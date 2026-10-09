/**
 * DROP heuristic (Whang 1985). Start from every single-column candidate index
 * and repeatedly drop the index whose removal raises the workload cost the
 * least, until the configuration fits the storage budget; then keep dropping
 * indexes whose removal costs nothing. Single-column only, as in the original
 * and in Kossmann et al.'s (2020) re-implementation.
 */
import { syntacticCandidates } from "./candidates";
import type { OfflineAlgorithm } from "./types";
import { WhatIfWorkload, without } from "./workload-cost";

export const drop: OfflineAlgorithm = ({ workload, budgetBytes, model }) => {
  const w = new WhatIfWorkload(model, workload);
  let config = syntacticCandidates(workload, 1);
  let current = w.cost(config);
  while (config.length > 0) {
    let best = config[0];
    let bestCost = Infinity;
    for (const ix of config) {
      const c = w.cost(without(config, ix));
      if (c < bestCost) {
        bestCost = c;
        best = ix;
      }
    }
    const overBudget = w.bytes(config) > budgetBytes;
    if (overBudget || bestCost <= current + 1e-9) {
      config = without(config, best);
      current = bestCost;
    } else break;
  }
  return config;
};
