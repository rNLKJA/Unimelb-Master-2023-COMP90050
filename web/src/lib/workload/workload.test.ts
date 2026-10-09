import { describe, expect, it } from "vitest";
import { smallDb } from "@/lib/test/fixtures";
import { templatize } from "@/lib/forecast/templatize";
import { generateWorkload, jaccard, templateSet } from "./scenarios";
import { READ_TEMPLATES, TEMPLATES } from "./templates";

const { stats } = smallDb();

describe("workload scenarios", () => {
  it("static rounds repeat all twelve read templates three times", () => {
    const w = generateWorkload({ scenario: "static", rounds: 3, seed: 1, stats });
    expect(w.rounds).toHaveLength(3);
    for (const r of w.rounds) {
      expect(r).toHaveLength(36);
      expect(templateSet(r).size).toBe(READ_TEMPLATES.length);
    }
  });

  it("shifting workloads move through three template groups", () => {
    const w = generateWorkload({ scenario: "shifting", rounds: 24, seed: 1, stats });
    expect(w.phases.map((p) => p.start)).toEqual([0, 8, 16]);
    const groups = [0, 8, 16].map((r) => templateSet(w.rounds[r]));
    expect(jaccard(groups[0], groups[1])).toBe(0);
    expect(jaccard(groups[1], groups[2])).toBe(0);
  });

  it("HTAP rounds add one UPDATE per read", () => {
    const w = generateWorkload({ scenario: "htap", rounds: 1, seed: 1, stats });
    expect(w.rounds[0].filter((q) => q.kind === "update")).toHaveLength(36);
  });

  it("is reproducible from its seed", () => {
    const a = generateWorkload({ scenario: "random", rounds: 2, seed: 5, stats });
    const b = generateWorkload({ scenario: "random", rounds: 2, seed: 5, stats });
    expect(a.rounds.flat().map((q) => q.sql)).toEqual(b.rounds.flat().map((q) => q.sql));
  });

  it("every template reduces to one QB5000 template string", () => {
    const w = generateWorkload({ scenario: "static", rounds: 4, seed: 9, stats });
    const byTemplate = new Map<string, Set<string>>();
    for (const q of w.rounds.flat()) {
      byTemplate.set(q.template, (byTemplate.get(q.template) ?? new Set()).add(templatize(q.sql)));
    }
    for (const forms of byTemplate.values()) expect(forms.size).toBe(1);
    const distinct = new Set([...byTemplate.values()].map((s) => [...s][0]));
    expect(distinct.size).toBe(READ_TEMPLATES.length);
    expect(TEMPLATES.map((t) => t.id)).toContain("U1");
  });
});
