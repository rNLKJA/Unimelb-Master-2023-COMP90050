/**
 * Query templates for the arena. Each mirrors a pattern from TPC-H (Q6's
 * shipping-window revenue, Q3/Q10's customer-order joins, Q14/Q19's part
 * filters) but is reduced to the selection and join predicates that make
 * index selection interesting. A template produces concrete SQL with literal
 * parameters plus a structured description of its predicates — the
 * "query shape" every advisor reasons over.
 */
import { BRANDS, PRIORITIES, SEGMENTS, SHIP_MODES } from "@/lib/db/generate";
import { CURRENT_DATE, ORDER_DATE_MAX, isoFromDay, type TpchTable } from "@/lib/db/schema";
import { pick, randInt } from "@/lib/random";
import { makeSuite, type QueryTemplate, type TemplateContext } from "./types";

export type { QueryTemplate, TemplateContext } from "./types";

export type TemplateGroup = "orders" | "shipping" | "catalogue";

const rows = (ctx: TemplateContext, t: TpchTable) => ctx.stats[t].rows;
const q = (s: string) => `'${s}'`;
const money = (x: number) => x.toFixed(2);

/** A TPC-H template, whose group is one of the three TPC-H phases. */
export type TpchTemplate = QueryTemplate & { group: TemplateGroup };

export const TEMPLATES: TpchTemplate[] = [
  {
    id: "Q1",
    title: "Customer order history",
    group: "orders",
    kind: "select",
    blurb: "Every order a customer has placed, newest first.",
    build: (rng, ctx) => {
      const cust = randInt(rng, 1, rows(ctx, "customer"));
      return {
        template: "Q1",
        kind: "select",
        sql: `SELECT o_orderkey, o_orderdate, o_totalprice FROM orders WHERE o_custkey = ${cust} ORDER BY o_orderdate DESC`,
        access: [
          {
            table: "orders",
            eq: ["o_custkey"],
            ranges: [],
            payload: ["o_orderkey", "o_orderdate", "o_totalprice"],
          },
        ],
      };
    },
  },
  {
    id: "Q2",
    title: "Shipping-window revenue",
    group: "shipping",
    kind: "select",
    blurb: "TPC-H Q6 in miniature: discounted revenue shipped in one week.",
    build: (rng, ctx) => {
      const s = ctx.stats.lineitem.columns.l_shipdate;
      const d = randInt(rng, s.min ?? 0, (s.max ?? 2500) - 7);
      const disc = randInt(rng, 2, 9) / 100;
      return {
        template: "Q2",
        kind: "select",
        sql:
          `SELECT SUM(l_extendedprice * l_discount) AS revenue FROM lineitem ` +
          `WHERE l_shipdate >= ${q(isoFromDay(d))} AND l_shipdate < ${q(isoFromDay(d + 7))} ` +
          `AND l_discount BETWEEN ${(disc - 0.01).toFixed(2)} AND ${(disc + 0.01).toFixed(2)} AND l_quantity < 24`,
        access: [
          {
            table: "lineitem",
            eq: [],
            ranges: [
              { column: "l_shipdate", lo: d, hi: d + 6 },
              { column: "l_discount", lo: disc - 0.01, hi: disc + 0.01 },
              { column: "l_quantity", lo: 1, hi: 23 },
            ],
            payload: ["l_extendedprice"],
          },
        ],
      };
    },
  },
  {
    id: "Q3",
    title: "Part demand",
    group: "catalogue",
    kind: "select",
    blurb: "How many units of one part have been ordered.",
    build: (rng, ctx) => {
      const part = randInt(rng, 1, rows(ctx, "part"));
      return {
        template: "Q3",
        kind: "select",
        sql: `SELECT COUNT(*) AS lines, SUM(l_quantity) AS units FROM lineitem WHERE l_partkey = ${part}`,
        access: [{ table: "lineitem", eq: ["l_partkey"], ranges: [], payload: ["l_quantity"] }],
      };
    },
  },
  {
    id: "Q4",
    title: "Supplier by ship mode",
    group: "shipping",
    kind: "select",
    blurb: "One supplier's shipments by a single carrier mode.",
    build: (rng, ctx) => {
      const supp = randInt(rng, 1, rows(ctx, "supplier"));
      const mode = pick(rng, SHIP_MODES);
      return {
        template: "Q4",
        kind: "select",
        sql: `SELECT COUNT(*) AS lines, AVG(l_extendedprice) AS avg_price FROM lineitem WHERE l_suppkey = ${supp} AND l_shipmode = ${q(mode)}`,
        access: [
          {
            table: "lineitem",
            eq: ["l_suppkey", "l_shipmode"],
            ranges: [],
            payload: ["l_extendedprice"],
          },
        ],
      };
    },
  },
  {
    id: "Q5",
    title: "Customer order lines",
    group: "orders",
    kind: "select",
    blurb: "Join a customer's orders to their line items (TPC-H Q3/Q10 style).",
    build: (rng, ctx) => {
      const cust = randInt(rng, 1, rows(ctx, "customer"));
      return {
        template: "Q5",
        kind: "select",
        sql:
          `SELECT o_orderkey, l_linenumber, l_quantity, l_extendedprice FROM orders ` +
          `JOIN lineitem ON l_orderkey = o_orderkey WHERE o_custkey = ${cust}`,
        access: [
          { table: "orders", eq: ["o_custkey"], ranges: [], payload: ["o_orderkey"] },
          {
            table: "lineitem",
            eq: [],
            ranges: [],
            payload: ["l_linenumber", "l_quantity", "l_extendedprice"],
          },
        ],
        join: { left: "o_orderkey", right: "l_orderkey" },
      };
    },
  },
  {
    id: "Q6",
    title: "Segment directory",
    group: "catalogue",
    kind: "select",
    blurb: "Customers in one market segment and nation.",
    build: (rng) => {
      const seg = pick(rng, SEGMENTS);
      const nation = randInt(rng, 0, 24);
      return {
        template: "Q6",
        kind: "select",
        sql: `SELECT c_custkey, c_name, c_acctbal FROM customer WHERE c_mktsegment = ${q(seg)} AND c_nationkey = ${nation}`,
        access: [
          {
            table: "customer",
            eq: ["c_mktsegment", "c_nationkey"],
            ranges: [],
            payload: ["c_custkey", "c_name", "c_acctbal"],
          },
        ],
      };
    },
  },
  {
    id: "Q7",
    title: "Brand catalogue",
    group: "catalogue",
    kind: "select",
    blurb: "Parts of one brand in one size (TPC-H Q19 flavour).",
    build: (rng) => {
      const brand = pick(rng, BRANDS);
      const size = randInt(rng, 1, 50);
      return {
        template: "Q7",
        kind: "select",
        sql: `SELECT p_partkey, p_name, p_retailprice FROM part WHERE p_brand = ${q(brand)} AND p_size = ${size}`,
        access: [
          {
            table: "part",
            eq: ["p_brand", "p_size"],
            ranges: [],
            payload: ["p_partkey", "p_name", "p_retailprice"],
          },
        ],
      };
    },
  },
  {
    id: "Q8",
    title: "Late returns",
    group: "shipping",
    kind: "select",
    blurb: "Returned lines received in a four-day window.",
    build: (rng, ctx) => {
      const s = ctx.stats.lineitem.columns.l_receiptdate;
      const d = randInt(rng, (s.min ?? 0) + 5, CURRENT_DATE - 4);
      return {
        template: "Q8",
        kind: "select",
        sql: `SELECT COUNT(*) AS returned FROM lineitem WHERE l_receiptdate BETWEEN ${q(isoFromDay(d))} AND ${q(isoFromDay(d + 3))} AND l_returnflag = 'R'`,
        access: [
          {
            table: "lineitem",
            eq: ["l_returnflag"],
            ranges: [{ column: "l_receiptdate", lo: d, hi: d + 3 }],
            payload: [],
          },
        ],
      };
    },
  },
  {
    id: "Q9",
    title: "Large open orders",
    group: "orders",
    kind: "select",
    blurb: "Open orders above a high price threshold.",
    build: (rng, ctx) => {
      const p = ctx.stats.orders.columns.o_totalprice;
      const max = p.max ?? 500_000;
      const threshold = Math.round(max * (0.72 + rng() * 0.12));
      return {
        template: "Q9",
        kind: "select",
        sql: `SELECT o_orderkey, o_totalprice FROM orders WHERE o_orderstatus = 'O' AND o_totalprice > ${money(threshold)}`,
        access: [
          {
            table: "orders",
            eq: ["o_orderstatus"],
            ranges: [{ column: "o_totalprice", lo: threshold, hi: max }],
            payload: ["o_orderkey"],
          },
        ],
      };
    },
  },
  {
    id: "Q10",
    title: "Daily order totals",
    group: "orders",
    kind: "select",
    blurb: "Count and value of the orders placed on one day.",
    build: (rng) => {
      const d = randInt(rng, 0, ORDER_DATE_MAX);
      return {
        template: "Q10",
        kind: "select",
        sql: `SELECT COUNT(*) AS orders, SUM(o_totalprice) AS value FROM orders WHERE o_orderdate = ${q(isoFromDay(d))}`,
        access: [{ table: "orders", eq: ["o_orderdate"], ranges: [], payload: ["o_totalprice"] }],
      };
    },
  },
  {
    id: "Q11",
    title: "Priority backlog",
    group: "orders",
    kind: "select",
    blurb: "Orders of one priority placed within a month.",
    build: (rng) => {
      const prio = pick(rng, PRIORITIES);
      const d = randInt(rng, 0, ORDER_DATE_MAX - 30);
      return {
        template: "Q11",
        kind: "select",
        sql: `SELECT COUNT(*) AS backlog FROM orders WHERE o_orderpriority = ${q(prio)} AND o_orderdate BETWEEN ${q(isoFromDay(d))} AND ${q(isoFromDay(d + 30))}`,
        access: [
          {
            table: "orders",
            eq: ["o_orderpriority"],
            ranges: [{ column: "o_orderdate", lo: d, hi: d + 30 }],
            payload: [],
          },
        ],
      };
    },
  },
  {
    id: "Q12",
    title: "Suppliers of a part",
    group: "catalogue",
    kind: "select",
    blurb: "Which suppliers shipped one part, joined to the supplier table.",
    build: (rng, ctx) => {
      const part = randInt(rng, 1, rows(ctx, "part"));
      return {
        template: "Q12",
        kind: "select",
        sql:
          `SELECT s_name, SUM(l_quantity) AS units FROM lineitem JOIN supplier ON s_suppkey = l_suppkey ` +
          `WHERE l_partkey = ${part} GROUP BY s_name`,
        access: [
          { table: "lineitem", eq: ["l_partkey"], ranges: [], payload: ["l_quantity"] },
          { table: "supplier", eq: [], ranges: [], payload: ["s_name"] },
        ],
        join: { left: "l_suppkey", right: "s_suppkey" },
      };
    },
  },
  {
    id: "U1",
    title: "Reprice an order",
    group: "shipping",
    kind: "update",
    blurb: "Transactional write: change the discount on every line of one order.",
    build: (rng, ctx) => {
      const order = randInt(rng, 1, rows(ctx, "orders"));
      const disc = randInt(rng, 0, 10) / 100;
      return {
        template: "U1",
        kind: "update",
        sql: `UPDATE lineitem SET l_discount = ${disc.toFixed(2)} WHERE l_orderkey = ${order}`,
        access: [{ table: "lineitem", eq: ["l_orderkey"], ranges: [], payload: [] }],
        updates: ["l_discount"],
      };
    },
  },
];

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));
export const READ_TEMPLATES = TEMPLATES.filter((t) => t.kind === "select");

export const GROUP_LABELS: Record<TemplateGroup, string> = {
  orders: "Order desk",
  shipping: "Shipping analytics",
  catalogue: "Parts & customers",
};

/** The TPC-H-like workload: twelve reads in three groups and one UPDATE. */
export const TPCH_SUITE = makeSuite(
  "tpch",
  TEMPLATES,
  (["orders", "shipping", "catalogue"] as const).map((id) => ({ id, label: GROUP_LABELS[id] })),
  "U1",
);
