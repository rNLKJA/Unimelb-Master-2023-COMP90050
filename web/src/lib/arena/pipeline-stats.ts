/**
 * Counts for the landing page's "enumerate → select → explore" diagram,
 * computed from the real advisors on the default workload (at build time).
 */
import { greedyMK, autoAdminSelect } from "@/lib/advisors/auto-admin";
import { dedupe, isRelevant, syntacticCandidates } from "@/lib/advisors/candidates";
import { WhatIfWorkload } from "@/lib/advisors/workload-cost";
import { generateDatabase } from "@/lib/db/generate";
import { computeStats, databaseBytes } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { generateWorkload } from "@/lib/workload/scenarios";

export function pipelineCounts() {
  const stats = computeStats(generateDatabase({ orders: 7_500, seed: 2023 }));
  const workload = generateWorkload({ scenario: "static", rounds: 1, seed: 2023, stats }).rounds[0];
  const model = new CostModel(stats);
  const budgetBytes = databaseBytes(stats);
  const candidates = syntacticCandidates(workload, 2);
  const w = new WhatIfWorkload(model, workload);
  const perQuery = dedupe(
    w.items.flatMap(({ query }) =>
      greedyMK(
        new WhatIfWorkload(model, [query]),
        candidates.filter((ix) => isRelevant(ix, query)),
        {
          m: 2,
          k: 12,
          budgetBytes,
        },
      ),
    ),
  );
  const counter = new CostModel(stats);
  const chosen = autoAdminSelect(workload, counter, { budgetBytes });
  return {
    candidates: candidates.length,
    perQuery: perQuery.length,
    chosen: chosen.length,
    calls: counter.calls,
  };
}
