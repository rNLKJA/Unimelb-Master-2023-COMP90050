import { describe, expect, it } from "vitest";
import { CostModel } from "@/lib/engine/cost-model";
import { indexId, type IndexDef } from "@/lib/engine/types";
import { databaseBytes } from "@/lib/db/stats";
import { mulberry32 } from "@/lib/random";
import { smallDb } from "@/lib/test/fixtures";
import { generateWorkload } from "@/lib/workload/scenarios";
import { TEMPLATE_BY_ID } from "@/lib/workload/templates";
import { autoAdmin, greedyMK } from "./auto-admin";
import { candidatesForQuery, permutations, syntacticCandidates } from "./candidates";
import { solveCophy } from "./cophy";
import { db2Advisor } from "./db2-advisor";
import { drop } from "./drop";
import { WhatIfWorkload } from "./workload-cost";

const { stats } = smallDb();
const workload = generateWorkload({ scenario: "static", rounds: 1, seed: 3, stats }).rounds[0];
const budget = databaseBytes(stats);

function bruteForce(w: WhatIfWorkload, cands: IndexDef[], budgetBytes: number) {
  let best = { config: [] as IndexDef[], cost: w.cost([]) };
  for (let mask = 1; mask < 1 << cands.length; mask++) {
    const config = cands.filter((_, i) => mask & (1 << i));
    if (w.bytes(config) > budgetBytes) continue;
    const cost = w.cost(config);
    if (cost < best.cost) best = { config, cost };
  }
  return best;
}

describe("candidate enumeration", () => {
  it("permutes columns", () => {
    expect(permutations(["a", "b", "c"], 2)).toHaveLength(6);
  });

  it("lists AutoAdmin's syntactically relevant indexes", () => {
    const q = { id: "x", ...TEMPLATE_BY_ID.get("Q4")!.build(mulberry32(1), { stats }) };
    expect(candidatesForQuery(q, 2).map(indexId).sort()).toEqual([
      "lineitem(l_shipmode)",
      "lineitem(l_shipmode, l_suppkey)",
      "lineitem(l_suppkey)",
      "lineitem(l_suppkey, l_shipmode)",
    ]);
  });

  it("includes join columns of both join sides", () => {
    const q = { id: "x", ...TEMPLATE_BY_ID.get("Q5")!.build(mulberry32(1), { stats }) };
    const ids = candidatesForQuery(q, 1).map(indexId);
    expect(ids).toContain("lineitem(l_orderkey)");
    expect(ids).toContain("orders(o_custkey)");
  });
});

describe("offline advisors", () => {
  const model = new CostModel(stats);
  const w = new WhatIfWorkload(model, workload);
  const rng = mulberry32(4);
  const results = {
    drop: drop({ workload, budgetBytes: budget, model, rng }),
    autoadmin: autoAdmin({ workload, budgetBytes: budget, model, rng }),
    db2advis: db2Advisor({ workload, budgetBytes: budget, model, rng }),
    cophy: solveCophy(workload, model, { budgetBytes: budget }),
  };

  it("all respect the storage budget and beat no index", () => {
    const none = w.cost([]);
    for (const config of [
      results.drop,
      results.autoadmin,
      results.db2advis,
      results.cophy.config,
    ]) {
      expect(w.bytes(config)).toBeLessThanOrEqual(budget);
      expect(w.cost(config)).toBeLessThan(none * 0.5);
    }
  });

  it("DROP keeps single-column indexes only", () => {
    expect(results.drop.every((ix) => ix.columns.length === 1)).toBe(true);
  });

  it("CoPhy proves optimality and is at least as good as the heuristics", () => {
    expect(results.cophy.optimal).toBe(true);
    const cophy = w.cost(results.cophy.config);
    for (const config of [results.drop, results.autoadmin, results.db2advis]) {
      expect(cophy).toBeLessThanOrEqual(w.cost(config) * 1.001);
    }
  });

  it("CoPhy's objective matches the what-if cost of its answer", () => {
    expect(results.cophy.cost).toBeCloseTo(w.cost(results.cophy.config), 6);
  });

  it("CoPhy matches brute force on a small instance", () => {
    const small = workload.filter((q) => ["Q3", "Q4", "Q12"].includes(q.template));
    const sw = new WhatIfWorkload(model, small);
    const cands = syntacticCandidates(small, 2);
    const tight = 700_000;
    const exact = bruteForce(sw, cands, tight);
    const solved = solveCophy(small, model, { budgetBytes: tight });
    expect(solved.optimal).toBe(true);
    expect(sw.cost(solved.config)).toBeCloseTo(exact.cost, 9);
  });

  it("CoPhy returns no redundant index, however loose the budget", () => {
    for (const factor of [0.5, 1, 2, 3]) {
      const solved = solveCophy(workload, model, { budgetBytes: factor * budget });
      const cost = w.cost(solved.config);
      expect(solved.cost).toBeCloseTo(cost, 6);
      for (const ix of solved.config) {
        const without = solved.config.filter((other) => other !== ix);
        expect(w.cost(without), `${indexId(ix)} at ${factor}x`).toBeGreaterThan(cost + 1e-9);
      }
    }
  });

  it("a looser budget never makes CoPhy build more for the same cost", () => {
    const at2 = solveCophy(workload, model, { budgetBytes: 2 * budget });
    const at3 = solveCophy(workload, model, { budgetBytes: 3 * budget });
    if (Math.abs(at2.cost - at3.cost) < 1e-9 * at2.cost)
      expect(w.bytes(at3.config)).toBeLessThanOrEqual(w.bytes(at2.config));
    else expect(at3.cost).toBeLessThan(at2.cost);
  });

  it("Greedy(m, k) with m = k is exhaustive", () => {
    const small = workload.filter((q) => ["Q1", "Q10", "Q11"].includes(q.template));
    const sw = new WhatIfWorkload(model, small);
    const cands = syntacticCandidates(small, 1);
    const g = greedyMK(sw, cands, { m: cands.length, k: cands.length, budgetBytes: 150_000 });
    expect(sw.cost(g)).toBeCloseTo(bruteForce(sw, cands, 150_000).cost, 9);
  });

  it("DB2 Advisor is reproducible for a seed", () => {
    const again = db2Advisor({ workload, budgetBytes: budget, model, rng: mulberry32(4) });
    expect(again.map(indexId)).toEqual(results.db2advis.map(indexId));
  });
});
