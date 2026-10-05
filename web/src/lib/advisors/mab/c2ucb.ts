/**
 * C²UCB — contextual combinatorial upper confidence bound (Qin, Chen & Zhu
 * 2014), as used for index tuning by Perera et al. ("No DBA? No regret!",
 * TKDE 2023, Algorithm 1). Arm scores are linear in their contexts with a
 * weight vector θ shared by all arms and learnt by ridge regression:
 *
 *   θ̂ = V⁻¹ b,   r̂(i) = θ̂ᵀ x(i) + α √(x(i)ᵀ V⁻¹ x(i))         (eq. 1)
 *   V ← V + Σ x xᵀ,   b ← b + Σ r x                  (lines 12-13)
 *
 * Hyperparameters default to the authors' published TPC-H configuration
 * (α = 1, λ = 0.5, α shrinking by 1.05× per round). Forgetting on workload
 * shift follows the paper: a large shift resets the learner, a small one
 * discounts history.
 */
import { addOuter, dot, identity, invert, matVec, type Matrix } from "@/lib/linalg";

export interface C2UCBOptions {
  dimension: number;
  alpha: number;
  lambda: number;
  /** α is divided by this every round (1 = no decay). */
  alphaDecay: number;
}

export const DEFAULT_C2UCB: Omit<C2UCBOptions, "dimension"> = {
  alpha: 1,
  lambda: 0.5,
  alphaDecay: 1.05,
};

export interface ArmScore {
  mean: number;
  bonus: number;
  score: number;
}

export class C2UCB {
  V: Matrix;
  b: Float64Array;
  alpha: number;

  constructor(readonly opts: C2UCBOptions) {
    this.V = identity(opts.dimension, opts.lambda);
    this.b = new Float64Array(opts.dimension);
    this.alpha = opts.alpha;
  }

  /** θ̂ = V⁻¹ b */
  weights(): Float64Array {
    return matVec(invert(this.V), this.b);
  }

  /**
   * UCB scores for this round's arms (Algorithm 1, lines 5-9); then decay α.
   * `discount` optionally re-weights one feature's contribution to the mean
   * (used for the index-creation cost).
   */
  score(contexts: Float64Array[], discount?: { feature: number; weight: number }): ArmScore[] {
    const vInv = invert(this.V);
    const theta = matVec(vInv, this.b);
    const out = contexts.map((x) => {
      let mean = dot(theta, x);
      if (discount) mean -= (1 - discount.weight) * theta[discount.feature] * x[discount.feature];
      const bonus = this.alpha * Math.sqrt(Math.max(0, dot(x, matVec(vInv, x))));
      return { mean, bonus, score: mean + bonus };
    });
    this.alpha /= this.opts.alphaDecay;
    return out;
  }

  /** Ridge-regression update with one observed (context, reward) pair. */
  update(x: Float64Array, reward: number) {
    addOuter(this.V, x);
    for (let i = 0; i < x.length; i++) this.b[i] += reward * x[i];
  }

  hardReset() {
    this.V = identity(this.opts.dimension, this.opts.lambda);
    this.b = new Float64Array(this.opts.dimension);
    this.alpha = this.opts.alpha;
  }

  /**
   * Forget history in proportion to the workload shift: `change` is the share
   * of templates in the latest round that the learner had not seen before.
   */
  forget(change: number) {
    if (change > 0.5) {
      this.hardReset();
      return;
    }
    if (change <= 0) return;
    const keep = 1 - 2 * change;
    if (change > 0.1) this.alpha = this.opts.alpha;
    const d = this.opts.dimension;
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++)
        this.V[i][j] = keep * this.V[i][j] + (i === j ? this.opts.lambda : 0);
      this.b[i] *= keep;
    }
  }
}
