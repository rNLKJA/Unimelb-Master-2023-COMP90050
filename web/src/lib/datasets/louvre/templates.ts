/**
 * A museum operations workload for the Louvre ticketing database: the
 * queries a box office, the gallery floor and the exhibitions team would run
 * all day. Twelve reads in three groups (the phases of the shifting and
 * drifting scenarios) and one UPDATE for HTAP rounds.
 *
 * Literals come from the data itself: ranges from the optimiser statistics,
 * point values (barcodes, devices, slot dates, payment methods, languages)
 * from value pools of real column values, so frequent values are drawn more
 * often, as they would be in a real workload. Joins name every column with
 * its table because the Louvre schema reuses names (ticket_id, scanned_at).
 */
import { isoFromDayTime } from "@/lib/db/schema";
import { randInt, type Rng } from "@/lib/random";
import {
  fromPool,
  makeSuite,
  type QueryTemplate,
  type TemplateContext,
} from "@/lib/workload/types";

export type LouvreGroup = "box" | "galleries" | "exhibitions";

export const LOUVRE_GROUP_LABELS: Record<LouvreGroup, string> = {
  box: "Box office",
  galleries: "Gallery floor",
  exhibitions: "Exhibitions",
};

const q = (s: string | number | null) => `'${String(s).replace(/'/g, "''")}'`;

/** A whole day d (day number) such that [d, d + span) lies inside the column's range. */
function dayIn(rng: Rng, ctx: TemplateContext, table: string, column: string, span: number) {
  const s = ctx.stats[table].columns[column];
  const lo = Math.ceil(s.min ?? 0);
  const hi = Math.max(lo, Math.floor(s.max ?? lo) - span);
  return randInt(rng, lo, hi);
}

/** An integer key inside a column's range. */
function keyIn(rng: Rng, ctx: TemplateContext, table: string, column: string) {
  const s = ctx.stats[table].columns[column];
  return randInt(rng, s.min ?? 1, s.max ?? 1);
}

/** "[lo, hi)" on a timestamp column, as SQL and as the cost model's inclusive range. */
function window(column: string, from: number, to: number) {
  return {
    sql: `${column} >= ${q(isoFromDayTime(from))} AND ${column} < ${q(isoFromDayTime(to))}`,
    range: { column, lo: from, hi: to },
  };
}

export type LouvreTemplate = QueryTemplate & { group: LouvreGroup };

export const LOUVRE_TEMPLATES: LouvreTemplate[] = [
  {
    id: "L1",
    title: "Ticket sales by hour",
    group: "box",
    kind: "select",
    blurb: "Orders per hour of the day over one week, every channel.",
    build: (rng, ctx) => {
      const d = dayIn(rng, ctx, "purchase_order", "ordered_at", 7);
      const w = window("ordered_at", d, d + 7);
      return {
        template: "L1",
        kind: "select",
        sql:
          `SELECT substr(ordered_at, 12, 2) AS hour, COUNT(*) AS orders FROM purchase_order ` +
          `WHERE ${w.sql} GROUP BY hour ORDER BY hour`,
        access: [{ table: "purchase_order", eq: [], ranges: [w.range], payload: [] }],
      };
    },
  },
  {
    id: "L2",
    title: "Takings by payment method",
    group: "box",
    kind: "select",
    blurb: "One week's takings for one payment method (card, wallet or cash).",
    build: (rng, ctx) => {
      const method = fromPool(rng, ctx, "payment.method");
      const d = dayIn(rng, ctx, "payment", "paid_at", 7);
      const w = window("paid_at", d, d + 7);
      return {
        template: "L2",
        kind: "select",
        sql:
          `SELECT COUNT(*) AS payments, SUM(amount_cents) / 100.0 AS takings_eur FROM payment ` +
          `WHERE method = ${q(method)} AND ${w.sql}`,
        access: [
          { table: "payment", eq: ["method"], ranges: [w.range], payload: ["amount_cents"] },
        ],
      };
    },
  },
  {
    id: "L3",
    title: "Ticket check by barcode",
    group: "box",
    kind: "select",
    blurb: "The desk scans a barcode and looks the ticket up.",
    build: (rng, ctx) => {
      const barcode = fromPool(rng, ctx, "ticket.barcode");
      return {
        template: "L3",
        kind: "select",
        sql: `SELECT ticket_id, order_id FROM ticket WHERE barcode = ${q(barcode)}`,
        access: [
          { table: "ticket", eq: ["barcode"], ranges: [], payload: ["ticket_id", "order_id"] },
        ],
      };
    },
  },
  {
    id: "L4",
    title: "Refund desk: an order and its lines",
    group: "box",
    kind: "select",
    blurb: "Find the order behind a payment and list what was bought.",
    build: (rng, ctx) => {
      const payment = keyIn(rng, ctx, "purchase_order", "payment_id");
      return {
        template: "L4",
        kind: "select",
        sql:
          `SELECT purchase_order.order_id, purchase_order.channel, order_line.product_id, order_line.quantity ` +
          `FROM purchase_order JOIN order_line ON order_line.order_id = purchase_order.order_id ` +
          `WHERE purchase_order.payment_id = ${payment}`,
        access: [
          {
            table: "purchase_order",
            eq: ["payment_id"],
            ranges: [],
            payload: ["order_id", "channel"],
          },
          { table: "order_line", eq: [], ranges: [], payload: ["product_id", "quantity"] },
        ],
        join: { left: "order_id", right: "order_id" },
      };
    },
  },
  {
    id: "L5",
    title: "Wing footfall on a day",
    group: "galleries",
    kind: "select",
    blurb: "How many scans one wing's doors recorded on one day.",
    build: (rng, ctx) => {
      const wing = keyIn(rng, ctx, "wing", "wing_id");
      const d = dayIn(rng, ctx, "wing_scan", "scanned_at", 1);
      const w = window("scanned_at", d, d + 1);
      return {
        template: "L5",
        kind: "select",
        sql: `SELECT COUNT(*) AS scans FROM wing_scan WHERE wing_id = ${wing} AND ${w.sql}`,
        access: [{ table: "wing_scan", eq: ["wing_id"], ranges: [w.range], payload: [] }],
      };
    },
  },
  {
    id: "L6",
    title: "Arrivals by transport at an entrance",
    group: "galleries",
    kind: "select",
    blurb: "First entries through one entrance in a week, by how visitors travelled.",
    build: (rng, ctx) => {
      const entrance = keyIn(rng, ctx, "entrance", "entrance_id");
      const d = dayIn(rng, ctx, "entry_scan", "scanned_at", 7);
      const w = window("scanned_at", d, d + 7);
      return {
        template: "L6",
        kind: "select",
        sql:
          `SELECT transport_mode, COUNT(*) AS visitors FROM entry_scan ` +
          `WHERE entrance_id = ${entrance} AND is_first_entry = 1 AND ${w.sql} GROUP BY transport_mode`,
        access: [
          {
            table: "entry_scan",
            eq: ["entrance_id", "is_first_entry"],
            ranges: [w.range],
            payload: ["transport_mode"],
          },
        ],
      };
    },
  },
  {
    id: "L7",
    title: "A visitor's route through the wings",
    group: "galleries",
    kind: "select",
    blurb: "Every wing door one ticket passed, in order.",
    build: (rng, ctx) => {
      const ticket = keyIn(rng, ctx, "ticket", "ticket_id");
      return {
        template: "L7",
        kind: "select",
        sql: `SELECT wing_id, scanned_at FROM wing_scan WHERE ticket_id = ${ticket} ORDER BY scanned_at`,
        access: [
          { table: "wing_scan", eq: ["ticket_id"], ranges: [], payload: ["wing_id", "scanned_at"] },
        ],
      };
    },
  },
  {
    id: "L8",
    title: "Audio-guide hires by language",
    group: "galleries",
    kind: "select",
    blurb: "Guides hired in one language over a month.",
    build: (rng, ctx) => {
      const lang = fromPool(rng, ctx, "audio_guide_hire.language_code");
      const d = dayIn(rng, ctx, "audio_guide_hire", "issued_at", 30);
      const w = window("issued_at", d, d + 30);
      return {
        template: "L8",
        kind: "select",
        sql: `SELECT COUNT(*) AS hires FROM audio_guide_hire WHERE language_code = ${q(lang)} AND ${w.sql}`,
        access: [
          { table: "audio_guide_hire", eq: ["language_code"], ranges: [w.range], payload: [] },
        ],
      };
    },
  },
  {
    id: "L9",
    title: "Exhibition slot fill for a day",
    group: "exhibitions",
    kind: "select",
    blurb: "Bookings per 15-minute slot on one exhibition day.",
    build: (rng, ctx) => {
      const day = fromPool(rng, ctx, "exhibition_slot.slot_date");
      return {
        template: "L9",
        kind: "select",
        sql:
          `SELECT exhibition_slot.start_time, COUNT(exhibition_booking.booking_id) AS booked ` +
          `FROM exhibition_slot JOIN exhibition_booking ON exhibition_booking.slot_id = exhibition_slot.slot_id ` +
          `WHERE exhibition_slot.slot_date = ${q(day)} GROUP BY exhibition_slot.start_time`,
        access: [
          {
            table: "exhibition_slot",
            eq: ["slot_date"],
            ranges: [],
            payload: ["start_time", "slot_id"],
          },
          { table: "exhibition_booking", eq: [], ranges: [], payload: ["booking_id"] },
        ],
        join: { left: "slot_id", right: "slot_id" },
      };
    },
  },
  {
    id: "L10",
    title: "Bookings on a ticket",
    group: "exhibitions",
    kind: "select",
    blurb: "Which exhibition slots one ticket holder booked.",
    build: (rng, ctx) => {
      const ticket = keyIn(rng, ctx, "ticket", "ticket_id");
      return {
        template: "L10",
        kind: "select",
        sql: `SELECT booking_id, slot_id, booked_at FROM exhibition_booking WHERE ticket_id = ${ticket}`,
        access: [
          {
            table: "exhibition_booking",
            eq: ["ticket_id"],
            ranges: [],
            payload: ["booking_id", "slot_id", "booked_at"],
          },
        ],
      };
    },
  },
  {
    id: "L11",
    title: "Hall Napoléon admissions",
    group: "exhibitions",
    kind: "select",
    blurb: "Exhibition admissions between 9 am and 6 pm on one day.",
    build: (rng, ctx) => {
      const d = dayIn(rng, ctx, "hall_napoleon_scan", "scanned_at", 1);
      const w = window("scanned_at", d + 9 / 24, d + 18 / 24);
      return {
        template: "L11",
        kind: "select",
        sql: `SELECT COUNT(*) AS admitted FROM hall_napoleon_scan WHERE ${w.sql}`,
        access: [{ table: "hall_napoleon_scan", eq: [], ranges: [w.range], payload: [] }],
      };
    },
  },
  {
    id: "L12",
    title: "Bookings made in a week",
    group: "exhibitions",
    kind: "select",
    blurb: "How many exhibition bookings were taken in one week.",
    build: (rng, ctx) => {
      const d = dayIn(rng, ctx, "exhibition_booking", "booked_at", 7);
      const w = window("booked_at", d, d + 7);
      return {
        template: "L12",
        kind: "select",
        sql: `SELECT COUNT(*) AS bookings FROM exhibition_booking WHERE ${w.sql}`,
        access: [{ table: "exhibition_booking", eq: [], ranges: [w.range], payload: [] }],
      };
    },
  },
  {
    id: "LU1",
    title: "Move a ticket's booking",
    group: "exhibitions",
    kind: "update",
    blurb: "Transactional write: move one ticket's exhibition booking to another slot.",
    build: (rng, ctx) => {
      const ticket = keyIn(rng, ctx, "ticket", "ticket_id");
      const slot = keyIn(rng, ctx, "exhibition_slot", "slot_id");
      return {
        template: "LU1",
        kind: "update",
        sql: `UPDATE exhibition_booking SET slot_id = ${slot} WHERE ticket_id = ${ticket}`,
        access: [{ table: "exhibition_booking", eq: ["ticket_id"], ranges: [], payload: [] }],
        updates: ["slot_id"],
      };
    },
  },
];

export const LOUVRE_SUITE = makeSuite(
  "louvre",
  LOUVRE_TEMPLATES,
  (["box", "galleries", "exhibitions"] as const).map((id) => ({
    id,
    label: LOUVRE_GROUP_LABELS[id],
  })),
  "LU1",
);

/** Columns whose real values the templates draw from. */
export const LOUVRE_POOL_COLUMNS = [
  "payment.method",
  "ticket.barcode",
  "audio_guide_hire.language_code",
  "exhibition_slot.slot_date",
] as const;
