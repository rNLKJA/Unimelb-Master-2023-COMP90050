/**
 * Real engine: SQLite compiled to WebAssembly (sql.js). Runs in a Web Worker in
 * the browser and directly under Node in the tests. Index creation and query
 * times are wall-clock measurements; index sizes come from the page-count delta.
 */
import type { Database, SqlJsStatic } from "sql.js";
import { TPCH_SCHEMA, type SchemaDef, type TableDef, type TableName } from "@/lib/db/schema";
import type { TableDataSet } from "@/lib/db/stats";
import type { ExecResult, Executor } from "./executor";
import {
  buildPlanTree,
  scannedTables,
  usedIndexNames,
  type ExplainRow,
  type PlanNode,
} from "./explain";
import { createIndexSql, indexId, indexName, type IndexDef, type QueryInstance } from "./types";

/**
 * The lab's DDL for one table: its INTEGER PRIMARY KEY (if any) and plain
 * typed columns. No UNIQUE constraints, foreign keys, CHECKs or secondary
 * indexes, so every index beyond the rowid is an advisor's choice.
 */
export function ddl(def: TableDef): string {
  const cols = def.columns.map((c) => {
    const type = c.type === "int" ? "INTEGER" : c.type === "real" ? "REAL" : "TEXT";
    return c.name === def.primaryKey
      ? `${c.name} INTEGER PRIMARY KEY`
      : `${c.name} ${type}${c.nullable ? "" : " NOT NULL"}`;
  });
  return `CREATE TABLE ${def.name} (${cols.join(", ")})`;
}

/** Create the schema, bulk-load the rows and gather statistics. */
export function loadDatabase(
  SQL: SqlJsStatic,
  data: TableDataSet,
  schema: SchemaDef = TPCH_SCHEMA,
): Database {
  const db = new SQL.Database();
  db.run("PRAGMA page_size = 4096");
  tune(db);
  db.run("BEGIN");
  for (const def of schema.tables) {
    const t = def.name;
    db.run(ddl(def));
    const cols = data[t].columns;
    const stmt = db.prepare(
      `INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    );
    for (const row of data[t].rows) stmt.run(row);
    stmt.free();
  }
  db.run("COMMIT");
  db.run("ANALYZE");
  return db;
}

/**
 * Connection settings for the lab: no transient automatic indexes (so a join
 * without an index really scans) and a page cache large enough to hold the
 * whole database, which keeps timings stable.
 */
export function tune(db: Database) {
  db.run("PRAGMA automatic_index = OFF");
  db.run("PRAGMA cache_size = -131072");
  db.run("PRAGMA temp_store = MEMORY");
}

export function explain(db: Database, sql: string): PlanNode[] {
  const res = db.exec(`EXPLAIN QUERY PLAN ${sql}`);
  const rows: ExplainRow[] = (res[0]?.values ?? []).map((v) => ({
    id: Number(v[0]),
    parent: Number(v[1]),
    detail: String(v[3]),
  }));
  return buildPlanTree(rows);
}

/** Opcodes that modify the database file (EXPLAIN's bytecode listing). */
const WRITE_OPCODES = new Set([
  "OpenWrite",
  "Insert",
  "Delete",
  "IdxInsert",
  "IdxDelete",
  "Clear",
  "Destroy",
  "CreateBtree",
  "DropTable",
  "DropIndex",
  "SetCookie",
]);

/**
 * Whether a statement only reads, decided the way sqlite3_stmt_readonly() does:
 * from its compiled bytecode (a write transaction or a write opcode), not from
 * its first keyword, so `WITH … UPDATE` counts as a write. Statements that do
 * not compile count as writes.
 */
export function isReadOnly(db: Database, sql: string): boolean {
  try {
    const res = db.exec(`EXPLAIN ${sql}`);
    const [cols, values] = [res[0]?.columns ?? [], res[0]?.values ?? []];
    const op = cols.indexOf("opcode");
    const p2 = cols.indexOf("p2");
    if (op < 0) return false;
    return !values.some(
      (v) => WRITE_OPCODES.has(String(v[op])) || (v[op] === "Transaction" && Number(v[p2]) !== 0),
    );
  } catch {
    return false;
  }
}

/** Rows inserted, updated or deleted on this connection so far (sqlite3_total_changes). */
export const totalChanges = (db: Database) =>
  Number(db.exec("SELECT total_changes()")[0].values[0][0]);

/** Bytes in pages that hold data (page count minus the free list). */
const pageBytes = (db: Database) => {
  const pragma = (name: string) => Number(db.exec(`PRAGMA ${name}`)[0].values[0][0]);
  return (pragma("page_count") - pragma("freelist_count")) * pragma("page_size");
};

export class SqliteExecutor implements Executor {
  readonly kind = "sqlite" as const;
  private db: Database;
  private readonly pristine: Uint8Array;
  private readonly byName = new Map<string, IndexDef>();

  /**
   * @param skipScan let SQLite use skip-scan on new indexes. Off by default:
   *   with sqlite_stat1 statistics SQLite will "skip" over a low-cardinality
   *   leading column, a plan our what-if model does not predict. Turning it on
   *   shows a real optimiser surprise.
   */
  constructor(
    private readonly SQL: SqlJsStatic,
    db: Database,
    private readonly now: () => number = () => performance.now(),
    private readonly skipScan = false,
  ) {
    this.pristine = db.export();
    // export() resets connection pragmas; reopen from the snapshot so every run starts identically.
    db.close();
    this.db = this.open();
  }

  private open(): Database {
    const db = new this.SQL.Database(this.pristine);
    tune(db);
    return db;
  }

  get database(): Database {
    return this.db;
  }

  createIndex(ix: IndexDef) {
    const before = pageBytes(this.db);
    const t0 = this.now();
    this.db.run(createIndexSql(ix));
    this.db.run(`ANALYZE ${indexName(ix)}`);
    if (!this.skipScan) {
      this.db.run(
        `UPDATE sqlite_stat1 SET stat = stat || ' noskipscan' WHERE idx = '${indexName(ix)}'`,
      );
      this.db.run("ANALYZE sqlite_schema");
    }
    const ms = this.now() - t0;
    this.byName.set(indexName(ix), ix);
    return { ms, bytes: Math.max(0, pageBytes(this.db) - before) };
  }

  dropIndex(ix: IndexDef) {
    const t0 = this.now();
    this.db.run(`DROP INDEX IF EXISTS ${indexName(ix)}`);
    return { ms: this.now() - t0 };
  }

  plan(sql: string): PlanNode[] {
    return explain(this.db, sql);
  }

  execute(q: QueryInstance): ExecResult {
    const plan = explain(this.db, q.sql);
    const t0 = this.now();
    if (q.kind === "update") this.db.run(q.sql);
    else this.db.exec(q.sql);
    const ms = this.now() - t0;
    const used = usedIndexNames(plan)
      .map((name) => this.byName.get(name))
      .filter((ix): ix is IndexDef => Boolean(ix))
      .map(indexId);
    const maintained =
      q.kind === "update" && q.updates
        ? [...this.byName.values()]
            .filter(
              (ix) =>
                ix.table === q.access[0].table && ix.columns.some((c) => q.updates!.includes(c)),
            )
            .filter((ix) => this.exists(ix))
            .map(indexId)
        : [];
    return { ms, used, maintained, scanned: scannedTables(plan) as TableName[] };
  }

  private exists(ix: IndexDef): boolean {
    const r = this.db.exec(
      `SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = '${indexName(ix)}'`,
    );
    return r.length > 0;
  }

  reset() {
    this.db.close();
    this.db = this.open();
    this.byName.clear();
  }

  close() {
    this.db.close();
  }
}
