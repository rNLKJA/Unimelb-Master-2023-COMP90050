import { describe, expect, it } from "vitest";
import { databaseBytes } from "@/lib/db/stats";
import { smallDb } from "@/lib/test/fixtures";
import { clusterTemplates, cosine } from "./cluster";
import { DEFAULT_FORECAST, loopForecaster, runForecast, runTuningLoop } from "./lab";
import { KernelRegression, LinearRegression, hybrid, makeDataset } from "./models";
import { templatize } from "./templatize";

describe("QB5000 pre-processor", () => {
  it("replaces constants with placeholders", () => {
    expect(templatize("select * from foo where id = 5")).toBe("SELECT * FROM foo WHERE id = ?");
    expect(templatize("SELECT a FROM t WHERE d BETWEEN '1994-01-01' AND '1994-02-01'")).toBe(
      "SELECT a FROM t WHERE d BETWEEN ? AND ?",
    );
  });

  it("collapses IN lists and whitespace, but keeps identifiers with digits", () => {
    expect(templatize("SELECT x1 FROM t2   WHERE k IN (1, 2,3)")).toBe(
      "SELECT x1 FROM t2 WHERE k IN (?)",
    );
  });
});

describe("clustering", () => {
  it("groups series with the same shape regardless of scale", () => {
    const base = Array.from({ length: 48 }, (_, h) => 1 + Math.sin((h / 24) * 2 * Math.PI));
    const other = Array.from({ length: 48 }, (_, h) => 1 + Math.cos((h / 24) * 2 * Math.PI));
    const clusters = clusterTemplates({ a: base, b: base.map((x) => 3 * x), c: other });
    expect(clusters.map((c) => c.members)).toEqual([["a", "b"], ["c"]]);
    expect(cosine(base, base)).toBeCloseTo(1, 12);
  });

  it("recovers the three behavioural groups of the synthetic trace", () => {
    const f = runForecast(DEFAULT_FORECAST);
    expect(f.clusters.map((c) => c.members.join(","))).toEqual([
      "Q1,Q10,Q11,Q5,Q9",
      "Q2,Q4,Q8",
      "Q12,Q3,Q6,Q7",
    ]);
  });
});

describe("forecasting models", () => {
  it("linear regression recovers an exact AR(2) process", () => {
    const s = [1, 2];
    for (let t = 2; t < 60; t++) s.push(0.6 * s[t - 1] + 0.3 * s[t - 2] + 1);
    const lr = new LinearRegression(0).fit(makeDataset(s, 2, 1));
    expect(lr.predict([s[58], s[59]])).toBeCloseTo(0.6 * s[59] + 0.3 * s[58] + 1, 6);
  });

  it("kernel regression returns the training target for a training input", () => {
    const kr = new KernelRegression().fit({ X: [[0], [10], [20]], y: [1, 5, 9] }, 0.5);
    expect(kr.predict([10])).toBeCloseTo(5, 6);
  });

  it("HYBRID switches to KR only for a spike above γ = 150%", () => {
    expect(hybrid(10, 24)).toBe(10);
    expect(hybrid(10, 26)).toBe(26);
  });

  it("HYBRID catches the shipping cluster's spikes better than LR alone", () => {
    const shipping = runForecast(DEFAULT_FORECAST).clusters.find((c) => c.members.includes("Q2"))!;
    expect(shipping.mse.hybrid).toBeLessThan(shipping.mse.lr);
  });
});

describe("self-driving loop", () => {
  it("forecast-driven tuning beats reactive tuning and approaches the oracle", () => {
    const { stats } = smallDb();
    const loop = runTuningLoop(runForecast(DEFAULT_FORECAST), stats, {
      budgetBytes: 0.3 * databaseBytes(stats),
    });
    const t = loop.totals;
    expect(t.oracle).toBeLessThanOrEqual(t.proactive);
    expect(t.proactive).toBeLessThan(t.reactive);
    expect(t.reactive).toBeLessThan(t.none);
    expect(t.static).toBeLessThan(t.none);
  });
});

describe("self-driving loop never looks ahead", () => {
  // The organiser builds a window's configuration before the window starts, so
  // the forecast it tunes for must not change when anything from `start` on
  // changes. Checked for every horizon and window the lab's controls offer.
  const base = runForecast(DEFAULT_FORECAST).trace;
  const scrambled = (from: number) => ({
    ...base,
    series: Object.fromEntries(
      Object.entries(base.series).map(([t, s], k) => [
        t,
        s.map((v, h) => (h < from ? v : (v * (k + 2) + 37 * ((h * 7 + k) % 11)) % 400)),
      ]),
    ),
  });

  for (const horizon of [1, 3, 6, 12, 24]) {
    for (const windowHours of [1, 3, 6]) {
      it(`horizon ${horizon} h, window ${windowHours} h`, () => {
        const opts = { ...DEFAULT_FORECAST, horizon };
        const original = runForecast({ ...opts, trace: base });
        const start = original.testStart + 4 * windowHours;
        const perturbed = runForecast({ ...opts, trace: scrambled(start) });
        const a = loopForecaster(original, windowHours);
        const b = loopForecaster(perturbed, windowHours);
        expect(a.horizon).toBeGreaterThanOrEqual(windowHours);
        expect([...b.window(start)]).toEqual([...a.window(start)]);
        // ...whereas the next window is allowed to (and does) react to the new data.
        expect([...b.window(start + a.horizon + windowHours)]).not.toEqual([
          ...a.window(start + a.horizon + windowHours),
        ]);
      });
    }
  }
});
