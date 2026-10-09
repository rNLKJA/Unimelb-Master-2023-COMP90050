/**
 * Workload scenarios, modelled on the experiment designs in Perera et al.
 * (2023): a static workload that repeats every round, a shifting workload that
 * moves between groups of templates, a random ad-hoc workload, and an HTAP mix
 * of analytical reads and transactional writes.
 */
import type { DatabaseStats } from "@/lib/db/stats";
import type { QueryInstance } from "@/lib/engine/types";
import { deriveSeed, mulberry32, pick } from "@/lib/random";
import {
  GROUP_LABELS,
  READ_TEMPLATES,
  TEMPLATE_BY_ID,
  type QueryTemplate,
  type TemplateGroup,
} from "./templates";

export type ScenarioId = "static" | "shifting" | "random" | "htap";

export const SCENARIOS: Record<ScenarioId, { label: string; blurb: string }> = {
  static: {
    label: "Static",
    blurb: "All twelve read templates every round (three instances each), fresh parameters.",
  },
  shifting: {
    label: "Shifting",
    blurb: "Three phases: order desk, then shipping analytics, then parts and customers.",
  },
  random: {
    label: "Random",
    blurb: "Ad-hoc rounds: 36 queries drawn at random from the twelve read templates.",
  },
  htap: {
    label: "HTAP",
    blurb: "The static reads plus as many single-order UPDATEs, which pay for index maintenance.",
  },
};

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
}

const SHIFT_ORDER: TemplateGroup[] = ["orders", "shipping", "catalogue"];

export function generateWorkload({
  scenario,
  rounds,
  seed,
  stats,
  perRound = 36,
}: WorkloadOptions): Workload {
  const rng = mulberry32(deriveSeed(seed, `workload:${scenario}`));
  const ctx = { stats };
  let counter = 0;
  const make = (t: QueryTemplate): QueryInstance => ({ id: `q${++counter}`, ...t.build(rng, ctx) });
  const out: QueryInstance[][] = [];
  const phases: Phase[] = [];

  const phaseLength = Math.max(1, Math.ceil(rounds / SHIFT_ORDER.length));
  for (let r = 0; r < rounds; r++) {
    const batch: QueryInstance[] = [];
    if (scenario === "static" || scenario === "htap") {
      for (let i = 0; i < perRound; i++)
        batch.push(make(READ_TEMPLATES[i % READ_TEMPLATES.length]));
      if (scenario === "htap") {
        const writer = TEMPLATE_BY_ID.get("U1")!;
        for (let i = 0; i < perRound; i++) batch.push(make(writer));
      }
    } else if (scenario === "shifting") {
      const group = SHIFT_ORDER[Math.min(SHIFT_ORDER.length - 1, Math.floor(r / phaseLength))];
      if (r % phaseLength === 0) phases.push({ start: r, label: GROUP_LABELS[group] });
      const pool = READ_TEMPLATES.filter((t) => t.group === group);
      for (let i = 0; i < perRound; i++) batch.push(make(pool[i % pool.length]));
    } else {
      for (let i = 0; i < perRound; i++) batch.push(make(pick(rng, READ_TEMPLATES)));
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
