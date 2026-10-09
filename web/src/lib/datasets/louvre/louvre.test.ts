/**
 * The Louvre dataset: the shipped file is the INFO20003 database byte for
 * byte, it loads into the lab's index-free tables, and its workload runs on
 * SQLite with the what-if model agreeing with SQLite's planner.
 */
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SqlJsStatic } from "sql.js";
import { contextLayout, qualified } from "@/lib/advisors/mab/arms";
import { dayNumber, isoFromDayTime } from "@/lib/db/schema";
import { databaseBytes, type DatabaseStats, type TableDataSet } from "@/lib/db/stats";
import { CostModel } from "@/lib/engine/cost-model";
import { SqliteExecutor, loadDatabase } from "@/lib/engine/sqlite-executor";
import { indexId, type IndexDef, type QueryInstance } from "@/lib/engine/types";
import { templatize } from "@/lib/forecast/templatize";
import { mulberry32 } from "@/lib/random";
import { louvreDb, sqlJs, type LouvreFixture } from "@/lib/test/fixtures";
import { generateWorkload, templateSet } from "@/lib/workload/scenarios";
import { isGzip, isSqlite, valuePools } from "./data";
import { LOUVRE_PROVENANCE, LOUVRE_SCHEMA } from "./schema";
import { LOUVRE_SUITE, LOUVRE_TEMPLATES } from "./templates";

let fx: LouvreFixture;
let data: TableDataSet;
let stats: DatabaseStats;
let SQL: SqlJsStatic;
let ex: SqliteExecutor;
let model: CostModel;

beforeAll(async () => {
  fx = await louvreDb();
  ({ data, stats } = fx);
  SQL = await sqlJs();
  ex = new SqliteExecutor(SQL, loadDatabase(SQL, data, LOUVRE_SCHEMA));
  model = new CostModel(stats);
});

const make = (id: string, seed = 11): QueryInstance => ({
  id,
  ...LOUVRE_SUITE.byId.get(id)!.build(mulberry32(seed), { stats, pools: fx.pools }),
});

describe("Louvre provenance", () => {
  it("is the INFO20003 file, byte for byte", () => {
    expect(isSqlite(fx.bytes)).toBe(true);
    expect(isGzip(fx.bytes)).toBe(false);
    expect(fx.bytes.length).toBe(LOUVRE_PROVENANCE.bytes);
    expect(createHash("sha256").update(fx.bytes).digest("hex")).toBe(LOUVRE_PROVENANCE.sha256);
  });

  it("keeps every table and every row of the source", () => {
    expect(Object.keys(data)).toHaveLength(19);
    const counts = Object.fromEntries(Object.entries(data).map(([t, d]) => [t, d.rows.length]));
    expect(counts).toMatchObject({
      wing_scan: 19_545,
      ticket: 9_842,
      entry_scan: 9_738,
      payment: 5_412,
      purchase_order: 5_412,
      order_line: 5_412,
      exhibition_booking: 2_015,
      audio_guide_hire: 1_085,
    });
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    expect(total).toBeGreaterThan(65_000);
    expect(total).toBeLessThan(67_000);
  });
});

describe("Louvre statistics", () => {
  it("reads timestamps as fractional days and keeps NULLs out of the ranges", () => {
    const s = stats.wing_scan.columns.scanned_at;
    expect(s.type).toBe("datetime");
    expect(Math.floor(s.min!)).toBe(dayNumber("2015-03-01"));
    expect(Math.floor(s.max!)).toBe(dayNumber("2020-02-29"));
    expect(stats.purchase_order.columns.entrance_id.nulls).toBeGreaterThan(4_000);
    expect(stats.purchase_order.columns.entrance_id).toMatchObject({ ndv: 5, min: 1, max: 5 });
    expect(stats.wing.columns.wing_id).toMatchObject({ min: 1, max: 3 });
    expect(stats.order_line.primaryKey).toBeNull();
    expect(stats.ticket.primaryKey).toBe("ticket_id");
  });

  it("round-trips timestamps through day numbers", () => {
    const iso = "2017-08-19 14:05:33";
    const [date] = iso.split(" ");
    const x = dayNumber(date) + (14 * 3600 + 5 * 60 + 33) / 86_400;
    expect(isoFromDayTime(x)).toBe(iso);
  });

  it("keeps equal column names on different tables apart in the bandit's context", () => {
    const layout = contextLayout(stats);
    const columns = Object.values(stats).reduce((s, t) => s + Object.keys(t.columns).length, 0);
    expect(layout.dimension).toBe(3 + columns);
    expect(layout.slot.get(qualified("wing_scan", "ticket_id"))).not.toBe(
      layout.slot.get(qualified("entry_scan", "ticket_id")),
    );
  });
});

describe("Louvre in SQLite", () => {
  it("loads into index-free tables", () => {
    const n = ex.database.exec("SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'")[0]
      .values[0][0];
    expect(n).toBe(0);
    for (const t of ["wing_scan", "audio_guide_hire", "order_line"]) {
      const rows = ex.database.exec(`SELECT COUNT(*) FROM ${t}`)[0].values[0][0];
      expect(rows).toBe(data[t].rows.length);
    }
  });

  it("runs every template, and the reads return rows for most instances", () => {
    ex.reset();
    let nonEmpty = 0;
    for (const t of LOUVRE_TEMPLATES) {
      for (let s = 0; s < 5; s++) {
        const q = make(t.id, s + 1);
        expect(ex.execute(q).ms).toBeGreaterThanOrEqual(0);
        if (q.kind === "select" && ex.database.exec(q.sql).length > 0) nonEmpty++;
      }
    }
    expect(nonEmpty).toBeGreaterThan(30);
  });

  it("agrees with the what-if model on single-index plans", () => {
    const cases: [string, IndexDef][] = [
      ["L1", { table: "purchase_order", columns: ["ordered_at"] }],
      ["L2", { table: "payment", columns: ["method", "paid_at"] }],
      ["L3", { table: "ticket", columns: ["barcode"] }],
      ["L4", { table: "purchase_order", columns: ["payment_id"] }],
      ["L5", { table: "wing_scan", columns: ["wing_id", "scanned_at"] }],
      ["L6", { table: "entry_scan", columns: ["entrance_id", "scanned_at"] }],
      ["L7", { table: "wing_scan", columns: ["ticket_id"] }],
      ["L8", { table: "audio_guide_hire", columns: ["language_code", "issued_at"] }],
      ["L10", { table: "exhibition_booking", columns: ["ticket_id"] }],
      ["L11", { table: "hall_napoleon_scan", columns: ["scanned_at"] }],
      ["L12", { table: "exhibition_booking", columns: ["booked_at"] }],
      ["LU1", { table: "exhibition_booking", columns: ["ticket_id"] }],
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

  it("uses an index on the join column for the refund-desk join", () => {
    ex.reset();
    const index: IndexDef = { table: "order_line", columns: ["order_id"] };
    ex.createIndex(index);
    const q = make("L4");
    expect(ex.execute(q).used).toContain(indexId(index));
    expect(model.estimate(q, [index]).used).toContain(indexId(index));
  });

  it("estimates index sizes within 15% of SQLite's pages", () => {
    ex.reset();
    for (const index of [
      { table: "wing_scan", columns: ["scanned_at"] },
      { table: "wing_scan", columns: ["wing_id", "scanned_at"] },
      { table: "ticket", columns: ["barcode"] },
      { table: "entry_scan", columns: ["ticket_id"] },
    ] as IndexDef[]) {
      const { bytes } = ex.createIndex(index);
      expect(Math.abs(model.indexBytes(index) / bytes - 1)).toBeLessThan(0.15);
    }
  });
});

describe("Louvre workload", () => {
  const gen = (scenario: Parameters<typeof generateWorkload>[0]["scenario"], drift = 0.5) =>
    generateWorkload({
      scenario,
      rounds: 9,
      seed: 3,
      stats,
      suite: LOUVRE_SUITE,
      pools: fx.pools,
      drift,
    });

  it("static rounds run all twelve reads three times", () => {
    for (const r of gen("static").rounds) {
      expect(r).toHaveLength(36);
      expect(templateSet(r).size).toBe(12);
    }
  });

  it("shifts through box office, gallery floor and exhibitions", () => {
    const w = gen("shifting");
    expect(w.phases.map((p) => p.label)).toEqual(["Box office", "Gallery floor", "Exhibitions"]);
    expect([...templateSet(w.rounds[0])].sort()).toEqual(["L1", "L2", "L3", "L4"]);
    expect([...templateSet(w.rounds[8])].sort()).toEqual(["L10", "L11", "L12", "L9"]);
  });

  it("drift 0 is the static mix, drift 1 the shifting mix", () => {
    const count = (qs: QueryInstance[]) =>
      qs.reduce<Record<string, number>>(
        (m, q) => ({ ...m, [q.template]: (m[q.template] ?? 0) + 1 }),
        {},
      );
    expect(count(gen("drifting", 0).rounds[4])).toEqual(count(gen("static").rounds[4]));
    expect(count(gen("drifting", 1).rounds[4])).toEqual(count(gen("shifting").rounds[4]));
    const half = count(gen("drifting", 0.5).rounds[4]);
    // 18 from all twelve reads (1 or 2 each), 18 more from the gallery-floor group
    expect(half.L5 + half.L6 + half.L7 + half.L8).toBe(18 + 6);
  });

  it("adds one booking move per read in HTAP rounds", () => {
    expect(gen("htap").rounds[0].filter((q) => q.template === "LU1")).toHaveLength(36);
  });

  it("gives every template one QB5000 template string", () => {
    const byTemplate = new Map<string, Set<string>>();
    for (const q of gen("static").rounds.flat())
      byTemplate.set(q.template, (byTemplate.get(q.template) ?? new Set()).add(templatize(q.sql)));
    for (const forms of byTemplate.values()) expect(forms.size).toBe(1);
  });

  it("draws literals from real values, weighted by frequency", () => {
    const pools = valuePools(data);
    const english = pools["audio_guide_hire.language_code"].filter((v) => v === "en").length;
    expect(english).toBe(498);
    expect(databaseBytes(stats)).toBeGreaterThan(1_000_000);
  });
});
