import { describe, expect, it } from "vitest";
import { smallDb } from "@/lib/test/fixtures";
import { TEMPLATE_BY_ID } from "@/lib/workload/templates";
import { mulberry32 } from "@/lib/random";
import { CostModel } from "./cost-model";
import type { IndexDef, QueryInstance } from "./types";

const { stats } = smallDb();
const model = new CostModel(stats);
const rng = mulberry32(5);
const make = (id: string): QueryInstance => ({
  id,
  ...TEMPLATE_BY_ID.get(id)!.build(rng, { stats }),
});
const ix = (table: IndexDef["table"], ...columns: string[]): IndexDef => ({ table, columns });

describe("CostModel (what-if)", () => {
  it("scans when no index applies", () => {
    const plan = model.estimate(make("Q3"), []);
    expect(plan.paths[0].kind).toBe("scan");
    expect(plan.used).toEqual([]);
  });

  it("uses an index whose leading column has an equality predicate", () => {
    const q = make("Q3");
    const none = model.estimate(q, []).cost;
    const plan = model.estimate(q, [ix("lineitem", "l_partkey")]);
    expect(plan.used).toEqual(["lineitem(l_partkey)"]);
    expect(plan.cost).toBeLessThan(none / 10);
  });

  it("ignores an index whose leading column is not constrained", () => {
    const plan = model.estimate(make("Q3"), [ix("lineitem", "l_quantity", "l_partkey")]);
    expect(plan.used).toEqual([]);
  });

  it("prefers a covering index (no rowid fetches)", () => {
    const q = make("Q3");
    const plain = model.estimate(q, [ix("lineitem", "l_partkey")]).cost;
    const covering = model.estimate(q, [ix("lineitem", "l_partkey", "l_quantity")]);
    expect(covering.paths[0]).toMatchObject({ kind: "index", covering: true });
    expect(covering.cost).toBeLessThan(plain);
  });

  it("matches an equality prefix followed by one range column", () => {
    const plan = model.estimate(make("Q11"), [ix("orders", "o_orderpriority", "o_orderdate")]);
    const path = plan.paths[0];
    expect(path.kind === "index" && path.matched).toEqual(["o_orderpriority", "o_orderdate"]);
  });

  it("turns a join into index nested loops when the inner side is indexed", () => {
    const q = make("Q5");
    const none = model.estimate(q, []).cost;
    const plan = model.estimate(q, [ix("orders", "o_custkey"), ix("lineitem", "l_orderkey")]);
    expect(plan.used.sort()).toEqual(["lineitem(l_orderkey)", "orders(o_custkey)"]);
    expect(plan.cost).toBeLessThan(none / 10);
  });

  it("charges index maintenance to UPDATEs", () => {
    const q = make("U1");
    const seek = model.estimate(q, [ix("lineitem", "l_orderkey")]);
    const both = model.estimate(q, [ix("lineitem", "l_orderkey"), ix("lineitem", "l_discount")]);
    expect(seek.maintenance).toBe(0);
    expect(both.maintained).toEqual(["lineitem(l_discount)"]);
    expect(both.cost).toBeGreaterThan(seek.cost);
  });

  it("estimates index sizes from row counts and key widths", () => {
    const one = model.indexBytes(ix("lineitem", "l_partkey"));
    const two = model.indexBytes(ix("lineitem", "l_partkey", "l_shipdate"));
    expect(two).toBeGreaterThan(one);
    // 2-byte key + 7 bytes overhead on pages ~92% full
    expect(one).toBe(Math.ceil((stats.lineitem.rows * 9) / 0.92));
  });

  it("counts what-if calls", () => {
    const m = new CostModel(stats);
    m.workloadCost([make("Q1"), make("Q2")], []);
    expect(m.calls).toBe(2);
  });
});
