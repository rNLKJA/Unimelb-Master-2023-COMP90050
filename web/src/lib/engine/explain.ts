/**
 * Parse SQLite's EXPLAIN QUERY PLAN output into a tree and pull out the facts
 * the advisors need: which secondary indexes a statement used and which tables
 * it scanned in full.
 */

export interface ExplainRow {
  id: number;
  parent: number;
  detail: string;
}

export interface PlanNode {
  id: number;
  detail: string;
  /** SCAN / SEARCH / USE TEMP B-TREE / ... */
  op: "scan" | "search" | "temp" | "other";
  table: string | null;
  index: string | null;
  covering: boolean;
  children: PlanNode[];
}

const SCAN_RE = /^SCAN (\w+)/;
const SEARCH_RE = /^SEARCH (\w+)/;
const INDEX_RE = /USING (COVERING )?INDEX (\w+)/;

export function classify(detail: string): Omit<PlanNode, "id" | "children" | "detail"> {
  const idx = INDEX_RE.exec(detail);
  const scan = SCAN_RE.exec(detail);
  const search = SEARCH_RE.exec(detail);
  const op = search
    ? "search"
    : scan
      ? "scan"
      : detail.startsWith("USE TEMP B-TREE")
        ? "temp"
        : "other";
  return {
    op,
    table: (search ?? scan)?.[1] ?? null,
    index: idx ? idx[2] : null,
    covering: Boolean(idx?.[1]),
  };
}

export function buildPlanTree(rows: ExplainRow[]): PlanNode[] {
  const nodes = new Map<number, PlanNode>();
  const roots: PlanNode[] = [];
  for (const r of rows) {
    nodes.set(r.id, { id: r.id, detail: r.detail, children: [], ...classify(r.detail) });
  }
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    const parent = nodes.get(r.parent);
    if (parent && r.parent !== r.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function flattenPlan(nodes: PlanNode[]): PlanNode[] {
  return nodes.flatMap((n) => [n, ...flattenPlan(n.children)]);
}

/** Secondary index names a plan uses (excludes SQLite's own autoindexes). */
export function usedIndexNames(nodes: PlanNode[]): string[] {
  return [
    ...new Set(
      flattenPlan(nodes)
        .map((n) => n.index)
        .filter((x): x is string => x !== null && !x.startsWith("sqlite_autoindex")),
    ),
  ];
}

/** Tables read by a full scan (a SCAN without an index). */
export function scannedTables(nodes: PlanNode[]): string[] {
  return flattenPlan(nodes)
    .filter((n) => n.op === "scan" && n.index === null && n.table !== null)
    .map((n) => n.table!);
}
