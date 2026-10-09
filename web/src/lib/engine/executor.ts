import type { TableName } from "@/lib/db/schema";
import type { IndexDef, QueryInstance } from "./types";

export interface ExecResult {
  ms: number;
  /** Index ids (see indexId) the plan used. */
  used: string[];
  /** Index ids an UPDATE had to maintain. */
  maintained: string[];
  /** Tables scanned in full. */
  scanned: TableName[];
}

/**
 * The environment an advisor's configuration is applied to. Two
 * implementations: SQLite (sql.js, real measured runtimes) and a simulated
 * engine (deterministic, used by tests and the instant mode).
 */
export interface Executor {
  readonly kind: "sqlite" | "simulated";
  createIndex(ix: IndexDef): { ms: number; bytes: number };
  dropIndex(ix: IndexDef): { ms: number };
  execute(q: QueryInstance): ExecResult;
  /** Return to pristine data with no secondary indexes. */
  reset(): void;
}
