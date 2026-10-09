import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import initSqlJs, { type SqlJsStatic } from "sql.js";
import { LOUVRE_SCHEMA } from "@/lib/datasets/louvre/schema";
import { readTables, sqliteBytes, valuePools } from "@/lib/datasets/louvre/data";
import { generateDatabase, type GeneratedDatabase } from "@/lib/db/generate";
import { computeStats, type DatabaseStats, type TableDataSet } from "@/lib/db/stats";
import type { ValuePools } from "@/lib/workload/types";

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

export const LOUVRE_GZ_PATH = fileURLToPath(
  new URL("../../../public/data/louvre.db.gz", import.meta.url),
);

export interface LouvreFixture {
  bytes: Uint8Array;
  data: TableDataSet;
  stats: DatabaseStats;
  pools: ValuePools;
}

let louvre: Promise<LouvreFixture> | null = null;

/** The shipped Louvre database, read the way the worker reads it. */
export function louvreDb(): Promise<LouvreFixture> {
  louvre ??= (async () => {
    const SQL = await sqlJs();
    const bytes = await sqliteBytes(new Uint8Array(readFileSync(LOUVRE_GZ_PATH)));
    const db = new SQL.Database(bytes);
    const data = readTables(db, LOUVRE_SCHEMA);
    db.close();
    return { bytes, data, stats: computeStats(data, LOUVRE_SCHEMA), pools: valuePools(data) };
  })();
  return louvre;
}
