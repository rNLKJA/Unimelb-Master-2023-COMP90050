/**
 * Optimiser statistics: per-column distinct counts and value ranges, computed
 * from the generated data. They play the role of a DBMS catalogue (think
 * PostgreSQL's pg_stats or SQLite's sqlite_stat1) for the what-if cost model.
 */
import type { GeneratedDatabase } from "./generate";
import { SCHEMA, TABLE_NAMES, dayNumber, type TableName } from "./schema";

export interface ColumnStats {
  ndv: number;
  /** Numeric range (dates as day numbers); null for text columns. */
  min: number | null;
  max: number | null;
}

export interface TableStats {
  rows: number;
  /** Average row width in bytes. */
  rowWidth: number;
  columns: Record<string, ColumnStats>;
}

export type DatabaseStats = Record<TableName, TableStats>;

export function computeStats(db: GeneratedDatabase): DatabaseStats {
  const out = {} as DatabaseStats;
  for (const t of TABLE_NAMES) {
    const def = SCHEMA[t];
    const data = db[t];
    const columns: Record<string, ColumnStats> = {};
    def.columns.forEach((col, j) => {
      const seen = new Set<number | string>();
      let min = Infinity;
      let max = -Infinity;
      for (const row of data.rows) {
        const v = row[j];
        seen.add(v);
        if (col.type !== "text") {
          const x = col.type === "date" ? dayNumber(String(v)) : Number(v);
          if (x < min) min = x;
          if (x > max) max = x;
        }
      }
      columns[col.name] = {
        ndv: Math.max(1, seen.size),
        min: col.type === "text" || data.rows.length === 0 ? null : min,
        max: col.type === "text" || data.rows.length === 0 ? null : max,
      };
    });
    out[t] = {
      rows: data.rows.length,
      rowWidth: def.columns.reduce((s, col) => s + col.width, 0) + 4,
      columns,
    };
  }
  return out;
}

export function databaseBytes(stats: DatabaseStats): number {
  return TABLE_NAMES.reduce((s, t) => s + stats[t].rows * stats[t].rowWidth, 0);
}
