import { describe, expect, it } from "vitest";
import { CostModel } from "@/lib/engine/cost-model";
import { ModelExecutor } from "@/lib/engine/model-executor";
import { indexId, type QueryInstance } from "@/lib/engine/types";
import { databaseBytes } from "@/lib/db/stats";
import { mulberry32, normal } from "@/lib/random";
import { smallDb } from "@/lib/test/fixtures";
import { runAdvisor } from "@/lib/arena/run";
import { generateWorkload } from "@/lib/workload/scenarios";
import {
  CONTEXT_DIMENSION,
  D_COVERING,
  contextVector,
  generateArms,
  workloadPredicateColumns,
} from "./arms";
import { C2UCB } from "./c2ucb";
import { MabAdvisor } from "./mab-advisor";
import { selectSuperArm } from "./oracle";

const { stats } = smallDb();
const model = new CostModel(stats);

/**
 * Perera et al. (2023), Example 1: for "SELECT A.C1 FROM A WHERE A.C2 = 5 AND
 * A.C3 = 6" the system generates six arms — four combinations and
 * permutations of the predicates and two covering indexes that add the
 * payload — and the payload column's context component is 0.
 */
const example1: QueryInstance = {
  id: "ex1",
  template: "EX1",
  kind: "select",
  sql: "SELECT c_name FROM customer WHERE c_mktsegment = 'BUILDING' AND c_nationkey = 5",
  access: [
    { table: "customer", eq: ["c_mktsegment", "c_nationkey"], ranges: [], payload: ["c_name"] },
  ],
};

describe("MAB arms and contexts (paper parity)", () => {
  const arms = generateArms([example1], model, { maxPermutation: 2, minTableRows: 0 });

  it("generates the six arms of Example 1", () => {
    expect([...arms.keys()].sort()).toEqual([
      "customer(c_mktsegment)",
      "customer(c_mktsegment, c_nationkey)",
      "customer(c_mktsegment, c_nationkey, c_name)",
      "customer(c_nationkey)",
      "customer(c_nationkey, c_mktsegment)",
      "customer(c_nationkey, c_mktsegment, c_name)",
    ]);
    expect(arms.get("customer(c_mktsegment, c_nationkey, c_name)")!.covers.has("EX1")).toBe(true);
    expect(arms.get("customer(c_mktsegment, c_nationkey)")!.covers.size).toBe(0);
  });

  it("encodes column position as 10^-j and leaves payload-only columns at 0", () => {
    const arm = arms.get("customer(c_nationkey, c_mktsegment, c_name)")!;
    const x = contextVector(arm, workloadPredicateColumns([example1]), {
      materialised: false,
      databaseBytes: 1e6,
      usage: 0,
    });
    const nonZero = [...x.entries()].filter(([, v]) => v !== 0).map(([, v]) => v);
    expect(x).toHaveLength(CONTEXT_DIMENSION);
    expect(x[D_COVERING]).toBe(1);
    // nation key first (1), segment second (0.1), name is payload (0), plus covering flag and size
    expect(nonZero.filter((v) => v === 1 || v === 0.1)).toHaveLength(3);
    expect(nonZero).toHaveLength(4);
  });

  it("drops the size feature once an arm is materialised", () => {
    const arm = arms.get("customer(c_nationkey)")!;
    const fresh = contextVector(arm, new Set(), {
      materialised: false,
      databaseBytes: 1e6,
      usage: 0,
    });
    const built = contextVector(arm, new Set(), {
      materialised: true,
      databaseBytes: 1e6,
      usage: 0,
    });
    expect(fresh[1]).toBeGreaterThan(0);
    expect(built[1]).toBe(0);
  });
});

describe("C²UCB", () => {
  it("recovers a linear reward model by ridge regression", () => {
    const theta = [2, -1, 0.5];
    const b = new C2UCB({ dimension: 3, alpha: 1, lambda: 0.5, alphaDecay: 1 });
    const rng = mulberry32(1);
    for (let i = 0; i < 400; i++) {
      const x = Float64Array.from([rng(), rng(), rng()]);
      b.update(x, theta[0] * x[0] + theta[1] * x[1] + theta[2] * x[2] + 0.01 * normal(rng));
    }
    const w = b.weights();
    theta.forEach((t, i) => expect(w[i]).toBeCloseTo(t, 1));
  });

  it("shrinks the exploration bonus along observed directions", () => {
    const b = new C2UCB({ dimension: 2, alpha: 1, lambda: 0.5, alphaDecay: 1 });
    const seen = Float64Array.from([1, 0]);
    const unseen = Float64Array.from([0, 1]);
    for (let i = 0; i < 20; i++) b.update(seen, 1);
    const [s, u] = b.score([seen, unseen]);
    expect(s.bonus).toBeLessThan(u.bonus);
    expect(s.mean).toBeGreaterThan(u.mean);
  });

  it("decays α each round and forgets on workload shifts", () => {
    const b = new C2UCB({ dimension: 2, alpha: 1, lambda: 0.5, alphaDecay: 1.05 });
    b.score([Float64Array.from([1, 0])]);
    expect(b.alpha).toBeCloseTo(1 / 1.05, 10);
    b.update(Float64Array.from([1, 0]), 3);
    b.forget(0.25); // keep half of the history
    expect(b.b[0]).toBeCloseTo(1.5, 10);
    expect(b.alpha).toBe(1);
    b.forget(0.8); // large shift: hard reset
    expect(b.b[0]).toBe(0);
    expect(b.V[0][0]).toBe(0.5);
  });
});

describe("greedy oracle", () => {
  const arms = [
    ...generateArms([example1], model, { maxPermutation: 2, minTableRows: 0 }).values(),
  ];

  it("prunes non-positive arms, respects memory and filters covered arms", () => {
    const scores = arms.map((a) =>
      a.id === "customer(c_nationkey, c_mktsegment, c_name)"
        ? 5
        : a.id === "customer(c_mktsegment)"
          ? -1
          : 1,
    );
    const chosen = selectSuperArm(arms, scores, { budgetBytes: 1e9, maxPerTable: 6 });
    // The covering index covers EX1, so every other arm of EX1 is filtered out.
    expect(chosen.map((a) => a.id)).toEqual(["customer(c_nationkey, c_mktsegment, c_name)"]);
  });

  it("never exceeds the memory budget", () => {
    const scores = arms.map(() => 1);
    const budget = arms[0].bytes + 10;
    const chosen = selectSuperArm(arms, scores, { budgetBytes: budget, maxPerTable: 6 });
    expect(chosen.reduce((s, a) => s + a.bytes, 0)).toBeLessThanOrEqual(budget);
  });
});

describe("MAB tuner end to end", () => {
  it("learns a configuration that beats no index on a static workload", () => {
    const rounds = generateWorkload({ scenario: "static", rounds: 20, seed: 1, stats }).rounds;
    const run = (advisor: MabAdvisor | null) =>
      runAdvisor({
        advisor: advisor ?? { id: "none", recommend: () => null },
        rounds,
        executor: new ModelExecutor(new CostModel(stats), 7),
        whatIf: new CostModel(stats),
        budgetBytes: 2 * databaseBytes(stats),
        whatIfLatencyMs: 0,
        seed: 1,
      });
    const mab = new MabAdvisor();
    const learnt = run(mab);
    const baseline = run(null);
    const late = learnt.rounds.slice(-5).reduce((s, r) => s + r.executionMs, 0);
    const base = baseline.rounds.slice(-5).reduce((s, r) => s + r.executionMs, 0);
    expect(late).toBeLessThan(base * 0.3);
    expect(learnt.totals.whatIfCalls).toBe(0); // the bandit never asks the optimiser
    expect(mab.trace[0].arms).toBeGreaterThan(10);
    expect(learnt.finalConfig.map(indexId).length).toBeGreaterThan(3);
  });
});
