/**
 * Facts taken from the Group 40 report (19 July 2023 draft in
 * coursework/presentation/) and slides (20 July 2023), so the site states
 * exactly what the coursework said.
 */

/** Table 1 of the report: levels of autonomy (after Pavlo et al. 2021). */
export const AUTONOMY_LEVELS = [
  { level: 0, name: "Manual", description: "The system has no autonomy." },
  {
    level: 1,
    name: "Assistant",
    description: "The system recommends promising actions to the user.",
  },
  {
    level: 2,
    name: "Mixed",
    description: "The system acts, and alerts the user when a decision is needed.",
  },
  { level: 3, name: "Local", description: "Self-contained components act on their own." },
  { level: 4, name: "Directed", description: "The system is semi-autonomous." },
  { level: 5, name: "Self-driving", description: "The system is fully autonomous." },
] as const;

export type Workload = "TPC-H" | "TPC-DS";
export type Mode = "Static" | "Dynamic" | "Random";

export interface BreakdownRow {
  workload: Workload;
  mode: Mode;
  tool: "PDTool" | "MAB";
  recommendation: number;
  creation: number;
  execution: number;
  total: number;
}

/**
 * Table 2 of the report: total workload time (minutes) for a commercial
 * physical design tool (PDTool) and the MAB tuner, from Perera et al. (2023).
 */
export const TABLE_2: BreakdownRow[] = [
  {
    workload: "TPC-H",
    mode: "Static",
    tool: "PDTool",
    recommendation: 0.6,
    creation: 2.45,
    execution: 46.35,
    total: 49.4,
  },
  {
    workload: "TPC-H",
    mode: "Static",
    tool: "MAB",
    recommendation: 0.08,
    creation: 5.66,
    execution: 55.64,
    total: 61.38,
  },
  {
    workload: "TPC-DS",
    mode: "Static",
    tool: "PDTool",
    recommendation: 44.86,
    creation: 1.45,
    execution: 302.63,
    total: 348.94,
  },
  {
    workload: "TPC-DS",
    mode: "Static",
    tool: "MAB",
    recommendation: 1.53,
    creation: 5.94,
    execution: 242.15,
    total: 249.62,
  },
  {
    workload: "TPC-H",
    mode: "Dynamic",
    tool: "PDTool",
    recommendation: 1.55,
    creation: 9.36,
    execution: 26.35,
    total: 37.25,
  },
  {
    workload: "TPC-H",
    mode: "Dynamic",
    tool: "MAB",
    recommendation: 0.12,
    creation: 9.74,
    execution: 25.14,
    total: 35,
  },
  {
    workload: "TPC-DS",
    mode: "Dynamic",
    tool: "PDTool",
    recommendation: 11.13,
    creation: 6.08,
    execution: 187.08,
    total: 204.29,
  },
  {
    workload: "TPC-DS",
    mode: "Dynamic",
    tool: "MAB",
    recommendation: 1.66,
    creation: 16.48,
    execution: 155.65,
    total: 173.79,
  },
  {
    workload: "TPC-H",
    mode: "Random",
    tool: "PDTool",
    recommendation: 7.55,
    creation: 14.68,
    execution: 84.14,
    total: 106.37,
  },
  {
    workload: "TPC-H",
    mode: "Random",
    tool: "MAB",
    recommendation: 0.08,
    creation: 7.06,
    execution: 80.43,
    total: 87.57,
  },
  {
    workload: "TPC-DS",
    mode: "Random",
    tool: "PDTool",
    recommendation: 310.22,
    creation: 8.23,
    execution: 323.57,
    total: 642.01,
  },
  {
    workload: "TPC-DS",
    mode: "Random",
    tool: "MAB",
    recommendation: 1.4,
    creation: 19.81,
    execution: 227.02,
    total: 248.24,
  },
];

export interface Comparison {
  workload: Workload;
  mode: Mode;
  pdtool: BreakdownRow;
  mab: BreakdownRow;
  /** Relative change in total time, MAB vs PDTool (negative = MAB faster). */
  change: number;
}

export function comparisons(rows: BreakdownRow[] = TABLE_2): Comparison[] {
  const out: Comparison[] = [];
  for (const pd of rows.filter((r) => r.tool === "PDTool")) {
    const mab = rows.find(
      (r) => r.tool === "MAB" && r.workload === pd.workload && r.mode === pd.mode,
    )!;
    out.push({
      workload: pd.workload,
      mode: pd.mode,
      pdtool: pd,
      mab,
      change: mab.total / pd.total - 1,
    });
  }
  return out;
}

/** Key coursework dates, from the project brief and the submitted files. */
export const COURSEWORK_DATES = [
  { date: "2023-07-02", label: "Group formed and topic submitted (Self-driving databases)" },
  { date: "2023-07-19", label: "Report draft completed" },
  { date: "2023-07-20", label: "Group presentation delivered" },
  { date: "2023-07-24", label: "Report due" },
] as const;

export const TEAM = [
  { name: "Sunchuangyu (Rin) Huang", focus: "Index selection" },
  { name: "Runqiu Fei", focus: "Index selection" },
  { name: "Xiaoyi Liu", focus: "Workload-driven optimisation" },
  { name: "Qingxuan Yang", focus: "Workload-driven optimisation" },
] as const;
