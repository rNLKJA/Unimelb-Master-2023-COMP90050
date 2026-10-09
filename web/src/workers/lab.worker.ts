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
import type { LlmContext } from "@/lib/ai/index-advisor";
import { runAdvisor } from "@/lib/arena/run";
import { runReplicate, warmUp as warmUpBench, type BenchEnv } from "@/lib/bench/benchmark";
import { readTables, sqliteBytes, valuePools } from "@/lib/datasets/louvre/data";
import { LOUVRE_PROVENANCE } from "@/lib/datasets/louvre/schema";
import { DATASETS, type DatasetId } from "@/lib/datasets/registry";
import { generateDatabase, rowCounts } from "@/lib/db/generate";
import { SCALES, type SchemaDef, type ScalePreset } from "@/lib/db/schema";
import { computeStats, databaseBytes, type DatabaseStats, type TableDataSet } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import type { Executor } from "@/lib/engine/executor";
import type { PlanNode } from "@/lib/engine/explain";
import { ModelExecutor } from "@/lib/engine/model-executor";
import {
  SqliteExecutor,
  explain,
  isReadOnly,
  loadDatabase,
  totalChanges,
  tune,
} from "@/lib/engine/sqlite-executor";
import { createIndexSql, indexName, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import {
  FORECAST_DB_SCALE,
  FORECAST_DB_SEED,
  buildForecastView,
  type ForecastSettings,
} from "@/lib/forecast/view";
import { generateWorkload } from "@/lib/workload/scenarios";
import type { ValuePools } from "@/lib/workload/types";
import type {
  ArenaConfig,
  BenchRunConfig,
  ConsoleResult,
  DatabaseInfo,
  LabRequest,
  LabResponse,
  LlmContextRequest,
} from "./protocol";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const post = (msg: LabResponse) => ctx.postMessage(msg);

let SQL: SqlJsStatic | null = null;
async function sqlite(): Promise<SqlJsStatic> {
  SQL ??= await initSqlJs({ locateFile: () => "/vendor/sql-wasm.wasm" });
  return SQL;
}

interface Loaded {
  key: string;
  dataset: DatasetId;
  schema: SchemaDef;
  data: TableDataSet;
  stats: DatabaseStats;
  pools?: ValuePools;
  info: DatabaseInfo;
}
let loaded: Loaded | null = null;

/** The Louvre file is fetched and decoded once per worker. */
let louvreRows: Promise<TableDataSet> | null = null;
function louvreData(): Promise<TableDataSet> {
  louvreRows ??= (async () => {
    post({ type: "status", phase: "Downloading the Louvre database" });
    const res = await fetch(LOUVRE_PROVENANCE.url);
    if (!res.ok) throw new Error(`Could not download the Louvre database (HTTP ${res.status})`);
    const bytes = await sqliteBytes(new Uint8Array(await res.arrayBuffer()));
    const S = await sqlite();
    const db = new S.Database(bytes);
    try {
      return readTables(db, DATASETS.louvre.schema);
    } finally {
      db.close();
    }
  })();
  louvreRows.catch(() => (louvreRows = null));
  return louvreRows;
}

async function ensureData(
  dataset: DatasetId,
  scale: ScalePreset["id"],
  seed: number,
): Promise<Loaded> {
  const key = dataset === "louvre" ? "louvre" : `tpch:${scale}:${seed}`;
  if (loaded?.key === key) return loaded;
  const t0 = performance.now();
  const schema = DATASETS[dataset].schema;
  let data: TableDataSet;
  let pools: ValuePools | undefined;
  if (dataset === "louvre") {
    data = await louvreData();
    pools = valuePools(data);
  } else {
    post({ type: "status", phase: "Generating TPC-H-like data" });
    data = generateDatabase({ orders: SCALES[scale].orders, seed });
  }
  const stats = computeStats(data, schema);
  loaded = {
    key,
    dataset,
    schema,
    data,
    stats,
    pools,
    info: {
      dataset,
      rows: rowCounts(data),
      dataBytes: databaseBytes(stats),
      sqliteVersion: null,
      loadMs: performance.now() - t0,
    },
  };
  return loaded;
}

/** Run a few statements before timing anything so the WASM JIT is warm. */
function warmUp(db: Database, schema: SchemaDef) {
  for (let i = 0; i < 2; i++) {
    for (const t of schema.tables) db.exec(`SELECT COUNT(*) FROM ${t.name} WHERE rowid % 7 = 3`);
  }
}

/** Load a dataset into a fresh SQLite database, warmed up, and note the version. */
async function openSqlite(base: Loaded): Promise<Database> {
  post({ type: "status", phase: "Starting SQLite (WebAssembly)" });
  const S = await sqlite();
  post({ type: "status", phase: "Loading rows into SQLite" });
  const t0 = performance.now();
  const db = loadDatabase(S, base.data, base.schema);
  warmUp(db, base.schema);
  base.info.sqliteVersion = String(db.exec("SELECT sqlite_version()")[0].values[0][0]);
  base.info.loadMs = performance.now() - t0;
  return db;
}

function workloadFor(base: Loaded, c: Pick<ArenaConfig, "scenario" | "rounds" | "seed" | "drift">) {
  return generateWorkload({
    scenario: c.scenario,
    rounds: c.rounds,
    seed: c.seed,
    stats: base.stats,
    suite: DATASETS[base.dataset].suite,
    pools: base.pools,
    drift: c.drift,
  });
}

/** One instance of each template, in order of first appearance. */
function firstOfEach(queries: QueryInstance[]): QueryInstance[] {
  const seen = new Set<string>();
  return queries.filter((q) => !seen.has(q.template) && seen.add(q.template));
}

/* ---------------- arena ---------------- */

async function runArena(config: ArenaConfig) {
  const started = performance.now();
  const base = await ensureData(config.dataset, config.scale, config.seed);
  const { stats } = base;
  const suite = DATASETS[config.dataset].suite;
  let executor: Executor;
  let sqliteExec: SqliteExecutor | null = null;
  if (config.engine === "sqlite") {
    const db = await openSqlite(base);
    sqliteExec = new SqliteExecutor(await sqlite(), db, () => performance.now(), config.skipScan);
    executor = sqliteExec;
  } else {
    executor = new ModelExecutor(new CostModel(stats), config.seed);
  }

  const workload = workloadFor(base, config);
  const budgetBytes = Math.round(config.budget * base.info.dataBytes);
  const counts = new Map<string, number>();
  for (const q of workload.rounds.flat()) counts.set(q.template, (counts.get(q.template) ?? 0) + 1);
  const sample = firstOfEach(workload.rounds.flat());
  post({
    type: "arena:setup",
    info: base.info,
    budgetBytes,
    workload: {
      phases: workload.phases,
      perRound: workload.rounds.map((r) => r.length),
      templates: [...counts].map(([id, count]) => ({
        id,
        title: suite.byId.get(id)?.title ?? id,
        count,
      })),
      sample: sample.map((q) => ({ template: q.template, sql: q.sql })),
    },
  });

  const extras = {
    llm: config.llm ? { config: config.llm.config, latencyMs: config.llm.latencyMs } : undefined,
    workload: workload.rounds.flat(),
  };
  for (const id of config.advisors) {
    post({ type: "status", phase: `Running ${id}` });
    const advisor = createAdvisor(id, { ...DEFAULT_MAB, alpha: config.mabAlpha }, extras);
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
    const planTrees: Record<string, PlanNode[]> = {};
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

/* ---------------- benchmark ---------------- */

async function runBench(config: BenchRunConfig) {
  const started = performance.now();
  const base = await ensureData(config.dataset, config.scale, config.seed);
  const budgetBytes = Math.round(config.budget * base.info.dataBytes);
  let sqliteExec: SqliteExecutor | null = null;
  if (config.engine === "sqlite") {
    const db = await openSqlite(base);
    sqliteExec = new SqliteExecutor(await sqlite(), db, () => performance.now(), config.skipScan);
  }
  const env: BenchEnv = {
    stats: base.stats,
    suite: DATASETS[config.dataset].suite,
    pools: base.pools,
    executor: (seed) => sqliteExec ?? new ModelExecutor(new CostModel(base.stats), seed),
  };
  const levels: (number | null)[] = config.sweep ?? [null];
  const total = levels.length * config.replicates;
  post({ type: "bench:setup", info: base.info, budgetBytes, total });
  let done = 0;
  let warm = false;
  for (const drift of levels) {
    const cfg = {
      scenario: drift === null ? config.scenario : ("drifting" as const),
      drift: drift ?? config.drift,
      rounds: config.rounds,
      replicates: config.replicates,
      seed: config.seed,
      budgetBytes,
      advisors: config.advisors,
      whatIfLatencyMs: config.whatIfLatencyMs,
      mabAlpha: config.mabAlpha,
      llm: config.llm ? { config: config.llm.config, latencyMs: config.llm.latencyMs } : undefined,
    };
    if (!warm) {
      // One discarded replicate first, so nothing timed runs on a cold engine.
      post({ type: "status", phase: "Warming up (one discarded replicate)" });
      warmUpBench(env, cfg);
      warm = true;
    }
    for (let r = 0; r < config.replicates; r++) {
      post({
        type: "status",
        phase:
          drift === null
            ? `Replicate ${r + 1} of ${config.replicates}`
            : `Drift ${drift.toFixed(2)} · replicate ${r + 1} of ${config.replicates}`,
      });
      const result = runReplicate(env, cfg, r);
      post({ type: "bench:replicate", drift, result, done: ++done });
    }
  }
  sqliteExec?.close();
  post({ type: "bench:done", elapsedMs: performance.now() - started });
}

/* ---------------- LLM context ---------------- */

/** EXPLAIN QUERY PLAN as indented lines. */
function planLines(nodes: PlanNode[], depth = 0): string[] {
  return nodes.flatMap((n) => [
    `${"  ".repeat(depth)}${n.detail}`,
    ...planLines(n.children, depth + 1),
  ]);
}

async function llmContext(req: LlmContextRequest) {
  const base = await ensureData(req.dataset, req.scale, req.seed);
  const db = await openSqlite(base);
  try {
    const round = workloadFor(base, req).rounds[0] ?? [];
    const model = new CostModel(base.stats);
    const byTemplate = new Map<string, { count: number; cost: number; q: QueryInstance }>();
    let total = 0;
    for (const q of round) {
      const cost = model.estimate(q, []).cost;
      total += cost;
      const e = byTemplate.get(q.template);
      if (e) {
        e.count++;
        e.cost += cost;
      } else byTemplate.set(q.template, { count: 1, cost, q });
    }
    const suite = DATASETS[req.dataset].suite;
    const context: LlmContext = {
      dataset: req.dataset,
      datasetLabel: DATASETS[req.dataset].label,
      scenario: req.scenario,
      seed: req.seed,
      rounds: req.rounds,
      budgetBytes: Math.round(req.budget * base.info.dataBytes),
      dataBytes: base.info.dataBytes,
      engine: `SQLite ${base.info.sqliteVersion} (sql.js, WebAssembly)`,
      stats: base.stats,
      workload: [...byTemplate.values()].map(({ count, cost, q }) => ({
        template: q.template,
        title: suite.byId.get(q.template)?.title ?? q.template,
        count,
        kind: q.kind,
        costShare: total > 0 ? cost / total : 0,
        sql: q.sql,
      })),
      plans: firstOfEach(round).map((q) => ({
        template: q.template,
        lines: planLines(explain(db, q.sql)),
      })),
    };
    post({ type: "llm:context", context });
  } finally {
    db.close();
  }
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
  const base = await ensureData("tpch", scale, seed);
  post({ type: "status", phase: "Starting SQLite (WebAssembly)" });
  const S = await sqlite();
  post({ type: "status", phase: "Loading rows into SQLite" });
  session?.db.close();
  session = null;
  const t0 = performance.now();
  const db = loadDatabase(S, base.data, base.schema);
  tune(db);
  warmUp(db, base.schema);
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

async function runForecastLab(settings: ForecastSettings) {
  const t0 = performance.now();
  const { stats } = await ensureData("tpch", FORECAST_DB_SCALE, FORECAST_DB_SEED);
  const view = buildForecastView(stats, settings);
  post({ type: "forecast:result", view, ms: performance.now() - t0 });
}

ctx.onmessage = async (event: MessageEvent<LabRequest>) => {
  const req = event.data;
  try {
    if (req.type === "arena:run") await runArena(req.config);
    else if (req.type === "bench:run") await runBench(req.config);
    else if (req.type === "llm:context") await llmContext(req.request);
    else if (req.type === "console:open") await openConsole(req.scale, req.seed);
    else if (req.type === "console:exec") execConsole(req.sql, req.exampleId);
    else if (req.type === "console:index") indexConsole(req.action, req.index);
    else if (req.type === "forecast:run") await runForecastLab(req.settings);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // SQL mistakes in a ready console are the reader's to fix, not a crash.
    if (session && (req.type === "console:exec" || req.type === "console:index"))
      post({ type: "console:error", message });
    else post({ type: "error", message });
  }
};
