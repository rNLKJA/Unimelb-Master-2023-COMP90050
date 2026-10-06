"use client";

import { useState } from "react";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { Legend, LineChart, type Series } from "@/components/charts/line-chart";
import { Panel, PanelHeader } from "@/components/shared/section";
import { formatBytes, formatMs } from "@/lib/format";
import { indexTimeline, type ForecastView } from "@/lib/forecast/view";
import { cn } from "@/lib/utils";
import { dayName, hourLabel, STRATEGY_COLORS, STRATEGY_TEXT_COLORS } from "./shared";

const SEGMENTS = [
  { key: "query", label: "Estimated query time", color: "var(--seg-exec)" },
  { key: "creation", label: "Index builds", color: "var(--seg-create)" },
];

export function LoopResults({ view }: { view: ForecastView }) {
  const { strategies, windows, windowHours, budgetBytes } = view.loop;
  const none = strategies.find((s) => s.id === "none")!;
  const best = strategies
    .filter((s) => s.id !== "oracle")
    .reduce((a, b) => (b.total < a.total ? b : a));
  const [picked, setPicked] = useState<"proactive" | "reactive">("proactive");
  const timelineOf = strategies.find((s) => s.id === picked)!;
  const timeline = indexTimeline(timelineOf.configs);

  const cumulative: Series[] = strategies.map((s) => {
    let acc = 0;
    return {
      id: s.id,
      label: s.label,
      color: STRATEGY_COLORS[s.id],
      values: s.perWindow.map((v) => (acc += v)),
      dashed: s.id === "oracle" || s.id === "none",
      width: s.id === "proactive" ? 2.5 : 1.75,
    };
  });
  const perDay = 24 / windowHours;
  const dayTicks = windows.map((_, i) => i).filter((i) => i % perDay === 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Total cost over the test week"
            sub={`Budget ${formatBytes(budgetBytes)} · ${windows.length} windows of ${windowHours} h. Lower is better.`}
          />
          <div className="space-y-4 p-4 sm:p-5">
            <BreakdownBars
              caption="Estimated query time plus index build time per strategy"
              segments={SEGMENTS}
              format={formatMs}
              rows={strategies.map((s) => ({
                id: s.id,
                text: s.label,
                label: (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: STRATEGY_COLORS[s.id] }}
                    />
                    {s.label}
                  </span>
                ),
                values: { query: s.query, creation: s.creation },
                total: s.total,
                highlight: s.id === best.id,
                note:
                  s.id === "none" ? undefined : `${((s.total / none.total - 1) * 100).toFixed(0)}%`,
              }))}
            />
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              {strategies.map((s) => (
                <div key={s.id} className="flex gap-2">
                  <dt
                    className="shrink-0 font-medium"
                    style={{ color: STRATEGY_TEXT_COLORS[s.id] }}
                  >
                    {s.label}
                  </dt>
                  <dd className="text-muted-foreground">{s.blurb}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
        <Panel>
          <PanelHeader
            title="Cumulative cost through the week"
            sub="The gap opens at each predictable spike."
          />
          <div className="p-3 sm:p-4">
            <LineChart
              ariaLabel="Cumulative estimated cost per tuning strategy across the test week"
              series={cumulative}
              length={windows.length}
              xLabel={(i) => hourLabel(windows[i])}
              xTicks={dayTicks}
              xTickLabel={(i) => dayName(windows[i])}
              yFormat={formatMs}
            />
            <Legend
              className="mt-2 px-2"
              items={cumulative.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))}
            />
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Which indexes were in place, window by window"
          sub="Forecast-driven tuning builds for the coming window; reactive tuning builds for the one that just ended, so it is a window late at every switch."
          right={
            <div role="tablist" aria-label="Strategy for the index timeline" className="flex gap-1">
              {(["proactive", "reactive"] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={picked === id}
                  onClick={() => setPicked(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                    picked === id
                      ? "border-border bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: STRATEGY_COLORS[id] }}
                    aria-hidden
                  />
                  {strategies.find((s) => s.id === id)?.label}
                </button>
              ))}
            </div>
          }
        />
        <div
          role="region"
          aria-label="Index timeline, window by window"
          tabIndex={0}
          className="overflow-x-auto p-4 focus-visible:-outline-offset-2 sm:p-5"
        >
          {timeline.length === 0 ? (
            <p className="text-muted-foreground text-sm">No index fitted the budget.</p>
          ) : (
            <table className="border-separate border-spacing-[2px] font-mono text-[11px]">
              <caption className="sr-only">
                Index presence per {windowHours}-hour window for the {timelineOf.label} strategy
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="text-muted-foreground pr-3 text-left font-normal">
                    index
                  </th>
                  {windows.map((w, i) => (
                    <th
                      key={w}
                      scope="col"
                      className={cn(
                        "text-muted-foreground text-left font-normal whitespace-nowrap",
                        windowHours === 1 ? "w-1.5" : "w-3",
                      )}
                    >
                      {i % perDay === 0 ? dayName(w) : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.id}>
                    <th scope="row" className="pr-3 text-left font-normal whitespace-nowrap">
                      {row.id}
                    </th>
                    {row.present.map((on, i) => (
                      <td
                        key={windows[i]}
                        title={`${hourLabel(windows[i])}: ${on ? "built" : "absent"}`}
                        className={cn(
                          "h-4 rounded-[2px]",
                          windowHours === 1 ? "w-1.5" : "w-3",
                          !on && "bg-surface-2",
                        )}
                        style={on ? { background: STRATEGY_COLORS[picked] } : undefined}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
