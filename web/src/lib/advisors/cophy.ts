/**
 * CoPhy (Dash, Polyzotis & Ailamaki, PVLDB 2011). CoPhy first asks the
 * optimiser — via INUM's cached plans — for the cost of every query under each
 * "atomic configuration" (at most one index per table it touches), then states
 * index selection as a binary integer program:
 *
 *   minimise  Σ_q w_q · min_{a ⊆ X, a atomic for q} cost(q, a)  + maintenance(X)
 *   subject to  Σ_i size_i · x_i ≤ budget,   x_i ∈ {0, 1}
 *
 * and hands it to an LP/IP solver. Our instances are small, so we solve that
 * program exactly with depth-first branch and bound over the cached atomic
 * costs (no further what-if calls during the search). The lower bound switches
 * every undecided index on for lookups but charges maintenance only for the
 * indexes already chosen. A node limit keeps the browser responsive; the
 * result says whether optimality was proven.
 */
import type { CostModel } from "@/lib/engine/cost-model";
import type { IndexDef, QueryInstance } from "@/lib/engine/types";
import { indexableColumns, joinColumnOf, syntacticCandidates } from "./candidates";
import type { OfflineAlgorithm } from "./types";
import { WhatIfWorkload } from "./workload-cost";

export interface CophyResult {
  config: IndexDef[];
  /** Objective value (what-if cost of the workload under `config`). */
  cost: number;
  nodes: number;
  optimal: boolean;
  candidates: number;
  atoms: number;
}

interface Atom {
  /** Candidate positions used by this atomic configuration. */
  members: number[];
  locate: number;
}

interface QueryTable {
  weight: number;
  atoms: Atom[];
  /** Maintenance cost per candidate position (UPDATEs only). */
  maintenance: Map<number, number>;
}

function relevantTo(ix: IndexDef, q: QueryInstance, accessIndex: number): boolean {
  const access = q.access[accessIndex];
  if (access.table !== ix.table) return false;
  const cols = indexableColumns(access, joinColumnOf(q, accessIndex));
  return cols.includes(ix.columns[0]);
}

export function solveCophy(
  workload: QueryInstance[],
  model: CostModel,
  {
    budgetBytes,
    maxWidth = 2,
    nodeLimit = 200_000,
  }: { budgetBytes: number; maxWidth?: number; nodeLimit?: number },
): CophyResult {
  const w = new WhatIfWorkload(model, workload);
  const all = syntacticCandidates(workload, maxWidth).filter(
    (ix) => model.indexBytes(ix) <= budgetBytes,
  );

  // 1. INUM-style cost tables: one what-if call per atomic configuration.
  let atomCount = 0;
  const tables: QueryTable[] = w.items.map(({ query, weight }) => {
    const options = query.access.map((_, i) => [
      -1,
      ...all.map((ix, c) => (relevantTo(ix, query, i) ? c : -2)).filter((c) => c >= 0),
    ]);
    const combos: number[][] =
      options.length === 1
        ? options[0].map((c) => [c])
        : options[0].flatMap((a) => options[1].map((b) => [a, b]));
    const atoms = combos.map((combo) => {
      const members = combo.filter((c) => c >= 0);
      const est = model.estimate(
        query,
        members.map((c) => all[c]),
      );
      atomCount++;
      return { members, locate: est.cost - est.maintenance };
    });
    const maintenance = new Map<number, number>();
    if (query.kind === "update" && query.updates) {
      all.forEach((ix, c) => {
        if (
          ix.table === query.access[0].table &&
          ix.columns.some((col) => query.updates!.includes(col))
        ) {
          maintenance.set(c, model.estimate(query, [ix]).maintenance);
        }
      });
    }
    return { weight, atoms, maintenance };
  });

  // 2. Dominance pruning: keep candidates that make some atom cheaper than no index.
  const useful = new Set<number>();
  for (const t of tables) {
    const base = t.atoms.find((a) => a.members.length === 0)!.locate;
    for (const a of t.atoms) if (a.locate < base - 1e-12) a.members.forEach((c) => useful.add(c));
  }

  const objective = (inSet: Uint8Array, maintSet: Uint8Array) => {
    let total = 0;
    for (const t of tables) {
      let best = Infinity;
      for (const a of t.atoms) {
        if (a.locate < best && a.members.every((c) => inSet[c])) best = a.locate;
      }
      let maint = 0;
      for (const [c, m] of t.maintenance) if (maintSet[c]) maint += m;
      total += t.weight * (best + maint);
    }
    return total;
  };

  const sizes = all.map((ix) => model.indexBytes(ix));
  const empty = new Uint8Array(all.length);
  const base = objective(empty, empty);
  const order = [...useful]
    .map((c) => {
      const one = new Uint8Array(all.length);
      one[c] = 1;
      return { c, gain: base - objective(one, one) };
    })
    .sort((a, b) => b.gain / sizes[b.c] - a.gain / sizes[a.c])
    .map((x) => x.c);

  // 3. Branch and bound.
  const chosen = new Uint8Array(all.length);
  const optimistic = new Uint8Array(all.length);
  let bestCost = base;
  let bestSet: number[] = [];
  let nodes = 0;
  let exhausted = false;

  const visit = (depth: number, bytes: number, cost: number) => {
    if (nodes >= nodeLimit) {
      exhausted = true;
      return;
    }
    nodes++;
    if (cost < bestCost - 1e-12) {
      bestCost = cost;
      bestSet = order.filter((c) => chosen[c]);
    }
    if (depth >= order.length) return;
    optimistic.set(chosen);
    for (let d = depth; d < order.length; d++) optimistic[order[d]] = 1;
    if (objective(optimistic, chosen) >= bestCost - 1e-12) return;
    const c = order[depth];
    if (bytes + sizes[c] <= budgetBytes) {
      chosen[c] = 1;
      visit(depth + 1, bytes + sizes[c], objective(chosen, chosen));
      chosen[c] = 0;
    }
    visit(depth + 1, bytes, cost);
  };
  visit(0, 0, base);

  // 4. Among optimal solutions prefer the smallest. The search tries "include"
  // first and keeps the first optimum it meets, which can carry indexes the
  // objective never uses (l_suppkey,l_shipmode next to l_shipmode,l_suppkey).
  // An IP solver is equally indifferent to them, but building them costs real
  // time in the arena, so drop any index whose removal leaves the objective
  // unchanged, largest first.
  const keep = new Uint8Array(all.length);
  bestSet.forEach((c) => (keep[c] = 1));
  for (const c of [...bestSet].sort((a, b) => sizes[b] - sizes[a])) {
    keep[c] = 0;
    if (objective(keep, keep) > bestCost + 1e-9 * Math.max(1, Math.abs(bestCost))) keep[c] = 1;
  }
  bestSet = bestSet.filter((c) => keep[c]);
  bestCost = objective(keep, keep);

  return {
    config: bestSet.map((c) => all[c]),
    cost: bestCost,
    nodes,
    optimal: !exhausted,
    candidates: order.length,
    atoms: atomCount,
  };
}

export const cophy: OfflineAlgorithm = ({ workload, budgetBytes, model }) =>
  solveCophy(workload, model, { budgetBytes }).config;
