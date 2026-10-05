/**
 * Candidate enumeration shared by the offline advisors: the "syntactically
 * relevant" indexes of AutoAdmin (Chaudhuri & Narasayya 1997) — permutations of
 * a query's indexable columns (equality, range and join predicates) on the
 * same table, up to a maximum width.
 */
import { indexId, type IndexDef, type QueryInstance, type TableAccess } from "@/lib/engine/types";

/** Join column of access `i` in a two-table query, if any. */
export function joinColumnOf(q: QueryInstance, i: number): string | undefined {
  if (!q.join) return undefined;
  return i === 0 ? q.join.left : q.join.right;
}

/** Columns of one table access an index could be seeked on. */
export function indexableColumns(access: TableAccess, joinColumn?: string): string[] {
  const cols = [...access.eq, ...access.ranges.map((r) => r.column)];
  if (joinColumn && !cols.includes(joinColumn)) cols.push(joinColumn);
  return [...new Set(cols)];
}

export function permutations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  items.forEach((x, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest, k - 1)) out.push([x, ...tail]);
  });
  return out;
}

export function dedupe(indexes: IndexDef[]): IndexDef[] {
  const seen = new Map<string, IndexDef>();
  for (const ix of indexes) if (!seen.has(indexId(ix))) seen.set(indexId(ix), ix);
  return [...seen.values()];
}

export function candidatesForQuery(q: QueryInstance, maxWidth: number): IndexDef[] {
  const out: IndexDef[] = [];
  q.access.forEach((access, i) => {
    const cols = indexableColumns(access, joinColumnOf(q, i));
    for (let w = 1; w <= Math.min(maxWidth, cols.length); w++) {
      for (const perm of permutations(cols, w)) out.push({ table: access.table, columns: perm });
    }
  });
  return dedupe(out);
}

export function syntacticCandidates(queries: QueryInstance[], maxWidth: number): IndexDef[] {
  return dedupe(queries.flatMap((q) => candidatesForQuery(q, maxWidth)));
}

/** Is `ix` built only from columns `q` can seek on (so it is relevant to q)? */
export function isRelevant(ix: IndexDef, q: QueryInstance): boolean {
  return q.access.some(
    (access, i) =>
      access.table === ix.table &&
      ix.columns.every((c) => indexableColumns(access, joinColumnOf(q, i)).includes(c)),
  );
}

/** One representative instance per template (offline tools compress workloads the same way). */
export function compressWorkload(
  queries: QueryInstance[],
): { query: QueryInstance; weight: number }[] {
  const byTemplate = new Map<string, { query: QueryInstance; weight: number }>();
  for (const q of queries) {
    const e = byTemplate.get(q.template);
    if (e) e.weight++;
    else byTemplate.set(q.template, { query: q, weight: 1 });
  }
  return [...byTemplate.values()];
}
