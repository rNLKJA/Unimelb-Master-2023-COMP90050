/// <reference lib="webworker" />
/**
 * The lab's compute engine. Runs SQLite (sql.js) and every advisor off the
 * main thread so the page stays responsive while experiments run.
 */
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { createAdvisor } from "@/lib/advisors/registry";
import { consoleExamples, sameStatement, type ConsoleExample } from "@/lib/console/examples";
import { whatIfReport } from "@/lib/console/what-if";
import { DEFAULT_MAB, MabAdvisor } from "@/lib/advisors/mab/mab-advisor";
import { runAdvisor } from "@/lib/arena/run";
import { generateDatabase, rowCounts, type GeneratedDatabase } from "@/lib/db/generate";
import { SCALES, TABLE_NAMES, type ScalePreset } from "@/lib/db/schema";
import { computeStats, databaseBytes, type DatabaseStats } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import type { Executor } from "@/lib/engine/executor";
import { ModelExecutor } from "@/lib/engine/model-executor";
import {
  SqliteExecutor,
  explain,
  isReadOnly,
  loadDatabase,
  totalChanges,
  tune,
} from "@/lib/engine/sqlite-executor";
import { createIndexSql, indexName, type IndexDef } from "@/lib/engine/types";
import {
  FORECAST_DB_SCALE,
  FORECAST_DB_SEED,
  buildForecastView,
  type ForecastSettings,
} from "@/lib/forecast/view";
import { generateWorkload } from "@/lib/workload/scenarios";
import { TEMPLATE_BY_ID } from "@/lib/workload/templates";
import type { ConsoleResult, DatabaseInfo, LabRequest, LabResponse } from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: LabResponse) => ctx.postMessage(msg);

let SQL: SqlJsStatic | null = null;
async function sqlite(): Promise<SqlJsStatic> {
  SQL ??= await initSqlJs({ locateFile: () => "/vendor/sql-wasm.wasm" });
  return SQL;
}

interface Loaded {
  key: string;
  data: GeneratedDatabase;
  stats: DatabaseStats;
  info: DatabaseInfo;
}
let loaded: Loaded | null = null;

function ensureData(scale: ScalePreset["id"], seed: number): Loaded {
  const key = `${scale}:${seed}`;
  if (loaded?.key === key) return loaded;
  post({ type: "status", phase: "Generating TPC-H-like data" });
  const t0 = performance.now();
  const data = generateDatabase({ orders: SCALES[scale].orders, seed });
  const stats = computeStats(data);
  loaded = {
    key,
    data,
    stats,
    info: {
      rows: rowCounts(data),
      dataBytes: databaseBytes(stats),
      sqliteVersion: null,
      loadMs: performance.now() - t0,
    },
  };
  return loaded;
}

/** Run a few statements before timing anything so the WASM JIT is warm. */
function warmUp(db: Database) {
  for (let i = 0; i < 2; i++) {
    for (const t of TABLE_NAMES) db.exec(`SELECT COUNT(*) FROM ${t} WHERE rowid % 7 = 3`);
  }
}

/* ---------------- arena ---------------- */

async function runArena(config: Extract<LabRequest, { type: "arena:run" }>["config"]) {
  const started = performance.now();
  const base = ensureData(config.scale, config.seed);
  const { stats } = base;
  let executor: Executor;
  let sqliteExec: SqliteExecutor | null = null;
  if (config.engine === "sqlite") {
    post({ type: "status", phase: "Starting SQLite (WebAssembly)" });
    const S = await sqlite();
    post({ type: "status", phase: "Loading rows into SQLite" });
    const t0 = performance.now();
    const db = loadDatabase(S, base.data);
    warmUp(db);
    base.info.sqliteVersion = String(db.exec("SELECT sqlite_version()")[0].values[0][0]);
    base.info.loadMs = performance.now() - t0;
    sqliteExec = new SqliteExecutor(S, db, () => performance.now(), config.skipScan);
    executor = sqliteExec;
  } else {
    executor = new ModelExecutor(new CostModel(stats), config.seed);
  }

  const workload = generateWorkload({
    scenario: config.scenario,
    rounds: config.rounds,
    seed: config.seed,
    stats,
  });
  const budgetBytes = Math.round(config.budget * base.info.dataBytes);
  const counts = new Map<string, number>();
  for (const q of workload.rounds.flat()) counts.set(q.template, (counts.get(q.template) ?? 0) + 1);
  const seenSample = new Set<string>();
  const sample = workload.rounds
    .flat()
    .filter((q) => !seenSample.has(q.template) && seenSample.add(q.template));
  post({
    type: "arena:setup",
    info: base.info,
    budgetBytes,
    workload: {
      phases: workload.phases,
      perRound: workload.rounds.map((r) => r.length),
      templates: [...counts].map(([id, count]) => ({
        id,
        title: TEMPLATE_BY_ID.get(id)?.title ?? id,
        count,
      })),
      sample: sample.map((q) => ({ template: q.template, sql: q.sql })),
    },
  });

  for (const id of config.advisors) {
    post({ type: "status", phase: `Running ${id}` });
    const advisor = createAdvisor(id, { ...DEFAULT_MAB, alpha: config.mabAlpha });
    const result = runAdvisor({
      advisor,
      rounds: workload.rounds,
      executor,
      whatIf: new CostModel(stats),
      budgetBytes,
      whatIfLatencyMs: config.whatIfLatencyMs,
      seed: config.seed,
      onRound: (record) => post({ type: "arena:round", advisor: id, record }),
    });
    // The final configuration's plan for one instance of each template.
    const planTrees: Record<string, ReturnType<typeof explain>> = {};
    if (sqliteExec) {
      for (const q of sample) planTrees[q.template] = sqliteExec.plan(q.sql);
    }
    post({
      type: "arena:advisor-done",
      advisor: id,
      totals: result.totals,
      finalConfig: result.finalConfig,
      mabTrace: advisor instanceof MabAdvisor ? advisor.trace : undefined,
      plans: sqliteExec ? planTrees : undefined,
    });
  }
  sqliteExec?.close();
  post({ type: "arena:done", elapsedMs: performance.now() - started });
}

/* ---------------- console ---------------- */

interface ConsoleSession {
  db: Database;
  model: CostModel;
  examples: Map<string, ConsoleExample>;
  indexes: Map<string, { index: IndexDef; bytes: number }>;
}
let session: ConsoleSession | null = null;

async function openConsole(scale: ScalePreset["id"], seed: number) {
  const base = ensureData(scale, seed);
  post({ type: "status", phase: "Starting SQLite (WebAssembly)" });
  const S = await sqlite();
  post({ type: "status", phase: "Loading rows into SQLite" });
  session?.db.close();
  session = null;
  const t0 = performance.now();
  const db = loadDatabase(S, base.data);
  tune(db);
  warmUp(db);
  base.info.sqliteVersion = String(db.exec("SELECT sqlite_version()")[0].values[0][0]);
  base.info.loadMs = performance.now() - t0;
  const examples = consoleExamples(base.stats, seed);
  session = {
    db,
    model: new CostModel(base.stats),
    examples: new Map(examples.map((e) => [e.id, e])),
    indexes: new Map(),
  };
  post({
    type: "console:ready",
    info: base.info,
    indexes: [],
    examples: examples.map(({ id, title, blurb, sql, instance }) => ({
      id,
      title,
      blurb,
      sql,
      templated: Boolean(instance),
    })),
  });
}

const MAX_ROWS = 200;
const looksLikeQuery = (sql: string) => /^\s*(SELECT|WITH|VALUES)\b/i.test(sql);

/** Run a prepared statement to completion, keeping at most MAX_ROWS rows. */
function drain(db: Database, sql: string, keep: boolean) {
  const stmt = db.prepare(sql);
  const columns = stmt.getColumnNames();
  const rows: ConsoleResult["rows"] = [];
  let truncated = false;
  const t0 = performance.now();
  try {
    while (stmt.step()) {
      if (!keep) continue;
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        continue;
      }
      rows.push(stmt.get().map((v) => (v instanceof Uint8Array ? `<blob ${v.length} B>` : v)));
    }
  } finally {
    stmt.free();
  }
  return { columns, rows, truncated, ms: performance.now() - t0 };
}

function execConsole(sql: string, exampleId?: string) {
  if (!session) throw new Error("The database is still loading.");
  const { db } = session;
  let plan: ConsoleResult["plan"] = [];
  try {
    plan = explain(db, sql);
  } catch {
    plan = [];
  }
  const readOnly = looksLikeQuery(sql) && isReadOnly(db, sql);
  const before = totalChanges(db);
  const first = drain(db, sql, true);
  const changes = totalChanges(db) - before;
  const times = [first.ms];
  // Reads that finish quickly are timed twice more; the median is reported.
  // Anything that writes (including WITH … UPDATE) runs exactly once.
  if (readOnly && changes === 0 && first.ms < 100)
    for (let i = 0; i < 2; i++) times.push(drain(db, sql, false).ms);
  times.sort((a, b) => a - b);

  const example = exampleId ? session.examples.get(exampleId) : undefined;
  const whatIf =
    example?.instance && sameStatement(example.sql, sql)
      ? whatIfReport(
          session.model,
          example.instance,
          [...session.indexes.values()].map((e) => e.index),
        )
      : null;
  post({
    type: "console:result",
    result: {
      columns: first.columns,
      rows: first.rows,
      truncated: first.truncated,
      ms: times[times.length >> 1],
      runs: times.length,
      plan,
      changes,
      whatIf,
    },
  });
}

function pageBytes(db: Database) {
  const pragma = (name: string) => Number(db.exec(`PRAGMA ${name}`)[0].values[0][0]);
  return (pragma("page_count") - pragma("freelist_count")) * pragma("page_size");
}

function indexConsole(action: "create" | "drop", index: IndexDef) {
  if (!session) throw new Error("The database is still loading.");
  const { db, indexes } = session;
  const name = indexName(index);
  const t0 = performance.now();
  if (action === "create") {
    if (!indexes.has(name)) {
      const before = pageBytes(db);
      db.run(createIndexSql(index));
      db.run(`ANALYZE ${name}`);
      db.run(
        `UPDATE sqlite_stat1 SET stat = stat || ' noskipscan' WHERE idx = '${name}' AND stat NOT LIKE '%noskipscan%'`,
      );
      db.run("ANALYZE sqlite_schema");
      indexes.set(name, { index, bytes: Math.max(0, pageBytes(db) - before) });
    }
  } else {
    db.run(`DROP INDEX IF EXISTS ${name}`);
    indexes.delete(name);
  }
  post({
    type: "console:indexes",
    indexes: [...indexes.values()],
    action,
    ms: performance.now() - t0,
  });
}

/* ---------------- forecasting ---------------- */

function runForecastLab(settings: ForecastSettings) {
  const t0 = performance.now();
  const { stats } = ensureData(FORECAST_DB_SCALE, FORECAST_DB_SEED);
  const view = buildForecastView(stats, settings);
  post({ type: "forecast:result", view, ms: performance.now() - t0 });
}

ctx.onmessage = async (event: MessageEvent<LabRequest>) => {
  const req = event.data;
  try {
    if (req.type === "arena:run") await runArena(req.config);
    else if (req.type === "console:open") await openConsole(req.scale, req.seed);
    else if (req.type === "console:exec") execConsole(req.sql, req.exampleId);
    else if (req.type === "console:index") indexConsole(req.action, req.index);
    else if (req.type === "forecast:run") runForecastLab(req.settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // SQL mistakes in a ready console are the reader's to fix, not a crash.
    if (session && (req.type === "console:exec" || req.type === "console:index"))
      post({ type: "console:error", message });
    else post({ type: "error", message });
  }
};
