/**
 * The arena's datasets. Both run through the same engine, cost model,
 * advisors and benchmark; they differ in where the rows come from and in the
 * workload that queries them.
 */
import { TPCH_SCHEMA, type SchemaDef } from "@/lib/db/schema";
import { TPCH_SUITE } from "@/lib/workload/templates";
import type { WorkloadSuite } from "@/lib/workload/types";
import { LOUVRE_SCHEMA } from "./louvre/schema";
import { LOUVRE_SUITE } from "./louvre/templates";

export type DatasetId = "tpch" | "louvre";

export const DATASET_IDS: DatasetId[] = ["tpch", "louvre"];

export interface DatasetInfo {
  id: DatasetId;
  label: string;
  short: string;
  blurb: string;
  /** Generated at a chosen size (TPC-H-like) or a fixed file (Louvre). */
  scalable: boolean;
  schema: SchemaDef;
  suite: WorkloadSuite;
  /** The table counts are shown for in the arena's status line. */
  headlineTable: string;
  headlineNoun: string;
}

export const DATASETS: Record<DatasetId, DatasetInfo> = {
  tpch: {
    id: "tpch",
    label: "TPC-H-like (generated)",
    short: "TPC-H-like",
    blurb:
      "Seven tables in TPC-H's shape, generated in the browser from a seed at three sizes: the benchmark the surveyed papers use.",
    scalable: true,
    schema: TPCH_SCHEMA,
    suite: TPCH_SUITE,
    headlineTable: "lineitem",
    headlineNoun: "line items",
  },
  louvre: {
    id: "louvre",
    label: "Louvre (from INFO20003)",
    short: "Louvre",
    blurb:
      "The 19-table Louvre ticketing database designed in INFO20003 (2020), with five years of synthetic museum activity, and a box-office, gallery and exhibitions workload.",
    scalable: false,
    schema: LOUVRE_SCHEMA,
    suite: LOUVRE_SUITE,
    headlineTable: "wing_scan",
    headlineNoun: "wing scans",
  },
};

export function isDatasetId(v: unknown): v is DatasetId {
  return v === "tpch" || v === "louvre";
}
