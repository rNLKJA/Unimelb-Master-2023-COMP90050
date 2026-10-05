/**
 * AutoAdmin index selection (Chaudhuri & Narasayya, VLDB 1997), as evaluated
 * by Kossmann et al. (2020):
 *   1. candidate selection — for every query, run the enumeration on that query
 *      alone and keep its best indexes;
 *   2. configuration enumeration — Greedy(m, k): find the best configuration of
 *      at most m indexes exhaustively, then add indexes greedily while the
 *      what-if cost keeps falling (and the budget allows);
 *   3. multi-column iteration — extend the chosen indexes by one more column
 *      from the same queries and repeat, up to the maximum width.
 */
import type { CostModel } from "@/lib/engine/cost-model";
import type { IndexDef, QueryInstance } from "@/lib/engine/types";
import {
  dedupe,
  indexableColumns,
  isRelevant,
  joinColumnOf,
  syntacticCandidates,
} from "./candidates";
import type { OfflineAlgorithm } from "./types";
import { WhatIfWorkload, containsIndex, withIndex, type WorkloadInput } from "./workload-cost";

export interface GreedyOptions {
  m: number;
  k: number;
  budgetBytes: number;
}

function subsets<T>(items: T[], maxSize: number): T[][] {
  const out: T[][] = [[]];
  const rec = (start: number, acc: T[]) => {
    for (let i = start; i < items.length; i++) {
      const next = [...acc, items[i]];
      out.push(next);
      if (next.length < maxSize) rec(i + 1, next);
    }
  };
  rec(0, []);
  return out;
}

/** Greedy(m, k) configuration enumeration with a storage budget. */
export function greedyMK(
  w: WhatIfWorkload,
  candidates: IndexDef[],
  { m, k, budgetBytes }: GreedyOptions,
): IndexDef[] {
  let best: IndexDef[] = [];
  let bestCost = w.cost([]);
  for (const s of subsets(candidates, Math.min(m, k))) {
    if (s.length === 0 || w.bytes(s) > budgetBytes) continue;
    const c = w.cost(s);
    if (c < bestCost - 1e-9) {
      best = s;
      bestCost = c;
    }
  }
  while (best.length < k) {
    let pick: IndexDef | null = null;
    let pickCost = bestCost;
    for (const ix of candidates) {
      if (containsIndex(best, ix)) continue;
      const next = withIndex(best, ix);
      if (w.bytes(next) > budgetBytes) continue;
      const c = w.cost(next);
      if (c < pickCost - 1e-9) {
        pick = ix;
        pickCost = c;
      }
    }
    if (!pick) break;
    best = withIndex(best, pick);
    bestCost = pickCost;
  }
  return best;
}

/** Extend each selected index by one indexable column of a query that touches its table. */
function extendByOneColumn(selected: IndexDef[], workload: QueryInstance[]): IndexDef[] {
  const out: IndexDef[] = [];
  for (const ix of selected) {
    for (const q of workload) {
      q.access.forEach((access, i) => {
        if (access.table !== ix.table) return;
        const cols = indexableColumns(access, joinColumnOf(q, i));
        if (!ix.columns.every((c) => cols.includes(c))) return;
        for (const c of cols)
          if (!ix.columns.includes(c)) out.push({ table: ix.table, columns: [...ix.columns, c] });
      });
    }
  }
  return dedupe(out);
}

export function autoAdminSelect(
  input: WorkloadInput,
  model: CostModel,
  {
    budgetBytes,
    maxWidth = 2,
    m = 2,
    k = 12,
  }: { budgetBytes: number; maxWidth?: number; m?: number; k?: number },
): IndexDef[] {
  const full = new WhatIfWorkload(model, input);
  const workload = full.queries;
  let potential = syntacticCandidates(workload, 1);
  let selected: IndexDef[] = [];
  for (let width = 1; width <= maxWidth; width++) {
    // 1. per-query candidate selection
    const candidates: IndexDef[] = [];
    for (const { query } of full.items) {
      const relevant = potential.filter((ix) => isRelevant(ix, query));
      if (relevant.length === 0) continue;
      const single = new WhatIfWorkload(model, [query]);
      candidates.push(...greedyMK(single, relevant, { m, k, budgetBytes }));
    }
    // 2. enumeration over the whole workload
    selected = greedyMK(full, dedupe(candidates), { m, k, budgetBytes });
    // 3. widen for the next iteration
    potential = dedupe([...selected, ...extendByOneColumn(selected, workload)]);
  }
  return selected;
}

export const autoAdmin: OfflineAlgorithm = ({ workload, budgetBytes, model }) =>
  autoAdminSelect(workload, model, { budgetBytes });
