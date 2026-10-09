import initSqlJs, { type SqlJsStatic } from "sql.js";
import { generateDatabase, type GeneratedDatabase } from "@/lib/db/generate";
import { computeStats, type DatabaseStats } from "@/lib/db/stats";

let cached: { data: GeneratedDatabase; stats: DatabaseStats } | null = null;

/** A small, deterministic database shared by the tests (S scale, seed 42). */
export function smallDb() {
  if (!cached) {
    const data = generateDatabase({ orders: 7_500, seed: 42 });
    cached = { data, stats: computeStats(data) };
  }
  return cached;
}

let sql: Promise<SqlJsStatic> | null = null;
export function sqlJs(): Promise<SqlJsStatic> {
  sql ??= initSqlJs();
  return sql;
}
