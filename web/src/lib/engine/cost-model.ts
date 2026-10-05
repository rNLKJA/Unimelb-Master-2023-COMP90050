/**
 * A what-if cost model in the System R tradition. Given optimiser statistics
 * and a hypothetical index configuration it estimates each query's cost, the
 * access path it would use and the size and build cost of every index — the
 * "what-if" API that AutoAdmin, DB2 Advisor and CoPhy all rely on. Constants
 * are calibrated in milliseconds against sql.js (SQLite compiled to WASM).
 *
 * The planner mirrors SQLite's rules: an index is usable when a prefix of its
 * columns is matched by equality predicates, optionally followed by one range
 * column; without a usable index the table is scanned (automatic indexes are
 * disabled in the lab so joins without an index really do nested-loop scans).
 */
import { SCHEMA, columnDef, type TableName } from "@/lib/db/schema";
import type { DatabaseStats } from "@/lib/db/stats";
import {
  indexId,
  isCovering,
  type IndexDef,
  type QueryInstance,
  type RangePredicate,
  type TableAccess,
} from "./types";

export interface CostConstants {
  /** Per row visited by a full table scan... */
  scanRow: number;
  /** ...plus this much per byte of row width. */
  scanByte: number;
  /** Per B-tree level descended by a seek. */
  seekLevel: number;
  /** Per index entry visited after a seek. */
  indexRow: number;
  /** Per table row fetched by rowid from a non-covering index. */
  rowidFetch: number;
  /** Per row changed by an UPDATE (base table write). */
  updateRow: number;
  /** Per secondary-index entry rewritten by an UPDATE. */
  indexMaintain: number;
  /** Per row per log2(rows) when sorting during CREATE INDEX. */
  buildRow: number;
  /** Per outer row tested against a join Bloom filter. */
  bloomRow: number;
  /** Fixed per-statement overhead (parse, plan, step). */
  statement: number;
}

/**
 * Milliseconds, calibrated from warmed-up median timings of sql.js 1.14 (SQLite
 * 3.49) under Node on an Apple-silicon laptop: a full scan costs roughly
 * 0.05-0.07 µs per row, an index entry ~0.15 µs, a rowid fetch from a
 * non-covering index ~1.5 µs, and a point seek ~10 µs.
 */
export const DEFAULT_CONSTANTS: CostConstants = {
  scanRow: 0.000027,
  scanByte: 0.00000054,
  seekLevel: 0.0005,
  indexRow: 0.00015,
  rowidFetch: 0.0015,
  updateRow: 0.003,
  indexMaintain: 0.008,
  buildRow: 0.00004,
  bloomRow: 0.00001,
  statement: 0.004,
};

export type AccessPath =
  | { kind: "scan"; table: TableName; rows: number; cost: number }
  | { kind: "rowid"; table: TableName; rows: number; cost: number }
  | {
      kind: "index";
      table: TableName;
      index: IndexDef;
      covering: boolean;
      matched: string[];
      rows: number;
      cost: number;
    };

export interface PlanEstimate {
  cost: number;
  /** Access path per table, outer table first for joins. */
  paths: AccessPath[];
  /** Index ids used by the plan. */
  used: string[];
  /** Secondary indexes rewritten by an UPDATE. */
  maintained: string[];
  /** Part of `cost` spent maintaining secondary indexes (UPDATEs only). */
  maintenance: number;
  /** Number of inner probes a join performs. */
  outerRows?: number;
  /** Extra cost of building and testing a join Bloom filter, if one is used. */
  bloom?: number;
}

const log2 = (n: number) => Math.log2(Math.max(2, n));

export class CostModel {
  calls = 0;
  constructor(
    readonly stats: DatabaseStats,
    readonly k: CostConstants = DEFAULT_CONSTANTS,
  ) {}

  rows(table: TableName): number {
    return this.stats[table].rows;
  }

  /** Cost of reading every row of a table. */
  scanCost(table: TableName): number {
    const t = this.stats[table];
    return t.rows * (this.k.scanRow + this.k.scanByte * t.rowWidth);
  }

  eqSelectivity(column: string, table: TableName): number {
    return 1 / this.stats[table].columns[column].ndv;
  }

  rangeSelectivity(r: RangePredicate, table: TableName): number {
    const s = this.stats[table].columns[r.column];
    if (s.min === null || s.max === null) return 1 / 3;
    const discrete = columnDef(r.column).type !== "real";
    const lo = Math.max(r.lo, s.min);
    const hi = Math.min(r.hi, s.max);
    if (hi < lo) return 0;
    const width = s.max - s.min + (discrete ? 1 : 0);
    if (width <= 0) return 1;
    return Math.min(1, (hi - lo + (discrete ? 1 : 0)) / width);
  }

  /** Output cardinality of a table access after all of its local predicates. */
  outputRows(access: TableAccess): number {
    let sel = 1;
    for (const c of access.eq) sel *= this.eqSelectivity(c, access.table);
    for (const r of access.ranges) sel *= this.rangeSelectivity(r, access.table);
    return this.rows(access.table) * sel;
  }

  /** Cheapest access path for one table under `config`. `joinColumn` is an extra equality (join probe). */
  bestAccess(access: TableAccess, config: IndexDef[], joinColumn?: string): AccessPath {
    const { table } = access;
    const n = this.rows(table);
    const k = this.k;
    const eq = joinColumn ? [...access.eq, joinColumn] : access.eq;
    let best: AccessPath = { kind: "scan", table, rows: n, cost: this.scanCost(table) };

    const pk = SCHEMA[table].primaryKey;
    if (pk && eq.includes(pk)) {
      // SQLite always resolves an equality on the INTEGER PRIMARY KEY with a
      // rowid lookup, even on tables small enough that a scan would be as fast.
      return { kind: "rowid", table, rows: 1, cost: log2(n) * k.seekLevel };
    } else if (pk) {
      const r = access.ranges.find((x) => x.column === pk);
      if (r) {
        const rows = n * this.rangeSelectivity(r, table);
        const cost = log2(n) * k.seekLevel + (rows / n) * this.scanCost(table);
        if (cost < best.cost) best = { kind: "rowid", table, rows, cost };
      }
    }

    for (const ix of config) {
      if (ix.table !== table) continue;
      let sel = 1;
      const matched: string[] = [];
      for (const col of ix.columns) {
        if (eq.includes(col)) {
          sel *= this.eqSelectivity(col, table);
          matched.push(col);
          continue;
        }
        const r = access.ranges.find((x) => x.column === col);
        if (r) {
          sel *= this.rangeSelectivity(r, table);
          matched.push(col);
        }
        break;
      }
      if (matched.length === 0) continue;
      const rows = n * sel;
      const covering = isCovering(ix, access, joinColumn);
      const cost = log2(n) * k.seekLevel + rows * k.indexRow + (covering ? 0 : rows * k.rowidFetch);
      // SQLite prefers the longer match / covering index on ties.
      if (cost < best.cost - 1e-12)
        best = { kind: "index", table, index: ix, covering, matched, rows, cost };
    }
    return best;
  }

  /** What-if call: estimated cost of `q` if exactly the indexes in `config` existed. */
  estimate(q: QueryInstance, config: IndexDef[]): PlanEstimate {
    this.calls++;
    const k = this.k;
    let plan: { cost: number; paths: AccessPath[]; outerRows?: number; bloom?: number };

    if (q.access.length === 1) {
      const path = this.bestAccess(q.access[0], config);
      plan = { cost: path.cost, paths: [path] };
    } else {
      const [a, b] = q.access;
      const { left, right } = q.join!;
      // Nested-loop join in either order. When the inner side has its own
      // filters SQLite may first build a Bloom filter over the qualifying inner
      // rows and probe only outer rows that pass it.
      const order = (outer: TableAccess, inner: TableAccess, innerCol: string) => {
        const o = this.bestAccess(outer, config);
        const outerRows = Math.max(1, this.outputRows(outer));
        const probe = this.bestAccess(inner, config, innerCol);
        const plain = o.cost + outerRows * probe.cost;
        const hasFilter = inner.eq.length + inner.ranges.length > 0;
        if (!hasFilter) return { cost: plain, paths: [o, probe], outerRows };
        const innerSel = this.outputRows(inner) / this.rows(inner.table);
        const build = this.bestAccess(inner, config).cost;
        const probes = outerRows * innerSel;
        const bloom = o.cost + build + outerRows * k.bloomRow + probes * probe.cost;
        return bloom < plain
          ? {
              cost: bloom,
              paths: [o, probe],
              outerRows: Math.max(1, probes),
              bloom: build + outerRows * k.bloomRow,
            }
          : { cost: plain, paths: [o, probe], outerRows };
      };
      const ab = order(a, b, right);
      const ba = order(b, a, left);
      plan = ab.cost <= ba.cost ? ab : ba;
    }

    let cost = k.statement + plan.cost;
    let maintenance = 0;
    const maintained: string[] = [];
    if (q.kind === "update" && q.updates) {
      const target = q.access[0];
      const changed = this.outputRows(target);
      cost += changed * k.updateRow;
      for (const ix of config) {
        if (ix.table === target.table && ix.columns.some((c) => q.updates!.includes(c))) {
          maintained.push(indexId(ix));
          maintenance += changed * k.indexMaintain;
        }
      }
      cost += maintenance;
    }
    const used = plan.paths.flatMap((p) => (p.kind === "index" ? [indexId(p.index)] : []));
    return {
      cost,
      paths: plan.paths,
      used,
      maintained,
      maintenance,
      outerRows: plan.outerRows,
      bloom: plan.bloom,
    };
  }

  /**
   * Re-cost a plan chosen by another model (the optimiser) with this model's
   * constants. The simulated engine uses it to charge the "true" price of the
   * optimiser's — possibly misinformed — plan choice.
   */
  recost(q: QueryInstance, plan: PlanEstimate): number {
    const k = this.k;
    const pathCost = (p: AccessPath) => {
      const n = this.rows(p.table);
      if (p.kind === "scan") return this.scanCost(p.table);
      if (p.kind === "rowid")
        return log2(n) * k.seekLevel + (p.rows > 1 ? (p.rows / n) * this.scanCost(p.table) : 0);
      return log2(n) * k.seekLevel + p.rows * k.indexRow + (p.covering ? 0 : p.rows * k.rowidFetch);
    };
    let cost = k.statement;
    if (plan.paths.length === 1) cost += pathCost(plan.paths[0]);
    else
      cost +=
        pathCost(plan.paths[0]) +
        (plan.bloom ?? 0) +
        (plan.outerRows ?? 1) * pathCost(plan.paths[1]);
    if (q.kind === "update") {
      const changed = this.outputRows(q.access[0]);
      cost += changed * k.updateRow + plan.maintained.length * changed * k.indexMaintain;
    }
    return cost;
  }

  /** Total estimated cost of a workload under `config`. */
  workloadCost(queries: QueryInstance[], config: IndexDef[]): number {
    let total = 0;
    for (const q of queries) total += this.estimate(q, config).cost;
    return total;
  }

  /**
   * Estimated size of an index in bytes: per entry the key bytes, one record
   * header byte per extra column and ~7 bytes of rowid, header and cell pointer,
   * on B-tree pages ~92% full (fitted to SQLite page counts).
   */
  indexBytes(ix: IndexDef): number {
    const key = ix.columns.reduce((s, c) => s + columnDef(c).width, 0);
    const entry = key + (ix.columns.length - 1) + 7;
    return Math.ceil((this.rows(ix.table) * entry) / 0.92);
  }

  /** Estimated CREATE INDEX time: read the table, sort the keys, write the B-tree. */
  creationCost(ix: IndexDef): number {
    const n = this.rows(ix.table);
    return this.scanCost(ix.table) + n * log2(n) * this.k.buildRow + n * this.k.indexRow;
  }
}

export function configBytes(model: CostModel, config: IndexDef[]): number {
  return config.reduce((s, ix) => s + model.indexBytes(ix), 0);
}
