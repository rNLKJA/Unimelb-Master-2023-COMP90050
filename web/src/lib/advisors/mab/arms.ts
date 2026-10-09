/**
 * Arms and contexts for bandit index tuning (Perera et al. 2023, §4).
 *
 * Arms are generated from the queries of interest: permutations of each
 * query's predicate columns (equality, range and join) on a table, up to a
 * maximum length, plus covering variants that append the query's remaining
 * columns. SQLite has no INCLUDE clause, so payload columns become trailing key
 * columns.
 *
 * Context part 1 has one component per database column (every column of every
 * table of the dataset, keyed table.column so equal names on different tables
 * stay apart): 10^-j when the column sits at position j of the index and is a
 * predicate column of the workload, 0 otherwise (payload-only columns stay 0,
 * as in the paper's Example 1).
 * Part 2 holds derived statistics: D1 covering flag, D2 index size over
 * database size (0 once materialised, so a built index carries no creation
 * cost), D3 how often the optimiser used the arm recently.
 */
import type { DatabaseStats } from "@/lib/db/stats";
import type { CostModel } from "@/lib/engine/cost-model";
import {
  indexId,
  isCovering,
  referencedColumns,
  type IndexDef,
  type QueryInstance,
} from "@/lib/engine/types";
import { indexableColumns, joinColumnOf, permutations } from "@/lib/advisors/candidates";

export const CONTEXT_PREFIX_BASE = 10;
export const D_COVERING = 0;
export const D_SIZE = 1;
export const D_USAGE = 2;
export const STATIC_CONTEXT = 3;

/** A column named by its table, so `wing_scan.ticket_id` and `entry_scan.ticket_id` differ. */
export const qualified = (table: string, column: string) => `${table}.${column}`;

/** Where each database column sits in the context vector. */
export interface ContextLayout {
  dimension: number;
  slot: Map<string, number>;
}

/** One context component per column of every table in `stats`, in schema order. */
export function contextLayout(stats: DatabaseStats): ContextLayout {
  const slot = new Map<string, number>();
  for (const [table, t] of Object.entries(stats))
    for (const column of Object.keys(t.columns))
      slot.set(qualified(table, column), STATIC_CONTEXT + slot.size);
  return { dimension: STATIC_CONTEXT + slot.size, slot };
}

export interface Arm {
  id: string;
  index: IndexDef;
  /** Templates whose predicates generated this arm. */
  queries: Set<string>;
  /** Templates this arm fully covers. */
  covers: Set<string>;
  bytes: number;
}

export interface ArmOptions {
  /** Longest predicate permutation (the authors use 2). */
  maxPermutation: number;
  /** Tables smaller than this are never indexed (scaled down from the authors' 10,000). */
  minTableRows: number;
}

export const DEFAULT_ARM_OPTIONS: ArmOptions = { maxPermutation: 2, minTableRows: 1_000 };

export function generateArms(
  queries: QueryInstance[],
  model: CostModel,
  opts: ArmOptions = DEFAULT_ARM_OPTIONS,
): Map<string, Arm> {
  const arms = new Map<string, Arm>();
  const add = (ix: IndexDef, q: QueryInstance, covering: boolean) => {
    const id = indexId(ix);
    let arm = arms.get(id);
    if (!arm) {
      arm = { id, index: ix, queries: new Set(), covers: new Set(), bytes: model.indexBytes(ix) };
      arms.set(id, arm);
    }
    arm.queries.add(q.template);
    if (covering) arm.covers.add(q.template);
  };

  for (const q of queries) {
    q.access.forEach((access, i) => {
      if (model.rows(access.table) < opts.minTableRows) return;
      const join = joinColumnOf(q, i);
      const preds = indexableColumns(access, join);
      const longest = Math.min(opts.maxPermutation, preds.length);
      const pk = model.primaryKey(access.table);
      for (let k = 1; k <= longest; k++) {
        for (const perm of permutations(preds, k)) {
          const ix = { table: access.table, columns: perm };
          add(ix, q, isCovering(ix, access, join, pk));
          if (k !== longest) continue;
          const payload = referencedColumns(access, join).filter(
            (c) => !perm.includes(c) && c !== pk,
          );
          if (payload.length === 0) continue;
          const cover = { table: access.table, columns: [...perm, ...payload] };
          add(cover, q, isCovering(cover, access, join, pk));
        }
      }
    });
  }
  return arms;
}

/**
 * Predicate columns of the workload, qualified by table: the only columns
 * allowed a non-zero part-1 context.
 */
export function workloadPredicateColumns(queries: QueryInstance[]): Set<string> {
  const out = new Set<string>();
  for (const q of queries)
    q.access.forEach((a, i) =>
      indexableColumns(a, joinColumnOf(q, i)).forEach((c) => out.add(qualified(a.table, c))),
    );
  return out;
}

export function contextVector(
  arm: Arm,
  predicateColumns: Set<string>,
  layout: ContextLayout,
  {
    materialised,
    databaseBytes,
    usage,
  }: { materialised: boolean; databaseBytes: number; usage: number },
): Float64Array {
  const x = new Float64Array(layout.dimension);
  arm.index.columns.forEach((c, j) => {
    const key = qualified(arm.index.table, c);
    const slot = layout.slot.get(key);
    if (slot !== undefined && predicateColumns.has(key))
      x[slot] = Math.pow(CONTEXT_PREFIX_BASE, -j);
  });
  x[D_COVERING] = arm.covers.size > 0 ? 1 : 0;
  x[D_SIZE] = materialised ? 0 : arm.bytes / databaseBytes;
  x[D_USAGE] = usage;
  return x;
}
