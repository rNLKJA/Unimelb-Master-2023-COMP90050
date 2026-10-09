/**
 * The shape every dataset's workload shares: query templates that produce
 * concrete SQL plus a structured description of their predicates, grouped
 * into phases for the shifting and drifting scenarios.
 */
import type { DatabaseStats, Value } from "@/lib/db/stats";
import type { QueryInstance } from "@/lib/engine/types";
import type { Rng } from "@/lib/random";

/**
 * Real values to draw literals from, keyed `table.column` (for example the
 * Louvre's ticket barcodes). Drawing from a column's rows weights each value
 * by how often it occurs.
 */
export type ValuePools = Record<string, readonly Value[]>;

export interface TemplateContext {
  stats: DatabaseStats;
  pools?: ValuePools;
}

export interface QueryTemplate {
  id: string;
  title: string;
  /** Phase group (see WorkloadSuite.groups). */
  group: string;
  kind: "select" | "update";
  blurb: string;
  build: (rng: Rng, ctx: TemplateContext) => Omit<QueryInstance, "id">;
}

/** One dataset's templates and how the scenarios use them. */
export interface WorkloadSuite {
  id: string;
  templates: QueryTemplate[];
  /** Read templates, in the order static rounds cycle through them. */
  reads: QueryTemplate[];
  byId: Map<string, QueryTemplate>;
  /** Phase order for shifting and drifting workloads. */
  groups: { id: string; label: string }[];
  /** The UPDATE template HTAP rounds add. */
  writer: string;
}

export function makeSuite(
  id: string,
  templates: QueryTemplate[],
  groups: { id: string; label: string }[],
  writer: string,
): WorkloadSuite {
  return {
    id,
    templates,
    reads: templates.filter((t) => t.kind === "select"),
    byId: new Map(templates.map((t) => [t.id, t])),
    groups,
    writer,
  };
}

/** A value drawn from a pool, or a clear error when the pool is missing. */
export function fromPool(rng: Rng, ctx: TemplateContext, key: string): Value {
  const pool = ctx.pools?.[key];
  if (!pool || pool.length === 0) throw new Error(`No value pool for ${key}`);
  return pool[Math.floor(rng() * pool.length)];
}
