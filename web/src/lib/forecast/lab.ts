/**
 * The forecasting lab: QB5000's pipeline end to end on a synthetic trace —
 * templatize, cluster, forecast — and then the self-driving loop of Kossmann &
 * Schlosser (2020): the workload predictor's forecast feeds the tuner, whose
 * configuration the organiser builds before each window begins.
 */
import { autoAdminSelect } from "@/lib/advisors/auto-admin";
import type { WeightedQuery } from "@/lib/advisors/workload-cost";
import type { DatabaseStats } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import { deriveSeed, mulberry32 } from "@/lib/random";
import { READ_TEMPLATES } from "@/lib/workload/templates";
import { clusterTemplates, type Cluster } from "./cluster";
import {
  KernelRegression,
  LinearRegression,
  fromLog,
  hybrid,
  makeDataset,
  mse,
  toLog,
} from "./models";
import { generateTrace, type Trace } from "./trace";

export interface ForecastOptions {
  days: number;
  trainDays: number;
  /** Prediction horizon in hours. */
  horizon: number;
  seed: number;
  lrLags?: number;
  krLags?: number;
  rho?: number;
  /** Use this trace instead of generating one from `seed` (tests perturb it). */
  trace?: Trace;
}

export const DEFAULT_FORECAST: ForecastOptions = {
  days: 21,
  trainDays: 14,
  horizon: 3,
  seed: 2023,
};

export interface ClusterForecast {
  members: string[];
  /** Share of the cluster's training volume per member template. */
  shares: Record<string, number>;
  history: number[];
  lr: number[];
  kr: number[];
  hybrid: number[];
  mse: { lr: number; kr: number; hybrid: number };
}

export interface ForecastResult {
  trace: Trace;
  testStart: number;
  /** Prediction horizon in hours: the forecast for hour h uses data up to h - horizon. */
  horizon: number;
  lrLags: number;
  krLags: number;
  clusters: ClusterForecast[];
}

/**
 * Fit LR and KR on the training weeks of one cluster's log volume and forecast
 * every test hour `horizon` hours ahead: the prediction for hour `target` reads
 * only the observations before `target - horizon + 1`.
 */
function forecastCluster(
  volume: number[],
  testStart: number,
  horizon: number,
  lrLags: number,
  krLags: number,
) {
  const logs = volume.map(toLog);
  const lr = new LinearRegression().fit(makeDataset(logs, lrLags, horizon, testStart));
  const kr = new KernelRegression().fit(makeDataset(logs, krLags, horizon, testStart));
  const preds = { lr: [] as number[], kr: [] as number[], hybrid: [] as number[] };
  const actualLogs: number[] = [];
  for (let target = testStart; target < volume.length; target++) {
    const s = target - horizon + 1; // first index after the input window
    const vLr = fromLog(lr.predict(logs.slice(s - lrLags, s)));
    const vKr = fromLog(kr.predict(logs.slice(s - krLags, s)));
    preds.lr.push(vLr);
    preds.kr.push(vKr);
    preds.hybrid.push(hybrid(vLr, vKr));
    actualLogs.push(logs[target]);
  }
  const logOf = (xs: number[]) => xs.map(toLog);
  return {
    ...preds,
    mse: {
      lr: mse(logOf(preds.lr), actualLogs),
      kr: mse(logOf(preds.kr), actualLogs),
      hybrid: mse(logOf(preds.hybrid), actualLogs),
    },
  };
}

export function runForecast(opts: ForecastOptions = DEFAULT_FORECAST): ForecastResult {
  const { days, trainDays, horizon, seed, lrLags = 24, krLags = 168, rho = 0.8 } = opts;
  const trace = opts.trace ?? generateTrace({ days, seed });
  const testStart = trainDays * 24;
  const trainHistory = Object.fromEntries(
    Object.entries(trace.series).map(([t, s]) => [t, s.slice(0, testStart)]),
  );
  const clusters: Cluster[] = clusterTemplates(trainHistory, rho);

  const out = clusters.map((c): ClusterForecast => {
    const volume = Array.from({ length: trace.hours }, (_, h) =>
      c.members.reduce((s, m) => s + trace.series[m][h], 0),
    );
    const trainVolume = c.members.map((m) => trainHistory[m].reduce((a, b) => a + b, 0));
    const total = trainVolume.reduce((a, b) => a + b, 0) || 1;
    const shares = Object.fromEntries(c.members.map((m, i) => [m, trainVolume[i] / total]));
    return {
      members: c.members,
      shares,
      history: volume,
      ...forecastCluster(volume, testStart, horizon, lrLags, krLags),
    };
  });
  return { trace, testStart, horizon, lrLags, krLags, clusters: out };
}

/**
 * The workload predictor as the tuning loop sees it. The organiser commits to a
 * configuration before a window [start, start + W) begins, so every hour of the
 * window must be forecast from data observed before `start`. A horizon-H
 * forecast of hour h reads data up to h - H, which is only safe for the whole
 * window when H >= W; for shorter horizons the loop refits the same models
 * W hours ahead (same clusters, lags and training weeks) instead of peeking.
 */
export function loopForecaster(forecast: ForecastResult, windowHours: number) {
  const horizon = Math.max(forecast.horizon, windowHours);
  const clusters =
    horizon === forecast.horizon
      ? forecast.clusters
      : forecast.clusters.map((c) => ({
          ...c,
          ...forecastCluster(
            c.history,
            forecast.testStart,
            horizon,
            forecast.lrLags,
            forecast.krLags,
          ),
        }));
  return {
    horizon,
    /** Forecast statement counts per template for [start, start + windowHours). */
    window(start: number): Map<string, number> {
      const weights = new Map<string, number>();
      for (const c of clusters) {
        let volume = 0;
        for (let h = start; h < start + windowHours; h++)
          volume += c.hybrid[h - forecast.testStart] ?? 0;
        for (const m of c.members) weights.set(m, volume * c.shares[m]);
      }
      return weights;
    },
  };
}

/* ---------------- the self-driving loop ---------------- */

export type Strategy = "none" | "static" | "reactive" | "proactive" | "oracle";

export const STRATEGIES: Record<Strategy, { label: string; blurb: string }> = {
  none: { label: "No index", blurb: "Never tunes." },
  static: { label: "Tune once", blurb: "One configuration from the two training weeks." },
  reactive: { label: "Reactive", blurb: "Tunes for the window that just finished." },
  proactive: { label: "Forecast-driven", blurb: "Tunes for QB5000's forecast of the next window." },
  oracle: {
    label: "Oracle",
    blurb: "Tunes for the true next window. Perfect foresight, but blind to build cost.",
  },
};

export interface WindowResult {
  start: number;
  queryCost: number;
  creationCost: number;
  config: string[];
}

export interface LoopResult {
  windowHours: number;
  /** Horizon of the forecasts the forecast-driven tuner used (at least `windowHours`). */
  forecastHorizon: number;
  windows: number[];
  strategies: Record<Strategy, WindowResult[]>;
  totals: Record<Strategy, number>;
}

function representatives(stats: DatabaseStats, seed: number): Map<string, QueryInstance> {
  const rng = mulberry32(deriveSeed(seed, "forecast-reps"));
  return new Map(READ_TEMPLATES.map((t) => [t.id, { id: t.id, ...t.build(rng, { stats }) }]));
}

export function runTuningLoop(
  forecast: ForecastResult,
  stats: DatabaseStats,
  {
    windowHours = 3,
    budgetBytes,
    seed = 2023,
  }: { windowHours?: number; budgetBytes: number; seed?: number },
): LoopResult {
  const model = new CostModel(stats);
  const reps = representatives(stats, seed);
  const { trace, testStart } = forecast;
  const predictor = loopForecaster(forecast, windowHours);

  const mixActual = (from: number, to: number): WeightedQuery[] =>
    [...reps.entries()].map(([t, query]) => ({
      query,
      weight: trace.series[t].slice(from, to).reduce((a, b) => a + b, 0),
    }));
  const mixForecast = (start: number): WeightedQuery[] => {
    const weights = predictor.window(start);
    return [...reps.entries()].map(([t, query]) => ({ query, weight: weights.get(t) ?? 0 }));
  };
  const tune = (mix: WeightedQuery[]) => autoAdminSelect(mix, model, { budgetBytes, k: 8 });
  const windowCost = (mix: WeightedQuery[], config: IndexDef[]) =>
    mix.reduce((s, { query, weight }) => s + weight * model.estimate(query, config).cost, 0);

  const windows: number[] = [];
  for (let w = testStart; w + windowHours <= trace.hours; w += windowHours) windows.push(w);
  const staticConfig = tune(mixActual(0, testStart));

  const strategies = {} as Record<Strategy, WindowResult[]>;
  (Object.keys(STRATEGIES) as Strategy[]).forEach((s) => {
    let current: IndexDef[] = [];
    strategies[s] = windows.map((start) => {
      const actual = mixActual(start, start + windowHours);
      let next: IndexDef[];
      if (s === "none") next = [];
      else if (s === "static") next = staticConfig;
      else if (s === "reactive") next = tune(mixActual(start - windowHours, start));
      else if (s === "proactive") next = tune(mixForecast(start));
      else next = tune(actual);
      const have = new Set(current.map(indexId));
      const creationCost = next
        .filter((ix) => !have.has(indexId(ix)))
        .reduce((c, ix) => c + model.creationCost(ix), 0);
      current = next;
      return {
        start,
        queryCost: windowCost(actual, next),
        creationCost,
        config: next.map(indexId),
      };
    });
  });
  const totals = Object.fromEntries(
    (Object.keys(strategies) as Strategy[]).map((s) => [
      s,
      strategies[s].reduce((a, w) => a + w.queryCost + w.creationCost, 0),
    ]),
  ) as Record<Strategy, number>;
  return { windowHours, forecastHorizon: predictor.horizon, windows, strategies, totals };
}
