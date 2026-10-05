/**
 * Integration tests against real SQLite (sql.js). They check that the what-if
 * model agrees with SQLite's own planner on which index a query uses, and that
 * index sizes are estimated within a few percent of SQLite's page counts.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { SqlJsStatic } from "sql.js";
import { TABLE_NAMES } from "@/lib/db/schema";
import { smallDb, sqlJs } from "@/lib/test/fixtures";
import { mulberry32 } from "@/lib/random";
import { TEMPLATES, TEMPLATE_BY_ID } from "@/lib/workload/templates";
import { CostModel } from "./cost-model";
import { SqliteExecutor, loadDatabase } from "./sqlite-executor";
import { indexId, type IndexDef, type QueryInstance } from "./types";

const { data, stats } = smallDb();
const model = new CostModel(stats);
let SQL: SqlJsStatic;
let ex: SqliteExecutor;
const rng = mulberry32(11);
const make = (id: string): QueryInstance => ({
  id,
  ...TEMPLATE_BY_ID.get(id)!.build(rng, { stats }),
});

beforeAll(async () => {
  SQL = await sqlJs();
  ex = new SqliteExecutor(SQL, loadDatabase(SQL, data));
});

describe("SQLite engine", () => {
  it("loads every row", () => {
    for (const t of TABLE_NAMES) {
      const n = ex.database.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
      expect(n).toBe(data[t].rows.length);
    }
  });

  it("runs every template", () => {
    ex.reset();
    for (const t of TEMPLATES) {
      const r = ex.execute(make(t.id));
      expect(r.ms).toBeGreaterThanOrEqual(0);
    }
  });

  it("agrees with the what-if model on single-index plans", () => {
    const cases: [string, IndexDef][] = [
      ["Q1", { table: "orders", columns: ["o_custkey"] }],
      ["Q2", { table: "lineitem", columns: ["l_shipdate"] }],
      ["Q3", { table: "lineitem", columns: ["l_partkey"] }],
      ["Q4", { table: "lineitem", columns: ["l_suppkey", "l_shipmode"] }],
      ["Q5", { table: "lineitem", columns: ["l_orderkey"] }],
      ["Q8", { table: "lineitem", columns: ["l_receiptdate"] }],
      ["Q10", { table: "orders", columns: ["o_orderdate"] }],
      ["Q11", { table: "orders", columns: ["o_orderpriority", "o_orderdate"] }],
      ["Q12", { table: "lineitem", columns: ["l_partkey"] }],
      ["U1", { table: "lineitem", columns: ["l_orderkey"] }],
    ];
    for (const [template, index] of cases) {
      ex.reset();
      ex.createIndex(index);
      const q = make(template);
      const real = ex.execute(q).used;
      const est = model.estimate(q, [index]).used;
      expect({ template, real }).toEqual({ template, real: est });
      expect(real).toContain(indexId(index));
    }
  });

  it("estimates index sizes within 10% of SQLite's pages", () => {
    ex.reset();
    for (const index of [
      { table: "lineitem", columns: ["l_shipdate"] },
      { table: "lineitem", columns: ["l_partkey", "l_quantity"] },
      { table: "orders", columns: ["o_custkey"] },
    ] as IndexDef[]) {
      const { bytes } = ex.createIndex(index);
      expect(Math.abs(model.indexBytes(index) / bytes - 1)).toBeLessThan(0.1);
    }
  });

  it("reports indexes an UPDATE has to maintain", () => {
    ex.reset();
    ex.createIndex({ table: "lineitem", columns: ["l_orderkey"] });
    ex.createIndex({ table: "lineitem", columns: ["l_discount"] });
    const r = ex.execute(make("U1"));
    expect(r.used).toEqual(["lineitem(l_orderkey)"]);
    expect(r.maintained).toEqual(["lineitem(l_discount)"]);
  });

  it("disables skip-scan unless asked", async () => {
    const index: IndexDef = { table: "lineitem", columns: ["l_partkey", "l_suppkey"] };
    const q = make("Q4");
    ex.reset();
    ex.createIndex(index);
    expect(ex.execute(q).used).toEqual([]);
    const skippy = new SqliteExecutor(SQL, loadDatabase(SQL, data), undefined, true);
    skippy.createIndex(index);
    expect(
      skippy
        .plan(q.sql)
        .map((n) => n.detail)
        .join(" "),
    ).toMatch(/ANY\(l_partkey\)/);
    skippy.close();
  });

  it("starts every run from the same pristine data", () => {
    ex.reset();
    ex.execute(make("U1"));
    ex.createIndex({ table: "orders", columns: ["o_custkey"] });
    ex.reset();
    const indexes = ex.database.exec("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'")[0]
      .values[0][0];
    expect(indexes).toBe(0);
  });
});
