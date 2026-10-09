import { lgamma } from "./special";

/** P(X <= k) for X ~ Binomial(n, 1/2), summed in log space. */
function binomHalfCdf(k: number, n: number): number {
  let s = 0;
  const lnHalfN = n * Math.log(0.5);
  for (let i = 0; i <= k; i++) {
    s += Math.exp(lgamma(n + 1) - lgamma(i + 1) - lgamma(n - i + 1) + lnHalfN);
  }
  return Math.min(1, s);
}

export interface SignTestResult {
  /** Pairs where A was lower (A "won"). */
  wins: number;
  /** Pairs where B was lower. */
  losses: number;
  /** Ties, which an exact sign test drops. */
  ties: number;
  /** Exact two-sided p-value. */
  p: number;
}

/**
 * Exact two-sided sign test on paired outcomes (scipy.stats.binomtest(k, n,
 * 0.5), R binom.test): ties are dropped, and p = min(1, 2 P(X <= min(w, l)))
 * with X ~ Binomial(w + l, 1/2). It is the exact McNemar test on the
 * discordant pairs.
 */
export function signTest(wins: number, losses: number, ties = 0): SignTestResult {
  const n = wins + losses;
  if (n === 0) return { wins, losses, ties, p: 1 };
  return { wins, losses, ties, p: Math.min(1, 2 * binomHalfCdf(Math.min(wins, losses), n)) };
}

/** Sign test of a < b over paired samples (smaller is better, e.g. workload time). */
export function pairedSignTest(a: readonly number[], b: readonly number[]): SignTestResult {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  a.forEach((x, i) => {
    if (x < b[i]) wins++;
    else if (x > b[i]) losses++;
    else ties++;
  });
  return signTest(wins, losses, ties);
}
