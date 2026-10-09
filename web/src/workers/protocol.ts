import type { AdvisorId } from "@/lib/advisors/types";
import type { MabRoundTrace } from "@/lib/advisors/mab/mab-advisor";
import type { LlmContext } from "@/lib/ai/index-advisor";
import type { Provider } from "@/lib/ai/types";
import type { RoundRecord, RunTotals } from "@/lib/arena/run";
import type { ReplicateResult } from "@/lib/bench/benchmark";
import type { WhatIfReport } from "@/lib/console/what-if";
import type { DatasetId } from "@/lib/datasets/registry";
import type { ScalePreset } from "@/lib/db/schema";
import type { PlanNode } from "@/lib/engine/explain";
import type { IndexDef } from "@/lib/engine/types";
import type { ForecastSettings, ForecastView } from "@/lib/forecast/view";
import type { ScenarioId, Phase } from "@/lib/workload/scenarios";

export type EngineKind = "sqlite" | "simulated";

/** A validated LLM proposal, ready to be built by the arena. */
export interface LlmPlan {
  config: IndexDef[];
  /** Provider response time, charged as recommendation time. */
  latencyMs: number;
  /** The audit-log record it came from. */
  auditId: string;
  /** "claude-haiku-4-5" etc. (the model that answered). */
  model: string;
  provider: Provider;
}

export interface ArenaConfig {
  dataset: DatasetId;
  engine: EngineKind;
  /** TPC-H-like only (the Louvre file has a fixed size). */
  scale: ScalePreset["id"];
  seed: number;
  scenario: ScenarioId;
  /** Drifting scenario: focused share of each round, 0 (static) to 1 (shifting). */
  drift: number;
  rounds: number;
  /** Storage budget as a fraction of the data size. */
  budget: number;
  advisors: AdvisorId[];
  whatIfLatencyMs: number;
  skipScan: boolean;
  mabAlpha: number;
  /** Required when `advisors` includes "llm". */
  llm: LlmPlan | null;
}

/** The benchmark: the arena's settings plus replicates and an optional drift sweep. */
export interface BenchRunConfig extends ArenaConfig {
  replicates: number;
  /** Drift levels to sweep (runs the drifting scenario at each), or null for one scenario. */
  sweep: number[] | null;
}

/** What the worker needs to build the LLM's context: the same data and round 1 the arena would run. */
export type LlmContextRequest = Pick<
  ArenaConfig,
  "dataset" | "scale" | "seed" | "scenario" | "drift" | "rounds" | "budget"
>;

export interface DatabaseInfo {
  dataset: DatasetId;
  rows: Record<string, number>;
  dataBytes: number;
  sqliteVersion: string | null;
  loadMs: number;
}

export interface WorkloadSummary {
  phases: Phase[];
  perRound: number[];
  templates: { id: string; title: string; count: number }[];
  sample: { template: string; sql: string }[];
}

export type LabRequest =
  | { type: "arena:run"; config: ArenaConfig }
  | { type: "bench:run"; config: BenchRunConfig }
  | { type: "llm:context"; request: LlmContextRequest }
  | { type: "console:open"; scale: ScalePreset["id"]; seed: number }
  | { type: "console:exec"; sql: string; exampleId?: string }
  | { type: "console:index"; action: "create" | "drop"; index: IndexDef }
  | { type: "forecast:run"; settings: ForecastSettings };

export interface ConsoleExampleInfo {
  id: string;
  title: string;
  blurb: string;
  sql: string;
  /** True when the lab knows the statement's shape and can answer what-if questions. */
  templated: boolean;
}

export interface ConsoleResult {
  columns: string[];
  rows: (string | number | null)[][];
  truncated: boolean;
  /** Median execution time over `runs` timed runs. */
  ms: number;
  runs: number;
  plan: PlanNode[];
  changes: number;
  whatIf: WhatIfReport | null;
}

export type LabResponse =
  | { type: "status"; phase: string }
  | { type: "arena:setup"; info: DatabaseInfo; budgetBytes: number; workload: WorkloadSummary }
  | { type: "arena:round"; advisor: AdvisorId; record: RoundRecord }
  | {
      type: "arena:advisor-done";
      advisor: AdvisorId;
      totals: RunTotals;
      finalConfig: IndexDef[];
      mabTrace?: MabRoundTrace[];
      plans?: Record<string, PlanNode[]>;
    }
  | { type: "arena:done"; elapsedMs: number }
  | { type: "bench:setup"; info: DatabaseInfo; budgetBytes: number; total: number }
  | { type: "bench:replicate"; drift: number | null; result: ReplicateResult; done: number }
  | { type: "bench:done"; elapsedMs: number }
  | { type: "llm:context"; context: LlmContext }
  | {
      type: "console:ready";
      info: DatabaseInfo;
      indexes: IndexDef[];
      examples: ConsoleExampleInfo[];
    }
  | { type: "console:result"; result: ConsoleResult }
  | { type: "console:error"; message: string }
  | {
      type: "console:indexes";
      indexes: { index: IndexDef; bytes: number }[];
      action: "create" | "drop";
      ms: number;
    }
  | { type: "forecast:result"; view: ForecastView; ms: number }
  | { type: "error"; message: string };
