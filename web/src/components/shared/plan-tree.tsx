import { cn } from "@/lib/utils";
import type { PlanNode } from "@/lib/engine/explain";

const OP_STYLE: Record<PlanNode["op"], string> = {
  search: "text-mint",
  scan: "text-amber-ink",
  temp: "text-violet",
  other: "text-muted-foreground",
};

const OP_LABEL: Record<PlanNode["op"], string> = {
  search: "SEARCH",
  scan: "SCAN",
  temp: "TEMP",
  other: "STEP",
};

function Node({ node, depth }: { node: PlanNode; depth: number }) {
  const rest = node.detail.replace(/^(SEARCH|SCAN)\s+/, "");
  return (
    <li>
      <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: depth * 16 }}>
        <span aria-hidden className="text-muted-foreground/60 mt-[3px]">
          {depth > 0 ? "└" : "▸"}
        </span>
        <span className={cn("w-[3.6rem] shrink-0 font-semibold", OP_STYLE[node.op])}>
          {OP_LABEL[node.op]}
        </span>
        <span className="text-foreground/90 min-w-0 break-words">
          {node.op === "search" || node.op === "scan" ? rest : node.detail}
          {node.covering && (
            <span className="bg-mint-soft text-accent-foreground ml-2 rounded-sm px-1 py-px text-[10px]">
              covering
            </span>
          )}
        </span>
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <Node key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** EXPLAIN QUERY PLAN as a compact tree: green seeks, amber full scans. */
export function PlanTree({ nodes, className }: { nodes: PlanNode[]; className?: string }) {
  if (nodes.length === 0)
    return <p className="text-muted-foreground font-mono text-xs">No plan.</p>;
  return (
    <ul className={cn("font-mono text-xs leading-relaxed", className)} aria-label="Query plan">
      {nodes.map((n) => (
        <Node key={n.id} node={n} depth={0} />
      ))}
    </ul>
  );
}
