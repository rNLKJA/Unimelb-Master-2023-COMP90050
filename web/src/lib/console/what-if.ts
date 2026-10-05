/**
 * The SQL console's "what if" panel: for a query the lab knows the shape of,
 * ask the cost model what the current configuration costs, and what each of
 * the candidate indexes AutoAdmin would enumerate for it would cost if it were
 * added — the same optimiser call every offline advisor is built on.
 */
import { candidatesForQuery } from "@/lib/advisors/candidates";
import type { AccessPath, CostModel } from "@/lib/engine/cost-model";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";

export interface PathSummary {
  table: string;
  kind: AccessPath["kind"];
  index: string | null;
  covering: boolean;
  rows: number;
}

export interface WhatIfReport {
  /** Estimated cost (ms) under the indexes that exist now. */
  cost: number;
  paths: PathSummary[];
  /** Candidate indexes not yet built, cheapest resulting cost first. */
  candidates: { index: IndexDef; id: string; cost: number; bytes: number; buildMs: number }[];
}

export function summarisePath(p: AccessPath): PathSummary {
  return {
    table: p.table,
    kind: p.kind,
    index: p.kind === "index" ? indexId(p.index) : null,
    covering: p.kind === "index" ? p.covering : false,
    rows: Math.round(p.rows),
  };
}

export function whatIfReport(
  model: CostModel,
  query: QueryInstance,
  existing: IndexDef[],
  { maxWidth = 2, limit = 6 }: { maxWidth?: number; limit?: number } = {},
): WhatIfReport {
  const now = model.estimate(query, existing);
  const have = new Set(existing.map(indexId));
  const candidates = candidatesForQuery(query, maxWidth)
    .filter((ix) => !have.has(indexId(ix)))
    .map((ix) => ({
      index: ix,
      id: indexId(ix),
      cost: model.estimate(query, [...existing, ix]).cost,
      bytes: model.indexBytes(ix),
      buildMs: model.creationCost(ix),
    }))
    .sort((a, b) => a.cost - b.cost || a.bytes - b.bytes)
    .slice(0, limit);
  return { cost: now.cost, paths: now.paths.map(summarisePath), candidates };
}
