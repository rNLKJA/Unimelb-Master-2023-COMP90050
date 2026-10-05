/**
 * Starter statements for the SQL console: one instance of every arena template
 * (so the what-if panel can reason about it) plus a few catalogue queries.
 */
import type { DatabaseStats } from "@/lib/db/stats";
import type { QueryInstance } from "@/lib/engine/types";
import { deriveSeed, mulberry32 } from "@/lib/random";
import { TEMPLATES } from "@/lib/workload/templates";

export interface ConsoleExample {
  id: string;
  title: string;
  blurb: string;
  sql: string;
  /** Structured shape of the statement, when it comes from a template. */
  instance?: QueryInstance;
}

const CATALOGUE: ConsoleExample[] = [
  {
    id: "tables",
    title: "Tables and indexes",
    blurb: "SQLite's own catalogue: every table and index, with its DDL.",
    sql: "SELECT type, name, tbl_name, sql FROM sqlite_schema ORDER BY type DESC, name",
  },
  {
    id: "stats",
    title: "Optimiser statistics",
    blurb: "What ANALYZE stored for the planner: rows, and rows per distinct key.",
    sql: "SELECT tbl, idx, stat FROM sqlite_stat1 ORDER BY tbl, idx",
  },
  {
    id: "sizes",
    title: "Rows per table",
    blurb: "Cardinalities of the TPC-H-like tables.",
    sql:
      "SELECT 'region' AS tbl, COUNT(*) AS rows FROM region UNION ALL SELECT 'nation', COUNT(*) FROM nation " +
      "UNION ALL SELECT 'supplier', COUNT(*) FROM supplier UNION ALL SELECT 'customer', COUNT(*) FROM customer " +
      "UNION ALL SELECT 'part', COUNT(*) FROM part UNION ALL SELECT 'orders', COUNT(*) FROM orders " +
      "UNION ALL SELECT 'lineitem', COUNT(*) FROM lineitem",
  },
];

export function consoleExamples(stats: DatabaseStats, seed: number): ConsoleExample[] {
  const rng = mulberry32(deriveSeed(seed, "console-examples"));
  const fromTemplates = TEMPLATES.map((t): ConsoleExample => {
    const instance: QueryInstance = { id: `example-${t.id}`, ...t.build(rng, { stats }) };
    return { id: t.id, title: t.title, blurb: t.blurb, sql: instance.sql, instance };
  });
  return [...fromTemplates, ...CATALOGUE];
}

/** Statements are compared ignoring whitespace, so reformatting keeps the what-if link. */
export function sameStatement(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").replace(/;\s*$/, "").trim();
  return norm(a) === norm(b);
}
