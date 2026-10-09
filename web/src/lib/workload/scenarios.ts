/**
 * Workload scenarios, modelled on the experiment designs in Perera et al.
 * (2023): a static workload that repeats every round, a shifting workload that
 * moves between groups of templates, a random ad-hoc workload, and an HTAP mix
 * of analytical reads and transactional writes. The 2026 upgrade adds a
 * drifting workload whose `drift` parameter interpolates between static
 * (0) and shifting (1), for the benchmark's drift-sensitivity sweep.
 *
 * Every scenario works on any dataset's WorkloadSuite (TPC-H-like or Louvre).
 */
import type { DatabaseStats } from "@/lib/db/stats";
import type { QueryInstance } from "@/lib/engine/types";
import { deriveSeed, mulberry32, pick } from "@/lib/random";
import { TPCH_SUITE } from "./templates";
import type { QueryTemplate, ValuePools, WorkloadSuite } from "./types";

export type ScenarioId = "static" | "shifting" | "random" | "htap" | "drifting";

export const SCENARIO_IDS: ScenarioId[] = ["static", "shifting", "drifting", "random", "htap"];

export const SCENARIOS: Record<ScenarioId, { label: string; blurb: string }> = {
  static: {
    label: "Static",
    blurb: "All twelve read templates every round (three instances each), fresh parameters.",
  },
  shifting: {
    label: "Shifting",
    blurb: "Three phases, each running only one group of templates.",
  },
  drifting: {
    label: "Drifting",
    blurb:
      "Each round mixes all twelve reads with the current phase's group. The drift setting is the focused share (0 = static, 1 = shifting).",
  },
  random: {
    label: "Random",
    blurb: "Ad-hoc rounds: 36 queries drawn at random from the twelve read templates.",
  },
  htap: {
    label: "HTAP",
    blurb: "The static reads plus as many single-row UPDATEs, which pay for index maintenance.",
  },
};

/** A scenario's description with the dataset's own phase names. */
export function scenarioBlurb(scenario: ScenarioId, suite: WorkloadSuite = TPCH_SUITE): string {
  const groups = suite.groups.map((g) => g.label.toLowerCase());
  if (scenario === "shifting")
    return `Three phases: ${groups[0]}, then ${groups[1]}, then ${groups[2]}.`;
  if (scenario === "htap") {
    const writer = suite.byId.get(suite.writer);
    return `The static reads plus as many UPDATEs (${writer?.title.toLowerCase() ?? suite.writer}), which pay for index maintenance.`;
  }
  return SCENARIOS[scenario].blurb;
}

export interface Phase {
  start: number;
  label: string;
}

export interface Workload {
  scenario: ScenarioId;
  rounds: QueryInstance[][];
  phases: Phase[];
}

export interface WorkloadOptions {
  scenario: ScenarioId;
  rounds: number;
  seed: number;
  stats: DatabaseStats;
  /** Statements per round (default 36: each of the twelve read templates three times). */
  perRound?: number;
  /** The dataset's templates (default: TPC-H-like). */
  suite?: WorkloadSuite;
  /** Real values for template literals (needed by the Louvre suite). */
  pools?: ValuePools;
  /** Drifting only: share of each round drawn from the current phase's group, 0 to 1. */
  drift?: number;
}

export function generateWorkload({
  scenario,
  rounds,
  seed,
  stats,
  perRound = 36,
  suite = TPCH_SUITE,
  pools,
  drift = 0.5,
}: WorkloadOptions): Workload {
  // The TPC-H suite keeps its original stream label so earlier runs reproduce exactly.
  const label = suite.id === "tpch" ? `workload:${scenario}` : `workload:${suite.id}:${scenario}`;
  const rng = mulberry32(deriveSeed(seed, label));
  const ctx = { stats, pools };
  let counter = 0;
  const make = (t: QueryTemplate): QueryInstance => ({ id: `q${++counter}`, ...t.build(rng, ctx) });
  const reads = suite.reads;
  const out: QueryInstance[][] = [];
  const phases: Phase[] = [];
  const order = suite.groups;
  const focus = Math.round(Math.min(1, Math.max(0, drift)) * perRound);

  const phaseLength = Math.max(1, Math.ceil(rounds / order.length));
  for (let r = 0; r < rounds; r++) {
    const batch: QueryInstance[] = [];
    if (scenario === "static" || scenario === "htap") {
      for (let i = 0; i < perRound; i++) batch.push(make(reads[i % reads.length]));
      if (scenario === "htap") {
        const writer = suite.byId.get(suite.writer)!;
        for (let i = 0; i < perRound; i++) batch.push(make(writer));
      }
    } else if (scenario === "shifting" || scenario === "drifting") {
      const group = order[Math.min(order.length - 1, Math.floor(r / phaseLength))];
      if (r % phaseLength === 0) phases.push({ start: r, label: group.label });
      const pool = reads.filter((t) => t.group === group.id);
      if (scenario === "shifting") {
        for (let i = 0; i < perRound; i++) batch.push(make(pool[i % pool.length]));
      } else {
        for (let i = 0; i < perRound - focus; i++) batch.push(make(reads[i % reads.length]));
        for (let i = 0; i < focus; i++) batch.push(make(pool[i % pool.length]));
      }
    } else {
      for (let i = 0; i < perRound; i++) batch.push(make(pick(rng, reads)));
    }
    out.push(batch);
  }
  if (phases.length === 0) phases.push({ start: 0, label: SCENARIOS[scenario].label });
  return { scenario, rounds: out, phases };
}

/** Distinct templates in a batch of queries. */
export function templateSet(queries: QueryInstance[]): Set<string> {
  return new Set(queries.map((q) => q.template));
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
