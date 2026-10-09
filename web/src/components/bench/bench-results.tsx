"use client";

import { Download } from "lucide-react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { advisorColor } from "@/components/arena/state";
import { IntervalChart } from "@/components/charts/interval-chart";
import { Legend, LineChart, type Series } from "@/components/charts/line-chart";
import { Panel, PanelHeader } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { ADVISOR_BY_ID } from "@/lib/advisors/registry";
import type { AdvisorId } from "@/lib/advisors/types";
import { METRIC_LABEL, type BenchSummary, type Metric } from "@/lib/bench/benchmark";
import { formatMs, formatSignedMs } from "@/lib/format";
import { formatInterval, formatP, pctChange } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

const name = (id: AdvisorId) =>
  id === "autoadmin" ? "AutoAdmin (greedy)" : (ADVISOR_BY_ID.get(id)?.short ?? id);
const longName = (id: AdvisorId) =>
  id === "autoadmin" ? "AutoAdmin (greedy what-if)" : (ADVISOR_BY_ID.get(id)?.name ?? id);
const pct = (x: number) => pctChange(x);
const ci = (c: { lower: number; upper: number }, f: (x: number) => string) => formatInterval(c, f);

function Swatch({ id }: { id: AdvisorId }) {
  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        id === "hindsight" && "ring-foreground/40 ring-1",
      )}
      style={{ background: advisorColor(id) }}
    />
  );
}

function Th({ children, right = true }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={cn("py-2 pr-3 font-medium", right ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

function Scroll({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="overflow-x-auto focus-visible:-outline-offset-2"
    >
      {children}
    </div>
  );
}

export function DisplayOptions({
  metric,
  onMetric,
  baseline,
  onBaseline,
  options,
}: {
  metric: Metric;
  onMetric: (m: Metric) => void;
  baseline: AdvisorId;
  onBaseline: (id: AdvisorId) => void;
  options: AdvisorId[];
}) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="text-sm">
        <span className="kicker mb-1 block">Metric</span>
        <select
          value={metric}
          onChange={(e) => onMetric(e.target.value as Metric)}
          className="border-input bg-surface rounded-md border px-2 py-1.5 text-sm"
        >
          {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
            <option key={m} value={m}>
              {METRIC_LABEL[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="kicker mb-1 block">Compare against</span>
        <select
          value={baseline}
          onChange={(e) => onBaseline(e.target.value as AdvisorId)}
          className="border-input bg-surface rounded-md border px-2 py-1.5 text-sm"
        >
          {options.map((id) => (
            <option key={id} value={id}>
              {longName(id)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** The advisor's long name, with the AI-generated label for the LLM advisor. */
function AdvisorName({ id, llmModel }: { id: AdvisorId; llmModel?: string }) {
  return (
    <span className="flex items-center gap-2">
      <Swatch id={id} />
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {longName(id)}
        {id === "llm" && <AiGeneratedLabel model={llmModel} />}
      </span>
    </span>
  );
}

/** What the intervals describe, for the panel subtitles. */
function intervalNote(s: BenchSummary) {
  return s.intervals === "replicates"
    ? `95% percentile-bootstrap intervals over the ${s.replicates} replicates of this browser session (B = ${s.bootstrap.B}, seed ${s.bootstrap.seed}). They describe workload-to-workload variation in this session only; re-running the same seeds moves the results by more.`
    : `95% pigeonhole-bootstrap intervals over ${s.sessions} sessions x ${s.replicates} workload seeds (B = ${s.bootstrap.B}, seed ${s.bootstrap.seed}).`;
}

/** Mean workload time per advisor with bootstrap intervals. */
export function MeansPanel({ summary, llmModel }: { summary: BenchSummary; llmModel?: string }) {
  const rows = [...summary.advisors].sort((a, b) => a.mean.estimate - b.mean.estimate);
  return (
    <Panel>
      <PanelHeader
        title="Mean cumulative workload time"
        sub={`${METRIC_LABEL[summary.metric]}, summed over all rounds, averaged over ${summary.replicates} replicates. Whiskers: ${intervalNote(summary)}`}
      />
      <div className="space-y-4 p-4 sm:p-5">
        <IntervalChart
          caption="Mean cumulative workload time per advisor"
          format={formatMs}
          rows={rows.map((a) => ({
            id: a.id,
            label: name(a.id),
            color: advisorColor(a.id),
            estimate: a.mean.estimate,
            lower: a.mean.lower,
            upper: a.mean.upper,
            dashed: a.id === "hindsight",
          }))}
        />
        <Scroll label="Mean workload time by advisor">
          <table className="w-full min-w-[48rem] text-sm [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <Th right={false}>Advisor</Th>
                <Th>Mean</Th>
                <Th>95% CI</Th>
                <Th>SD</Th>
                <Th>Speed-up vs no index</Th>
                <Th>Recommend</Th>
                <Th>Build</Th>
                <Th>Run</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-border/60 border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <AdvisorName id={a.id} llmModel={llmModel} />
                  </th>
                  <td className="tabular py-2 pr-3 text-right font-mono whitespace-nowrap">
                    {formatMs(a.mean.estimate)}
                  </td>
                  <td className="text-muted-foreground tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap">
                    {ci(a.mean, formatMs)}
                  </td>
                  <td className="text-muted-foreground tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap">
                    {formatMs(a.sd)}
                  </td>
                  <td className="tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap">
                    {a.speedup
                      ? `${a.speedup.estimate.toFixed(2)}× ${ci(a.speedup, (x) => x.toFixed(2))}`
                      : "–"}
                  </td>
                  <td className="text-muted-foreground tabular py-2 pr-3 text-right font-mono text-xs">
                    {formatMs(a.recommendationMs)}
                  </td>
                  <td className="text-muted-foreground tabular py-2 pr-3 text-right font-mono text-xs">
                    {formatMs(a.creationMs)}
                  </td>
                  <td className="text-muted-foreground tabular py-2 text-right font-mono text-xs">
                    {formatMs(a.executionMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
        <p className="text-muted-foreground text-xs">
          Workload seeds {summary.seeds.join(", ")}. The hindsight reference is not a contender: it
          knows the whole workload in advance and is not charged for recommending.
        </p>
      </div>
    </Panel>
  );
}

/** Paired comparisons against the chosen baseline. */
export function PairedPanel({ summary, llmModel }: { summary: BenchSummary; llmModel?: string }) {
  const rows = summary.paired;
  if (rows.length === 0) return null;
  const against = rows[0].against;
  return (
    <Panel>
      <PanelHeader
        title={`Paired comparison against ${longName(against)}`}
        sub={`Each replicate is a pair, because both advisors ran the same workload. Change is the ratio of means minus one, so negative means faster than the baseline. The effect size d_z is the mean difference over the SD of the differences. The sign test drops ties. ${intervalNote(summary)}`}
      />
      <div className="space-y-4 p-4 sm:p-5">
        <IntervalChart
          caption={`Change in workload time against ${longName(against)}`}
          format={(x) => pct(1 + x)}
          reference={{ value: 0, label: `same time as ${name(against)}` }}
          rows={rows.map((p) => ({
            id: p.id,
            label: name(p.id),
            color: advisorColor(p.id),
            estimate: p.ratio.estimate - 1,
            lower: p.ratio.lower - 1,
            upper: p.ratio.upper - 1,
          }))}
        />
        <Scroll label="Paired comparisons">
          <table className="w-full min-w-[52rem] text-sm [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <Th right={false}>Advisor</Th>
                <Th>Mean difference</Th>
                <Th>Change [95% CI]</Th>
                <Th>Effect size d_z</Th>
                <Th>Faster / slower / tied</Th>
                <Th>Sign test p</Th>
                <Th>Share faster [95% CI]</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-border/60 border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <AdvisorName id={p.id} llmModel={llmModel} />
                  </th>
                  <td className="tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap">
                    {formatSignedMs(p.difference.estimate)}{" "}
                    <span className="text-muted-foreground">
                      {ci(p.difference, formatSignedMs)}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap",
                      p.ratio.upper < 1 ? "text-mint" : p.ratio.lower > 1 ? "text-coral" : "",
                    )}
                  >
                    {pct(p.ratio.estimate)}{" "}
                    <span className="text-muted-foreground">{ci(p.ratio, pct)}</span>
                  </td>
                  <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                    {Number.isFinite(p.dz) ? p.dz.toFixed(2) : "–"}
                  </td>
                  <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                    {p.sign.wins} / {p.sign.losses} / {p.sign.ties}
                  </td>
                  <td className="tabular py-2 pr-3 text-right font-mono text-xs">
                    {formatP(p.sign.p)}
                  </td>
                  <td className="tabular py-2 text-right font-mono text-xs whitespace-nowrap">
                    {Number.isFinite(p.winShare.estimate)
                      ? `${(p.winShare.estimate * 100).toFixed(0)}% ${ci(p.winShare, (x) => `${(x * 100).toFixed(0)}%`)}`
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
        <p className="text-muted-foreground text-xs">
          With {summary.replicates} replicates the smallest possible sign-test p is{" "}
          {formatP(Math.min(1, 2 * Math.pow(0.5, summary.replicates)))}; read the effect sizes and
          intervals, not only p. Percentile-bootstrap intervals from few replicates are somewhat too
          narrow, and more replicates in one session cannot capture run-to-run variation: to check a
          result, run the benchmark again and compare.
        </p>
      </div>
    </Panel>
  );
}

/** The bandit's cumulative regret against the hindsight reference. */
export function RegretPanel({ summary }: { summary: BenchSummary }) {
  const r = summary.regret;
  if (!r) return null;
  const proven = r.reference.proven === r.reference.of;
  const series: Series[] = [
    {
      id: "regret",
      label: `${name(r.id)} regret`,
      color: advisorColor(r.id),
      values: r.curve.estimate,
      band: { lower: r.curve.lower, upper: r.curve.upper },
    },
  ];
  return (
    <Panel>
      <PanelHeader
        title="The bandit's regret"
        sub={`Cumulative time the bandit spent beyond the hindsight reference (${proven ? "the what-if-optimal fixed configuration" : "the best fixed configuration branch and bound found"} for the whole workload, built before round 1), averaged over replicates. The band is a pointwise 95% bootstrap interval.`}
      />
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <LineChart
            ariaLabel="Cumulative regret per round with a 95% band"
            series={series}
            xLabel={(i) => `R${i + 1}`}
            yFormat={(v) => (v < 0 ? `−${formatMs(-v)}` : formatMs(v))}
          />
          <Legend
            className="mt-2 px-2"
            items={[
              { label: "mean cumulative regret (shaded: 95% band)", color: advisorColor(r.id) },
            ]}
          />
        </div>
        <div className="space-y-4 text-sm">
          <dl className="space-y-4">
            <div>
              <dt className="text-muted-foreground text-xs">Final regret</dt>
              <dd className="font-display tabular text-2xl font-semibold">
                {r.final.estimate < 0 ? "−" : ""}
                {formatMs(Math.abs(r.final.estimate))}
              </dd>
              <dd className="text-muted-foreground font-mono text-xs">
                95% CI {ci(r.final, (x) => (x < 0 ? "−" : "") + formatMs(Math.abs(x)))}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">
                Relative to the reference&apos;s total
              </dt>
              <dd className="font-display tabular text-2xl font-semibold">
                {(r.relative.estimate * 100).toFixed(0)}%
              </dd>
              <dd className="text-muted-foreground font-mono text-xs">
                95% CI {ci(r.relative, (x) => `${(x * 100).toFixed(0)}%`)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Reference proven optimal</dt>
              <dd className={cn("tabular font-mono text-xs", !proven && "text-coral")}>
                in {r.reference.proven} of {r.reference.of} replicates
              </dd>
            </div>
          </dl>
          {!proven && (
            <p role="note" className="text-coral text-xs leading-relaxed">
              Branch and bound ran out of nodes before proving optimality in{" "}
              {r.reference.of - r.reference.proven} replicate
              {r.reference.of - r.reference.proven === 1 ? "" : "s"}, so this regret is against the
              best configuration found, not a proven optimum.
            </p>
          )}
          <p className="text-muted-foreground text-xs leading-relaxed">
            Regret starts below zero because the reference pays for all its indexes before round 1.
            It can end below zero too: the reference is optimal for the cost model, not for measured
            runtimes, and it never adapts.
          </p>
        </div>
      </div>
    </Panel>
  );
}

export interface SweepPoint {
  drift: number;
  summary: BenchSummary;
}

/** How the comparison against the baseline moves with workload drift. */
export function DriftPanel({ points }: { points: SweepPoint[] }) {
  if (points.length < 2) return null;
  const against = points[0].summary.paired[0]?.against;
  const ids = [...new Set(points.flatMap((p) => p.summary.paired.map((x) => x.id)))].filter(
    (id) => id !== "none",
  );
  const series: Series[] = ids.map((id) => {
    const get = (p: SweepPoint) => p.summary.paired.find((x) => x.id === id);
    return {
      id,
      label: name(id),
      color: advisorColor(id),
      values: points.map((p) => (get(p) ? (get(p)!.ratio.estimate - 1) * 100 : null)),
      band: {
        lower: points.map((p) => (get(p) ? (get(p)!.ratio.lower - 1) * 100 : null)),
        upper: points.map((p) => (get(p) ? (get(p)!.ratio.upper - 1) * 100 : null)),
      },
    };
  });
  return (
    <Panel>
      <PanelHeader
        title="Sensitivity to workload drift"
        sub={`The drifting workload at ${points.length} levels, from 0 (static: every template every round) to 1 (shifting: each phase runs only its group). Change in workload time against ${against ? longName(against) : "the baseline"}, with 95% bands.`}
      />
      <div className="space-y-4 p-4 sm:p-5">
        <LineChart
          ariaLabel="Change against the baseline by drift level"
          series={series}
          length={points.length}
          xLabel={(i) => `drift ${points[i].drift.toFixed(2)}`}
          xTickLabel={(i) => points[i].drift.toFixed(2)}
          yFormat={(v) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(0)}%`}
        />
        <Legend
          className="px-2"
          items={series.map((s) => ({ label: `${s.label} vs ${name(against!)}`, color: s.color }))}
        />
        <Scroll label="Change against the baseline by drift">
          <table className="w-full min-w-[36rem] text-sm [&_td]:whitespace-nowrap">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <Th right={false}>Drift</Th>
                {ids.map((id) => (
                  <Th key={id}>{name(id)} change [95% CI]</Th>
                ))}
                <Th>Replicates</Th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.drift} className="border-border/60 border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-mono text-xs font-normal">
                    {p.drift.toFixed(2)}
                  </th>
                  {ids.map((id) => {
                    const x = p.summary.paired.find((y) => y.id === id);
                    return (
                      <td
                        key={id}
                        className="tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap"
                      >
                        {x ? `${pct(x.ratio.estimate)} ${ci(x.ratio, pct)}` : "–"}
                      </td>
                    );
                  })}
                  <td className="tabular py-2 text-right font-mono text-xs">
                    {p.summary.replicates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      </div>
    </Panel>
  );
}

export function ExportButtons({ onCsv, onJson }: { onCsv: () => void; onJson: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={onCsv}>
        <Download aria-hidden /> Replicates (CSV)
      </Button>
      <Button variant="outline" onClick={onJson}>
        <Download aria-hidden /> Summary and settings (JSON)
      </Button>
    </div>
  );
}
