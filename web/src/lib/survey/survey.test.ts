/**
 * Parity with the 2023 group report: the numbers and claims the site repeats
 * must match what the report printed.
 */
import { describe, expect, it } from "vitest";
import { ADVISORS } from "@/lib/advisors/registry";
import { PAPERS, PAPER_BY_ID } from "./papers";
import { AUTONOMY_LEVELS, TABLE_2, comparisons } from "./report";

describe("report Table 2 (Perera et al., minutes)", () => {
  it("each row's components add up to its total (to the report's rounding)", () => {
    for (const r of TABLE_2) {
      expect(Math.abs(r.recommendation + r.creation + r.execution - r.total)).toBeLessThanOrEqual(
        0.011,
      );
    }
  });

  it("MAB recommends faster than PDTool in every setting", () => {
    for (const c of comparisons())
      expect(c.mab.recommendation).toBeLessThan(c.pdtool.recommendation);
  });

  it("MAB wins on total time everywhere except static TPC-H", () => {
    const losses = comparisons().filter((c) => c.change > 0);
    expect(losses.map((c) => `${c.workload} ${c.mode}`)).toEqual(["TPC-H Static"]);
  });

  it("the biggest win is TPC-DS random, about 61% less time", () => {
    const best = comparisons().reduce((a, b) => (a.change < b.change ? a : b));
    expect(`${best.workload} ${best.mode}`).toBe("TPC-DS Random");
    expect(best.change).toBeCloseTo(-0.613, 3);
  });
});

describe("autonomy levels (report Table 1)", () => {
  it("runs from manual (0) to self-driving (5)", () => {
    expect(AUTONOMY_LEVELS.map((l) => l.name)).toEqual([
      "Manual",
      "Assistant",
      "Mixed",
      "Local",
      "Directed",
      "Self-driving",
    ]);
  });
});

describe("taxonomy", () => {
  it("has unique ids and https links", () => {
    expect(new Set(PAPERS.map((p) => p.id)).size).toBe(PAPERS.length);
    for (const p of PAPERS) expect(p.url).toMatch(/^https:\/\//);
  });

  it("covers the report's bibliography (refs 3-21, the benchmarks aside)", () => {
    const refs = new Set(PAPERS.flatMap((p) => (p.reportRef ? [p.reportRef] : [])));
    for (let r = 3; r <= 21; r++) expect(refs.has(r)).toBe(true);
  });

  it("records the two attribution errors in the 2023 report", () => {
    expect(
      PAPERS.filter((p) => p.erratum)
        .map((p) => p.reportRef)
        .sort(),
    ).toEqual([11, 21]);
  });

  it("links every arena advisor to a surveyed paper", () => {
    for (const a of ADVISORS.filter((x) => x.paper)) expect(PAPER_BY_ID.has(a.paper!)).toBe(true);
  });
});
