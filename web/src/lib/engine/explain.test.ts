import { describe, expect, it } from "vitest";
import { buildPlanTree, flattenPlan, scannedTables, usedIndexNames } from "./explain";

// Rows exactly as SQLite 3.49 prints them for a join with an index and a Bloom filter.
const ROWS = [
  { id: 3, parent: 0, detail: "SCAN lineitem" },
  { id: 6, parent: 0, detail: "BLOOM FILTER ON orders (o_orderkey=?)" },
  { id: 13, parent: 0, detail: "SEARCH orders USING INTEGER PRIMARY KEY (rowid=?)" },
  { id: 20, parent: 0, detail: "USE TEMP B-TREE FOR GROUP BY" },
];

describe("EXPLAIN QUERY PLAN parsing", () => {
  it("builds a tree and classifies operations", () => {
    const tree = buildPlanTree(ROWS);
    expect(tree.map((n) => n.op)).toEqual(["scan", "other", "search", "temp"]);
    expect(tree[0].table).toBe("lineitem");
    expect(scannedTables(tree)).toEqual(["lineitem"]);
  });

  it("finds secondary indexes, covering or not, and skips autoindexes", () => {
    const tree = buildPlanTree([
      {
        id: 2,
        parent: 0,
        detail:
          "SEARCH lineitem USING COVERING INDEX ix_lineitem__l_partkey__l_quantity (l_partkey=?)",
      },
      {
        id: 5,
        parent: 0,
        detail: "SEARCH supplier USING INDEX ix_supplier__s_nationkey (s_nationkey=?)",
      },
      { id: 7, parent: 0, detail: "SEARCH t USING INDEX sqlite_autoindex_t_1 (a=?)" },
    ]);
    expect(usedIndexNames(tree)).toEqual([
      "ix_lineitem__l_partkey__l_quantity",
      "ix_supplier__s_nationkey",
    ]);
    expect(tree[0].covering).toBe(true);
    expect(tree[1].covering).toBe(false);
  });

  it("nests children under their parent", () => {
    const tree = buildPlanTree([
      { id: 1, parent: 0, detail: "CO-ROUTINE sub" },
      { id: 4, parent: 1, detail: "SCAN orders" },
      { id: 9, parent: 0, detail: "SCAN sub" },
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].children[0].detail).toBe("SCAN orders");
    expect(flattenPlan(tree)).toHaveLength(3);
  });
});
