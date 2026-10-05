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
  clusters: ClusterForecast[];
}

export function runForecast(opts: ForecastOptions = DEFAULT_FORECAST): ForecastResult {
  const { days, trainDays, horizon, seed, lrLags = 24, krLags = 168, rho = 0.8 } = opts;
  const trace = generateTrace({ days, seed });
  const testStart = trainDays * 24;
  const trainHistory = Object.fromEntries(
    Object.entries(trace.series).map(([t, s]) => [t, s.slice(0, testStart)]),
  );
  const clusters: Cluster[] = clusterTemplates(trainHistory, rho);

  const out = clusters.map((c): ClusterForecast => {
    const volume = Array.from({ length: trace.hours }, (_, h) =>
      c.members.reduce((s, m) => s + trace.series[m][h], 0),
    );
    const logs = volume.map(toLog);
    const trainVolume = c.members.map((m) => trainHistory[m].reduce((a, b) => a + b, 0));
    const total = trainVolume.reduce((a, b) => a + b, 0) || 1;
    const shares = Object.fromEntries(c.members.map((m, i) => [m, trainVolume[i] / total]));

    const lr = new LinearRegression().fit(makeDataset(logs, lrLags, horizon, testStart));
    const kr = new KernelRegression().fit(makeDataset(logs, krLags, horizon, testStart));
    const preds = { lr: [] as number[], kr: [] as number[], hybrid: [] as number[] };
    const actualLogs: number[] = [];
    for (let target = testStart; target < trace.hours; target++) {
      const s = target - horizon + 1; // first index after the input window
      const pLr = lr.predict(logs.slice(s - lrLags, s));
      const pKr = kr.predict(logs.slice(s - krLags, s));
      const vLr = fromLog(pLr);
      const vKr = fromLog(pKr);
      preds.lr.push(vLr);
      preds.kr.push(vKr);
      preds.hybrid.push(hybrid(vLr, vKr));
      actualLogs.push(logs[target]);
    }
    const logOf = (xs: number[]) => xs.map(toLog);
    return {
      members: c.members,
      shares,
      history: volume,
      lr: preds.lr,
      kr: preds.kr,
      hybrid: preds.hybrid,
      mse: {
        lr: mse(logOf(preds.lr), actualLogs),
        kr: mse(logOf(preds.kr), actualLogs),
        hybrid: mse(logOf(preds.hybrid), actualLogs),
      },
    };
  });
  return { trace, testStart, clusters: out };
}

/* ---------------- the self-driving loop ---------------- */

export type Strategy = "none" | "static" | "reactive" | "proactive" | "oracle";

export const STRATEGIES: Record<Strategy, { label: string; blurb: string }> = {
  none: { label: "No index", blurb: "Never tunes." },
  static: { label: "Tune once", blurb: "One configuration from the two training weeks." },
  reactive: { label: "Reactive", blurb: "Tunes for the window that just finished." },
  proactive: { label: "Forecast-driven", blurb: "Tunes for QB5000's forecast of the next window." },
  oracle: { label: "Oracle", blurb: "Tunes for the true next window (an upper bound)." },
};

export interface WindowResult {
  start: number;
  queryCost: number;
  creationCost: number;
  config: string[];
}

export interface LoopResult {
  windowHours: number;
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
  const hourIndex = (h: number) => h - testStart;

  const mixActual = (from: number, to: number): WeightedQuery[] =>
    [...reps.entries()].map(([t, query]) => ({
      query,
      weight: trace.series[t].slice(from, to).reduce((a, b) => a + b, 0),
    }));
  const mixForecast = (from: number, to: number): WeightedQuery[] => {
    const weights = new Map<string, number>();
    for (const c of forecast.clusters) {
      let volume = 0;
      for (let h = from; h < to; h++) volume += c.hybrid[hourIndex(h)] ?? 0;
      for (const m of c.members) weights.set(m, volume * c.shares[m]);
    }
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
      else if (s === "proactive") next = tune(mixForecast(start, start + windowHours));
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
  return { windowHours, windows, strategies, totals };
}
