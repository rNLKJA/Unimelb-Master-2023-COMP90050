/**
 * Schemas for the lab's datasets. The engine, the cost model and the advisors
 * work on any `SchemaDef`; this file defines the generic shape and the
 * compact TPC-H-like schema. It keeps the shape of the TPC-H benchmark the
 * surveyed papers evaluate on (Kossmann et al. 2020; Perera et al. 2023) but at
 * a size that loads into SQLite-in-the-browser in well under a second. The
 * second dataset, the Louvre ticketing database from INFO20003, lives in
 * lib/datasets/louvre/.
 *
 * lineitem deliberately has no primary key (it is a plain rowid table), so every
 * secondary index on it — including one on l_orderkey — is an advisor's choice.
 */

/**
 * Column types as the cost model sees them. `date` is an ISO day
 * (YYYY-MM-DD) and `datetime` an ISO timestamp (YYYY-MM-DD HH:MM:SS); both are
 * stored as TEXT in SQLite and become day numbers (fractional for datetimes)
 * for range estimates.
 */
export type ColumnType = "int" | "real" | "text" | "date" | "datetime";

export const TABLE_NAMES = [
  "region",
  "nation",
  "supplier",
  "customer",
  "part",
  "orders",
  "lineitem",
] as const;

/** A table of the TPC-H-like schema. */
export type TpchTable = (typeof TABLE_NAMES)[number];

/** Any table of any dataset. Engine and advisor code is written against plain names. */
export type TableName = string;

export interface ColumnDef {
  name: string;
  type: ColumnType;
  /** Average stored width in bytes, used for index-size estimates. */
  width: number;
  /** NULL allowed (every column is NOT NULL unless marked). */
  nullable?: boolean;
}

export interface TableDef {
  name: TableName;
  /** INTEGER PRIMARY KEY (rowid alias) column, if any. */
  primaryKey: string | null;
  columns: ColumnDef[];
  blurb: string;
}

/** A dataset's tables, in load order. */
export interface SchemaDef {
  tables: TableDef[];
}

/** Column helper shared by every dataset's schema. */
export const col = (name: string, type: ColumnType, width: number, nullable = false): ColumnDef =>
  nullable ? { name, type, width, nullable } : { name, type, width };
const c = col;

export const SCHEMA: Record<TpchTable, TableDef> = {
  region: {
    name: "region",
    primaryKey: "r_regionkey",
    blurb: "5 world regions",
    columns: [c("r_regionkey", "int", 1), c("r_name", "text", 8)],
  },
  nation: {
    name: "nation",
    primaryKey: "n_nationkey",
    blurb: "25 nations",
    columns: [c("n_nationkey", "int", 1), c("n_name", "text", 9), c("n_regionkey", "int", 1)],
  },
  supplier: {
    name: "supplier",
    primaryKey: "s_suppkey",
    blurb: "suppliers",
    columns: [
      c("s_suppkey", "int", 2),
      c("s_name", "text", 18),
      c("s_nationkey", "int", 1),
      c("s_acctbal", "real", 8),
    ],
  },
  customer: {
    name: "customer",
    primaryKey: "c_custkey",
    blurb: "customers",
    columns: [
      c("c_custkey", "int", 2),
      c("c_name", "text", 18),
      c("c_nationkey", "int", 1),
      c("c_mktsegment", "text", 9),
      c("c_acctbal", "real", 8),
    ],
  },
  part: {
    name: "part",
    primaryKey: "p_partkey",
    blurb: "parts",
    columns: [
      c("p_partkey", "int", 2),
      c("p_name", "text", 22),
      c("p_brand", "text", 8),
      c("p_type", "text", 20),
      c("p_size", "int", 1),
      c("p_container", "text", 9),
      c("p_retailprice", "real", 8),
    ],
  },
  orders: {
    name: "orders",
    primaryKey: "o_orderkey",
    blurb: "orders",
    columns: [
      c("o_orderkey", "int", 3),
      c("o_custkey", "int", 2),
      c("o_orderstatus", "text", 1),
      c("o_totalprice", "real", 8),
      c("o_orderdate", "date", 10),
      c("o_orderpriority", "text", 9),
    ],
  },
  lineitem: {
    name: "lineitem",
    primaryKey: null,
    blurb: "order lines (no primary key)",
    columns: [
      c("l_orderkey", "int", 3),
      c("l_linenumber", "int", 1),
      c("l_partkey", "int", 2),
      c("l_suppkey", "int", 2),
      c("l_quantity", "int", 1),
      c("l_extendedprice", "real", 8),
      c("l_discount", "real", 8),
      c("l_tax", "real", 8),
      c("l_returnflag", "text", 1),
      c("l_linestatus", "text", 1),
      c("l_shipdate", "date", 10),
      c("l_commitdate", "date", 10),
      c("l_receiptdate", "date", 10),
      c("l_shipmode", "text", 5),
    ],
  },
};

export const TPCH_SCHEMA: SchemaDef = { tables: TABLE_NAMES.map((t) => SCHEMA[t]) };

/** Every column of every TPC-H table, in schema order. */
export const ALL_COLUMNS: string[] = TABLE_NAMES.flatMap((t) =>
  SCHEMA[t].columns.map((col) => col.name),
);

const COLUMN_TABLE = new Map<string, TpchTable>(
  TABLE_NAMES.flatMap((t) => SCHEMA[t].columns.map((col) => [col.name, t] as const)),
);

/** The TPC-H table a (prefixed, so unique) TPC-H column belongs to. */
export function tableOf(column: string): TpchTable {
  const t = COLUMN_TABLE.get(column);
  if (!t) throw new Error(`Unknown column ${column}`);
  return t;
}

export function columnDef(column: string): ColumnDef {
  const def = SCHEMA[tableOf(column)].columns.find((col) => col.name === column);
  if (!def) throw new Error(`Unknown column ${column}`);
  return def;
}

export interface ScalePreset {
  id: "xs" | "s" | "m";
  label: string;
  orders: number;
}

export const SCALES: Record<ScalePreset["id"], ScalePreset> = {
  xs: { id: "xs", label: "XS · 3k orders", orders: 3_000 },
  s: { id: "s", label: "S · 7.5k orders", orders: 7_500 },
  m: { id: "m", label: "M · 15k orders", orders: 15_000 },
};

/** Table cardinalities follow TPC-H's ratios (customer:orders = 1:10, part ≈ orders × 2/15). */
export function cardinalities(orders: number) {
  return {
    region: 5,
    nation: 25,
    supplier: Math.max(20, Math.round(orders / 150)),
    customer: Math.max(50, Math.round(orders / 10)),
    part: Math.max(50, Math.round((orders * 2) / 15)),
    orders,
  };
}

/* ---------- dates ---------- */

const DAY_MS = 86_400_000;
const EPOCH = Date.UTC(1992, 0, 1);

/** Days since 1992-01-01 (TPC-H's STARTDATE). */
export function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
}

export function isoFromDay(day: number): string {
  return new Date(EPOCH + day * DAY_MS).toISOString().slice(0, 10);
}

/** Fractional days since 1992-01-01 for an ISO timestamp "YYYY-MM-DD HH:MM:SS". */
export function dayTime(iso: string): number {
  const [date, time = "00:00:00"] = iso.split(/[ T]/);
  const [h, m, s] = time.split(":").map(Number);
  return dayNumber(date) + ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) / 86_400;
}

/** The ISO timestamp "YYYY-MM-DD HH:MM:SS" of a fractional day number (whole seconds). */
export function isoFromDayTime(x: number): string {
  const ms = Math.round(x * 86_400) * 1000;
  return new Date(EPOCH + ms).toISOString().slice(0, 19).replace("T", " ");
}

/** A column value on the cost model's numeric scale (dates as day numbers), or null for text. */
export function numericValue(type: ColumnType, v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (type === "text") return null;
  if (type === "date") return dayNumber(String(v));
  if (type === "datetime") return dayTime(String(v));
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

/** TPC-H order dates run from STARTDATE to ENDDATE - 151 days. */
export const ORDER_DATE_MIN = 0;
export const ORDER_DATE_MAX = dayNumber("1998-08-02");
/** TPC-H CURRENTDATE, which splits returnflag/linestatus values. */
export const CURRENT_DATE = dayNumber("1995-06-17");
