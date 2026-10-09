import { beforeAll, describe, expect, it } from "vitest";
import {
  runReplicate,
  type BenchConfig,
  type BenchEnv,
  type ReplicateResult,
} from "@/lib/bench/benchmark";
import { databaseBytes } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { smallDb } from "@/lib/test/fixtures";
import { TPCH_SUITE } from "@/lib/workload/templates";
import {
  measurementEntry,
  proposalSettings,
  sameProposalSettings,
  type MeasuredBenchmark,
  type ProposalSettings,
} from "./measurement";

const { stats } = smallDb();
const env: BenchEnv = {
  stats,
  suite: TPCH_SUITE,
  executor: (seed) => new ModelExecutor(new CostModel(stats), seed),
  now: () => 0,
};
const request: ProposalSettings = {
  dataset: "tpch",
  scale: "s",
  seed: 100,
  scenario: "static",
  drift: 0.5,
  rounds: 8,
  budget: 2,
};
const base: BenchConfig = {
  scenario: "static",
  drift: 0.5,
  rounds: 8,
  replicates: 4,
  seed: 100,
  budgetBytes: 2 * databaseBytes(stats),
  advisors: ["none", "autoadmin", "mab"],
  whatIfLatencyMs: 0.02,
  mabAlpha: 1,
  llm: { config: [{ table: "orders", columns: ["o_custkey"] }], latencyMs: 1200 },
};
const run = (advisors: BenchConfig["advisors"]) =>
  Array.from({ length: 4 }, (_, r) => runReplicate(env, { ...base, advisors }, r));
const measured = (over: Partial<MeasuredBenchmark> = {}): MeasuredBenchmark => ({
  ...request,
  engine: "simulated",
  advisors: ["none", "autoadmin", "mab", "llm"],
  sweep: false,
  llm: { auditId: "call-1", provider: "anthropic", model: "claude-haiku-4-5", request },
  ...over,
});

describe("LLM measurement records", () => {
  let withLlm: ReplicateResult[];
  let withoutLlm: ReplicateResult[];
  beforeAll(() => {
    withLlm = run(["none", "autoadmin", "mab", "llm"]);
    withoutLlm = run(["none", "autoadmin", "mab"]);
  });

  it("links a real measurement to its call, with the settings it was made for", () => {
    const e = measurementEntry(measured(), withLlm, 123, {
      id: "m1",
      at: new Date("2026-10-09T00:00:00Z"),
    })!;
    expect(e).toMatchObject({ id: "m1", parentId: "call-1", kind: "measurement" });
    const m = e.output.measurement!;
    expect(m.comparisons.map((c) => c.against)).toEqual(["autoadmin", "mab"]);
    expect(m.advisors.map((a) => a.id)).toContain("llm");
    expect(m.replicates).toBe(4);
    expect(m.proposedFor).toEqual(request);
    expect(m.matchesProposal).toBe(true);
  });

  it("records nothing when the LLM advisor did not run (accept, untick, run)", () => {
    const unticked = measured({ advisors: ["none", "autoadmin", "mab"] });
    expect(measurementEntry(unticked, withoutLlm, 123)).toBeNull();
    // even if the plan is set and the advisor list still says llm, no llm runs means no record
    expect(measurementEntry(measured(), withoutLlm, 123)).toBeNull();
    expect(measurementEntry(measured({ sweep: true }), withLlm, 123)).toBeNull();
    expect(measurementEntry(measured({ llm: null }), withLlm, 123)).toBeNull();
  });

  it("flags a measurement on settings the model did not see", () => {
    const e = measurementEntry(measured({ seed: 101 }), withLlm, 123)!;
    expect(e.output.measurement!.matchesProposal).toBe(false);
  });

  it("matches proposal settings on data, workload and budget only", () => {
    expect(sameProposalSettings(request, { ...request })).toBe(true);
    for (const change of [
      { dataset: "louvre" },
      { scale: "m" },
      { seed: 7 },
      { scenario: "shifting" },
      { rounds: 30 },
      { budget: 1 },
    ])
      expect(sameProposalSettings(request, { ...request, ...change }), JSON.stringify(change)).toBe(
        false,
      );
    // drift only matters for the drifting scenario, scale only for TPC-H
    expect(sameProposalSettings(request, { ...request, drift: 0.9 })).toBe(true);
    const drifting = { ...request, scenario: "drifting" };
    expect(sameProposalSettings(drifting, { ...drifting, drift: 0.9 })).toBe(false);
    const louvre = { ...request, dataset: "louvre" };
    expect(sameProposalSettings(louvre, { ...louvre, scale: "l" })).toBe(true);
    expect(proposalSettings({ ...request, extra: 1 } as ProposalSettings)).toEqual(request);
  });
});
