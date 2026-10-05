"use client";

import { useState } from "react";
import { Legend, LineChart, type Series } from "@/components/charts/line-chart";
import { Panel, PanelHeader } from "@/components/shared/section";
import type { ForecastView } from "@/lib/forecast/view";
import { cn } from "@/lib/utils";
import { clusterColor, dayName, hourLabel, MODEL_COLORS } from "./shared";

const CONTEXT_HOURS = 72;

export function ForecastChart({ view }: { view: ForecastView }) {
  const [picked, setPicked] = useState(0);
  const ci = Math.min(picked, view.clusters.length - 1);
  const c = view.clusters[ci];
  const from = view.testStart - CONTEXT_HOURS;
  const n = view.hours - from;
  const pad = (xs: number[]) => [...Array<null>(CONTEXT_HOURS).fill(null), ...xs];
  const series: Series[] = [
    {
      id: "actual",
      label: "Actual",
      color: MODEL_COLORS.actual,
      values: c.volume.slice(from),
      width: 1.5,
    },
    { id: "lr", label: "LR", color: MODEL_COLORS.lr, values: pad(c.lr), width: 1.25, dashed: true },
    { id: "kr", label: "KR", color: MODEL_COLORS.kr, values: pad(c.kr), width: 1.25, dashed: true },
    {
      id: "hybrid",
      label: "HYBRID",
      color: MODEL_COLORS.hybrid,
      values: pad(c.hybrid),
      width: 2.25,
    },
  ];
  const dayTicks = Array.from({ length: Math.ceil(n / 24) }, (_, d) => d * 24).filter((i) => i < n);
  const best = (m: ForecastView["clusters"][number]["mse"]) =>
    (Object.entries(m) as [keyof typeof m, number][]).reduce((a, b) => (b[1] < a[1] ? b : a))[0];

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader
          title="Hourly volume, last training days and the test week"
          sub={`Forecasts start where the test week begins; each point was predicted ${view.settings.horizon} h earlier.`}
          right={
            <div role="tablist" aria-label="Cluster to plot" className="flex flex-wrap gap-1">
              {view.clusters.map((cl, i) => (
                <button
                  key={cl.members.join(",")}
                  type="button"
                  role="tab"
                  aria-selected={i === ci}
                  onClick={() => setPicked(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                    i === ci
                      ? "border-border bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ background: clusterColor(i) }}
                    aria-hidden
                  />
                  Cluster {i + 1}
                </button>
              ))}
            </div>
          }
        />
        <div className="p-3 sm:p-4">
          <LineChart
            ariaLabel={`Cluster ${ci + 1}: actual hourly volume and LR, KR and HYBRID forecasts over the test week`}
            series={series}
            length={n}
            height={280}
            xLabel={(i) => hourLabel(from + i)}
            xTicks={dayTicks}
            xTickLabel={(i) => dayName(from + i)}
            yFormat={(v) => v.toFixed(0)}
            yLabel="queries / h"
            bands={[{ from: CONTEXT_HOURS, to: n - 1, label: "test week" }]}
          />
          <Legend
            className="mt-2 px-2"
            items={series.map((s) => ({ label: s.label, color: s.color, dashed: s.dashed }))}
          />
          <p className="text-muted-foreground mt-2 px-2 text-xs">
            Members: {c.members.join(", ")} · HYBRID switched to the kernel-regression spike
            forecast in {c.spikes} of {c.hybrid.length} test hours.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Accuracy on the test week"
          sub="Mean squared error of log(1 + volume); lower is better."
        />
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full min-w-[18rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Cluster
                </th>
                {(["lr", "kr", "hybrid"] as const).map((m) => (
                  <th key={m} scope="col" className="py-2 pr-3 text-right font-medium last:pr-0">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: MODEL_COLORS[m] }}
                        aria-hidden
                      />
                      {m === "hybrid" ? "HYBRID" : m.toUpperCase()}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.clusters.map((cl, i) => {
                const winner = best(cl.mse);
                return (
                  <tr
                    key={cl.members.join(",")}
                    className="border-border/50 border-b last:border-0"
                  >
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: clusterColor(i) }}
                          aria-hidden
                        />
                        Cluster {i + 1}
                        <span className="text-muted-foreground font-mono text-[11px]">
                          ({cl.members.length})
                        </span>
                      </span>
                    </th>
                    {(["lr", "kr", "hybrid"] as const).map((m) => (
                      <td
                        key={m}
                        className={cn(
                          "tabular py-2 pr-3 text-right font-mono text-xs last:pr-0",
                          m === winner ? "text-mint font-semibold" : "text-muted-foreground",
                        )}
                      >
                        {cl.mse[m].toFixed(3)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
            QB5000&apos;s ENSEMBLE averages linear regression with an LSTM. Training an LSTM in a
            browser tab is out of scope, so linear regression stands in for the ensemble here; the
            HYBRID rule is unchanged. LR uses the last 24 hours as input, KR the last 168.
          </p>
        </div>
      </Panel>
    </div>
  );
}
