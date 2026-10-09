/**
 * Loading the Louvre database: the shipped file is gzip-compressed SQLite
 * (public/data/louvre.db.gz). The worker fetches and inflates it, opens it with
 * sql.js and reads every table's rows; the lab then reloads those rows into its
 * own index-free tables (see schema.ts). Node tests inflate it with zlib.
 */
import type { Database } from "sql.js";
import type { SchemaDef } from "@/lib/db/schema";
import type { TableDataSet, Value } from "@/lib/db/stats";
import type { ValuePools } from "@/lib/workload/types";
import { LOUVRE_POOL_COLUMNS } from "./templates";

/** gzip's magic number: some servers inflate the file in transit, some do not. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** SQLite's file header, "SQLite format 3\0". */
export function isSqlite(bytes: Uint8Array): boolean {
  const magic = "SQLite format 3";
  if (bytes.length < 100) return false;
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic.charCodeAt(i)) return false;
  return bytes[15] === 0;
}

/** Inflate with the browser's (and Node's) DecompressionStream. */
export async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The SQLite bytes, whether or not the transport already inflated them. */
export async function sqliteBytes(raw: Uint8Array): Promise<Uint8Array> {
  const bytes = isGzip(raw) ? await gunzip(raw) : raw;
  if (!isSqlite(bytes)) throw new Error("The Louvre database download is not a SQLite file");
  return bytes;
}

const ident = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unexpected identifier ${name}`);
  return name;
};

/** Every row of every schema table, in rowid order, with the schema's column order. */
export function readTables(db: Database, schema: SchemaDef): TableDataSet {
  const out: TableDataSet = {};
  for (const def of schema.tables) {
    const columns = def.columns.map((c) => ident(c.name));
    const res = db.exec(`SELECT ${columns.join(", ")} FROM ${ident(def.name)} ORDER BY rowid`);
    const rows = (res[0]?.values ?? []).map((r) =>
      r.map((v): Value => (v instanceof Uint8Array ? null : (v as Value))),
    );
    out[def.name] = { columns, rows };
  }
  return out;
}

/** Value pools for the workload's literals: every value of each pooled column. */
export function valuePools(
  data: TableDataSet,
  keys: readonly string[] = LOUVRE_POOL_COLUMNS,
): ValuePools {
  const pools: ValuePools = {};
  for (const key of keys) {
    const [table, column] = key.split(".");
    const t = data[table];
    const j = t?.columns.indexOf(column) ?? -1;
    if (!t || j < 0) throw new Error(`No column ${key} for a value pool`);
    pools[key] = t.rows.map((r) => r[j]).filter((v) => v !== null);
  }
  return pools;
}
