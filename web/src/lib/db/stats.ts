/**
 * Optimiser statistics: per-column distinct counts and value ranges, computed
 * from a dataset's rows. They play the role of a DBMS catalogue (think
 * PostgreSQL's pg_stats or SQLite's sqlite_stat1) for the what-if cost model,
 * and carry the schema facts the model needs (primary key, column types and
 * widths), so the engine works on any dataset.
 */
import { TPCH_SCHEMA, numericValue, type ColumnType, type SchemaDef } from "./schema";

export type Value = number | string | null;

export interface TableData {
  columns: string[];
  rows: Value[][];
}

/** Rows of every table of a dataset, keyed by table name. */
export type TableDataSet = Record<string, TableData>;

export interface ColumnStats {
  /** Distinct non-null values (at least 1). */
  ndv: number;
  /** Numeric range (dates as day numbers); null for text columns. */
  min: number | null;
  max: number | null;
  type: ColumnType;
  /** Average stored width in bytes (from the schema). */
  width: number;
  /** Rows where the column is NULL. */
  nulls: number;
}

export interface TableStats {
  rows: number;
  /** Average row width in bytes. */
  rowWidth: number;
  /** INTEGER PRIMARY KEY (rowid alias) column, if any. */
  primaryKey: string | null;
  columns: Record<string, ColumnStats>;
}

/** Statistics for every table, in the schema's load order. */
export type DatabaseStats = Record<string, TableStats>;

export function computeStats(db: TableDataSet, schema: SchemaDef = TPCH_SCHEMA): DatabaseStats {
  const out: DatabaseStats = {};
  for (const def of schema.tables) {
    const data = db[def.name];
    if (!data) throw new Error(`No rows for table ${def.name}`);
    const columns: Record<string, ColumnStats> = {};
    def.columns.forEach((col) => {
      const j = data.columns.indexOf(col.name);
      if (j < 0) throw new Error(`No column ${def.name}.${col.name} in the data`);
      const seen = new Set<number | string>();
      let min = Infinity;
      let max = -Infinity;
      let nulls = 0;
      for (const row of data.rows) {
        const v = row[j];
        if (v === null || v === undefined) {
          nulls++;
          continue;
        }
        seen.add(v);
        const x = numericValue(col.type, v);
        if (x !== null) {
          if (x < min) min = x;
          if (x > max) max = x;
        }
      }
      const numeric = col.type !== "text" && seen.size > 0;
      columns[col.name] = {
        ndv: Math.max(1, seen.size),
        min: numeric ? min : null,
        max: numeric ? max : null,
        type: col.type,
        width: col.width,
        nulls,
      };
    });
    out[def.name] = {
      rows: data.rows.length,
      rowWidth: def.columns.reduce((s, col) => s + col.width, 0) + 4,
      primaryKey: def.primaryKey,
      columns,
    };
  }
  return out;
}

export function databaseBytes(stats: DatabaseStats): number {
  return Object.values(stats).reduce((s, t) => s + t.rows * t.rowWidth, 0);
}

export function rowCountsOf(stats: DatabaseStats): Record<string, number> {
  return Object.fromEntries(Object.entries(stats).map(([t, s]) => [t, s.rows]));
}
