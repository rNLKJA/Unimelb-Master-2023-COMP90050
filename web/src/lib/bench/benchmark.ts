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
 */
import { createAdvisor, type AdvisorExtras } from "@/lib/advisors/registry";
import { DEFAULT_MAB } from "@/lib/advisors/mab/mab-advisor";
import { toCsv } from "@/lib/csv";
import type { AdvisorId } from "@/lib/advisors/types";
import { runAdvisor, type RunTotals } from "@/lib/arena/run";
import type { DatabaseStats } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import type { Executor } from "@/lib/engine/executor";
import { indexId, type IndexDef } from "@/lib/engine/types";
import {
  cohensDz,
  mean,
  meanBootstrap,
  meanCurveBootstrap,
  pairedMeanDiffBootstrap,
  pairedRatioBootstrap,
  pairedSignTest,
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
}

export interface ReplicateResult {
  replicate: number;
  seed: number;
  runs: Partial<Record<AdvisorId, AdvisorRun>>;
}

export const replicateSeed = (base: number, r: number) => base + r;

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
  const runs: ReplicateResult["runs"] = {};
  for (const id of ids) {
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
    runs[id] = {
      totals: result.totals,
      perRound: result.rounds.map((x) => x.recommendationMs + x.creationMs + x.executionMs),
      finalConfig: result.finalConfig.map(indexId),
    };
  }
  return { replicate: r, seed, runs };
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
}

export interface BenchSummary {
  metric: Metric;
  replicates: number;
  seeds: number[];
  bootstrap: { B: number; seed: number };
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
  const values = (id: AdvisorId) => complete.map((r) => metricOf(r.runs[id]!.totals, metric));
  const component = (id: AdvisorId, f: (t: RunTotals) => number) =>
    mean(complete.map((r) => f(r.runs[id]!.totals)));
  const none = ids.includes("none") ? values("none") : null;

  const advisors: AdvisorSummary[] = ids.map((id) => {
    const v = values(id);
    return {
      id,
      n: v.length,
      values: v,
      mean: meanBootstrap(v, boot),
      sd: sd(v),
      recommendationMs: component(id, (t) => t.recommendationMs),
      creationMs: component(id, (t) => t.creationMs),
      executionMs: component(id, (t) => t.executionMs),
      speedup: none && id !== "none" ? pairedRatioBootstrap(none, v, boot) : null,
    };
  });

  const paired: PairedSummary[] = ids.includes(baseline)
    ? ids
        .filter((id) => id !== baseline && id !== "hindsight")
        .map((id) => {
          const a = values(id);
          const b = values(baseline);
          const sign = pairedSignTest(a, b);
          return {
            id,
            against: baseline,
            n: a.length,
            difference: pairedMeanDiffBootstrap(a, b, boot),
            ratio: pairedRatioBootstrap(a, b, boot),
            dz: cohensDz(a, b),
            sign,
            winShare: wilson(sign.wins, sign.wins + sign.losses),
          };
        })
    : [];

  let regret: RegretSummary | null = null;
  if (ids.includes(learner) && ids.includes("hindsight") && complete.length > 0) {
    const curves = complete.map((r) => {
      const l = r.runs[learner]!;
      const h = r.runs.hindsight!;
      return cumulative(l.perRound.map((x, i) => x - h.perRound[i]));
    });
    const finals = curves.map((c) => c.at(-1) ?? 0);
    const refTotals = complete.map((r) => r.runs.hindsight!.totals.totalMs);
    const curve = meanCurveBootstrap(curves, boot);
    regret = {
      id: learner,
      final: meanBootstrap(finals, boot),
      relative: pairedRatioBootstrap(finals, refTotals, boot),
      curve: { estimate: curve.estimate, lower: curve.lower, upper: curve.upper },
    };
  }

  return {
    metric,
    replicates: complete.length,
    seeds: complete.map((r) => r.seed),
    bootstrap: boot,
    advisors,
    paired,
    regret,
  };
}

/* ---------- export ---------- */

export const CSV_COLUMNS = [
  "replicate",
  "seed",
  "advisor",
  "recommendation_ms",
  "creation_ms",
  "execution_ms",
  "total_ms",
  "what_if_calls",
  "final_bytes",
  "final_indexes",
] as const;

/** One row per replicate and advisor. */
export function replicatesToCsv(results: ReplicateResult[], context: Record<string, string> = {}) {
  const extra = Object.keys(context);
  return toCsv(
    [...extra, ...CSV_COLUMNS],
    results.flatMap((r) =>
      (Object.entries(r.runs) as [AdvisorId, AdvisorRun][]).map(([id, run]) => [
        ...extra.map((k) => context[k]),
        r.replicate,
        r.seed,
        id,
        run.totals.recommendationMs,
        run.totals.creationMs,
        run.totals.executionMs,
        run.totals.totalMs,
        run.totals.whatIfCalls,
        run.totals.finalBytes,
        run.finalConfig.join(" | "),
      ]),
    ),
  );
}
