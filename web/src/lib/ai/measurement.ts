/**
 * Linking an approved LLM proposal to what it was measured on. A proposal is
 * made for one set of settings (the data, the workload's scenario, seed and
 * rounds, the budget): the model saw that data and round 1 of that workload.
 * The arena and the benchmark keep a plan only while their settings still
 * match it, and the benchmark's measurement record says which settings the
 * proposal was made for and which it was measured on.
 */
import { summarise, type ReplicateResult } from "@/lib/bench/benchmark";
import { newId, type AuditEntry } from "./audit-log";
import type { Provider } from "./types";

/** The settings a proposal was made for (the worker's LlmContextRequest). */
export interface ProposalSettings {
  dataset: string;
  /** TPC-H-like scale; the Louvre data has one size. */
  scale: string;
  seed: number;
  scenario: string;
  /** Drifting scenario only. */
  drift: number;
  rounds: number;
  /** Storage budget as a fraction of the data. */
  budget: number;
}

export const proposalSettings = (c: ProposalSettings): ProposalSettings => ({
  dataset: c.dataset,
  scale: c.scale,
  seed: c.seed,
  scenario: c.scenario,
  drift: c.drift,
  rounds: c.rounds,
  budget: c.budget,
});

/** Would a run with settings `b` replay the data and workload a proposal for `a` was made from? */
export function sameProposalSettings(a: ProposalSettings, b: ProposalSettings): boolean {
  return (
    a.dataset === b.dataset &&
    a.budget === b.budget &&
    a.scenario === b.scenario &&
    a.rounds === b.rounds &&
    a.seed === b.seed &&
    (a.scenario !== "drifting" || a.drift === b.drift) &&
    (a.dataset !== "tpch" || a.scale === b.scale)
  );
}

export interface MeasuredBenchmark extends ProposalSettings {
  engine: string;
  advisors: readonly string[];
  /** A drift sweep (several workloads) rather than one scenario. */
  sweep: boolean;
  llm: {
    auditId: string;
    provider: Provider;
    model: string;
    request: ProposalSettings;
  } | null;
}

/**
 * The audit record for a finished benchmark that measured an approved
 * proposal, or null when there is nothing true to record: no plan, the LLM
 * advisor was not ticked, a drift sweep, or no paired comparison came out.
 */
export function measurementEntry(
  run: MeasuredBenchmark,
  results: readonly ReplicateResult[],
  budgetBytes: number,
  { id = newId(), at = new Date() }: { id?: string; at?: Date } = {},
): AuditEntry | null {
  const { llm } = run;
  if (!llm || run.sweep || !run.advisors.includes("llm")) return null;
  const rs = results.filter((r) => r.runs.llm);
  if (rs.length === 0) return null;
  const means = summarise(rs, { metric: "buildRun" });
  if (!means.advisors.some((a) => a.id === "llm")) return null;
  const comparisons = (["autoadmin", "mab"] as const).flatMap((b) => {
    const p = summarise(rs, { metric: "buildRun", baseline: b }).paired.find((x) => x.id === "llm");
    return p
      ? [
          {
            against: b,
            ratio: p.ratio.estimate,
            lower: p.ratio.lower,
            upper: p.ratio.upper,
            wins: p.sign.wins,
            losses: p.sign.losses,
          },
        ]
      : [];
  });
  if (comparisons.length === 0) return null;
  return {
    id,
    parentId: llm.auditId,
    kind: "measurement",
    timestamp: at.toISOString(),
    feature: "llm-index-advisor",
    provider: llm.provider,
    model: llm.model,
    input: {
      promptVersion: "measurement",
      dataset: run.dataset,
      scenario: run.scenario,
      seed: run.seed,
      rounds: run.rounds,
      budgetBytes,
      message: "",
    },
    output: {
      measurement: {
        dataset: run.dataset,
        engine: run.engine,
        scenario: run.scenario,
        replicates: means.replicates,
        seeds: means.seeds,
        metric: "build + run",
        advisors: means.advisors.map((a) => ({
          id: a.id,
          mean: a.mean.estimate,
          lower: a.mean.lower,
          upper: a.mean.upper,
        })),
        comparisons,
        proposedFor: llm.request,
        matchesProposal: sameProposalSettings(llm.request, run),
      },
    },
    latencyMs: 0,
    decision: "not-applicable",
  };
}
