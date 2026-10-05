/**
 * Greedy super-arm oracle with filtering (Perera et al. 2023, §4): prune arms
 * with non-positive scores, then alternate (a) picking the highest-scoring arm
 * that fits the remaining memory and (b) filtering out arms that no longer fit,
 * arms already covered by the pick through prefix matching (including arms
 * that share its leading column), and — when the pick is a covering index for
 * a query — every other arm generated only for that query. Greedy selection
 * gives the (1 - 1/e)-approximation the regret bound relies on.
 */
import type { Arm } from "./arms";

export interface OracleOptions {
  budgetBytes: number;
  maxPerTable: number;
}

const isPrefix = (a: string[], b: string[]) =>
  a.length <= b.length && a.every((c, i) => c === b[i]);

export function selectSuperArm(
  arms: Arm[],
  scores: number[],
  { budgetBytes, maxPerTable }: OracleOptions,
): Arm[] {
  let pool = arms.map((arm, i) => ({ arm, score: scores[i] })).filter((a) => a.score > 0);
  const chosen: Arm[] = [];
  let remaining = budgetBytes;
  const perTable = new Map<string, number>();

  while (pool.length > 0) {
    let best = 0;
    for (let i = 1; i < pool.length; i++) if (pool[i].score > pool[best].score) best = i;
    const { arm } = pool[best];
    pool.splice(best, 1);
    if (arm.bytes > remaining) continue;

    chosen.push(arm);
    remaining -= arm.bytes;
    const count = (perTable.get(arm.index.table) ?? 0) + 1;
    perTable.set(arm.index.table, count);

    pool = pool.filter(({ arm: other }) => {
      if (other.bytes > remaining) return false;
      if (other.index.table !== arm.index.table) return true;
      if (count >= maxPerTable) return false;
      if (isPrefix(other.index.columns, arm.index.columns)) return false;
      if (other.index.columns[0] === arm.index.columns[0]) return false;
      if (arm.covers.size > 0 && [...other.queries].every((t) => arm.covers.has(t))) return false;
      return true;
    });
  }
  return chosen;
}
