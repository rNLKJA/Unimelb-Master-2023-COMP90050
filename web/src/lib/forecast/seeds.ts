/**
 * The forecasting lab on one trace is a single sample. This runs the same
 * pipeline (same settings) on several seeded traces and summarises the spread:
 * each model's mean forecast error with a bootstrap interval over traces,
 * paired comparisons against linear regression, and the tuning loop's
 * estimated cost per strategy against the reactive tuner.
 */
import type { DatabaseStats } from "@/lib/db/stats";
import {
  mean,
  meanBootstrap,
  pairedRatioBootstrap,
  pairedSignTest,
  STATS_SEED,
  type BootstrapInterval,
  type SignTestResult,
} from "@/lib/stats";
import { STRATEGIES, type Strategy } from "./lab";
import { buildForecastView, type ForecastSettings } from "./view";

export type ModelId = "lr" | "kr" | "hybrid";

export interface SeedSpread {
  seeds: number[];
  bootstrap: { B: number; seed: number };
  /** Mean over clusters of each trace's test-week log MSE, per model. */
  models: { id: ModelId; values: number[]; mean: BootstrapInterval }[];
  /** Model error / LR error (ratio of means over traces); below 1 means more accurate than LR. */
  vsLr: { id: ModelId; ratio: BootstrapInterval; sign: SignTestResult }[];
  /** Estimated query + build cost of the tuning loop, per strategy. */
  strategies: {
    id: Strategy;
    label: string;
    values: number[];
    mean: BootstrapInterval;
    /** Strategy cost / reactive cost; below 1 means cheaper than tuning for the last window. */
    vsReactive: BootstrapInterval | null;
    sign: SignTestResult | null;
  }[];
}

export function seedSpread(
  stats: DatabaseStats,
  settings: ForecastSettings,
  seeds: number[],
  { B = 2000, seed = STATS_SEED }: { B?: number; seed?: number } = {},
): SeedSpread {
  const views = seeds.map((s) => buildForecastView(stats, { ...settings, seed: s }));
  const boot = { B, seed };
  const modelValues = (m: ModelId) => views.map((v) => mean(v.clusters.map((c) => c.mse[m])));
  const ids: ModelId[] = ["lr", "kr", "hybrid"];
  const lr = modelValues("lr");
  const reactive = views.map((v) => v.loop.strategies.find((s) => s.id === "reactive")!.total);
  return {
    seeds,
    bootstrap: boot,
    models: ids.map((id) => ({
      id,
      values: modelValues(id),
      mean: meanBootstrap(modelValues(id), boot),
    })),
    vsLr: (["kr", "hybrid"] as const).map((id) => {
      // smaller error wins the sign test
      const v = modelValues(id);
      return { id, ratio: pairedRatioBootstrap(v, lr, boot), sign: pairedSignTest(v, lr) };
    }),
    strategies: (Object.keys(STRATEGIES) as Strategy[]).map((id) => {
      const values = views.map((v) => v.loop.strategies.find((s) => s.id === id)!.total);
      return {
        id,
        label: STRATEGIES[id].label,
        values,
        mean: meanBootstrap(values, boot),
        vsReactive: id === "reactive" ? null : pairedRatioBootstrap(values, reactive, boot),
        sign: id === "reactive" ? null : pairedSignTest(values, reactive),
      };
    }),
  };
}

/** The traces the forecasting page summarises: the default seed and the nine after it. */
export const SPREAD_SEEDS = Array.from({ length: 10 }, (_, i) => 2023 + i);
