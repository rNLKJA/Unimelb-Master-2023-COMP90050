import { describe, expect, it } from "vitest";
import { createAdvisor } from "@/lib/advisors/registry";
import { OfflineAdvisor } from "@/lib/advisors/offline";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { databaseBytes } from "@/lib/db/stats";
import { smallDb } from "@/lib/test/fixtures";
import { generateWorkload } from "@/lib/workload/scenarios";
import { runAdvisor } from "./run";

const { stats } = smallDb();

function run(id: Parameters<typeof createAdvisor>[0], scenario: "static" | "shifting" = "static") {
  const advisor = createAdvisor(id);
  const result = runAdvisor({
    advisor,
    rounds: generateWorkload({ scenario, rounds: 15, seed: 2, stats }).rounds,
    executor: new ModelExecutor(new CostModel(stats), 3),
    whatIf: new CostModel(stats),
    budgetBytes: 2 * databaseBytes(stats),
    whatIfLatencyMs: 0.01,
    seed: 2,
  });
  return { advisor, result };
}

describe("arena runner", () => {
  it("adds recommendation, creation and execution into the total", () => {
    const { result } = run("autoadmin");
    const t = result.totals;
    expect(t.totalMs).toBeCloseTo(t.recommendationMs + t.creationMs + t.executionMs, 9);
    expect(result.rounds).toHaveLength(15);
  });

  it("the no-index baseline only executes", () => {
    const { result } = run("none");
    expect(result.totals.creationMs).toBe(0);
    expect(result.totals.recommendationMs).toBeLessThan(0.5); // just the cost of asking
    expect(result.finalConfig).toEqual([]);
  });

  it("invokes an offline tool once on a static workload, at the start of round 2", () => {
    const { advisor, result } = run("db2advis");
    expect((advisor as OfflineAdvisor).invocations).toBe(1);
    expect(result.rounds.findIndex((r) => r.created.length > 0)).toBe(1);
    expect(result.rounds[0].config).toEqual([]);
  });

  it("re-invokes an offline tool after each workload shift", () => {
    const { advisor } = run("autoadmin", "shifting");
    expect((advisor as OfflineAdvisor).invocations).toBe(3);
  });

  it("is deterministic on the simulated engine", () => {
    const a = run("mab").result.rounds.map((r) => r.executionMs);
    const b = run("mab").result.rounds.map((r) => r.executionMs);
    expect(a).toEqual(b);
  });
});
