/**
 * Reproduces the benchmark numbers quoted in docs/ (decision records and the
 * model card): both datasets, simulated and measured SQLite engines, the
 * static, shifting and HTAP workloads and the five-level drift sweep, with 10
 * seeded replicates of 25 rounds at a 200% budget.
 *
 *   pnpm bench:report     (takes about two minutes)
 *
 * Writes ../docs/benchmark-numbers.json. Measured times depend on the machine;
 * the file records Node's version and the platform it ran on.
 */
import { writeFileSync } from "node:fs";
import { arch, cpus, platform } from "node:os";
import { fileURLToPath } from "node:url";
import { it } from "vitest";
import { runReplicate, summarise, type BenchEnv, type BenchSummary } from "@/lib/bench/benchmark";
import { LOUVRE_SCHEMA } from "@/lib/datasets/louvre/schema";
import { LOUVRE_SUITE } from "@/lib/datasets/louvre/templates";
import { generateDatabase } from "@/lib/db/generate";
import { computeStats, databaseBytes } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { SqliteExecutor, loadDatabase } from "@/lib/engine/sqlite-executor";
import { louvreDb, sqlJs } from "@/lib/test/fixtures";
import { TPCH_SUITE } from "@/lib/workload/templates";

const OUT = fileURLToPath(new URL("../../docs/benchmark-numbers.json", import.meta.url));
const R = 10;
const SEED = 2023;

const ci = (x: { estimate: number; lower: number; upper: number }, d = 1) => ({
  estimate: Number(x.estimate.toFixed(d)),
  lower: Number(x.lower.toFixed(d)),
  upper: Number(x.upper.toFixed(d)),
});

function brief(s: BenchSummary) {
  return {
    replicates: s.replicates,
    meanMs: Object.fromEntries(s.advisors.map((a) => [a.id, ci(a.mean)])),
    speedupVsNone: Object.fromEntries(
      s.advisors.filter((a) => a.speedup).map((a) => [a.id, ci(a.speedup!, 3)]),
    ),
    componentsMs: Object.fromEntries(
      s.advisors.map((a) => [
        a.id,
        {
          recommendation: Number(a.recommendationMs.toFixed(1)),
          creation: Number(a.creationMs.toFixed(1)),
          execution: Number(a.executionMs.toFixed(1)),
        },
      ]),
    ),
    vsGreedy: Object.fromEntries(
      s.paired.map((p) => [
        p.id,
        {
          ratio: ci(p.ratio, 3),
          dz: Number(p.dz.toFixed(2)),
          wins: p.sign.wins,
          losses: p.sign.losses,
          ties: p.sign.ties,
          signTestP: Number(p.sign.p.toPrecision(3)),
        },
      ]),
    ),
    regret: s.regret ? { finalMs: ci(s.regret.final), relative: ci(s.regret.relative, 3) } : null,
  };
}

it("benchmark report", async () => {
  const fx = await louvreDb();
  const SQL = await sqlJs();
  const tpch = generateDatabase({ orders: 7_500, seed: SEED });
  const tstats = computeStats(tpch);
  const out: Record<string, unknown> = {
    generated: new Date().toISOString(),
    node: process.version,
    platform: `${platform()} ${arch()} (${cpus()[0]?.model ?? "unknown CPU"})`,
    settings: {
      replicates: R,
      firstSeed: SEED,
      rounds: 25,
      budget: "200% of data",
      advisors: ["none", "autoadmin", "mab", "hindsight"],
      bootstrap: "percentile, B = 2000, seed 90050",
      tpchScale: "S (7,500 orders, data seed 2023)",
    },
    results: {},
  };
  const results = out.results as Record<string, unknown>;
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
      const base = {
        drift: 0.5,
        rounds: 25,
        replicates: R,
        seed: SEED,
        budgetBytes: 2 * databaseBytes(stats),
        advisors: ["none", "autoadmin", "mab"] as ("none" | "autoadmin" | "mab")[],
        whatIfLatencyMs: 0.02,
        mabAlpha: 1,
      };
      const run = (scenario: "static" | "shifting" | "htap" | "drifting", drift = 0.5) =>
        Array.from({ length: R }, (_, r) => runReplicate(env, { ...base, scenario, drift }, r));
      for (const scenario of ["static", "shifting", "htap"] as const) {
        const rs = run(scenario);
        results[`${ds}/${engine}/${scenario}`] = {
          total: brief(summarise(rs)),
          buildRun: brief(summarise(rs, { metric: "buildRun" })),
        };
      }
      results[`${ds}/${engine}/drift-sweep`] = Object.fromEntries(
        [0, 0.25, 0.5, 0.75, 1].map((d) => [String(d), brief(summarise(run("drifting", d)))]),
      );
      sq?.close();
    }
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
}, 900_000);
