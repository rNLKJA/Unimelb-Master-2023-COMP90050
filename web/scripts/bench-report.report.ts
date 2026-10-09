/**
 * The benchmark behind the numbers quoted in docs/ (decision records and the
 * model card): both datasets, simulated and measured SQLite engines, the
 * static, shifting and HTAP workloads and the five-level drift sweep, with 10
 * seeded replicates of 25 rounds at a 200% budget.
 *
 *   pnpm bench:report     (scripts/bench-report.mjs; about 15 minutes)
 *
 * The driver runs this file once per session (BENCH_MODE=session), each time
 * in a fresh Node process, so the sessions differ the way two runs on the same
 * machine do (JIT, heap and machine state). Every session replays the same
 * workload seeds, with the advisors in a seeded random order per replicate
 * and one discarded warm-up replicate per dataset and engine. Then it runs
 * this file once more (BENCH_MODE=aggregate) to summarise every session
 * together, with a pigeonhole bootstrap over sessions x workload seeds, and
 * to record the range of each point estimate across sessions. That writes
 * ../docs/benchmark-numbers.json. Measured times depend on the machine; the
 * file records Node's version and the platform.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arch, cpus, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import { REFERENCE_NODE_LIMIT } from "@/lib/advisors/offline";
import {
  runReplicate,
  summarise,
  warmUp,
  type BenchConfig,
  type BenchEnv,
  type BenchSummary,
  type Metric,
  type ReplicateResult,
} from "@/lib/bench/benchmark";
import { LOUVRE_SCHEMA } from "@/lib/datasets/louvre/schema";
import { LOUVRE_SUITE } from "@/lib/datasets/louvre/templates";
import { generateDatabase } from "@/lib/db/generate";
import { computeStats, databaseBytes } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { SqliteExecutor, loadDatabase } from "@/lib/engine/sqlite-executor";
import type { BootstrapInterval } from "@/lib/stats";
import { louvreDb, sqlJs } from "@/lib/test/fixtures";
import { TPCH_SUITE } from "@/lib/workload/templates";

const OUT = fileURLToPath(new URL("../../docs/benchmark-numbers.json", import.meta.url));
const MODE = process.env.BENCH_MODE;
const DIR = process.env.BENCH_DIR ?? "";
const SESSION = Number(process.env.BENCH_SESSION ?? 0);
const R = 10;
const SEED = 2023;
const DRIFTS = [0, 0.25, 0.5, 0.75, 1];

interface SessionFile {
  session: number;
  started: string;
  node: string;
  platform: string;
  /** "tpch/sqlite/static", "tpch/sqlite/drift/0.25", … */
  results: Record<string, ReplicateResult[]>;
}

const machine = () => `${platform()} ${arch()} (${cpus()[0]?.model ?? "unknown CPU"})`;

it.runIf(MODE === "session")(
  "benchmark session",
  async () => {
    const fx = await louvreDb();
    const SQL = await sqlJs();
    const tpch = generateDatabase({ orders: 7_500, seed: SEED });
    const tstats = computeStats(tpch);
    const file: SessionFile = {
      session: SESSION,
      started: new Date().toISOString(),
      node: process.version,
      platform: machine(),
      results: {},
    };
    for (const ds of ["tpch", "louvre"] as const) {
      const stats = ds === "tpch" ? tstats : fx.stats;
      for (const engine of ["simulated", "sqlite"] as const) {
        const sq =
          engine === "sqlite"
            ? new SqliteExecutor(
                SQL,
                ds === "tpch" ? loadDatabase(SQL, tpch) : loadDatabase(SQL, fx.data, LOUVRE_SCHEMA),
              )
            : null;
        const env: BenchEnv = {
          stats,
          suite: ds === "tpch" ? TPCH_SUITE : LOUVRE_SUITE,
          pools: ds === "louvre" ? fx.pools : undefined,
          executor: (s) => sq ?? new ModelExecutor(new CostModel(stats), s),
        };
        const base: BenchConfig = {
          scenario: "static",
          drift: 0.5,
          rounds: 25,
          replicates: R,
          seed: SEED,
          budgetBytes: 2 * databaseBytes(stats),
          advisors: ["none", "autoadmin", "mab"],
          whatIfLatencyMs: 0.02,
          mabAlpha: 1,
        };
        warmUp(env, base);
        const run = (scenario: BenchConfig["scenario"], drift = 0.5) =>
          Array.from({ length: R }, (_, r) => ({
            ...runReplicate(env, { ...base, scenario, drift }, r),
            session: SESSION,
          }));
        for (const scenario of ["static", "shifting", "htap"] as const)
          file.results[`${ds}/${engine}/${scenario}`] = run(scenario);
        for (const d of DRIFTS) file.results[`${ds}/${engine}/drift/${d}`] = run("drifting", d);
        sq?.close();
      }
    }
    mkdirSync(DIR, { recursive: true });
    writeFileSync(path.join(DIR, `session-${SESSION}.json`), JSON.stringify(file));
  },
  900_000,
);

/* ---------- aggregate ---------- */

const round = (x: number, d: number) => Number(x.toFixed(d));

/** The pooled interval plus the range of the point estimate across sessions. */
function ci(pooled: BootstrapInterval, perSession: number[], d = 1) {
  return {
    estimate: round(pooled.estimate, d),
    lower: round(pooled.lower, d),
    upper: round(pooled.upper, d),
    sessionRange: [round(Math.min(...perSession), d), round(Math.max(...perSession), d)],
  };
}

function brief(all: ReplicateResult[], metric: Metric) {
  const s = summarise(all, { metric });
  const sessions = [...new Set(all.map((r) => r.session ?? 0))].sort((a, b) => a - b);
  const each: BenchSummary[] = sessions.map((k) =>
    summarise(
      all.filter((r) => (r.session ?? 0) === k),
      { metric },
    ),
  );
  const adv = (x: BenchSummary, id: string) => x.advisors.find((a) => a.id === id)!;
  const pair = (x: BenchSummary, id: string) => x.paired.find((p) => p.id === id)!;
  return {
    replicates: s.replicates,
    sessions: s.sessions,
    meanMs: Object.fromEntries(
      s.advisors.map((a) => [
        a.id,
        ci(
          a.mean,
          each.map((e) => adv(e, a.id).mean.estimate),
        ),
      ]),
    ),
    speedupVsNone: Object.fromEntries(
      s.advisors
        .filter((a) => a.speedup)
        .map((a) => [
          a.id,
          ci(
            a.speedup!,
            each.map((e) => adv(e, a.id).speedup!.estimate),
            3,
          ),
        ]),
    ),
    componentsMs: Object.fromEntries(
      s.advisors.map((a) => [
        a.id,
        {
          recommendation: round(a.recommendationMs, 1),
          creation: round(a.creationMs, 1),
          execution: round(a.executionMs, 1),
        },
      ]),
    ),
    vsGreedy: Object.fromEntries(
      s.paired.map((p) => [
        p.id,
        {
          ratio: ci(
            p.ratio,
            each.map((e) => pair(e, p.id).ratio.estimate),
            3,
          ),
          dz: round(p.dz, 2),
          wins: p.sign.wins,
          losses: p.sign.losses,
          ties: p.sign.ties,
          signTestP: Number(p.sign.p.toPrecision(3)),
        },
      ]),
    ),
    regret: s.regret
      ? {
          finalMs: ci(
            s.regret.final,
            each.map((e) => e.regret!.final.estimate),
          ),
          relative: ci(
            s.regret.relative,
            each.map((e) => e.regret!.relative.estimate),
            3,
          ),
          referenceProvenOptimal: s.regret.reference,
        }
      : null,
  };
}

it.runIf(MODE === "aggregate")("benchmark report", () => {
  const files = readdirSync(DIR)
    .filter((f) => /^session-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), "utf8")) as SessionFile)
    .sort((a, b) => a.session - b.session);
  if (files.length < 2) throw new Error(`Need at least two sessions in ${DIR}`);
  const keys = Object.keys(files[0].results);
  const pooled = (key: string) => files.flatMap((f) => f.results[key] ?? []);
  const results: Record<string, unknown> = {};
  for (const key of keys.filter((k) => !k.includes("/drift/")))
    results[key] = { total: brief(pooled(key), "total"), buildRun: brief(pooled(key), "buildRun") };
  for (const prefix of new Set(
    keys.filter((k) => k.includes("/drift/")).map((k) => k.split("/drift/")[0]),
  ))
    results[`${prefix}/drift-sweep`] = Object.fromEntries(
      DRIFTS.map((d) => [String(d), brief(pooled(`${prefix}/drift/${d}`), "total")]),
    );
  const out = {
    generated: new Date().toISOString(),
    node: files[0].node,
    platform: files[0].platform,
    settings: {
      replicates: R,
      sessions: files.length,
      firstSeed: SEED,
      rounds: 25,
      budget: "200% of data",
      advisors: ["none", "autoadmin", "mab", "hindsight"],
      tpchScale: "S (7,500 orders, data seed 2023)",
      protocol: `${files.length} independent sessions (a fresh Node process each), every one replaying workload seeds ${SEED} to ${SEED + R - 1}. Advisors run in a seeded random order per replicate, after one discarded warm-up replicate per dataset and engine.`,
      intervals: `95% pigeonhole percentile bootstrap over ${files.length} sessions x ${R} workload seeds (Owen 2007), B = 2000, seed 90050. sessionRange is the lowest and highest single-session point estimate. Sign tests, d_z and win counts use the ${R} workloads, each averaged over sessions.`,
      reference: `Hindsight reference: CoPhy branch and bound with a ${REFERENCE_NODE_LIMIT.toLocaleString("en-AU")}-node limit; referenceProvenOptimal counts the replicate runs where it proved optimality.`,
    },
    results,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
});
