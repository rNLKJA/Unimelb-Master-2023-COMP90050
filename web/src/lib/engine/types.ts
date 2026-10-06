import { SCHEMA, type TableName } from "@/lib/db/schema";

/** A secondary B-tree index: key columns in order (SQLite has no INCLUDE columns). */
export interface IndexDef {
  table: TableName;
  columns: string[];
}

export function indexId(ix: IndexDef): string {
  return `${ix.table}(${ix.columns.join(", ")})`;
}

/** A SQL-safe, deterministic index name. */
export function indexName(ix: IndexDef): string {
  return `ix_${ix.table}__${ix.columns.join("__")}`;
}

export function createIndexSql(ix: IndexDef): string {
  return `CREATE INDEX ${indexName(ix)} ON ${ix.table} (${ix.columns.join(", ")})`;
}

/** Inclusive numeric range on a column (dates as day numbers since 1992-01-01). */
export interface RangePredicate {
  column: string;
  lo: number;
  hi: number;
}

/** How a query touches one table: sargable predicates plus everything else it reads. */
export interface TableAccess {
  table: TableName;
  eq: string[];
  ranges: RangePredicate[];
  /** Other referenced columns (select list, aggregates, ORDER BY, GROUP BY). */
  payload: string[];
}

export interface QueryInstance {
  /** Unique id within a workload. */
  id: string;
  template: string;
  kind: "select" | "update";
  sql: string;
  access: TableAccess[];
  /** Equi-join between access[0] and access[1]. */
  join?: { left: string; right: string };
  /** Columns written by an UPDATE. */
  updates?: string[];
}

/** Every column of `access` that a plan must produce. */
export function referencedColumns(access: TableAccess, joinColumn?: string): string[] {
  const cols = new Set<string>([
    ...access.eq,
    ...access.ranges.map((r) => r.column),
    ...access.payload,
  ]);
  if (joinColumn) cols.add(joinColumn);
  return [...cols];
}

/** True when `ix` alone answers every column the access needs (the rowid/PK is always present). */
export function isCovering(ix: IndexDef, access: TableAccess, joinColumn?: string): boolean {
  const pk = SCHEMA[access.table].primaryKey;
  return referencedColumns(access, joinColumn).every((c) => c === pk || ix.columns.includes(c));
}
