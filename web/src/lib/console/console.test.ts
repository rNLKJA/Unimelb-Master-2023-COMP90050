import { describe, expect, it } from "vitest";
import { CostModel } from "@/lib/engine/cost-model";
import { flattenPlan } from "@/lib/engine/explain";
import { loadDatabase, explain } from "@/lib/engine/sqlite-executor";
import { createIndexSql, indexName } from "@/lib/engine/types";
import { smallDb, sqlJs } from "@/lib/test/fixtures";
import { consoleExamples, sameStatement } from "./examples";
import { whatIfReport } from "./what-if";

describe("console examples", () => {
  it("covers every template plus the catalogue queries, deterministically", () => {
    const { stats } = smallDb();
    const a = consoleExamples(stats, 7);
    const b = consoleExamples(stats, 7);
    expect(a.map((e) => e.sql)).toEqual(b.map((e) => e.sql));
    expect(a.filter((e) => e.instance).map((e) => e.id)).toContain("U1");
    expect(a.find((e) => e.id === "tables")?.instance).toBeUndefined();
  });

  it("matches statements regardless of whitespace and a trailing semicolon", () => {
    expect(sameStatement("SELECT 1\n  FROM t;", "SELECT 1 FROM t")).toBe(true);
    expect(sameStatement("SELECT 1 FROM t", "SELECT 2 FROM t")).toBe(false);
  });

  it("every example runs on SQLite", async () => {
    const SQL = await sqlJs();
    const { data, stats } = smallDb();
    const db = loadDatabase(SQL, data);
    for (const e of consoleExamples(stats, 2023)) expect(() => db.exec(e.sql)).not.toThrow();
    db.close();
  });
});

describe("what-if report", () => {
  it("ranks candidate indexes, and the best one is the plan SQLite then picks", async () => {
    const { data, stats } = smallDb();
    const model = new CostModel(stats);
    const q = consoleExamples(stats, 2023).find((e) => e.id === "Q3")!.instance!;
    const report = whatIfReport(model, q, []);
    expect(report.paths[0].kind).toBe("scan");
    expect(report.candidates.length).toBeGreaterThan(0);
    const best = report.candidates[0];
    expect(best.cost).toBeLessThan(report.cost / 10);
    expect(best.index.columns[0]).toBe("l_partkey");

    const SQL = await sqlJs();
    const db = loadDatabase(SQL, data);
    db.run(createIndexSql(best.index));
    const plan = explain(db, q.sql);
    expect(plan[0].index).toBe(indexName(best.index));
    db.close();
  });

  it("does not suggest indexes that already exist", () => {
    const { stats } = smallDb();
    const model = new CostModel(stats);
    const q = consoleExamples(stats, 2023).find((e) => e.id === "Q3")!.instance!;
    const first = whatIfReport(model, q, []).candidates[0];
    const again = whatIfReport(model, q, [first.index]);
    expect(again.candidates.map((c) => c.id)).not.toContain(first.id);
    expect(again.paths[0].index).toBe(first.id);
  });
});

describe("what-if paths vs SQLite plans (no secondary indexes)", () => {
  it("chooses the same access kind per table as SQLite for every template", async () => {
    const SQL = await sqlJs();
    const { data, stats } = smallDb();
    const db = loadDatabase(SQL, data);
    db.run("PRAGMA automatic_index = OFF");
    const model = new CostModel(stats);
    for (const e of consoleExamples(stats, 2023)) {
      if (!e.instance) continue;
      const predicted = Object.fromEntries(
        whatIfReport(model, e.instance, []).paths.map((p) => [p.table, p.kind]),
      );
      const actual = Object.fromEntries(
        flattenPlan(explain(db, e.sql))
          .filter((n) => n.table && (n.op === "scan" || n.op === "search"))
          .map((n) => [
            n.table,
            n.op === "scan" ? "scan" : n.detail.includes("PRIMARY KEY") ? "rowid" : "index",
          ]),
      );
      expect(predicted, e.id).toEqual(actual);
    }
    db.close();
  });
});
