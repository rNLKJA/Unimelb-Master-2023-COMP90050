"use client";

import { useMemo, useState } from "react";
import { ADVISOR_BY_ID } from "@/lib/advisors/registry";
import type { AdvisorId } from "@/lib/advisors/types";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BreakdownBars, TIME_SEGMENTS } from "@/components/charts/breakdown-bars";
import { Legend, LineChart, type Series } from "@/components/charts/line-chart";
import { Panel, PanelHeader } from "@/components/shared/section";
import { PlanTree } from "@/components/shared/plan-tree";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import type { ArenaState } from "./state";
import { advisorColor } from "./state";

const name = (id: AdvisorId) => ADVISOR_BY_ID.get(id)?.short ?? id;

function finished(state: ArenaState) {
  return (
    Object.entries(state.runs) as [AdvisorId, NonNullable<ArenaState["runs"][AdvisorId]>][]
  ).filter(([, r]) => r.rounds.length > 0);
}

export function Leaderboard({ state }: { state: ArenaState }) {
  const runs = finished(state);
  const rows = runs
    .map(([id, r]) => {
      const t = r.rounds.reduce(
        (acc, x) => ({
          recommendation: acc.recommendation + x.recommendationMs,
          creation: acc.creation + x.creationMs,
          execution: acc.execution + x.executionMs,
          calls: acc.calls + x.whatIfCalls,
        }),
        { recommendation: 0, creation: 0, execution: 0, calls: 0 },
      );
      return {
        id,
        r,
        ...t,
        total: t.recommendation + t.creation + t.execution,
        done: Boolean(r.totals),
      };
    })
    .sort((a, b) => (a.done === b.done ? a.total - b.total : a.done ? -1 : 1));
  const best = rows.find((r) => r.done);
  return (
    <Panel>
      <PanelHeader
        title="Total workload time"
        sub="Recommendation + index creation + query execution, summed over every round — the breakdown of the report's Table 2."
      />
      <div className="space-y-4 p-4 sm:p-5">
        <BreakdownBars
          caption="Total workload time per advisor"
          segments={TIME_SEGMENTS}
          format={formatMs}
          rows={rows.map((r) => ({
            id: r.id,
            text: name(r.id),
            label: (
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: advisorColor(r.id) }}
                />
                {name(r.id)}
                {r.id === "llm" && <AiGeneratedLabel />}
                {!r.done && (
                  <span className="text-muted-foreground font-mono text-[10px]">running</span>
                )}
              </span>
            ),
            values: {
              recommendation: r.recommendation,
              creation: r.creation,
              execution: r.execution,
            },
            total: r.total,
            highlight: best?.id === r.id,
          }))}
        />
        <div
          role="region"
          aria-label="Total workload time by advisor"
          tabIndex={0}
          className="overflow-x-auto focus-visible:-outline-offset-2"
        >
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Advisor
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Total
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  vs no index
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  What-if calls
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Indexes at end
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Storage at end
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const none = rows.find((x) => x.id === "none" && x.done);
                const last = r.r.rounds.at(-1);
                return (
                  <tr key={r.id} className="border-border/60 border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: advisorColor(r.id) }}
                        />
                        {ADVISOR_BY_ID.get(r.id)?.name}
                        {r.id === "llm" && <AiGeneratedLabel model={state.config?.llm?.model} />}
                      </span>
                    </th>
                    <td className="tabular py-2 pr-3 text-right font-mono">{formatMs(r.total)}</td>
                    <td
                      className={cn(
                        "tabular py-2 pr-3 text-right font-mono",
                        r.done && none && r.total < none.total
                          ? "text-mint"
                          : "text-muted-foreground",
                      )}
                    >
                      {!r.done
                        ? "running…"
                        : none && r.id !== "none"
                          ? `${((r.total / none.total - 1) * 100).toFixed(0)}%`
                          : "—"}
                    </td>
                    <td className="tabular py-2 pr-3 text-right font-mono">{formatInt(r.calls)}</td>
                    <td className="tabular py-2 pr-3 text-right font-mono">
                      {last?.config.length ?? 0}
                    </td>
                    <td className="tabular py-2 text-right font-mono">
                      {formatBytes(last?.bytes ?? 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

export function TimeCharts({ state }: { state: ArenaState }) {
  const runs = finished(state);
  const n = state.config?.rounds ?? 0;
  const markers = (state.setup?.workload.phases ?? [])
    .filter((p) => p.start > 0)
    .map((p) => ({ x: p.start, label: p.label }));
  const cumulative: Series[] = runs.map(([id, r]) => {
    let acc = 0;
    return {
      id,
      label: name(id),
      color: advisorColor(id),
      values: r.rounds.map((x) => (acc += x.recommendationMs + x.creationMs + x.executionMs)),
      dashed: id === "none",
    };
  });
  const perRound: Series[] = runs.map(([id, r]) => ({
    id,
    label: name(id),
    color: advisorColor(id),
    values: r.rounds.map((x) => x.executionMs),
    dashed: id === "none",
  }));
  const legend = runs.map(([id]) => ({
    label: name(id),
    color: advisorColor(id),
    dashed: id === "none",
  }));
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      <Panel>
        <PanelHeader
          title="Cumulative workload time"
          sub="Lower is better. Steps show index builds; slopes show query time."
        />
        <div className="p-3 sm:p-4">
          <LineChart
            ariaLabel="Cumulative workload time per round for each advisor"
            series={cumulative}
            length={n}
            markers={markers}
            xLabel={(i) => `R${i + 1}`}
            yFormat={formatMs}
          />
          <Legend items={legend} className="mt-2 px-2" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Query execution per round"
          sub="What each round's statements cost under the configuration in place."
        />
        <div className="p-3 sm:p-4">
          <LineChart
            ariaLabel="Execution time per round for each advisor"
            series={perRound}
            length={n}
            markers={markers}
            xLabel={(i) => `R${i + 1}`}
            yFormat={formatMs}
          />
          <Legend items={legend} className="mt-2 px-2" />
        </div>
      </Panel>
    </div>
  );
}

export function AdvisorPicker({
  ids,
  value,
  onChange,
  label,
}: {
  ids: AdvisorId[];
  value: AdvisorId;
  onChange: (id: AdvisorId) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
            value === id
              ? "border-border bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          <span className="size-2 rounded-full" style={{ background: advisorColor(id) }} />
          {name(id)}
        </button>
      ))}
    </div>
  );
}

/** Shown wherever the LLM advisor's configuration appears. */
function LlmConfigNote({ model }: { model?: string }) {
  return (
    <p className="text-muted-foreground mb-3 flex flex-wrap items-center gap-2 text-xs">
      <AiGeneratedLabel model={model} />
      <span>
        Configuration proposed by the model, validated by the lab and approved by a person.
      </span>
    </p>
  );
}

/** Which indexes each advisor kept, round by round, and how often they were used. */
export function ConfigMap({ state }: { state: ArenaState }) {
  const ids: AdvisorId[] = finished(state)
    .map(([id]) => id)
    .filter((id) => id !== "none");
  const [picked, setPicked] = useState<AdvisorId | null>(null);
  const id = picked && ids.includes(picked) ? picked : ids[ids.length - 1];
  const run = id ? state.runs[id] : undefined;
  const indexes = useMemo(() => {
    if (!run) return [];
    const seen = new Map<string, number>();
    run.rounds.forEach((r, i) => r.config.forEach((c) => !seen.has(c) && seen.set(c, i)));
    return [...seen.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([c]) => c);
  }, [run]);
  if (!id || !run) return null;
  const rounds = run.rounds;
  const maxUse = Math.max(1, ...rounds.flatMap((r) => Object.values(r.usage)));
  return (
    <Panel>
      <PanelHeader
        title="Index timeline"
        sub="Each row is an index; filled cells are rounds where it existed, brighter where more statements used it."
        right={
          <AdvisorPicker
            ids={ids}
            value={id}
            onChange={setPicked}
            label="Advisor for the index timeline"
          />
        }
      />
      <div
        role="region"
        aria-label="Index timeline"
        tabIndex={0}
        className="relative overflow-x-auto p-4 focus-visible:-outline-offset-2 sm:p-5"
      >
        {id === "llm" && <LlmConfigNote model={state.config?.llm?.model} />}
        {indexes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{name(id)} did not build any index.</p>
        ) : (
          <table className="border-separate border-spacing-[2px] font-mono text-[11px]">
            <thead>
              <tr>
                <th scope="col" className="text-muted-foreground pr-3 text-left font-normal">
                  index
                </th>
                {rounds.map((r) => (
                  <th
                    key={r.round}
                    scope="col"
                    className="text-muted-foreground w-4 text-center font-normal"
                  >
                    {(r.round + 1) % 5 === 0 ? (
                      r.round + 1
                    ) : (
                      <span className="sr-only">Round {r.round + 1}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indexes.map((ix) => (
                <tr key={ix}>
                  <th
                    scope="row"
                    className="max-w-[18rem] truncate pr-3 text-left font-normal whitespace-nowrap"
                    title={ix}
                  >
                    {ix}
                  </th>
                  {rounds.map((r) => {
                    const on = r.config.includes(ix);
                    const use = r.usage[ix] ?? 0;
                    const created = r.created.includes(ix);
                    return (
                      <td
                        key={r.round}
                        title={`Round ${r.round + 1}: ${on ? `present, used by ${use} statement${use === 1 ? "" : "s"}` : "absent"}${created ? " (built this round)" : ""}`}
                        className={cn(
                          "size-4 rounded-[3px]",
                          !on && "bg-surface-2",
                          created && "ring-foreground/60 ring-1 ring-inset",
                        )}
                        style={
                          on
                            ? {
                                background: `color-mix(in oklch, ${advisorColor(id)} ${25 + 75 * (use / maxUse)}%, var(--surface-2))`,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

/** Average execution time per template over the last five rounds, per advisor. */
export function TemplateTable({ state }: { state: ArenaState }) {
  const runs = finished(state).filter(([, r]) => r.totals);
  const templates = state.setup?.workload.templates ?? [];
  if (runs.length === 0 || templates.length === 0) return null;
  const avg = (rounds: ArenaState["runs"][AdvisorId], t: string) => {
    const tail = (rounds?.rounds ?? []).filter((r) => r.perTemplate[t] !== undefined).slice(-5);
    return tail.length ? tail.reduce((s, r) => s + r.perTemplate[t], 0) / tail.length : null;
  };
  return (
    <Panel>
      <PanelHeader
        title="Where the time goes"
        sub="Per-template execution time per round, averaged over the last five rounds that ran it."
      />
      <div
        role="region"
        aria-label="Per-template execution time"
        tabIndex={0}
        className="overflow-x-auto p-4 focus-visible:-outline-offset-2 sm:p-5"
      >
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-border text-muted-foreground border-b text-xs">
              <th scope="col" className="py-2 pr-3 text-left font-medium">
                Template
              </th>
              {runs.map(([id]) => (
                <th
                  key={id}
                  scope="col"
                  className="py-2 pr-3 text-right font-medium whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: advisorColor(id) }}
                    />
                    {name(id)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const values = runs.map(([id]) => avg(state.runs[id], t.id));
              const present = values.filter((v): v is number => v !== null);
              const min = Math.min(...present);
              return (
                <tr key={t.id} className="border-border/50 border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                    <span className="text-muted-foreground mr-2 font-mono text-xs">{t.id}</span>
                    {t.title}
                  </th>
                  {values.map((v, i) => (
                    <td
                      key={runs[i][0]}
                      className={cn(
                        "tabular py-1.5 pr-3 text-right font-mono text-xs whitespace-nowrap",
                        v !== null && v === min && present.length > 1
                          ? "text-mint"
                          : "text-muted-foreground",
                      )}
                    >
                      {v === null ? "—" : formatMs(v)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Why the bandit chose what it chose: UCB = learnt mean + exploration bonus. */
export function MabInspector({ state }: { state: ArenaState }) {
  const trace = state.runs.mab?.mabTrace;
  const [round, setRound] = useState<number | null>(null);
  if (!trace || trace.length === 0) return null;
  const idx = round === null ? trace.length - 1 : Math.min(round, trace.length - 1);
  const t = trace[idx];
  return (
    <Panel>
      <PanelHeader
        title="Inside the bandit"
        sub="For each round: how many arms C²UCB scored, the share of new templates that triggered forgetting, and the super arm it picked."
        right={
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Round
            <input
              type="range"
              min={0}
              max={trace.length - 1}
              value={idx}
              onChange={(e) => setRound(Number(e.target.value))}
              className="w-40 accent-[var(--mint)]"
              aria-label="Bandit round"
            />
            <span className="text-foreground tabular w-8 font-mono">{t.round + 1}</span>
          </label>
        }
      />
      <div className="space-y-3 p-4 sm:p-5">
        <p className="text-muted-foreground font-mono text-xs">
          {t.arms} arms scored · workload shift {(t.shift * 100).toFixed(0)}%
          {t.shift > 0.5 ? " → learner reset" : t.shift > 0 ? " → history discounted" : ""}
        </p>
        {t.chosen.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No arm had a positive score this round, so no index was kept.
          </p>
        ) : (
          <div
            role="region"
            aria-label="Bandit arm scores"
            tabIndex={0}
            className="overflow-x-auto focus-visible:-outline-offset-2"
          >
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th scope="col" className="py-2 pr-3 text-left font-medium">
                    Arm (index)
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    θᵀx
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    + α√(xᵀV⁻¹x)
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    gain observed
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    build time
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.chosen.map((c) => {
                  const r = t.rewards[c.id];
                  return (
                    <tr key={c.id} className="border-border/50 border-b last:border-0">
                      <th
                        scope="row"
                        className="py-1.5 pr-3 text-left font-mono text-xs font-normal"
                      >
                        {c.id}
                      </th>
                      <td className="tabular py-1.5 pr-3 text-right font-mono text-xs">
                        {c.mean.toFixed(2)}
                      </td>
                      <td className="text-muted-foreground tabular py-1.5 pr-3 text-right font-mono text-xs">
                        {c.bonus.toFixed(2)}
                      </td>
                      <td
                        className={cn(
                          "tabular py-1.5 pr-3 text-right font-mono text-xs",
                          r && r.gain > 0 ? "text-mint" : "text-coral",
                        )}
                      >
                        {r ? formatMs(r.gain) : "—"}
                      </td>
                      <td className="text-muted-foreground tabular py-1.5 text-right font-mono text-xs">
                        {r && r.creation > 0 ? formatMs(r.creation) : "already built"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** The final configuration's SQLite plan for one query of each template. */
export function FinalPlans({ state }: { state: ArenaState }) {
  const ids = finished(state)
    .filter(([, r]) => r.plans)
    .map(([id]) => id);
  const [picked, setPicked] = useState<AdvisorId | null>(null);
  const id = picked && ids.includes(picked) ? picked : ids[ids.length - 1];
  const plans = id ? state.runs[id]?.plans : undefined;
  const sample = state.setup?.workload.sample ?? [];
  const titles = new Map((state.setup?.workload.templates ?? []).map((t) => [t.id, t.title]));
  if (!id || !plans) return null;
  return (
    <Panel>
      <PanelHeader
        title="Final query plans"
        sub="SQLite's EXPLAIN QUERY PLAN under each advisor's final configuration. Green rows seek through an index; amber rows scan."
        right={
          <AdvisorPicker
            ids={ids}
            value={id}
            onChange={setPicked}
            label="Advisor for the final plans"
          />
        }
      />
      {id === "llm" && (
        <div className="px-4 pt-4 sm:px-5">
          <LlmConfigNote model={state.config?.llm?.model} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 p-4 sm:p-5 md:grid-cols-2">
        {sample.map((q) => (
          <div
            key={q.template}
            className="border-border bg-surface-2/50 min-w-0 rounded-lg border p-3"
          >
            <p className="mb-1 flex items-baseline gap-2 text-sm">
              <span className="text-muted-foreground font-mono text-xs">{q.template}</span>
              {titles.get(q.template)}
            </p>
            <PlanTree nodes={plans[q.template] ?? []} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
