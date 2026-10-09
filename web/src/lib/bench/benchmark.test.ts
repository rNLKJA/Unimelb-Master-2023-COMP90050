import { beforeAll, describe, expect, it } from "vitest";
import { databaseBytes } from "@/lib/db/stats";
import { LOUVRE_SUITE } from "@/lib/datasets/louvre/templates";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { louvreDb, smallDb, type LouvreFixture } from "@/lib/test/fixtures";
import { TPCH_SUITE } from "@/lib/workload/templates";
import {
  advisorOrder,
  replicatesToCsv,
  runReplicate,
  summarise,
  warmUp,
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

  it("runs the advisors in a seeded random order per replicate", () => {
    const ids = ["none", "autoadmin", "mab", "hindsight"];
    for (const r of results) {
      expect([...r.order].sort()).toEqual([...ids].sort());
      expect(r.order).toEqual(advisorOrder(["none", "autoadmin", "mab", "hindsight"], r.seed));
      // stored in the configured order whatever order they ran in
      expect(Object.keys(r.runs)).toEqual(ids);
    }
    expect(new Set(results.map((r) => r.order.join())).size).toBeGreaterThan(1);
    expect(() => warmUp(tpch, config)).not.toThrow();
  });

  it("records whether the hindsight reference was proven optimal", () => {
    for (const r of results) {
      expect(r.runs.hindsight!.reference?.optimal).toBe(true);
      expect(r.runs.hindsight!.reference!.nodes).toBeGreaterThan(0);
      expect(r.runs.mab!.reference).toBeUndefined();
    }
    expect(summarise(results).regret!.reference).toEqual({ proven: 6, of: 6 });
    const truncated = results.map((r, i) =>
      i === 0
        ? {
            ...r,
            runs: {
              ...r.runs,
              hindsight: { ...r.runs.hindsight!, reference: { optimal: false, nodes: 9 } },
            },
          }
        : r,
    );
    expect(summarise(truncated).regret!.reference).toEqual({ proven: 5, of: 6 });
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

  it("uses a pigeonhole bootstrap over sessions x seeds when there are several sessions", () => {
    const single = summarise(results);
    expect(single.sessions).toBe(1);
    expect(single.intervals).toBe("replicates");
    // Three "sessions" over the same seeds; the second and third run slower.
    const sessions = [0, 1, 2].flatMap((k) =>
      results.map((r) => ({
        ...r,
        session: k,
        runs: Object.fromEntries(
          Object.entries(r.runs).map(([id, run]) => [
            id,
            {
              ...run!,
              totals: {
                ...run!.totals,
                executionMs: run!.totals.executionMs * (1 + 0.1 * k),
                totalMs: run!.totals.totalMs + run!.totals.executionMs * 0.1 * k,
              },
            },
          ]),
        ),
      })),
    );
    const multi = summarise(sessions);
    expect(multi.sessions).toBe(3);
    expect(multi.replicates).toBe(6);
    expect(multi.intervals).toBe("sessions x workloads");
    expect(multi.seeds).toEqual([100, 101, 102, 103, 104, 105]);
    const none = (s: typeof multi) => s.advisors.find((a) => a.id === "none")!;
    expect(none(multi).n).toBe(18);
    expect(none(multi).mean.estimate).toBeCloseTo(
      sessions.reduce((t, r) => t + r.runs.none!.totals.totalMs, 0) / 18,
      9,
    );
    const width = (c: { lower: number; upper: number }) => c.upper - c.lower;
    expect(width(none(multi).mean)).toBeGreaterThan(width(none(single).mean));
    // tests run on the six workloads, each averaged over sessions
    const mab = multi.paired.find((p) => p.id === "mab")!;
    expect(mab.sign.wins + mab.sign.losses + mab.sign.ties).toBe(6);
    expect(multi.regret!.reference).toEqual({ proven: 18, of: 18 });
    // a seed missing from one session is dropped from all of them
    const gap = summarise(sessions.filter((r) => !(r.session === 2 && r.seed === 103)));
    expect(gap.seeds).toEqual([100, 101, 102, 104, 105]);
    expect(gap.advisors[0].n).toBe(15);
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
      "dataset,scenario,session,replicate,seed,advisor,run_position,recommendation_ms,creation_ms,execution_ms,total_ms,what_if_calls,final_bytes,final_indexes,reference_proven_optimal",
    );
    expect(lines).toHaveLength(1 + 6 * 4);
    const hindsight = lines.find((l) => l.includes(",hindsight,"))!;
    expect(hindsight.endsWith(",true")).toBe(true);
    const first = results[0];
    const mabRow = lines.find((l) => l.startsWith(`tpch,static,0,0,${first.seed},mab,`))!;
    expect(mabRow.split(",")[6]).toBe(String(first.order.indexOf("mab") + 1));
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
