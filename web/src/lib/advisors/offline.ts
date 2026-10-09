/**
 * Wraps an offline physical-design algorithm the way Perera et al. (2023) ran
 * their commercial baseline: invoked at the start of round 2 with round 1 as
 * the representative workload, and invoked again whenever the workload has
 * shifted (the template mix of the last round overlaps the one it was tuned
 * for by less than half).
 */
import { jaccard, templateSet } from "@/lib/workload/scenarios";
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
