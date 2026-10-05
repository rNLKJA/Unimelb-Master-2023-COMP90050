/**
 * A compact, serialisable view of the forecasting lab for the page: the trace,
 * QB5000's clusters and forecasts, and the self-driving loop that turns the
 * forecast into index configurations. Built on the server for the default
 * settings and in the Web Worker when the reader changes them.
 */
import { generateDatabase } from "@/lib/db/generate";
import { SCALES } from "@/lib/db/schema";
import { computeStats, databaseBytes, type DatabaseStats } from "@/lib/db/stats";
import { deriveSeed, mulberry32 } from "@/lib/random";
import { READ_TEMPLATES, type TemplateGroup } from "@/lib/workload/templates";
import { STRATEGIES, runForecast, runTuningLoop, type Strategy } from "./lab";
import { templatize } from "./templatize";

export interface ForecastSettings {
  seed: number;
  /** Prediction horizon in hours. */
  horizon: number;
  /** Cosine-similarity threshold for joining a cluster. */
  rho: number;
  /** Length of a tuning window in hours. */
  windowHours: number;
  /** Index budget as a fraction of the data size. */
  budget: number;
}

export const DEFAULT_SETTINGS: ForecastSettings = {
  seed: 2023,
  horizon: 3,
  rho: 0.8,
  windowHours: 3,
  budget: 0.3,
};

/** The forecasting lab tunes the S-scale database generated from this seed. */
export const FORECAST_DB_SEED = 2023;
export const FORECAST_DB_SCALE = "s" as const;

export const FORECAST_DAYS = 21;
export const TRAIN_DAYS = 14;

export interface ClusterView {
  members: string[];
  /** Hourly volume of the cluster over the whole trace. */
  volume: number[];
  /** Forecasts for every test hour (testStart..hours-1). */
  lr: number[];
  kr: number[];
  hybrid: number[];
  /** Mean squared error in log space, as QB5000 reports it. */
  mse: { lr: number; kr: number; hybrid: number };
  /** Test hours where HYBRID switched to the kernel-regression spike forecast. */
  spikes: number;
}

export interface StrategyView {
  id: Strategy;
  label: string;
  blurb: string;
  total: number;
  query: number;
  creation: number;
  /** Estimated query cost per window. */
  perWindow: number[];
  /** Index ids in place for each window. */
  configs: string[][];
}

export interface ForecastView {
  settings: ForecastSettings;
  hours: number;
  testStart: number;
  templates: {
    id: string;
    title: string;
    group: TemplateGroup;
    series: number[];
    cluster: number;
  }[];
  clusters: ClusterView[];
  loop: {
    windowHours: number;
    windows: number[];
    budgetBytes: number;
    strategies: StrategyView[];
  };
  totalStatements: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function buildForecastView(stats: DatabaseStats, settings: ForecastSettings): ForecastView {
  const forecast = runForecast({
    days: FORECAST_DAYS,
    trainDays: TRAIN_DAYS,
    horizon: settings.horizon,
    seed: settings.seed,
    rho: settings.rho,
  });
  const budgetBytes = Math.round(settings.budget * databaseBytes(stats));
  const loop = runTuningLoop(forecast, stats, {
    windowHours: settings.windowHours,
    budgetBytes,
    seed: settings.seed,
  });
  const clusterOf = new Map<string, number>();
  forecast.clusters.forEach((c, i) => c.members.forEach((m) => clusterOf.set(m, i)));

  const strategies = (Object.keys(STRATEGIES) as Strategy[]).map((id): StrategyView => {
    const ws = loop.strategies[id];
    const query = ws.reduce((s, w) => s + w.queryCost, 0);
    const creation = ws.reduce((s, w) => s + w.creationCost, 0);
    return {
      id,
      ...STRATEGIES[id],
      total: r2(query + creation),
      query: r2(query),
      creation: r2(creation),
      perWindow: ws.map((w) => r2(w.queryCost + w.creationCost)),
      configs: ws.map((w) => w.config),
    };
  });

  return {
    settings,
    hours: forecast.trace.hours,
    testStart: forecast.testStart,
    templates: READ_TEMPLATES.map((t) => ({
      id: t.id,
      title: t.title,
      group: t.group,
      series: forecast.trace.series[t.id],
      cluster: clusterOf.get(t.id) ?? -1,
    })),
    clusters: forecast.clusters.map((c) => ({
      members: c.members,
      volume: c.history,
      lr: c.lr.map(r2),
      kr: c.kr.map(r2),
      hybrid: c.hybrid.map(r2),
      mse: { lr: c.mse.lr, kr: c.mse.kr, hybrid: c.mse.hybrid },
      spikes: c.hybrid.filter((h, i) => h !== c.lr[i]).length,
    })),
    loop: { windowHours: loop.windowHours, windows: loop.windows, budgetBytes, strategies },
    totalStatements: Object.values(forecast.trace.series).reduce(
      (s, xs) => s + xs.reduce((a, b) => a + b, 0),
      0,
    ),
  };
}

/** Raw statements and the templates QB5000's pre-processor reduces them to. */
export function templatizeExamples(
  stats: DatabaseStats,
  ids: string[] = ["Q3", "Q2", "Q5"],
  perTemplate = 2,
  seed = 2023,
) {
  const rng = mulberry32(deriveSeed(seed, "templatize-examples"));
  return ids.flatMap((id) => {
    const t = READ_TEMPLATES.find((x) => x.id === id);
    if (!t) return [];
    return Array.from({ length: perTemplate }, () => {
      const sql = t.build(rng, { stats }).sql;
      return { template: id, sql, normalised: templatize(sql) };
    });
  });
}

/** Which windows each index was present in, for the index-timeline view. */
export function indexTimeline(configs: string[][]): { id: string; present: boolean[] }[] {
  const order = new Map<string, number>();
  configs.forEach((c, w) => c.forEach((id) => !order.has(id) && order.set(id, w)));
  return [...order.keys()]
    .sort((a, b) => order.get(a)! - order.get(b)! || a.localeCompare(b))
    .map((id) => ({ id, present: configs.map((c) => c.includes(id)) }));
}

/** Statistics of the database the forecasting lab tunes (also built in the worker). */
export function forecastDatabaseStats(): DatabaseStats {
  return computeStats(
    generateDatabase({ orders: SCALES[FORECAST_DB_SCALE].orders, seed: FORECAST_DB_SEED }),
  );
}
