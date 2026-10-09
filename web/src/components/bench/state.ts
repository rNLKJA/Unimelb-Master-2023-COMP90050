import type { AdvisorId } from "@/lib/advisors/types";
import type { ReplicateResult } from "@/lib/bench/benchmark";
import type { DatasetId } from "@/lib/datasets/registry";
import type { BenchRunConfig, DatabaseInfo, LabResponse } from "@/workers/protocol";

export interface BenchState {
  status: "idle" | "running" | "done" | "stopped" | "error";
  phase: string;
  config: BenchRunConfig | null;
  setup: { info: DatabaseInfo; budgetBytes: number; total: number } | null;
  results: { drift: number | null; result: ReplicateResult }[];
  done: number;
  elapsedMs: number | null;
  error: string | null;
}

export const INITIAL: BenchState = {
  status: "idle",
  phase: "",
  config: null,
  setup: null,
  results: [],
  done: 0,
  elapsedMs: null,
  error: null,
};

export type BenchAction =
  { type: "start"; config: BenchRunConfig } | { type: "stop" } | { type: "msg"; msg: LabResponse };

export function benchReducer(state: BenchState, action: BenchAction): BenchState {
  if (action.type === "start")
    return { ...INITIAL, status: "running", phase: "Starting the worker", config: action.config };
  if (action.type === "stop")
    return state.status === "running" ? { ...state, status: "stopped", phase: "Stopped" } : state;
  const msg = action.msg;
  if (state.status !== "running") return state;
  switch (msg.type) {
    case "status":
      return { ...state, phase: msg.phase };
    case "bench:setup":
      return {
        ...state,
        setup: { info: msg.info, budgetBytes: msg.budgetBytes, total: msg.total },
      };
    case "bench:replicate":
      return {
        ...state,
        done: msg.done,
        results: [...state.results, { drift: msg.drift, result: msg.result }],
      };
    case "bench:done":
      return { ...state, status: "done", phase: "Finished", elapsedMs: msg.elapsedMs };
    case "error":
      return { ...state, status: "error", error: msg.message };
    default:
      return state;
  }
}

/** The drift levels of the sensitivity sweep. */
export const SWEEP = [0, 0.25, 0.5, 0.75, 1];

/** The comparison the task cares about: no index, greedy what-if (AutoAdmin), the bandit. */
export const BENCH_ADVISORS: AdvisorId[] = ["none", "autoadmin", "mab"];

export function defaultBench(dataset: DatasetId = "tpch"): BenchRunConfig {
  return {
    dataset,
    engine: "sqlite",
    scale: "s",
    seed: 2023,
    scenario: "static",
    drift: 0.5,
    rounds: 25,
    budget: 2,
    advisors: BENCH_ADVISORS,
    whatIfLatencyMs: 0.02,
    skipScan: false,
    mabAlpha: 1,
    llm: null,
    replicates: 10,
    sweep: null,
  };
}
