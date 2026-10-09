import type { MabRoundTrace } from "@/lib/advisors/mab/mab-advisor";
import type { AdvisorId } from "@/lib/advisors/types";
import type { RoundRecord, RunTotals } from "@/lib/arena/run";
import type { PlanNode } from "@/lib/engine/explain";
import type { IndexDef } from "@/lib/engine/types";
import type { ArenaConfig, DatabaseInfo, LabResponse, WorkloadSummary } from "@/workers/protocol";

export interface AdvisorRun {
  rounds: RoundRecord[];
  totals?: RunTotals;
  finalConfig?: IndexDef[];
  mabTrace?: MabRoundTrace[];
  plans?: Record<string, PlanNode[]>;
}

export interface ArenaState {
  status: "idle" | "running" | "done" | "stopped" | "error";
  phase: string;
  config: ArenaConfig | null;
  setup: { info: DatabaseInfo; budgetBytes: number; workload: WorkloadSummary } | null;
  runs: Partial<Record<AdvisorId, AdvisorRun>>;
  current: AdvisorId | null;
  elapsedMs: number | null;
  error: string | null;
}

export const INITIAL: ArenaState = {
  status: "idle",
  phase: "",
  config: null,
  setup: null,
  runs: {},
  current: null,
  elapsedMs: null,
  error: null,
};

export type Action =
  { type: "start"; config: ArenaConfig } | { type: "stop" } | { type: "msg"; msg: LabResponse };

export function reducer(state: ArenaState, action: Action): ArenaState {
  if (action.type === "start")
    return { ...INITIAL, status: "running", phase: "Starting the worker", config: action.config };
  if (action.type === "stop")
    return state.status === "running"
      ? { ...state, status: "stopped", phase: "Stopped", current: null }
      : state;
  const msg = action.msg;
  // A stopped or finished run must not be revived by a late message.
  if (state.status !== "running") return state;
  switch (msg.type) {
    case "status":
      return { ...state, phase: msg.phase };
    case "arena:setup":
      return {
        ...state,
        setup: { info: msg.info, budgetBytes: msg.budgetBytes, workload: msg.workload },
      };
    case "arena:round": {
      const prev = state.runs[msg.advisor] ?? { rounds: [] };
      return {
        ...state,
        current: msg.advisor,
        runs: { ...state.runs, [msg.advisor]: { ...prev, rounds: [...prev.rounds, msg.record] } },
      };
    }
    case "arena:advisor-done": {
      const prev = state.runs[msg.advisor] ?? { rounds: [] };
      return {
        ...state,
        runs: {
          ...state.runs,
          [msg.advisor]: {
            ...prev,
            totals: msg.totals,
            finalConfig: msg.finalConfig,
            mabTrace: msg.mabTrace,
            plans: msg.plans,
          },
        },
      };
    }
    case "arena:done":
      return {
        ...state,
        status: "done",
        phase: "Finished",
        current: null,
        elapsedMs: msg.elapsedMs,
      };
    case "error":
      return { ...state, status: "error", error: msg.message, current: null };
    default:
      return state;
  }
}

export const DEFAULT_CONFIG: ArenaConfig = {
  dataset: "tpch",
  engine: "sqlite",
  scale: "s",
  seed: 2023,
  scenario: "shifting",
  drift: 0.5,
  rounds: 25,
  budget: 2,
  advisors: ["none", "drop", "autoadmin", "db2advis", "cophy", "mab"],
  whatIfLatencyMs: 0.02,
  skipScan: false,
  mabAlpha: 1,
  llm: null,
};

/** The arena's defaults for a dataset (the deep link /arena?dataset=louvre lands here). */
export function defaultConfig(dataset: ArenaConfig["dataset"] = "tpch"): ArenaConfig {
  return { ...DEFAULT_CONFIG, dataset };
}

export const advisorColor = (id: AdvisorId) => `var(--adv-${id})`;
