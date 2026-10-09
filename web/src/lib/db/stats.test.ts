import { describe, expect, it } from "vitest";
import { smallDb } from "@/lib/test/fixtures";
import { dayNumber } from "./schema";

describe("computeStats", () => {
  const { stats } = smallDb();

  it("counts distinct values", () => {
    expect(stats.part.columns.p_brand.ndv).toBe(25);
    expect(stats.customer.columns.c_mktsegment.ndv).toBe(5);
    expect(stats.lineitem.columns.l_shipmode.ndv).toBe(7);
    expect(stats.orders.columns.o_orderstatus.ndv).toBe(3);
  });

  it("records numeric and date ranges", () => {
    expect(stats.lineitem.columns.l_quantity).toMatchObject({ min: 1, max: 50 });
    expect(stats.orders.columns.o_orderdate.min).toBeGreaterThanOrEqual(0);
    expect(stats.orders.columns.o_orderdate.max).toBeLessThanOrEqual(dayNumber("1998-08-02"));
    expect(stats.customer.columns.c_mktsegment.min).toBeNull();
  });
});
