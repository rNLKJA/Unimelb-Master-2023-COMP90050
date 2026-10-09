import { describe, expect, it } from "vitest";
import rfx from "./__fixtures__/stats-parity-r.json";
import fx from "./__fixtures__/stats-parity.json";
import {
  bootstrapCI,
  cohensDz,
  createStatsRng,
  differences,
  mean,
  meanBootstrap,
  meanCurveBootstrap,
  median,
  medianBootstrap,
  normalCdf,
  normalQuantile,
  normalSf,
  pairedMeanDiffBootstrap,
  pairedRatioBootstrap,
  pairedSignTest,
  pigeonholeBootstrapCI,
  quantileSorted,
  sd,
  signTest,
  STATS_SEED,
  wilson,
} from ".";

/**
 * Expected values come from scripts/verify_stats.py (numpy, scipy,
 * statsmodels) and scripts/verify_stats.R (base R). Analytic quantities must
 * agree to near machine precision; bootstrap intervals use different random
 * streams, so they must agree within Monte Carlo error.
 */
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1e-300, Math.abs(b));
const samples = fx.samples as Record<string, number[]>;
const { a, b } = samples;

describe("normal distribution (scipy.stats.norm)", () => {
  it("cdf and survival function", () => {
    for (const [x, v] of fx.normalCdf) expect(rel(normalCdf(x), v)).toBeLessThan(1e-12);
    for (const [x, v] of fx.normalSf) expect(rel(normalSf(x), v)).toBeLessThan(1e-12);
  });
  it("quantile", () => {
    for (const [p, v] of fx.normalPpf) expect(normalQuantile(p)).toBeCloseTo(v, 12);
    expect(normalQuantile(0)).toBe(-Infinity);
    expect(normalQuantile(1)).toBe(Infinity);
    expect(normalQuantile(1.5)).toBeNaN();
  });
});

describe("Wilson score interval", () => {
  it("matches statsmodels proportion_confint(method='wilson')", () => {
    expect(fx.wilson.length).toBeGreaterThan(20);
    for (const [k, n, level, lo, hi] of fx.wilson) {
      const w = wilson(k, n, level);
      expect(w.estimate).toBe(k / n);
      expect(w.lower).toBeCloseTo(lo, 12);
      expect(w.upper).toBeCloseTo(hi, 12);
    }
  });
  it("matches R prop.test(correct = FALSE)", () => {
    for (const [k, n, level, lo, hi] of rfx.wilson) {
      const w = wilson(k, n, level);
      expect(w.lower).toBeCloseTo(lo, 10);
      expect(w.upper).toBeCloseTo(hi, 10);
    }
  });
  it("is undefined for an empty or impossible count", () => {
    expect(wilson(0, 0).estimate).toBeNaN();
    expect(wilson(3, 2).lower).toBeNaN();
  });
});

describe("exact sign test", () => {
  it("matches scipy.stats.binomtest and R binom.test", () => {
    for (const [w, l, p] of fx.signTest) expect(signTest(w, l).p).toBeCloseTo(p, 12);
    for (const [w, l, p] of rfx.signTest) expect(signTest(w, l).p).toBeCloseTo(p, 12);
  });
  it("counts wins, losses and ties of paired samples (smaller wins)", () => {
    const r = pairedSignTest([1, 2, 3, 4], [2, 2, 1, 5]);
    expect(r).toMatchObject({ wins: 2, losses: 1, ties: 1 });
    expect(pairedSignTest(a, b)).toMatchObject({ wins: 10, losses: 0, p: 0.001953125 });
  });
});

describe("descriptive statistics", () => {
  it("means and sample standard deviations match numpy and R", () => {
    for (const [name, v] of Object.entries(fx.describe)) {
      expect(mean(samples[name])).toBeCloseTo(v.mean, 10);
      expect(sd(samples[name])).toBeCloseTo(v.sd, 10);
      expect(median(samples[name])).toBeCloseTo(v.median, 12);
    }
    expect(mean(a)).toBeCloseTo(rfx.a.mean, 10);
    expect(sd(a)).toBeCloseTo(rfx.a.sd, 10);
    expect(mean(differences(a, b))).toBeCloseTo(rfx.d.mean, 10);
    expect(sd(differences(a, b))).toBeCloseTo(rfx.d.sd, 10);
    expect(mean([])).toBeNaN();
    expect(sd([1])).toBeNaN();
  });
  it("Cohen's d_z for paired samples", () => {
    expect(cohensDz(a, b)).toBeCloseTo(fx.cohensDz, 10);
    expect(cohensDz(a, b)).toBeCloseTo(rfx.cohensDz, 10);
    expect(cohensDz([1, 2], [0, 1])).toBeNaN(); // every difference equal: no spread
  });
  it("linear-interpolation quantiles (numpy.percentile, R type 7)", () => {
    for (const [name, p, v] of fx.quantiles as [string, number, number][]) {
      const sorted = Float64Array.from(samples[name]).sort();
      expect(quantileSorted(sorted, p)).toBeCloseTo(v, 12);
    }
    const sortedA = Float64Array.from(a).sort();
    for (const [p, v] of rfx.quantilesA) expect(quantileSorted(sortedA, p)).toBeCloseTo(v, 10);
    expect(quantileSorted([], 0.5)).toBeNaN();
  });
});

describe("percentile bootstrap", () => {
  // The TypeScript and scipy streams differ, so intervals agree to Monte Carlo
  // error: with 10 paired units the interval ends move by about 1% of the
  // width between seeds.
  const close = (got: number, want: number, width: number) =>
    expect(Math.abs(got - want)).toBeLessThan(0.06 * width);

  it("agrees with scipy for the mean paired difference", () => {
    const [lo, hi] = fx.bootstrap.meanDiff;
    const ci = pairedMeanDiffBootstrap(a, b, { B: 20_000 });
    expect(ci.estimate).toBeCloseTo(fx.pairedDiffMean, 10);
    close(ci.lower, lo, hi - lo);
    close(ci.upper, hi, hi - lo);
  });

  it("agrees with scipy (paired=True) for a ratio of means", () => {
    const [lo, hi] = fx.bootstrap.ratioOfMeans;
    const ci = pairedRatioBootstrap(a, b, { B: 20_000 });
    expect(ci.estimate).toBeCloseTo(mean(a) / mean(b), 12);
    close(ci.lower, lo, hi - lo);
    close(ci.upper, hi, hi - lo);
  });

  it("agrees with scipy for a mean", () => {
    const [lo, hi] = fx.bootstrap.meanA;
    const ci = meanBootstrap(a, { B: 20_000 });
    close(ci.lower, lo, hi - lo);
    close(ci.upper, hi, hi - lo);
  });

  it("is deterministic for a seed and records it", () => {
    const x = medianBootstrap(samples.timings, { seed: 7 });
    expect(medianBootstrap(samples.timings, { seed: 7 })).toEqual(x);
    expect(x.seed).toBe(7);
    expect(meanBootstrap(a).seed).toBe(STATS_SEED);
    expect(x.lower).toBeLessThanOrEqual(x.estimate);
    expect(x.upper).toBeGreaterThanOrEqual(x.estimate);
  });

  it("covers the mean of a known distribution about 95% of the time", () => {
    // 200 samples of size 30 from Uniform(0, 1): the 95% percentile interval for
    // the mean should contain 0.5 in roughly 190 of them (binomial sd about 3).
    const rng = createStatsRng(99);
    let covered = 0;
    for (let s = 0; s < 200; s++) {
      const xs = Array.from({ length: 30 }, () => rng.next());
      const ci = meanBootstrap(xs, { B: 500, seed: s });
      if (ci.lower <= 0.5 && 0.5 <= ci.upper) covered++;
    }
    expect(covered).toBeGreaterThan(176);
    expect(covered).toBeLessThan(200);
  });

  it("gives pointwise bands for curves and handles empty input", () => {
    const curve = meanCurveBootstrap([
      [1, 2, 3],
      [1, 3, 5],
      [2, 4, 6],
    ]);
    expect(curve.estimate).toEqual([4 / 3, 3, 14 / 3]);
    curve.estimate.forEach((m, i) => {
      expect(curve.lower[i]).toBeLessThanOrEqual(m);
      expect(curve.upper[i]).toBeGreaterThanOrEqual(m);
    });
    expect(bootstrapCI(0, () => 1).estimate).toBeNaN();
    expect(() => pairedMeanDiffBootstrap([1], [1, 2])).toThrow();
  });
});

describe("pigeonhole bootstrap (sessions x workloads)", () => {
  const popvar = (xs: number[]) => {
    const m = mean(xs);
    return xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  };
  /** Exact bootstrap variance of the grid mean (Owen 2007), K rows by R columns. */
  const exactVariance = (y: number[], K: number, R: number) => {
    const rowSums = Array.from({ length: K }, (_, s) =>
      y.slice(s * R, s * R + R).reduce((t, x) => t + x, 0),
    );
    const colSums = Array.from({ length: R }, (_, r) =>
      Array.from({ length: K }, (_, s) => y[s * R + r]).reduce((t, x) => t + x, 0),
    );
    const grand = mean(y);
    let z2 = 0;
    for (let s = 0; s < K; s++)
      for (let r = 0; r < R; r++)
        z2 += (y[s * R + r] - rowSums[s] / R - colSums[r] / K + grand) ** 2;
    return (z2 + K * popvar(rowSums) + R * popvar(colSums)) / (K * R) ** 2;
  };
  const meanOf = (y: number[], into?: number[]) => (cells: Int32Array) => {
    let t = 0;
    for (let i = 0; i < cells.length; i++) t += y[cells[i]];
    into?.push(t / cells.length);
    return t / cells.length;
  };

  it("the exact variance formula matches full enumeration on a small grid", () => {
    // 2 rows x 3 columns: 2^2 row draws x 3^3 column draws, all equally likely.
    const y = [1, 4, 2, 7, 3, 9];
    const K = 2;
    const R = 3;
    const means: number[] = [];
    for (let a = 0; a < K ** K; a++)
      for (let b = 0; b < R ** R; b++) {
        const rows = [a % K, Math.floor(a / K) % K];
        const cols = [b % R, Math.floor(b / R) % R, Math.floor(b / R / R) % R];
        let t = 0;
        for (const s of rows) for (const r of cols) t += y[s * R + r];
        means.push(t / (K * R));
      }
    expect(mean(means)).toBeCloseTo(mean(y), 12);
    expect(popvar(means)).toBeCloseTo(exactVariance(y, K, R), 12);
  });

  it("its Monte Carlo variance matches the exact formula for a crossed design", () => {
    const K = 5;
    const R = 10;
    const rng = createStatsRng(3);
    const session = Array.from({ length: K }, () => 4 * rng.next());
    const workload = Array.from({ length: R }, () => 10 * rng.next());
    const y = Array.from(
      { length: K * R },
      (_, i) => 100 + session[Math.floor(i / R)] + workload[i % R] + rng.next(),
    );
    const draws: number[] = [];
    const ci = pigeonholeBootstrapCI(K, R, meanOf(y, draws), { B: 20_000 });
    draws.shift(); // the estimate on the full grid
    const exact = exactVariance(y, K, R);
    expect(ci.estimate).toBeCloseTo(mean(y), 12);
    expect(ci.n).toBe(K * R);
    expect(Math.abs(mean(draws) - mean(y))).toBeLessThan(4 * Math.sqrt(exact / 20_000));
    expect(rel(popvar(draws), exact)).toBeLessThan(0.05);
  });

  it("is wider than resampling the cells as if they were independent", () => {
    // Sessions that differ by a constant: the one-way bootstrap over all 50
    // cells barely sees it; the pigeonhole bootstrap does.
    const K = 5;
    const R = 10;
    const rng = createStatsRng(11);
    const y = Array.from(
      { length: K * R },
      (_, i) => 50 + 3 * Math.floor(i / R) + 0.2 * rng.next(),
    );
    const two = pigeonholeBootstrapCI(K, R, meanOf(y));
    const one = bootstrapCI(K * R, meanOf(y));
    expect(two.upper - two.lower).toBeGreaterThan(1.8 * (one.upper - one.lower));
    expect(pigeonholeBootstrapCI(K, R, meanOf(y), { seed: 5 })).toEqual(
      pigeonholeBootstrapCI(K, R, meanOf(y), { seed: 5 }),
    );
    expect(pigeonholeBootstrapCI(0, R, meanOf(y)).estimate).toBeNaN();
  });
});

describe("seeded generator", () => {
  it("is reproducible and uniform enough", () => {
    const r1 = createStatsRng(1);
    const r2 = createStatsRng(1);
    const xs = Array.from({ length: 10_000 }, () => r1.next());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => r2.next()));
    expect(Math.abs(mean(xs) - 0.5)).toBeLessThan(0.01);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
