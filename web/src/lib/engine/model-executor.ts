/**
 * Simulated engine. The optimiser picks a plan with the what-if cost model
 * (its statistics assume uniform data); the plan is then charged with a hidden
 * "true" cost model whose constants differ, times a fixed per-template error and
 * a little per-run noise. The gap between the two models stands in for the
 * optimiser misestimates that motivate learning from observed runtimes
 * (Perera et al. 2023). Fully deterministic for a given seed.
 */
import { deriveSeed, mulberry32, normal, type Rng } from "@/lib/random";
import type { TableName } from "@/lib/db/schema";
import { CostModel, DEFAULT_CONSTANTS, type CostConstants } from "./cost-model";
import type { ExecResult, Executor } from "./executor";
import { indexId, type IndexDef, type QueryInstance } from "./types";

/** "Reality" is a little different from what the optimiser believes. */
export const TRUE_CONSTANTS: CostConstants = {
  ...DEFAULT_CONSTANTS,
  scanRow: DEFAULT_CONSTANTS.scanRow * 0.85,
  scanByte: DEFAULT_CONSTANTS.scanByte * 0.9,
  rowidFetch: DEFAULT_CONSTANTS.rowidFetch * 1.6,
  indexMaintain: DEFAULT_CONSTANTS.indexMaintain * 1.3,
  buildRow: DEFAULT_CONSTANTS.buildRow * 1.2,
};

export class ModelExecutor implements Executor {
  readonly kind = "simulated" as const;
  private config: IndexDef[] = [];
  private rng: Rng;
  private readonly truth: CostModel;
  private readonly templateError = new Map<string, number>();

  constructor(
    private readonly optimiser: CostModel,
    private readonly seed = 7,
    private readonly noise = 0.05,
  ) {
    this.truth = new CostModel(optimiser.stats, TRUE_CONSTANTS);
    this.rng = mulberry32(deriveSeed(seed, "exec"));
  }

  private errorFor(template: string): number {
    let e = this.templateError.get(template);
    if (e === undefined) {
      const r = mulberry32(deriveSeed(this.seed, `err:${template}`));
      e = Math.exp(0.2 * normal(r));
      this.templateError.set(template, e);
    }
    return e;
  }

  private jitter(): number {
    return Math.max(0.5, 1 + this.noise * normal(this.rng));
  }

  get current(): IndexDef[] {
    return this.config;
  }

  createIndex(ix: IndexDef) {
    this.config = [...this.config, ix];
    return { ms: this.truth.creationCost(ix) * this.jitter(), bytes: this.truth.indexBytes(ix) };
  }

  dropIndex(ix: IndexDef) {
    const id = indexId(ix);
    this.config = this.config.filter((x) => indexId(x) !== id);
    return { ms: 0.05 };
  }

  execute(q: QueryInstance): ExecResult {
    const plan = this.optimiser.estimate(q, this.config);
    this.optimiser.calls--; // executing is not a what-if call
    const ms = this.truth.recost(q, plan) * this.errorFor(q.template) * this.jitter();
    return {
      ms,
      used: plan.used,
      maintained: plan.maintained,
      scanned: plan.paths.filter((p) => p.kind === "scan").map((p) => p.table as TableName),
    };
  }

  reset() {
    this.config = [];
    this.rng = mulberry32(deriveSeed(this.seed, "exec"));
  }
}
