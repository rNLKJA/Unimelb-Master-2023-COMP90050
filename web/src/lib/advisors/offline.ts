/**
 * Wraps an offline physical-design algorithm the way Perera et al. (2023) ran
 * their commercial baseline: invoked at the start of round 2 with round 1 as
 * the representative workload, and invoked again whenever the workload has
 * shifted (the template mix of the last round overlaps the one it was tuned
 * for by less than half).
 */
import type { IndexDef, QueryInstance } from "@/lib/engine/types";
import { jaccard, templateSet } from "@/lib/workload/scenarios";
import { solveCophy } from "./cophy";
import type { Advisor, AdvisorContext, AdvisorId, OfflineAlgorithm } from "./types";

export class OfflineAdvisor implements Advisor {
  private tunedFor: Set<string> | null = null;
  invocations = 0;

  constructor(
    readonly id: AdvisorId,
    private readonly algorithm: OfflineAlgorithm,
    private readonly reinvokeBelow = 0.5,
  ) {}

  recommend(ctx: AdvisorContext) {
    const last = ctx.history.at(-1);
    if (!last || last.length === 0) return null;
    const mix = templateSet(last);
    if (this.tunedFor && jaccard(mix, this.tunedFor) >= this.reinvokeBelow) return null;
    this.tunedFor = mix;
    this.invocations++;
    return this.algorithm({
      workload: last,
      budgetBytes: ctx.budgetBytes,
      model: ctx.whatIf,
      rng: ctx.rng,
    });
  }
}

export class NoIndexAdvisor implements Advisor {
  readonly id = "none" as const;
  recommend() {
    return null;
  }
}

/**
 * A configuration decided outside the lab (the LLM advisor's validated
 * proposal), applied the way the offline tools' first invocation is: at the
 * start of round 2, after round 1 has run without indexes. It is not
 * re-consulted after a workload shift. `latencyMs` (the provider's response
 * time) is charged as recommendation time in that round.
 */
export class FixedConfigAdvisor implements Advisor {
  private applied = false;

  constructor(
    readonly id: AdvisorId,
    private readonly config: IndexDef[],
    private readonly latencyMs = 0,
    private readonly startRound = 1,
  ) {}

  recommend(ctx: AdvisorContext) {
    if (this.applied || ctx.round < this.startRound) return null;
    this.applied = true;
    return this.config;
  }

  overheadMs(round: number) {
    return round === this.startRound ? this.latencyMs : 0;
  }
}

/**
 * The benchmark's regret reference: the best fixed configuration in hindsight.
 * Before round 1 it builds the configuration that CoPhy's integer program
 * finds best, under the what-if model, for the whole workload (every round,
 * weighted by template frequency) within the storage budget. No real advisor
 * knows the future workload, so its recommendation time is not charged; index
 * creation and execution are. "Optimal" is with respect to the cost model, so
 * a learner measured on real runtimes can beat it, which shows up as negative
 * regret.
 *
 * Branch and bound gets a much larger node budget than the CoPhy advisor's,
 * because the reference's search is free. It proves optimality on every
 * dataset, scenario and budget the benchmark offers at the TPC-H-like S scale
 * (the hardest case, Louvre HTAP at 200%, takes about a million nodes). When
 * it still runs out, `optimal` is false and the benchmark reports regret
 * against the best configuration found, not an optimum.
 */
export const REFERENCE_NODE_LIMIT = 5_000_000;

export class HindsightAdvisor implements Advisor {
  readonly id = "hindsight" as const;
  readonly reference = true;
  private done = false;
  /** Whether branch and bound proved the configuration optimal (null before it runs). */
  optimal: boolean | null = null;
  /** Branch-and-bound nodes visited. */
  nodes = 0;

  constructor(
    private readonly workload: QueryInstance[],
    private readonly nodeLimit = REFERENCE_NODE_LIMIT,
  ) {}

  recommend(ctx: AdvisorContext) {
    if (this.done) return null;
    this.done = true;
    const result = solveCophy(this.workload, ctx.whatIf, {
      budgetBytes: ctx.budgetBytes,
      nodeLimit: this.nodeLimit,
    });
    this.optimal = result.optimal;
    this.nodes = result.nodes;
    return result.config;
  }
}
