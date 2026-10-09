/** Descriptive statistics and the standardised effect size for paired data. */

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Sample variance (n - 1 denominator, numpy ddof=1, R var). */
export function variance(xs: readonly number[]): number {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / (xs.length - 1);
}

/** Sample standard deviation (n - 1 denominator). */
export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

/** Element-wise differences a_i - b_i of paired samples. */
export function differences(a: readonly number[], b: readonly number[]): number[] {
  if (a.length !== b.length) throw new Error("Paired samples must have the same length");
  return a.map((x, i) => x - b[i]);
}

/**
 * Cohen's d_z for paired samples: the mean difference over the standard
 * deviation of the differences (Cohen 1988; Lakens 2013). It says how many
 * standard deviations of run-to-run variation the typical difference is.
 * Undefined (NaN) with fewer than two pairs or when every difference is equal.
 */
export function cohensDz(a: readonly number[], b: readonly number[]): number {
  const d = differences(a, b);
  const s = sd(d);
  return s > 0 ? mean(d) / s : NaN;
}
