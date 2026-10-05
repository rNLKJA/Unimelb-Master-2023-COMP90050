/**
 * The arena loop. For each round: ask the advisor for a configuration (timed,
 * plus a nominal latency per what-if call), apply the difference to the engine
 * (index creation timed), run the round's statements (timed), and feed the
 * observations back. Total workload time = recommendation + creation +
 * execution, the breakdown Perera et al. report (Table 2 of the group report).
 */
import type { Advisor } from "@/lib/advisors/types";
import type { CostModel } from "@/lib/engine/cost-model";
import type { ExecResult, Executor } from "@/lib/engine/executor";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import { deriveSeed, mulberry32 } from "@/lib/random";

export interface RoundRecord {
  round: number;
  recommendationMs: number;
  creationMs: number;
  executionMs: number;
  whatIfCalls: number;
  invoked: boolean;
  config: string[];
  bytes: number;
  created: string[];
  dropped: string[];
  /** Execution time per template this round. */
  perTemplate: Record<string, number>;
  /** How many statements used each index. */
  usage: Record<string, number>;
}

export interface RunTotals {
  recommendationMs: number;
  creationMs: number;
  executionMs: number;
  totalMs: number;
  whatIfCalls: number;
  finalBytes: number;
}

export interface RunResult {
  advisor: string;
  rounds: RoundRecord[];
  totals: RunTotals;
  finalConfig: IndexDef[];
}

export interface RunOptions {
  advisor: Advisor;
  rounds: QueryInstance[][];
  executor: Executor;
  whatIf: CostModel;
  budgetBytes: number;
  /** Charged per what-if optimiser call (a real optimiser call costs milliseconds). */
  whatIfLatencyMs: number;
  seed: number;
  now?: () => number;
  onRound?: (r: RoundRecord) => void;
}

export function totalsOf(rounds: RoundRecord[]): RunTotals {
  const sum = (f: (r: RoundRecord) => number) => rounds.reduce((s, r) => s + f(r), 0);
  const recommendationMs = sum((r) => r.recommendationMs);
  const creationMs = sum((r) => r.creationMs);
  const executionMs = sum((r) => r.executionMs);
  return {
    recommendationMs,
    creationMs,
    executionMs,
    totalMs: recommendationMs + creationMs + executionMs,
    whatIfCalls: sum((r) => r.whatIfCalls),
    finalBytes: rounds.at(-1)?.bytes ?? 0,
  };
}

export function runAdvisor({
  advisor,
  rounds,
  executor,
  whatIf,
  budgetBytes,
  whatIfLatencyMs,
  seed,
  now = () => performance.now(),
  onRound,
}: RunOptions): RunResult {
  executor.reset();
  const rng = mulberry32(deriveSeed(seed, `advisor:${advisor.id}`));
  let current: IndexDef[] = [];
  const sizes = new Map<string, number>();
  const records: RoundRecord[] = [];

  rounds.forEach((queries, round) => {
    const callsBefore = whatIf.calls;
    const t0 = now();
    const proposal = advisor.recommend({
      round,
      history: rounds.slice(0, round),
      current,
      budgetBytes,
      whatIf,
      rng,
    });
    const algoMs = now() - t0;
    const whatIfCalls = whatIf.calls - callsBefore;

    let creationMs = 0;
    const created: { index: IndexDef; ms: number; bytes: number }[] = [];
    const dropped: string[] = [];
    if (proposal) {
      const next = new Map(proposal.map((ix) => [indexId(ix), ix]));
      for (const ix of current) {
        if (next.has(indexId(ix))) continue;
        creationMs += executor.dropIndex(ix).ms;
        dropped.push(indexId(ix));
        sizes.delete(indexId(ix));
      }
      const have = new Set(current.map(indexId));
      for (const ix of next.values()) {
        if (have.has(indexId(ix))) continue;
        const r = executor.createIndex(ix);
        creationMs += r.ms;
        sizes.set(indexId(ix), r.bytes);
        created.push({ index: ix, ms: r.ms, bytes: r.bytes });
      }
      current = [...next.values()];
    }

    const results: ExecResult[] = [];
    const perTemplate: Record<string, number> = {};
    const usage: Record<string, number> = {};
    let executionMs = 0;
    for (const q of queries) {
      const r = executor.execute(q);
      results.push(r);
      executionMs += r.ms;
      perTemplate[q.template] = (perTemplate[q.template] ?? 0) + r.ms;
      for (const id of r.used) usage[id] = (usage[id] ?? 0) + 1;
    }
    advisor.observe?.({ round, queries, results, created, config: current });

    const record: RoundRecord = {
      round,
      recommendationMs: algoMs + whatIfCalls * whatIfLatencyMs,
      creationMs,
      executionMs,
      whatIfCalls,
      invoked: proposal !== null,
      config: current.map(indexId),
      bytes: [...sizes.values()].reduce((s, b) => s + b, 0),
      created: created.map((c) => indexId(c.index)),
      dropped,
      perTemplate,
      usage,
    };
    records.push(record);
    onRound?.(record);
  });

  return { advisor: advisor.id, rounds: records, totals: totalsOf(records), finalConfig: current };
}
