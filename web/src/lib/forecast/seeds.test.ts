import { describe, expect, it } from "vitest";
import { seedSpread } from "./seeds";
import { DEFAULT_SETTINGS, forecastDatabaseStats } from "./view";

describe("forecasting across seeded traces", () => {
  const stats = forecastDatabaseStats();
  const spread = seedSpread(stats, DEFAULT_SETTINGS, [2023, 2024, 2025], { B: 500 });

  it("summarises each model and strategy over the traces", () => {
    expect(spread.models.map((m) => m.id)).toEqual(["lr", "kr", "hybrid"]);
    for (const m of spread.models) {
      expect(m.values).toHaveLength(3);
      expect(m.mean.lower).toBeLessThanOrEqual(m.mean.estimate);
      expect(m.mean.upper).toBeGreaterThanOrEqual(m.mean.estimate);
    }
    const none = spread.strategies.find((s) => s.id === "none")!;
    const oracle = spread.strategies.find((s) => s.id === "oracle")!;
    expect(oracle.mean.estimate).toBeLessThan(none.mean.estimate);
    expect(spread.strategies.find((s) => s.id === "reactive")!.vsReactive).toBeNull();
  });

  it("compares models against LR as paired ratios of means", () => {
    const lr = spread.models.find((m) => m.id === "lr")!.mean.estimate;
    const kr = spread.models.find((m) => m.id === "kr")!.mean.estimate;
    const vs = spread.vsLr.find((v) => v.id === "kr")!;
    expect(vs.ratio.estimate).toBeCloseTo(kr / lr, 10);
    expect(vs.sign.wins + vs.sign.losses + vs.sign.ties).toBe(3);
  });

  it("is deterministic", () => {
    expect(seedSpread(stats, DEFAULT_SETTINGS, [2023, 2024, 2025], { B: 500 })).toEqual(spread);
  });
});
