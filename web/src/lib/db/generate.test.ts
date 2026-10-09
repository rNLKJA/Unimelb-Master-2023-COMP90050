import { describe, expect, it } from "vitest";
import { smallDb } from "@/lib/test/fixtures";
import { generateDatabase, rowCounts } from "./generate";
import { CURRENT_DATE, cardinalities, dayNumber, isoFromDay } from "./schema";

describe("generateDatabase", () => {
  const { data } = smallDb();

  it("follows TPC-H cardinality ratios", () => {
    const counts = rowCounts(data);
    expect(counts).toMatchObject({ ...cardinalities(7_500), orders: 7_500 });
    // 1..7 lines per order, uniformly: about 4 per order
    expect(counts.lineitem / counts.orders).toBeGreaterThan(3.8);
    expect(counts.lineitem / counts.orders).toBeLessThan(4.2);
  });

  it("is deterministic", () => {
    const again = generateDatabase({ orders: 7_500, seed: 42 });
    expect(again.lineitem.rows.slice(0, 50)).toEqual(data.lineitem.rows.slice(0, 50));
    expect(again.orders.rows.at(-1)).toEqual(data.orders.rows.at(-1));
  });

  it("applies TPC-H's returnflag and linestatus rules", () => {
    const col = (name: string) => data.lineitem.columns.indexOf(name);
    for (const row of data.lineitem.rows.slice(0, 5000)) {
      const receipt = dayNumber(String(row[col("l_receiptdate")]));
      const ship = dayNumber(String(row[col("l_shipdate")]));
      expect(row[col("l_returnflag")] === "N").toBe(receipt > CURRENT_DATE);
      expect(row[col("l_linestatus")] === "O").toBe(ship > CURRENT_DATE);
      expect(receipt).toBeGreaterThan(ship);
    }
  });

  it("derives order status from its lines", () => {
    const status = new Map(data.orders.rows.map((r) => [r[0], r[2]]));
    const lines = new Map<number, string[]>();
    for (const r of data.lineitem.rows) {
      const k = Number(r[0]);
      lines.set(k, [...(lines.get(k) ?? []), String(r[9])]);
    }
    for (const [k, ls] of [...lines].slice(0, 2000)) {
      const expected = ls.every((s) => s === "F") ? "F" : ls.every((s) => s === "O") ? "O" : "P";
      expect(status.get(k)).toBe(expected);
    }
  });

  it("round-trips dates", () => {
    expect(isoFromDay(dayNumber("1995-06-17"))).toBe("1995-06-17");
    expect(dayNumber("1992-01-01")).toBe(0);
  });
});
