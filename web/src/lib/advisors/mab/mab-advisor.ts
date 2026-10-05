/**
 * The MAB index tuner (Perera et al. 2023, Algorithm 2) around C²UCB.
 *
 * Each round it: summarises last round's statements by template (the queries
 * of interest), detects workload shift and forgets accordingly, generates arms
 * and contexts, scores them with C²UCB, asks the greedy oracle for a super arm
 * and materialises it. After the round runs it shapes rewards from *observed*
 * execution statistics, never from optimiser estimates:
 *
 *   gain(i, q) = [C(q, no index) − C(q, s)] / |indexes q used or maintained|
 *   r(i)      = Σ_q gain(i, q) − creation time of i (if built this round)
 *
 * and applies the "focused update": the execution gain is learnt with the
 * size feature switched off, the creation cost with only the size feature on.
 */
import { databaseBytes } from "@/lib/db/stats";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import type { Advisor, AdvisorContext, RoundFeedback } from "../types";
import {
  CONTEXT_DIMENSION,
  D_SIZE,
  DEFAULT_ARM_OPTIONS,
  contextVector,
  generateArms,
  workloadPredicateColumns,
  type Arm,
  type ArmOptions,
} from "./arms";
import { C2UCB, DEFAULT_C2UCB } from "./c2ucb";
import { selectSuperArm } from "./oracle";

export interface MabOptions {
  alpha: number;
  lambda: number;
  alphaDecay: number;
  arms: ArmOptions;
  maxPerTable: number;
  /**
   * Weight of the learnt creation cost in an arm's score. The authors' public
   * configuration counts it at one third (an index is paid for once but used
   * for many rounds); 1 is the paper's plain equation.
   */
  creationWeight: number;
  /** A template stays "of interest" for this many rounds after it was last seen. */
  queryMemory: number;
}

export const DEFAULT_MAB: MabOptions = {
  ...DEFAULT_C2UCB,
  arms: DEFAULT_ARM_OPTIONS,
  maxPerTable: 6,
  creationWeight: 1 / 3,
  queryMemory: 2,
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

interface Played {
  arm: Arm;
  x: Float64Array;
}

export interface MabRoundTrace {
  round: number;
  arms: number;
  shift: number;
  chosen: { id: string; mean: number; bonus: number }[];
  rewards: Record<string, { gain: number; creation: number }>;
}

export class MabAdvisor implements Advisor {
  readonly id = "mab" as const;
  readonly bandit: C2UCB;
  private seen = new Set<string>();
  private store = new Map<string, { query: QueryInstance; lastSeen: number }>();
  private usage = new Map<string, number>();
  private baseline = new Map<string, number[]>();
  private worst = new Map<string, number>();
  private played: Played[] = [];
  readonly trace: MabRoundTrace[] = [];

  constructor(readonly opts: MabOptions = DEFAULT_MAB) {
    this.bandit = new C2UCB({
      dimension: CONTEXT_DIMENSION,
      alpha: opts.alpha,
      lambda: opts.lambda,
      alphaDecay: opts.alphaDecay,
    });
  }

  recommend(ctx: AdvisorContext): IndexDef[] | null {
    const last = ctx.history.at(-1);
    if (!last || last.length === 0) return null;

    // Query store: latest instance and last-seen round per template.
    for (const q of last) this.store.set(q.template, { query: q, lastSeen: ctx.round - 1 });
    const lastTemplates = new Set(last.map((q) => q.template));
    const fresh = [...lastTemplates].filter((t) => !this.seen.has(t)).length;
    const shift = this.seen.size === 0 ? 0 : fresh / lastTemplates.size;
    if (shift > 0) this.bandit.forget(shift);
    lastTemplates.forEach((t) => this.seen.add(t));

    // Queries of interest: templates seen within the query memory window.
    const qoi = [...this.store.values()]
      .filter((e) => ctx.round - 1 - e.lastSeen < this.opts.queryMemory)
      .map((e) => e.query);

    const arms = [...generateArms(qoi, ctx.whatIf, this.opts.arms).values()];
    const predicates = workloadPredicateColumns(qoi);
    const dbBytes = databaseBytes(ctx.whatIf.stats);
    const current = new Set(ctx.current.map(indexId));
    const contexts = arms.map((arm) =>
      contextVector(arm, predicates, {
        materialised: current.has(arm.id),
        databaseBytes: dbBytes,
        usage: this.usage.get(arm.id) ?? 0,
      }),
    );
    const scores = this.bandit.score(contexts, {
      feature: D_SIZE,
      weight: this.opts.creationWeight,
    });
    const chosen = selectSuperArm(
      arms,
      scores.map((s) => s.score),
      { budgetBytes: ctx.budgetBytes, maxPerTable: this.opts.maxPerTable },
    );
    const byId = new Map(arms.map((a, i) => [a.id, i]));
    this.played = chosen.map((arm) => ({ arm, x: contexts[byId.get(arm.id)!] }));
    this.trace.push({
      round: ctx.round,
      arms: arms.length,
      shift,
      chosen: chosen.map((a) => {
        const s = scores[byId.get(a.id)!];
        return { id: a.id, mean: s.mean, bonus: s.bonus };
      }),
      rewards: {},
    });
    return chosen.map((a) => a.index);
  }

  observe({ queries, results, created }: RoundFeedback) {
    const gains = new Map<string, number>();
    const usedCount = new Map<string, number>();
    queries.forEach((q: QueryInstance, i) => {
      const r = results[i];
      const participants = [...new Set([...r.used, ...r.maintained])];
      this.worst.set(q.template, Math.max(this.worst.get(q.template) ?? 0, r.ms));
      if (participants.length === 0) {
        // Remember recent full-scan times; the median keeps one noisy run from skewing rewards.
        const seen = [...(this.baseline.get(q.template) ?? []), r.ms].slice(-5);
        this.baseline.set(q.template, seen);
        return;
      }
      for (const id of r.used) usedCount.set(id, (usedCount.get(id) ?? 0) + 1);
      const scans = this.baseline.get(q.template);
      const base = scans ? median(scans) : this.worst.get(q.template)!;
      const share = (base - r.ms) / participants.length;
      for (const id of participants) gains.set(id, (gains.get(id) ?? 0) + share);
    });

    const creation = new Map(created.map((c) => [indexId(c.index), c.ms]));
    const trace = this.trace.at(-1);
    for (const { arm, x } of this.played) {
      const gain = gains.get(arm.id) ?? 0;
      const execContext = Float64Array.from(x);
      execContext[D_SIZE] = 0;
      this.bandit.update(execContext, gain);
      const built = creation.get(arm.id);
      if (built !== undefined && x[D_SIZE] > 0) {
        const sizeOnly = new Float64Array(x.length);
        sizeOnly[D_SIZE] = x[D_SIZE];
        this.bandit.update(sizeOnly, -built);
      }
      if (trace) trace.rewards[arm.id] = { gain, creation: built ?? 0 };
    }

    const n = Math.max(1, queries.length);
    const ids = new Set([...this.usage.keys(), ...usedCount.keys()]);
    for (const id of ids)
      this.usage.set(id, ((this.usage.get(id) ?? 0) + (usedCount.get(id) ?? 0) / n) / 2);
    this.played = [];
  }
}
