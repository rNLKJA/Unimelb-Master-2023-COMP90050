/**
 * DB2 Advisor (Valentin et al., ICDE 2000). The optimiser is asked to plan
 * every query with all candidate indexes available as virtual indexes; each
 * query's improvement is credited to the indexes its best plan uses. The
 * indexes are then packed into the storage budget by benefit-to-size ratio
 * (a knapsack heuristic), and a randomised TRY_VARIATION phase swaps chosen and
 * unchosen indexes, keeping any swap that lowers the workload cost.
 */
import { indexId, type IndexDef } from "@/lib/engine/types";
import { pick } from "@/lib/random";
import { syntacticCandidates } from "./candidates";
import type { OfflineAlgorithm } from "./types";
import { WhatIfWorkload, containsIndex } from "./workload-cost";

export const db2Advisor: OfflineAlgorithm = ({ workload, budgetBytes, model, rng }) => {
  const w = new WhatIfWorkload(model, workload);
  const candidates = syntacticCandidates(workload, 2);
  const benefit = new Map<string, number>();
  const byId = new Map(candidates.map((ix) => [indexId(ix), ix]));

  for (const { query, weight } of w.items) {
    const base = model.estimate(query, []).cost;
    const plan = model.estimate(query, candidates);
    const gain = (base - plan.cost) * weight;
    if (plan.used.length === 0) continue;
    for (const id of plan.used) benefit.set(id, (benefit.get(id) ?? 0) + gain / plan.used.length);
  }

  const ranked = [...benefit.entries()]
    .filter(([, b]) => b > 0)
    .map(([id, b]) => ({ ix: byId.get(id)!, ratio: b / model.indexBytes(byId.get(id)!) }))
    .sort((a, b) => b.ratio - a.ratio);

  let chosen: IndexDef[] = [];
  let used = 0;
  for (const { ix } of ranked) {
    const size = model.indexBytes(ix);
    if (used + size <= budgetBytes) {
      chosen.push(ix);
      used += size;
    }
  }

  // TRY_VARIATION: random swaps between the solution and the rest of the candidates.
  const pool = ranked.map((r) => r.ix);
  let bestCost = w.cost(chosen);
  const ITERATIONS = 60;
  for (let it = 0; it < ITERATIONS && pool.length > chosen.length; it++) {
    const outside = pool.filter((ix) => !containsIndex(chosen, ix));
    if (outside.length === 0) break;
    const swapIn = pick(rng, outside);
    let next: IndexDef[];
    if (chosen.length > 0 && rng() < 0.7) {
      const victim = pick(rng, chosen);
      next = chosen.filter((ix) => ix !== victim).concat(swapIn);
    } else next = chosen.concat(swapIn);
    if (w.bytes(next) > budgetBytes) continue;
    const c = w.cost(next);
    if (c < bestCost - 1e-9) {
      chosen = next;
      bestCost = c;
    }
  }
  return chosen;
};
