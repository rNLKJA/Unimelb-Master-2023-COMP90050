import { describe, expect, it } from "vitest";
import { smallDb } from "@/lib/test/fixtures";
import { DEFAULT_SETTINGS, buildForecastView, indexTimeline, templatizeExamples } from "./view";

describe("forecast view", () => {
  const { stats } = smallDb();
  const view = buildForecastView(stats, DEFAULT_SETTINGS);

  it("covers three weeks, testing on the last one", () => {
    expect(view.hours).toBe(21 * 24);
    expect(view.testStart).toBe(14 * 24);
    for (const c of view.clusters) expect(c.hybrid).toHaveLength(7 * 24);
  });

  it("assigns every template to exactly one cluster", () => {
    const members = view.clusters.flatMap((c) => c.members).sort();
    expect(members).toEqual(view.templates.map((t) => t.id).sort());
    for (const t of view.templates) expect(view.clusters[t.cluster].members).toContain(t.id);
  });

  it("orders the strategies as the self-driving argument predicts", () => {
    const total = Object.fromEntries(view.loop.strategies.map((s) => [s.id, s.total]));
    expect(total.oracle).toBeLessThanOrEqual(total.proactive);
    expect(total.proactive).toBeLessThan(total.reactive);
    expect(total.reactive).toBeLessThan(total.none);
    for (const s of view.loop.strategies) {
      expect(s.perWindow).toHaveLength(view.loop.windows.length);
      expect(s.total).toBeCloseTo(s.query + s.creation, 1);
    }
  });

  it("a looser clustering threshold merges templates into fewer clusters", () => {
    const loose = buildForecastView(stats, { ...DEFAULT_SETTINGS, rho: 0.3 });
    expect(loose.clusters.length).toBeLessThan(view.clusters.length);
  });

  it("templatises statements that differ only in constants to the same template", () => {
    const ex = templatizeExamples(stats);
    const byTemplate = new Map<string, Set<string>>();
    for (const e of ex) {
      if (!byTemplate.has(e.template)) byTemplate.set(e.template, new Set());
      byTemplate.get(e.template)!.add(e.normalised);
    }
    for (const forms of byTemplate.values()) expect(forms.size).toBe(1);
    expect(new Set(ex.map((e) => e.sql)).size).toBe(ex.length);
  });

  it("builds an index timeline in order of first appearance", () => {
    expect(indexTimeline([["a"], ["a", "b"], ["b"]])).toEqual([
      { id: "a", present: [true, true, false] },
      { id: "b", present: [false, true, true] },
    ]);
  });
});
