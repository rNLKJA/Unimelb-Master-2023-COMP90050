/**
 * The advisor benchmark: R replicate runs per advisor, each on its own seeded
 * workload, with every advisor replaying the same workload inside a replicate
 * (common random numbers, so comparisons are paired). Summaries are computed
 * from the replicate totals:
 *
 * - mean cumulative workload time per advisor, with a percentile-bootstrap
 *   95% interval over replicates;
 * - paired comparisons against a baseline advisor (default: AutoAdmin's greedy
 *   what-if search): mean difference and ratio of means, both with
 *   pair-resampling bootstrap intervals, Cohen's d_z, an exact sign test and
 *   the share of replicates won with a Wilson interval;
 * - the bandit's regret: cumulative time above the hindsight reference
 *   (HindsightAdvisor), per round, with pointwise bootstrap bands.
 *
 * The metric is total workload time = recommendation + index creation +
 * execution, as in the arena. "Build + run" (creation + execution) is reported
 * too, because an LLM's recommendation time is mostly network and provider
 * latency rather than anything about its advice.
 *
 * Inside a replicate the advisors run in a seeded random order, so no advisor
 * always runs first on a cold engine, and callers run one discarded warm-up
 * replicate (`warmUp`) before timing anything.
 *
 * What the intervals cover depends on the data. From one session (one browser
 * worker, as on /benchmark) they resample replicates, so they describe
 * workload-to-workload variation in that session only: re-running the same
 * seeds in a fresh session moves the timings by more than that, because
 * machine, JIT and heap state change between runs. When results carry several
 * `session` numbers (`pnpm bench:report` runs independent processes over the
 * same seeds), `summarise` uses a pigeonhole bootstrap over sessions x
 * workload seeds, which includes run-to-run variation.
 */
import { createAdvisor, type AdvisorExtras } from "@/lib/advisors/registry";
import { DEFAULT_MAB } from "@/lib/advisors/mab/mab-advisor";
import { HindsightAdvisor } from "@/lib/advisors/offline";
import { toCsv } from "@/lib/csv";
import type { AdvisorId } from "@/lib/advisors/types";
import { runAdvisor, type RunTotals } from "@/lib/arena/run";
import type { DatabaseStats } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import type { Executor } from "@/lib/engine/executor";
import { indexId, type IndexDef } from "@/lib/engine/types";
import { deriveSeed, mulberry32, shuffle } from "@/lib/random";
import {
  bootstrapCI,
  cohensDz,
  mean,
  pairedSignTest,
  pigeonholeBootstrapCI,
  sd,
  STATS_SEED,
  wilson,
  type BootstrapInterval,
  type ProportionInterval,
  type SignTestResult,
} from "@/lib/stats";
import { generateWorkload, type ScenarioId } from "@/lib/workload/scenarios";
import type { ValuePools, WorkloadSuite } from "@/lib/workload/types";

export type Metric = "total" | "buildRun";

export const METRIC_LABEL: Record<Metric, string> = {
  total: "Total (recommend + build + run)",
  buildRun: "Build + run (no recommendation time)",
};

export interface BenchConfig {
  scenario: ScenarioId;
  /** Drifting scenario only. */
  drift: number;
  rounds: number;
  replicates: number;
  /** Replicate r runs workload seed `seed + r`. */
  seed: number;
  /** Storage budget in bytes. */
  budgetBytes: number;
  /** Contenders (the hindsight reference is always added for regret). */
  advisors: AdvisorId[];
  whatIfLatencyMs: number;
  mabAlpha: number;
  llm?: { config: IndexDef[]; latencyMs: number };
}

export interface BenchEnv {
  stats: DatabaseStats;
  suite: WorkloadSuite;
  pools?: ValuePools;
  /** A fresh (or reset) engine for one replicate; `seed` drives the simulated engine's noise. */
  executor: (seed: number) => Executor;
  now?: () => number;
}

export interface AdvisorRun {
  totals: RunTotals;
  /** Per-round total time (recommendation + creation + execution). */
  perRound: number[];
  finalConfig: string[];
  /** The hindsight reference only: whether branch and bound proved its configuration optimal. */
  reference?: { optimal: boolean; nodes: number };
}

export interface ReplicateResult {
  replicate: number;
  seed: number;
  /** Independent session (fresh process or worker) the replicate ran in; absent means 0. */
  session?: number;
  /** The order the advisors ran in, a seeded shuffle per replicate. */
  order: AdvisorId[];
  runs: Partial<Record<AdvisorId, AdvisorRun>>;
}

export const replicateSeed = (base: number, r: number) => base + r;

/** The seeded order advisors run in on one replicate, so position effects average out. */
export function advisorOrder(ids: readonly AdvisorId[], seed: number): AdvisorId[] {
  return shuffle(mulberry32(deriveSeed(seed, "advisor-order")), ids);
}

/**
 * One discarded replicate (workload seed `seed - 1`, which no measured
 * replicate uses) so the WebAssembly and JavaScript JITs and SQLite's caches
 * are warm before anything is timed.
 */
export function warmUp(env: BenchEnv, cfg: BenchConfig): void {
  runReplicate(env, cfg, -1);
}

/** Run every advisor (and the hindsight reference) on replicate `r`'s workload. */
export function runReplicate(env: BenchEnv, cfg: BenchConfig, r: number): ReplicateResult {
  const seed = replicateSeed(cfg.seed, r);
  const workload = generateWorkload({
    scenario: cfg.scenario,
    rounds: cfg.rounds,
    seed,
    stats: env.stats,
    suite: env.suite,
    pools: env.pools,
    drift: cfg.drift,
  });
  const executor = env.executor(seed);
  const extras: AdvisorExtras = { llm: cfg.llm, workload: workload.rounds.flat() };
  const ids = [...new Set<AdvisorId>([...cfg.advisors, "hindsight"])];
  const order = advisorOrder(ids, seed);
  const ran = new Map<AdvisorId, AdvisorRun>();
  for (const id of order) {
    const advisor = createAdvisor(id, { ...DEFAULT_MAB, alpha: cfg.mabAlpha }, extras);
    const result = runAdvisor({
      advisor,
      rounds: workload.rounds,
      executor,
      whatIf: new CostModel(env.stats),
      budgetBytes: cfg.budgetBytes,
      whatIfLatencyMs: cfg.whatIfLatencyMs,
      seed,
      now: env.now,
    });
    ran.set(id, {
      totals: result.totals,
      perRound: result.rounds.map((x) => x.recommendationMs + x.creationMs + x.executionMs),
      finalConfig: result.finalConfig.map(indexId),
      ...(advisor instanceof HindsightAdvisor
        ? { reference: { optimal: advisor.optimal === true, nodes: advisor.nodes } }
        : {}),
    });
  }
  // Stored in the configured order, whatever order they ran in.
  const runs: ReplicateResult["runs"] = {};
  for (const id of ids) runs[id] = ran.get(id);
  return { replicate: r, seed, order, runs };
}

export const metricOf = (t: RunTotals, metric: Metric) =>
  metric === "total" ? t.totalMs : t.creationMs + t.executionMs;

export interface AdvisorSummary {
  id: AdvisorId;
  n: number;
  values: number[];
  mean: BootstrapInterval;
  sd: number;
  /** Mean of each component over replicates. */
  recommendationMs: number;
  creationMs: number;
  executionMs: number;
  /** Mean speed-up over no index (ratio of means, pairs resampled), when "none" ran. */
  speedup: BootstrapInterval | null;
}

export interface PairedSummary {
  id: AdvisorId;
  against: AdvisorId;
  n: number;
  /** mean(id - against), ms: negative means `id` was faster. */
  difference: BootstrapInterval;
  /** mean(id) / mean(against): below 1 means `id` was faster. */
  ratio: BootstrapInterval;
  /** Cohen's d_z of the paired differences. */
  dz: number;
  sign: SignTestResult;
  /** Share of replicates where `id` was faster, ties excluded. */
  winShare: ProportionInterval;
}

/** Regret is always on total time (recommendation + creation + execution). */
export interface RegretSummary {
  id: AdvisorId;
  /** Final cumulative regret over the hindsight reference, ms. */
  final: BootstrapInterval;
  /** Final regret as a share of the reference's total. */
  relative: BootstrapInterval;
  /** Mean cumulative regret per round, with pointwise 95% bands. */
  curve: { estimate: number[]; lower: number[]; upper: number[] };
  /**
   * In how many replicate runs branch and bound proved the reference optimal.
   * When `proven < of`, regret is against the best configuration found.
   */
  reference: { proven: number; of: number };
}

/**
 * "replicates": percentile bootstrap over the replicates of one session.
 * "sessions x workloads": pigeonhole bootstrap over independent sessions and
 * workload seeds (see the module comment).
 */
export type IntervalMethod = "replicates" | "sessions x workloads";

export interface BenchSummary {
  metric: Metric;
  /** Workload seeds (replicates per session). */
  replicates: number;
  /** Independent sessions (1 in the browser). */
  sessions: number;
  seeds: number[];
  bootstrap: { B: number; seed: number };
  intervals: IntervalMethod;
  advisors: AdvisorSummary[];
  paired: PairedSummary[];
  regret: RegretSummary | null;
}

function cumulative(xs: number[]): number[] {
  let acc = 0;
  return xs.map((x) => (acc += x));
}

export interface SummaryOptions {
  metric?: Metric;
  baseline?: AdvisorId;
  /** Advisor whose regret is reported (default the bandit). */
  learner?: AdvisorId;
  B?: number;
  seed?: number;
}

export function summarise(
  results: ReplicateResult[],
  {
    metric = "total",
    baseline = "autoadmin",
    learner = "mab",
    B = 2000,
    seed = STATS_SEED,
  }: SummaryOptions = {},
): BenchSummary {
  const boot = { B, seed };
  const ids = [...new Set(results.flatMap((r) => Object.keys(r.runs) as AdvisorId[]))];
  // Only replicates where every advisor finished, so every comparison is paired.
  const complete = results.filter((r) => ids.every((id) => r.runs[id]));
  const sessionIds = [...new Set(complete.map((r) => r.session ?? 0))].sort((a, b) => a - b);

  // The units, and how to resample them. One session: its replicates. Several:
  // a sessions x seeds grid (seeds every session completed), row by row.
  let units: ReplicateResult[] = complete;
  let seeds = complete.map((r) => r.seed);
  let grid: { rows: number; cols: number } | null = null;
  if (sessionIds.length > 1) {
    const of = (s: number) => complete.filter((r) => (r.session ?? 0) === s);
    const shared = sessionIds
      .map((s) => new Set(of(s).map((r) => r.seed)))
      .reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
    seeds = [...shared].sort((a, b) => a - b);
    units = sessionIds.flatMap((s) => seeds.map((x) => of(s).find((r) => r.seed === x)!));
    grid = { rows: sessionIds.length, cols: seeds.length };
  }
  const n = units.length;
  const resample = (stat: (idx: Int32Array) => number): BootstrapInterval =>
    grid ? pigeonholeBootstrapCI(grid.rows, grid.cols, stat, boot) : bootstrapCI(n, stat, boot);
  const meanStat = (xs: readonly number[]) => (idx: Int32Array) => {
    let t = 0;
    for (let i = 0; i < idx.length; i++) t += xs[idx[i]];
    return t / idx.length;
  };
  const diffStat = (a: readonly number[], b: readonly number[]) => (idx: Int32Array) => {
    let t = 0;
    for (let i = 0; i < idx.length; i++) t += a[idx[i]] - b[idx[i]];
    return t / idx.length;
  };
  const ratioStat = (a: readonly number[], b: readonly number[]) => (idx: Int32Array) => {
    let ta = 0;
    let tb = 0;
    for (let i = 0; i < idx.length; i++) {
      ta += a[idx[i]];
      tb += b[idx[i]];
    }
    return ta / tb;
  };
  // Tests and win shares need independent pairs: with several sessions, each
  // workload seed's values are averaged over the sessions first.
  const perSeed = (xs: number[]) =>
    grid ? seeds.map((_, j) => mean(sessionIds.map((_, i) => xs[i * grid!.cols + j]))) : xs;

  const values = (id: AdvisorId) => units.map((r) => metricOf(r.runs[id]!.totals, metric));
  const component = (id: AdvisorId, f: (t: RunTotals) => number) =>
    mean(units.map((r) => f(r.runs[id]!.totals)));
  const none = ids.includes("none") ? values("none") : null;

  const advisors: AdvisorSummary[] = ids.map((id) => {
    const v = values(id);
    return {
      id,
      n: v.length,
      values: v,
      mean: resample(meanStat(v)),
      sd: sd(v),
      recommendationMs: component(id, (t) => t.recommendationMs),
      creationMs: component(id, (t) => t.creationMs),
      executionMs: component(id, (t) => t.executionMs),
      speedup: none && id !== "none" ? resample(ratioStat(none, v)) : null,
    };
  });

  const paired: PairedSummary[] = ids.includes(baseline)
    ? ids
        .filter((id) => id !== baseline && id !== "hindsight")
        .map((id) => {
          const a = values(id);
          const b = values(baseline);
          const sign = pairedSignTest(perSeed(a), perSeed(b));
          return {
            id,
            against: baseline,
            n: a.length,
            difference: resample(diffStat(a, b)),
            ratio: resample(ratioStat(a, b)),
            dz: cohensDz(perSeed(a), perSeed(b)),
            sign,
            winShare: wilson(sign.wins, sign.wins + sign.losses),
          };
        })
    : [];

  let regret: RegretSummary | null = null;
  if (ids.includes(learner) && ids.includes("hindsight") && n > 0) {
    const curves = units.map((r) => {
      const l = r.runs[learner]!;
      const h = r.runs.hindsight!;
      return cumulative(l.perRound.map((x, i) => x - h.perRound[i]));
    });
    const finals = curves.map((c) => c.at(-1) ?? 0);
    const refTotals = units.map((r) => r.runs.hindsight!.totals.totalMs);
    const width = Math.min(...curves.map((c) => c.length));
    const curve = { estimate: [] as number[], lower: [] as number[], upper: [] as number[] };
    for (let j = 0; j < width; j++) {
      const ci = resample(meanStat(curves.map((c) => c[j])));
      curve.estimate.push(ci.estimate);
      curve.lower.push(ci.lower);
      curve.upper.push(ci.upper);
    }
    regret = {
      id: learner,
      final: resample(meanStat(finals)),
      relative: resample(ratioStat(finals, refTotals)),
      curve,
      reference: {
        // Runs from before the flag existed count as unproven.
        proven: units.filter((r) => r.runs.hindsight!.reference?.optimal === true).length,
        of: n,
      },
    };
  }

  return {
    metric,
    replicates: grid ? grid.cols : n,
    sessions: grid ? grid.rows : sessionIds.length,
    seeds,
    bootstrap: boot,
    intervals: grid ? "sessions x workloads" : "replicates",
    advisors,
    paired,
    regret,
  };
}

/* ---------- export ---------- */

export const CSV_COLUMNS = [
  "session",
  "replicate",
  "seed",
  "advisor",
  "run_position",
  "recommendation_ms",
  "creation_ms",
  "execution_ms",
  "total_ms",
  "what_if_calls",
  "final_bytes",
  "final_indexes",
  "reference_proven_optimal",
] as const;

/** One row per replicate and advisor. */
export function replicatesToCsv(results: ReplicateResult[], context: Record<string, string> = {}) {
  const extra = Object.keys(context);
  return toCsv(
    [...extra, ...CSV_COLUMNS],
    results.flatMap((r) =>
      (Object.entries(r.runs) as [AdvisorId, AdvisorRun][]).map(([id, run]) => [
        ...extra.map((k) => context[k]),
        r.session ?? 0,
        r.replicate,
        r.seed,
        id,
        r.order.indexOf(id) + 1,
        run.totals.recommendationMs,
        run.totals.creationMs,
        run.totals.executionMs,
        run.totals.totalMs,
        run.totals.whatIfCalls,
        run.totals.finalBytes,
        run.finalConfig.join(" | "),
        run.reference ? run.reference.optimal : null,
      ]),
    ),
  );
}
