"use client";

import { Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/shared/section";
import type { PathSummary } from "@/lib/console/what-if";
import type { IndexDef } from "@/lib/engine/types";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConsoleResult } from "@/workers/protocol";

function describe(p: PathSummary): string {
  if (p.kind === "scan") return `SCAN ${p.table} (${formatInt(p.rows)} rows)`;
  if (p.kind === "rowid") return `SEARCH ${p.table} by primary key (~${formatInt(p.rows)} rows)`;
  return `SEARCH ${p.table} USING ${p.covering ? "COVERING " : ""}INDEX ${p.index} (~${formatInt(p.rows)} rows)`;
}

/** The optimiser's "what if" answers for the current statement, next to the measurement. */
export function WhatIfPanel({
  result,
  templated,
  disabled,
  onBuild,
}: {
  result: ConsoleResult;
  templated: boolean;
  disabled: boolean;
  onBuild: (ix: IndexDef) => void;
}) {
  const w = result.whatIf;
  return (
    <Panel>
      <PanelHeader
        title="What if…?"
        sub="The lab's cost model, asked the question every offline index advisor asks the optimiser."
      />
      <div className="p-4 sm:p-5">
        {!w ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {templated
              ? "You edited the statement, so the lab no longer knows its shape. Pick the template again to restore it."
              : "The what-if model reasons over query shapes it knows. Pick one of the templates (Q1–Q12, U1) and run it as generated to compare the estimate with SQLite's measurement and to see which indexes would help."}
          </p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3">
              <div className="border-border bg-surface-2/50 rounded-lg border px-3 py-2">
                <dt className="kicker">Estimated</dt>
                <dd className="font-display tabular mt-0.5 text-2xl font-semibold">
                  {formatMs(w.cost)}
                </dd>
              </div>
              <div className="border-border bg-surface-2/50 rounded-lg border px-3 py-2">
                <dt className="kicker">Measured</dt>
                <dd className="font-display tabular mt-0.5 text-2xl font-semibold">
                  {formatMs(result.ms)}
                </dd>
              </div>
            </dl>
            <ul className="text-muted-foreground space-y-0.5 font-mono text-xs">
              {w.paths.map((p, i) => (
                <li key={i}>
                  <span aria-hidden className={p.kind === "scan" ? "text-amber" : "text-mint"}>
                    {i === 0 ? "▸ " : "└ "}
                  </span>
                  {describe(p)}
                </li>
              ))}
            </ul>
            {w.candidates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[24rem] text-xs">
                  <caption className="text-muted-foreground mb-1.5 text-left text-xs">
                    Candidate indexes (AutoAdmin&apos;s syntactically relevant set), cheapest first
                  </caption>
                  <thead>
                    <tr className="border-border text-muted-foreground border-b">
                      <th scope="col" className="py-1.5 pr-2 text-left font-medium">
                        If we built…
                      </th>
                      <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                        est. cost
                      </th>
                      <th scope="col" className="py-1.5 pr-2 text-right font-medium">
                        size
                      </th>
                      <th scope="col" className="py-1.5 text-right font-medium">
                        <span className="sr-only">Build</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.candidates.map((c) => {
                      const change = c.cost / w.cost - 1;
                      return (
                        <tr key={c.id} className="border-border/50 border-b last:border-0">
                          <th scope="row" className="py-1 pr-2 text-left font-mono font-normal">
                            {c.id}
                          </th>
                          <td className="tabular py-1 pr-2 text-right font-mono whitespace-nowrap">
                            {formatMs(c.cost)}{" "}
                            <span
                              className={cn(change < -0.01 ? "text-mint" : "text-muted-foreground")}
                            >
                              {change < -0.01 ? `${(change * 100).toFixed(0)}%` : "±0"}
                            </span>
                          </td>
                          <td className="text-muted-foreground tabular py-1 pr-2 text-right font-mono whitespace-nowrap">
                            {formatBytes(c.bytes)}
                          </td>
                          <td className="py-1 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={disabled}
                              onClick={() => onBuild(c.index)}
                              aria-label={`Build index ${c.id}`}
                            >
                              <Hammer aria-hidden /> Build
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Every relevant index already exists.</p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
