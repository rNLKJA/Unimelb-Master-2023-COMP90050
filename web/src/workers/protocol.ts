import type { AdvisorId } from "@/lib/advisors/types";
import type { MabRoundTrace } from "@/lib/advisors/mab/mab-advisor";
import type { RoundRecord, RunTotals } from "@/lib/arena/run";
import type { WhatIfReport } from "@/lib/console/what-if";
import type { ScalePreset, TableName } from "@/lib/db/schema";
import type { PlanNode } from "@/lib/engine/explain";
import type { IndexDef } from "@/lib/engine/types";
import type { ForecastSettings, ForecastView } from "@/lib/forecast/view";
import type { ScenarioId, Phase } from "@/lib/workload/scenarios";

export type EngineKind = "sqlite" | "simulated";

export interface ArenaConfig {
  engine: EngineKind;
  scale: ScalePreset["id"];
  seed: number;
  scenario: ScenarioId;
  rounds: number;
  /** Storage budget as a fraction of the data size. */
  budget: number;
  advisors: AdvisorId[];
  whatIfLatencyMs: number;
  skipScan: boolean;
  mabAlpha: number;
}

export interface DatabaseInfo {
  rows: Record<TableName, number>;
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
