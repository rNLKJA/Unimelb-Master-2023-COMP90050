/**
 * The Louvre ticketing database from Rin's 2020 INFO20003 assignment (the
 * refined schema of its 2026 revival), as the lab loads it.
 *
 * Every table and column of the source file is kept. What changes is the
 * physical design: the lab creates each table with only its INTEGER PRIMARY
 * KEY (a rowid alias), and leaves out UNIQUE constraints, foreign keys,
 * CHECKs, triggers, STRICT typing and the refined schema's own secondary
 * indexes. Tables whose key is not a single INTEGER column (language,
 * audio_guide_device, order_line) become plain rowid tables. That is the
 * same rule the TPC-H-like dataset follows: every index beyond the rowid is
 * an advisor's choice, so the "no index" baseline means the same thing on
 * both datasets. See docs/decisions/DR-004.
 *
 * Widths are average stored bytes per value (SQLite record format), used for
 * index-size estimates; timestamps are TEXT "YYYY-MM-DD HH:MM:SS".
 */
import { col as c, type SchemaDef, type TableDef } from "@/lib/db/schema";

const t = (
  name: string,
  primaryKey: string | null,
  blurb: string,
  columns: TableDef["columns"],
): TableDef => ({ name, primaryKey, blurb, columns });

export const LOUVRE_TABLES: TableDef[] = [
  t("entrance", "entrance_id", "the five public entrances", [
    c("entrance_id", "int", 1),
    c("name", "text", 15),
  ]),
  t("wing", "wing_id", "Richelieu, Denon and Sully", [
    c("wing_id", "int", 1),
    c("name", "text", 6),
  ]),
  t("language", null, "13 audio-guide languages", [
    c("language_code", "text", 2),
    c("name", "text", 8),
  ]),
  t("product", "product_id", "tickets, audio guide and app", [
    c("product_id", "int", 1),
    c("code", "text", 10),
    c("name", "text", 20),
    c("price_cents", "int", 2),
  ]),
  t("financial_institution", "institution_id", "card issuers", [
    c("institution_id", "int", 1),
    c("name", "text", 16),
    c("short_name", "text", 6),
    c("country", "text", 8),
  ]),
  t("payment", "payment_id", "every payment, card or cash", [
    c("payment_id", "int", 2),
    c("method", "text", 10),
    c("amount_cents", "int", 2),
    c("paid_at", "datetime", 19),
  ]),
  t("card_payment", "payment_id", "masked card details", [
    c("payment_id", "int", 2),
    c("institution_id", "int", 1),
    c("issuing_branch", "text", 17),
    c("issued_country", "text", 8),
    c("account_name", "text", 12),
    c("card_first4", "text", 4),
    c("card_last4", "text", 4),
    c("expiry_month", "int", 1),
    c("expiry_year", "int", 2),
    c("wallet", "text", 9, true),
  ]),
  t("cash_payment", "payment_id", "cash at the desks", [
    c("payment_id", "int", 2),
    c("first_name", "text", 5),
    c("city", "text", 7),
    c("country", "text", 8),
  ]),
  t("purchase_order", "order_id", "orders by channel", [
    c("order_id", "int", 2),
    c("channel", "text", 10),
    c("entrance_id", "int", 1, true),
    c("wing_id", "int", 1, true),
    c("payment_id", "int", 2),
    c("ordered_at", "datetime", 19),
  ]),
  t("order_line", null, "products on each order (no single-column key)", [
    c("order_id", "int", 2),
    c("product_id", "int", 1),
    c("quantity", "int", 1),
    c("unit_price_cents", "int", 2),
  ]),
  t("ticket", "ticket_id", "museum tickets and their barcodes", [
    c("ticket_id", "int", 2),
    c("barcode", "text", 13),
    c("order_id", "int", 2),
  ]),
  t("entry_scan", "scan_id", "scans at the entrances", [
    c("scan_id", "int", 2),
    c("ticket_id", "int", 2),
    c("entrance_id", "int", 1),
    c("scanned_at", "datetime", 19),
    c("is_first_entry", "int", 1),
    c("transport_mode", "text", 5, true),
  ]),
  t("wing_scan", "scan_id", "scans at the wing doors", [
    c("scan_id", "int", 2),
    c("ticket_id", "int", 2),
    c("wing_id", "int", 1),
    c("scanned_at", "datetime", 19),
  ]),
  t("audio_guide_device", null, "audio-guide devices", [
    c("serial_number", "text", 16),
    c("activated_on", "date", 10),
    c("retired_on", "date", 10, true),
  ]),
  t("audio_guide_hire", "hire_id", "audio-guide hires and returns", [
    c("hire_id", "int", 2),
    c("ticket_id", "int", 2),
    c("serial_number", "text", 16),
    c("order_id", "int", 2),
    c("language_code", "text", 2),
    c("issued_wing_id", "int", 1),
    c("issued_at", "datetime", 19),
    c("returned_wing_id", "int", 1, true),
    c("returned_at", "datetime", 19, true),
  ]),
  t("exhibition", "exhibition_id", "temporary exhibitions", [
    c("exhibition_id", "int", 1),
    c("title", "text", 31),
    c("opens_on", "date", 10),
    c("closes_on", "date", 10),
    c("slot_capacity", "int", 1),
  ]),
  t("exhibition_slot", "slot_id", "15-minute exhibition slots", [
    c("slot_id", "int", 2),
    c("exhibition_id", "int", 1),
    c("slot_date", "date", 10),
    c("start_time", "text", 5),
    c("capacity", "int", 1),
  ]),
  t("exhibition_booking", "booking_id", "slot bookings on a ticket", [
    c("booking_id", "int", 2),
    c("slot_id", "int", 2),
    c("ticket_id", "int", 2),
    c("booked_at", "datetime", 19),
  ]),
  t("hall_napoleon_scan", "scan_id", "admissions to the Hall Napoléon", [
    c("scan_id", "int", 2),
    c("booking_id", "int", 2),
    c("scanned_at", "datetime", 19),
  ]),
];

export const LOUVRE_SCHEMA: SchemaDef = { tables: LOUVRE_TABLES };

/**
 * Where the file came from. `sha256` is the uncompressed SQLite file; a unit
 * test checks the copy shipped in public/data/ against it.
 */
export const LOUVRE_PROVENANCE = {
  file: "public/data/louvre.db.gz",
  url: "/data/louvre.db.gz",
  /** Private until its owner publishes it, so the site links the public download instead. */
  sourceRepo: "rNLKJA/Unimelb-undergraduate-2020-INFO20003-Assignment-1",
  sourcePath: "web/data/louvre.db",
  sourceCommit: "c0312f02253507c1c85b1d58d5e82724f1953738",
  lastChanged: "6ec72a8b392c91ace7de5e549c138832e16a871c",
  sha256: "b762146e2601e0c333991e203caed7ce65d76c0a9520fe1ba200f50a5331bece",
  bytes: 3_436_544,
  generator: "web/scripts/build-db.ts (seeded simulation, web/src/lib/seed/)",
  seed: 20200403,
  period: "1 March 2015 to 29 February 2020",
  site: "https://info20003-louvre-ops-db.vercel.app",
  /** Byte-identical public copy (checked 9 October 2026). */
  download: "https://info20003-louvre-ops-db.vercel.app/data/louvre.db",
  erd: "https://info20003-louvre-ops-db.vercel.app/schema",
} as const;
