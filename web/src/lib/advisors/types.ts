import type { CostModel } from "@/lib/engine/cost-model";
import type { ExecResult } from "@/lib/engine/executor";
import type { IndexDef, QueryInstance } from "@/lib/engine/types";
import type { Rng } from "@/lib/random";

export type AdvisorId =
  | "none"
  | "drop"
  | "autoadmin"
  | "db2advis"
  | "cophy"
  | "mab"
  /** A configuration proposed by the visitor's own LLM (bring your own key). */
  | "llm"
  /** Benchmark reference: the what-if optimum for the whole workload, known in advance. */
  | "hindsight";

export interface AdvisorContext {
  round: number;
  /** Queries executed in earlier rounds, oldest first. */
  history: QueryInstance[][];
  current: IndexDef[];
  budgetBytes: number;
  whatIf: CostModel;
  rng: Rng;
}

export interface RoundFeedback {
  round: number;
  queries: QueryInstance[];
  results: ExecResult[];
  created: { index: IndexDef; ms: number; bytes: number }[];
  config: IndexDef[];
}

export interface Advisor {
  readonly id: AdvisorId;
  /** The configuration to materialise before this round runs, or null to keep the current one. */
  recommend(ctx: AdvisorContext): IndexDef[] | null;
  observe?(feedback: RoundFeedback): void;
  /**
   * A reference, not a contender: its recommendation time is not charged
   * (it is computed with knowledge no real advisor has).
   */
  readonly reference?: boolean;
  /**
   * Time spent outside the lab for a recommendation made this round (an LLM's
   * API latency), added to recommendation time.
   */
  overheadMs?(round: number): number;
}

/** An offline physical-design algorithm: representative workload in, configuration out. */
export type OfflineAlgorithm = (input: {
  workload: QueryInstance[];
  budgetBytes: number;
  model: CostModel;
  rng: Rng;
}) => IndexDef[];
