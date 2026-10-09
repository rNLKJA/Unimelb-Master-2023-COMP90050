/**
 * Percentile-bootstrap confidence intervals (Efron & Tibshirani 1993, ch. 13).
 * Every procedure takes a seed and reports it, so the intervals on the page
 * are reproducible; `B` resamples default to 2000.
 *
 * With few units (the benchmark's default is 10 seeded replicates) the
 * percentile interval is somewhat too narrow. Resampling replicates from one
 * run also leaves out run-to-run variation (machine state, JIT and heap), so
 * the published benchmark numbers come from several independent sessions
 * through `pigeonholeBootstrapCI`.
 */
import { createStatsRng, STATS_SEED } from "./random";

export interface BootstrapOptions {
  /** Resamples (default 2000). */
  B?: number;
  seed?: number;
  /** Confidence level (default 0.95). */
  level?: number;
}

export interface BootstrapInterval {
  estimate: number;
  lower: number;
  upper: number;
  /** Resamples that produced a finite statistic. */
  B: number;
  seed: number;
  level: number;
  /** Units resampled. */
  n: number;
}

/** numpy.percentile's default (linear interpolation) on sorted data; R's quantile type 7. */
export function quantileSorted(sorted: ArrayLike<number>, p: number): number {
  const m = sorted.length;
  if (!m) return NaN;
  const pos = (m - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(m - 1, lo + 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Median (numpy.median). */
export function median(xs: readonly number[]): number {
  return quantileSorted(Float64Array.from(xs).sort(), 0.5);
}

const withDefaults = (o: BootstrapOptions): Required<BootstrapOptions> => ({
  B: o.B ?? 2000,
  seed: o.seed ?? STATS_SEED,
  level: o.level ?? 0.95,
});

function empty(o: Required<BootstrapOptions>, n: number): BootstrapInterval {
  return { estimate: NaN, lower: NaN, upper: NaN, B: 0, seed: o.seed, level: o.level, n };
}

/**
 * Percentile bootstrap: resample the n units with replacement B times,
 * recompute `stat` on each resample and take the (1 - level)/2 and
 * (1 + level)/2 quantiles. `stat` receives the resampled unit indices, so
 * paired data is resampled by pair.
 */
export function bootstrapCI(
  n: number,
  stat: (idx: Int32Array) => number,
  options: BootstrapOptions = {},
): BootstrapInterval {
  const opts = withDefaults(options);
  if (n <= 0) return empty(opts, n);
  const all = new Int32Array(n);
  for (let i = 0; i < n; i++) all[i] = i;
  const estimate = stat(all);
  const rng = createStatsRng(opts.seed);
  const draws = new Float64Array(opts.B);
  const idx = new Int32Array(n);
  let kept = 0;
  for (let b = 0; b < opts.B; b++) {
    for (let i = 0; i < n; i++) idx[i] = rng.int(n);
    const v = stat(idx);
    if (Number.isFinite(v)) draws[kept++] = v;
  }
  const sorted = draws.slice(0, kept).sort();
  const alpha = (1 - opts.level) / 2;
  return {
    estimate,
    lower: quantileSorted(sorted, alpha),
    upper: quantileSorted(sorted, 1 - alpha),
    B: kept,
    seed: opts.seed,
    level: opts.level,
    n,
  };
}

/**
 * Pigeonhole (two-way) percentile bootstrap for a crossed design (Owen 2007,
 * "The pigeonhole bootstrap", Annals of Applied Statistics 1(2), 386-411).
 * The data sit in a `rows` x `cols` grid where both factors are random: in
 * the benchmark, independent sessions (fresh processes) x workload seeds,
 * with every session replaying the same seeds. Each resample draws rows and
 * columns independently with replacement and keeps every cell where a drawn
 * row meets a drawn column, so session-to-session and workload-to-workload
 * variation both reach the interval. Resampling replicates within sessions
 * instead would treat the same ten workloads, re-run K times, as 10K
 * independent ones and understate the workload term K-fold.
 *
 * `stat` receives the flat indices (row * cols + col) of the resampled
 * grid's rows * cols cells. For a mean, the bootstrap variance is exactly
 * (||H_r Y H_c||^2 + rows * var(row sums) + cols * var(column sums)) /
 * (rows * cols)^2, with H the centring matrices and var the population
 * variance. That counts the interaction term more than once, so the interval
 * is mildly conservative.
 */
export function pigeonholeBootstrapCI(
  rows: number,
  cols: number,
  stat: (cells: Int32Array) => number,
  options: BootstrapOptions = {},
): BootstrapInterval {
  const opts = withDefaults(options);
  const n = Math.max(0, rows) * Math.max(0, cols);
  if (n === 0) return empty(opts, n);
  const all = new Int32Array(n);
  for (let i = 0; i < n; i++) all[i] = i;
  const estimate = stat(all);
  const rng = createStatsRng(opts.seed);
  const draws = new Float64Array(opts.B);
  const r = new Int32Array(rows);
  const cells = new Int32Array(n);
  let kept = 0;
  for (let b = 0; b < opts.B; b++) {
    for (let i = 0; i < rows; i++) r[i] = rng.int(rows);
    for (let j = 0; j < cols; j++) {
      const c = rng.int(cols);
      for (let i = 0; i < rows; i++) cells[i * cols + j] = r[i] * cols + c;
    }
    const v = stat(cells);
    if (Number.isFinite(v)) draws[kept++] = v;
  }
  const sorted = draws.slice(0, kept).sort();
  const alpha = (1 - opts.level) / 2;
  return {
    estimate,
    lower: quantileSorted(sorted, alpha),
    upper: quantileSorted(sorted, 1 - alpha),
    B: kept,
    seed: opts.seed,
    level: opts.level,
    n,
  };
}

/** Interval for a mean. */
export function meanBootstrap(xs: readonly number[], options: BootstrapOptions = {}) {
  return bootstrapCI(
    xs.length,
    (idx) => {
      let s = 0;
      for (let i = 0; i < idx.length; i++) s += xs[idx[i]];
      return s / idx.length;
    },
    options,
  );
}

/** Interval for a median. */
export function medianBootstrap(xs: readonly number[], options: BootstrapOptions = {}) {
  const buf = new Float64Array(xs.length);
  return bootstrapCI(
    xs.length,
    (idx) => {
      for (let i = 0; i < idx.length; i++) buf[i] = xs[idx[i]];
      buf.sort();
      return quantileSorted(buf, 0.5);
    },
    options,
  );
}

function assertPaired(a: readonly number[], b: readonly number[]) {
  if (a.length !== b.length) throw new Error("Paired samples must have the same length");
}

/** Interval for the mean paired difference, mean(a_i - b_i), resampling pairs. */
export function pairedMeanDiffBootstrap(
  a: readonly number[],
  b: readonly number[],
  options: BootstrapOptions = {},
) {
  assertPaired(a, b);
  return bootstrapCI(
    a.length,
    (idx) => {
      let s = 0;
      for (let i = 0; i < idx.length; i++) s += a[idx[i]] - b[idx[i]];
      return s / idx.length;
    },
    options,
  );
}

/**
 * Interval for the ratio of means of paired samples, mean(a) / mean(b),
 * resampling pairs together (so shared workload difficulty cancels). A ratio
 * of 0.8 means A took 20% less time than B on the same workloads.
 */
export function pairedRatioBootstrap(
  a: readonly number[],
  b: readonly number[],
  options: BootstrapOptions = {},
) {
  assertPaired(a, b);
  return bootstrapCI(
    a.length,
    (idx) => {
      let sa = 0;
      let sb = 0;
      for (let i = 0; i < idx.length; i++) {
        sa += a[idx[i]];
        sb += b[idx[i]];
      }
      return sa / sb;
    },
    options,
  );
}

/**
 * Pointwise intervals for the mean of each column of `rows` (units x positions),
 * e.g. a cumulative-regret curve over rounds across replicates. Each position
 * uses the same resampled units, so the band is a set of pointwise intervals,
 * not a simultaneous band.
 */
export function meanCurveBootstrap(
  rows: readonly (readonly number[])[],
  options: BootstrapOptions = {},
): { estimate: number[]; lower: number[]; upper: number[]; n: number; seed: number } {
  const opts = withDefaults(options);
  const n = rows.length;
  const width = n ? Math.min(...rows.map((r) => r.length)) : 0;
  const estimate: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];
  for (let j = 0; j < width; j++) {
    const col = rows.map((r) => r[j]);
    const ci = meanBootstrap(col, opts);
    estimate.push(ci.estimate);
    lower.push(ci.lower);
    upper.push(ci.upper);
  }
  return { estimate, lower, upper, n, seed: opts.seed };
}
