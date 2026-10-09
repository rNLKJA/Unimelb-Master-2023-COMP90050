/**
 * Deterministic TPC-H-like data generator. Value domains follow the TPC-H
 * specification (segments, priorities, ship modes, brand codes, date rules for
 * returnflag/linestatus) so the query templates behave like their benchmark
 * cousins, but nothing here is copied from dbgen.
 */
import { deriveSeed, mulberry32, pick, randInt, zipfSampler, type Rng } from "@/lib/random";
import {
  CURRENT_DATE,
  ORDER_DATE_MAX,
  ORDER_DATE_MIN,
  SCHEMA,
  TABLE_NAMES,
  cardinalities,
  isoFromDay,
  type TpchTable,
} from "./schema";
import type { TableData, TableDataSet } from "./stats";

export type { TableData, Value } from "./stats";

export type GeneratedDatabase = Record<TpchTable, TableData>;

export interface GenerateOptions {
  orders: number;
  seed: number;
  /** Zipf exponent for foreign keys (0 = uniform TPC-H, 1 = "TPC-H skew"). */
  skew?: number;
}

export const REGIONS = ["AFRICA", "AMERICA", "ASIA", "EUROPE", "MIDDLE EAST"];

/** TPC-H's 25 nations with their region keys. */
export const NATIONS: [string, number][] = [
  ["ALGERIA", 0],
  ["ARGENTINA", 1],
  ["BRAZIL", 1],
  ["CANADA", 1],
  ["EGYPT", 4],
  ["ETHIOPIA", 0],
  ["FRANCE", 3],
  ["GERMANY", 3],
  ["INDIA", 2],
  ["INDONESIA", 2],
  ["IRAN", 4],
  ["IRAQ", 4],
  ["JAPAN", 2],
  ["JORDAN", 4],
  ["KENYA", 0],
  ["MOROCCO", 0],
  ["MOZAMBIQUE", 0],
  ["PERU", 1],
  ["CHINA", 2],
  ["ROMANIA", 3],
  ["SAUDI ARABIA", 4],
  ["VIETNAM", 2],
  ["RUSSIA", 3],
  ["UNITED KINGDOM", 3],
  ["UNITED STATES", 1],
];

export const SEGMENTS = ["AUTOMOBILE", "BUILDING", "FURNITURE", "MACHINERY", "HOUSEHOLD"];
export const PRIORITIES = ["1-URGENT", "2-HIGH", "3-MEDIUM", "4-NOT SPECIFIED", "5-LOW"];
export const SHIP_MODES = ["REG AIR", "AIR", "RAIL", "SHIP", "TRUCK", "MAIL", "FOB"];
const TYPE_A = ["STANDARD", "SMALL", "MEDIUM", "LARGE", "ECONOMY", "PROMO"];
const TYPE_B = ["ANODIZED", "BURNISHED", "PLATED", "POLISHED", "BRUSHED"];
const TYPE_C = ["TIN", "NICKEL", "BRASS", "STEEL", "COPPER"];
const CONTAINER_A = ["SM", "LG", "MED", "JUMBO", "WRAP"];
const CONTAINER_B = ["CASE", "BOX", "BAG", "JAR", "PKG", "PACK", "CAN", "DRUM"];
const COLOURS = [
  "almond",
  "antique",
  "aquamarine",
  "azure",
  "beige",
  "bisque",
  "black",
  "blanched",
  "blue",
  "blush",
  "brown",
  "burlywood",
  "burnished",
  "chartreuse",
  "chiffon",
  "chocolate",
  "coral",
  "cornflower",
  "cornsilk",
  "cream",
  "cyan",
  "dark",
  "deep",
  "dim",
  "dodger",
  "drab",
  "firebrick",
  "floral",
  "forest",
  "frosted",
  "gainsboro",
  "ghost",
  "goldenrod",
  "green",
  "grey",
  "honeydew",
  "hot",
  "indian",
  "ivory",
  "khaki",
  "lace",
  "lavender",
  "lawn",
  "lemon",
  "light",
  "lime",
  "linen",
  "magenta",
  "maroon",
  "medium",
  "metallic",
  "midnight",
  "mint",
  "misty",
  "moccasin",
  "navajo",
  "navy",
  "olive",
  "orange",
  "orchid",
  "pale",
  "papaya",
  "peach",
  "peru",
  "pink",
  "plum",
  "powder",
  "puff",
  "purple",
  "red",
  "rose",
  "rosy",
  "royal",
  "saddle",
  "salmon",
  "sandy",
  "seashell",
  "sienna",
  "sky",
  "slate",
  "smoke",
  "snow",
  "spring",
  "steel",
  "tan",
  "thistle",
  "tomato",
  "turquoise",
  "violet",
  "wheat",
  "white",
  "yellow",
];

export const BRANDS = Array.from(
  { length: 25 },
  (_, i) => `Brand#${Math.floor(i / 5) + 1}${(i % 5) + 1}`,
);

const round2 = (x: number) => Math.round(x * 100) / 100;
const pad = (n: number, width: number) => String(n).padStart(width, "0");

function retailPrice(partkey: number): number {
  return (90000 + (Math.floor(partkey / 10) % 20001) + 100 * (partkey % 1000)) / 100;
}

export function generateDatabase({ orders, seed, skew = 0 }: GenerateOptions): GeneratedDatabase {
  const n = cardinalities(orders);
  const stream = (label: string): Rng => mulberry32(deriveSeed(seed, label));
  const db = {} as GeneratedDatabase;
  for (const t of TABLE_NAMES)
    db[t] = { columns: SCHEMA[t].columns.map((col) => col.name), rows: [] };

  db.region.rows = REGIONS.map((name, i) => [i, name]);
  db.nation.rows = NATIONS.map(([name, region], i) => [i, name, region]);

  const rs = stream("supplier");
  for (let k = 1; k <= n.supplier; k++) {
    db.supplier.rows.push([
      k,
      `Supplier#${pad(k, 9)}`,
      randInt(rs, 0, 24),
      round2(-999.99 + rs() * 10999.98),
    ]);
  }

  const rc = stream("customer");
  for (let k = 1; k <= n.customer; k++) {
    db.customer.rows.push([
      k,
      `Customer#${pad(k, 9)}`,
      randInt(rc, 0, 24),
      pick(rc, SEGMENTS),
      round2(-999.99 + rc() * 10999.98),
    ]);
  }

  const rp = stream("part");
  for (let k = 1; k <= n.part; k++) {
    db.part.rows.push([
      k,
      `${pick(rp, COLOURS)} ${pick(rp, COLOURS)}`,
      pick(rp, BRANDS),
      `${pick(rp, TYPE_A)} ${pick(rp, TYPE_B)} ${pick(rp, TYPE_C)}`,
      randInt(rp, 1, 50),
      `${pick(rp, CONTAINER_A)} ${pick(rp, CONTAINER_B)}`,
      retailPrice(k),
    ]);
  }

  const ro = stream("orders");
  const rl = stream("lineitem");
  const custOf = zipfSampler(n.customer, skew);
  const partOf = zipfSampler(n.part, skew);
  const suppOf = zipfSampler(n.supplier, skew);

  for (let k = 1; k <= orders; k++) {
    const orderDay = randInt(ro, ORDER_DATE_MIN, ORDER_DATE_MAX);
    const lines = randInt(ro, 1, 7);
    let total = 0;
    let fCount = 0;
    for (let ln = 1; ln <= lines; ln++) {
      const partkey = partOf(rl);
      const quantity = randInt(rl, 1, 50);
      const price = round2(quantity * retailPrice(partkey));
      const discount = randInt(rl, 0, 10) / 100;
      const tax = randInt(rl, 0, 8) / 100;
      const ship = orderDay + randInt(rl, 1, 121);
      const commit = orderDay + randInt(rl, 30, 90);
      const receipt = ship + randInt(rl, 1, 30);
      const returnflag = receipt <= CURRENT_DATE ? (rl() < 0.5 ? "R" : "A") : "N";
      const linestatus = ship > CURRENT_DATE ? "O" : "F";
      if (linestatus === "F") fCount++;
      total += price * (1 + tax) * (1 - discount);
      db.lineitem.rows.push([
        k,
        ln,
        partkey,
        suppOf(rl),
        quantity,
        price,
        discount,
        tax,
        returnflag,
        linestatus,
        isoFromDay(ship),
        isoFromDay(commit),
        isoFromDay(receipt),
        pick(rl, SHIP_MODES),
      ]);
    }
    const status = fCount === lines ? "F" : fCount === 0 ? "O" : "P";
    db.orders.rows.push([
      k,
      custOf(ro),
      status,
      round2(total),
      isoFromDay(orderDay),
      pick(ro, PRIORITIES),
    ]);
  }
  return db;
}

export function rowCounts(db: TableDataSet): Record<string, number> {
  return Object.fromEntries(Object.entries(db).map(([t, d]) => [t, d.rows.length]));
}
