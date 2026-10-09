/**
 * QB5000's Forecaster (Ma 2021, §3.5), on log-transformed hourly volumes:
 *
 *  - LR: linear auto-regression on the last `lags` observations, closed-form
 *    ridge solution (no iterative training).
 *  - KR: Nadaraya-Watson kernel regression with a Gaussian kernel — a weighted
 *    average of training targets, weighted by how similar their input windows
 *    are. Trained on the whole history so it can recall rare, periodic spikes.
 *  - HYBRID: use the ensemble prediction unless KR predicts a volume more than
 *    γ = 150% above it, in which case trust KR's spike.
 *
 * QB5000's ENSEMBLE averages LR with an LSTM; training an LSTM in the browser
 * is out of scope, so LR stands in for the ensemble here (stated on the page).
 */
import { invert, matVec } from "@/lib/linalg";

export interface Dataset {
  X: number[][];
  y: number[];
}

/** log(1 + x): QB5000 measures accuracy as MSE in log space. */
export const toLog = (x: number) => Math.log1p(Math.max(0, x));
export const fromLog = (x: number) => Math.max(0, Math.expm1(x));

/** Windows of `lags` values predicting the value `horizon` steps after the window. */
export function makeDataset(
  series: number[],
  lags: number,
  horizon: number,
  end = series.length,
): Dataset {
  const X: number[][] = [];
  const y: number[] = [];
  for (let t = lags; t + horizon - 1 < end; t++) {
    X.push(series.slice(t - lags, t));
    y.push(series[t + horizon - 1]);
  }
  return { X, y };
}

export class LinearRegression {
  private w: Float64Array = new Float64Array(0);
  constructor(private readonly ridge = 1e-3) {}

  fit({ X, y }: Dataset): this {
    const d = X[0].length + 1;
    const xtx = Array.from({ length: d }, () => new Float64Array(d));
    const xty = new Float64Array(d);
    for (let n = 0; n < X.length; n++) {
      const row = [1, ...X[n]];
      for (let i = 0; i < d; i++) {
        xty[i] += row[i] * y[n];
        for (let j = 0; j < d; j++) xtx[i][j] += row[i] * row[j];
      }
    }
    for (let i = 1; i < d; i++) xtx[i][i] += this.ridge * X.length;
    this.w = matVec(invert(xtx), xty);
    return this;
  }

  predict(x: number[]): number {
    let s = this.w[0];
    for (let i = 0; i < x.length; i++) s += this.w[i + 1] * x[i];
    return s;
  }

  get weights(): number[] {
    return [...this.w];
  }
}

export class KernelRegression {
  private X: number[][] = [];
  private y: number[] = [];
  bandwidth = 1;

  /** `bandwidth` defaults to the median pairwise distance of a sample (median heuristic). */
  fit({ X, y }: Dataset, bandwidth?: number): this {
    this.X = X;
    this.y = y;
    if (bandwidth) this.bandwidth = bandwidth;
    else {
      const d: number[] = [];
      const step = Math.max(1, Math.floor(X.length / 40));
      for (let i = 0; i < X.length; i += step)
        for (let j = i + step; j < X.length; j += step) d.push(dist2(X[i], X[j]));
      d.sort((a, b) => a - b);
      this.bandwidth = Math.sqrt(d[Math.floor(d.length / 2)] ?? 1) / 2 || 1;
    }
    return this;
  }

  predict(x: number[]): number {
    let num = 0;
    let den = 0;
    const h2 = 2 * this.bandwidth * this.bandwidth;
    for (let i = 0; i < this.X.length; i++) {
      const w = Math.exp(-dist2(x, this.X[i]) / h2);
      num += w * this.y[i];
      den += w;
    }
    return den > 1e-300
      ? num / den
      : this.y.reduce((a, b) => a + b, 0) / Math.max(1, this.y.length);
  }
}

function dist2(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s;
}

export const HYBRID_GAMMA = 1.5;

/** QB5000's HYBRID rule, applied to volumes (not logs). */
export function hybrid(ensembleVolume: number, krVolume: number, gamma = HYBRID_GAMMA): number {
  return krVolume > ensembleVolume * (1 + gamma) ? krVolume : ensembleVolume;
}

export function mse(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return s / Math.max(1, a.length);
}
