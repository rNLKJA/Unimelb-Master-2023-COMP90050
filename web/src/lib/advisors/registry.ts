import { autoAdmin } from "./auto-admin";
import { cophy } from "./cophy";
import { db2Advisor } from "./db2-advisor";
import { drop } from "./drop";
import { MabAdvisor, DEFAULT_MAB, type MabOptions } from "./mab/mab-advisor";
import { FixedConfigAdvisor, HindsightAdvisor, NoIndexAdvisor, OfflineAdvisor } from "./offline";
import type { IndexDef, QueryInstance } from "@/lib/engine/types";
import type { Advisor, AdvisorId } from "./types";

export type AdvisorFamily =
  "baseline" | "heuristic" | "linear-programming" | "bandit" | "llm" | "reference";

export interface AdvisorInfo {
  id: AdvisorId;
  name: string;
  short: string;
  year: number;
  family: AdvisorFamily;
  /** Survey paper id (see survey/papers.ts). */
  paper: string | null;
  mode: "offline" | "online" | "none";
  blurb: string;
}

/** The six algorithms of the 2023 survey (plus the no-index baseline), as the arena lists them. */

export const ADVISORS: AdvisorInfo[] = [
  {
    id: "none",
    name: "No index",
    short: "No index",
    year: 0,
    family: "baseline",
    paper: null,
    mode: "none",
    blurb: "Primary keys only. Every predicate on a non-key column scans its table.",
  },
  {
    id: "drop",
    name: "DROP heuristic",
    short: "DROP",
    year: 1985,
    family: "heuristic",
    paper: "whang-drop",
    mode: "offline",
    blurb: "Start with every single-column index, drop the least useful until the budget fits.",
  },
  {
    id: "autoadmin",
    name: "AutoAdmin",
    short: "AutoAdmin",
    year: 1997,
    family: "heuristic",
    paper: "autoadmin-1997",
    mode: "offline",
    blurb:
      "Per-query candidates, Greedy(m, k) enumeration over what-if costs, widened column by column.",
  },
  {
    id: "db2advis",
    name: "DB2 Advisor",
    short: "DB2 Adv.",
    year: 2000,
    family: "linear-programming",
    paper: "db2-advisor",
    mode: "offline",
    blurb:
      "Credit each query's gain to the indexes its best plan uses, knapsack by benefit/size, then random swaps.",
  },
  {
    id: "cophy",
    name: "CoPhy (exact BIP)",
    short: "CoPhy",
    year: 2011,
    family: "linear-programming",
    paper: "cophy",
    mode: "offline",
    blurb: "Index selection as a binary integer program, solved exactly here by branch and bound.",
  },
  {
    id: "mab",
    name: "MAB (C²UCB)",
    short: "MAB",
    year: 2021,
    family: "bandit",
    paper: "perera-mab",
    mode: "online",
    blurb: "Learns from observed runtimes every round; never asks the optimiser what-if questions.",
  },
];

/** The 2026 additions: the bring-your-own-key LLM advisor and the benchmark's reference. */
export const LLM_ADVISOR: AdvisorInfo = {
  id: "llm",
  name: "LLM advisor (your key)",
  short: "LLM",
  year: 2026,
  family: "llm",
  paper: null,
  mode: "offline",
  blurb:
    "Your own Claude or OpenAI key proposes indexes from the schema, a workload summary and the current plans; the lab validates them and builds them at round 2.",
};

export const HINDSIGHT_ADVISOR: AdvisorInfo = {
  id: "hindsight",
  name: "Hindsight optimum (reference)",
  short: "Hindsight",
  year: 0,
  family: "reference",
  paper: "cophy",
  mode: "offline",
  blurb:
    "CoPhy's what-if optimum for the whole workload, built before round 1 and never changed. It knows the future, so it is the yardstick for regret, not a contender. The benchmark says whether branch and bound proved it optimal.",
};

export const ADVISOR_BY_ID = new Map(
  [...ADVISORS, LLM_ADVISOR, HINDSIGHT_ADVISOR].map((a) => [a.id, a]),
);

export interface AdvisorExtras {
  /** The LLM advisor's validated configuration and the provider latency to charge. */
  llm?: { config: IndexDef[]; latencyMs: number };
  /** Every query of the run, for the hindsight reference. */
  workload?: QueryInstance[];
}

export function createAdvisor(
  id: AdvisorId,
  mab: MabOptions = DEFAULT_MAB,
  extras: AdvisorExtras = {},
): Advisor {
  switch (id) {
    case "none":
      return new NoIndexAdvisor();
    case "drop":
      return new OfflineAdvisor("drop", drop);
    case "autoadmin":
      return new OfflineAdvisor("autoadmin", autoAdmin);
    case "db2advis":
      return new OfflineAdvisor("db2advis", db2Advisor);
    case "cophy":
      return new OfflineAdvisor("cophy", cophy);
    case "mab":
      return new MabAdvisor(mab);
    case "llm":
      if (!extras.llm) throw new Error("The LLM advisor needs an accepted proposal first");
      return new FixedConfigAdvisor("llm", extras.llm.config, extras.llm.latencyMs);
    case "hindsight":
      if (!extras.workload) throw new Error("The hindsight reference needs the whole workload");
      return new HindsightAdvisor(extras.workload);
  }
}
