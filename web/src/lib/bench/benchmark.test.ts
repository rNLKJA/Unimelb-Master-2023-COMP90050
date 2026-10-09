import { beforeAll, describe, expect, it } from "vitest";
import { databaseBytes } from "@/lib/db/stats";
import { LOUVRE_SUITE } from "@/lib/datasets/louvre/templates";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { louvreDb, smallDb, type LouvreFixture } from "@/lib/test/fixtures";
import { TPCH_SUITE } from "@/lib/workload/templates";
import {
  replicatesToCsv,
  runReplicate,
  summarise,
  type BenchConfig,
  type BenchEnv,
  type ReplicateResult,
} from "./benchmark";

const { stats } = smallDb();
const tpch: BenchEnv = {
  stats,
  suite: TPCH_SUITE,
  executor: (seed) => new ModelExecutor(new CostModel(stats), seed),
  now: () => 0,
};
const config: BenchConfig = {
  scenario: "static",
  drift: 0.5,
  rounds: 12,
  replicates: 6,
  seed: 100,
  budgetBytes: 2 * databaseBytes(stats),
  advisors: ["none", "autoadmin", "mab"],
  whatIfLatencyMs: 0.02,
  mabAlpha: 1,
};

const runAll = (env: BenchEnv, cfg: BenchConfig) =>
  Array.from({ length: cfg.replicates }, (_, r) => runReplicate(env, cfg, r));

describe("benchmark replicates", () => {
  let results: ReplicateResult[];
  beforeAll(() => {
    results = runAll(tpch, config);
  });

  it("runs every advisor plus the hindsight reference on seeded workloads", () => {
    expect(results.map((r) => r.seed)).toEqual([100, 101, 102, 103, 104, 105]);
    for (const r of results)
      expect(Object.keys(r.runs).sort()).toEqual(["autoadmin", "hindsight", "mab", "none"]);
  });

  it("is reproducible: the same seed gives the same replicate", () => {
    expect(runReplicate(tpch, config, 2)).toEqual(results[2]);
  });

  it("charges the reference nothing for recommending, and it builds before round 1", () => {
    for (const r of results) {
      const h = r.runs.hindsight!;
      expect(h.totals.recommendationMs).toBe(0);
      expect(h.totals.whatIfCalls).toBe(0);
      expect(h.totals.creationMs).toBeGreaterThan(0);
      expect(h.finalConfig.length).toBeGreaterThan(0);
    }
  });

  it("summarises with paired comparisons against the greedy advisor", () => {
    const s = summarise(results);
    expect(s.replicates).toBe(6);
    const none = s.advisors.find((a) => a.id === "none")!;
    const greedy = s.advisors.find((a) => a.id === "autoadmin")!;
    expect(greedy.mean.estimate).toBeLessThan(none.mean.estimate);
    expect(greedy.mean.lower).toBeLessThanOrEqual(greedy.mean.estimate);
    expect(greedy.speedup!.estimate).toBeGreaterThan(1);
    const mab = s.paired.find((p) => p.id === "mab")!;
    expect(mab.against).toBe("autoadmin");
    expect(mab.n).toBe(6);
    expect(mab.ratio.estimate).toBeCloseTo(
      s.advisors.find((a) => a.id === "mab")!.mean.estimate / greedy.mean.estimate,
      10,
    );
    expect(mab.sign.wins + mab.sign.losses + mab.sign.ties).toBe(6);
    expect(s.paired.some((p) => p.id === "hindsight")).toBe(false);
  });

  it("reports the bandit's regret against the hindsight reference", () => {
    const s = summarise(results);
    expect(s.regret!.curve.estimate).toHaveLength(12);
    expect(s.regret!.final.estimate).toBeCloseTo(s.regret!.curve.estimate[11], 9);
    // round 1: the reference pays for all of its indexes up front while the
    // bandit runs unindexed, so the regret curve starts below zero
    const first = results.map((r) => r.runs.mab!.perRound[0] - r.runs.hindsight!.perRound[0]);
    expect(s.regret!.curve.estimate[0]).toBeCloseTo(first.reduce((a, b) => a + b) / 6, 9);
    expect(s.regret!.curve.estimate[0]).toBeLessThan(0);
    expect(s.regret!.relative.estimate).toBeCloseTo(
      s.regret!.final.estimate /
        (results.reduce((a, r) => a + r.runs.hindsight!.totals.totalMs, 0) / 6),
      9,
    );
  });

  it("excludes recommendation time in the build + run metric", () => {
    const total = summarise(results, { metric: "total" });
    const buildRun = summarise(results, { metric: "buildRun" });
    const g = (s: typeof total) => s.advisors.find((a) => a.id === "autoadmin")!.mean.estimate;
    expect(g(buildRun)).toBeLessThan(g(total));
  });

  it("exports one CSV row per replicate and advisor", () => {
    const csv = replicatesToCsv(results, { dataset: "tpch", scenario: "static" });
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "dataset,scenario,replicate,seed,advisor,recommendation_ms,creation_ms,execution_ms,total_ms,what_if_calls,final_bytes,final_indexes",
    );
    expect(lines).toHaveLength(1 + 6 * 4);
  });
});

describe("benchmark on the Louvre dataset", () => {
  let fx: LouvreFixture;
  beforeAll(async () => {
    fx = await louvreDb();
  });

  it("runs the same advisors and charges an LLM proposal's latency once", () => {
    const env: BenchEnv = {
      stats: fx.stats,
      pools: fx.pools,
      suite: LOUVRE_SUITE,
      executor: (seed) => new ModelExecutor(new CostModel(fx.stats), seed),
      now: () => 0,
    };
    const cfg: BenchConfig = {
      ...config,
      replicates: 3,
      budgetBytes: 2 * databaseBytes(fx.stats),
      advisors: ["none", "autoadmin", "mab", "llm"],
      llm: {
        config: [
          { table: "wing_scan", columns: ["wing_id", "scanned_at"] },
          { table: "wing_scan", columns: ["ticket_id"] },
        ],
        latencyMs: 1500,
      },
    };
    const results = runAll(env, cfg);
    for (const r of results) {
      const llm = r.runs.llm!;
      expect(llm.totals.recommendationMs).toBe(1500);
      expect(llm.finalConfig).toEqual(["wing_scan(wing_id, scanned_at)", "wing_scan(ticket_id)"]);
      expect(llm.perRound[0]).toBeCloseTo(r.runs.none!.perRound[0], 9); // round 1 runs unindexed
    }
    const s = summarise(results, { metric: "buildRun" });
    expect(s.paired.map((p) => p.id).sort()).toEqual(["llm", "mab", "none"]);
    const llm = s.advisors.find((a) => a.id === "llm")!;
    expect(llm.speedup!.estimate).toBeGreaterThan(1);
  });

  it("drift moves the workload from static to shifting", () => {
    const env: BenchEnv = {
      stats: fx.stats,
      pools: fx.pools,
      suite: LOUVRE_SUITE,
      executor: (seed) => new ModelExecutor(new CostModel(fx.stats), seed),
      now: () => 0,
    };
    const at = (drift: number) =>
      runReplicate(
        env,
        {
          ...config,
          scenario: "drifting",
          drift,
          replicates: 1,
          budgetBytes: 2 * databaseBytes(fx.stats),
        },
        0,
      );
    const still = at(0).runs.none!.totals.executionMs;
    const moving = at(1).runs.none!.totals.executionMs;
    expect(still).not.toBeCloseTo(moving, 3);
  });
});
