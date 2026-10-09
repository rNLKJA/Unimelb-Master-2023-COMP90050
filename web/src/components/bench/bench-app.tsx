"use client";

import { Database, LoaderCircle, Sigma, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { AiGeneratedLabel } from "@/components/ai/ai-label";
import { InvalidRateGroups } from "@/components/ai/invalid-rates";
import { LlmAdvisorPanel } from "@/components/ai/llm-advisor-panel";
import { Panel, PanelHeader } from "@/components/shared/section";
import { Button } from "@/components/ui/button";
import { useLabWorker } from "@/hooks/use-lab-worker";
import { appendEntry, listEntries, onAuditChange, type AuditEntry } from "@/lib/ai/audit-log";
import { invalidRates } from "@/lib/ai/index-advisor";
import { measurementEntry, proposalSettings, sameProposalSettings } from "@/lib/ai/measurement";
import type { AdvisorId } from "@/lib/advisors/types";
import {
  replicatesToCsv,
  summarise,
  type Metric,
  type ReplicateResult,
} from "@/lib/bench/benchmark";
import { download } from "@/lib/csv";
import { DATASETS, isDatasetId, type DatasetId } from "@/lib/datasets/registry";
import { formatBytes, formatMs } from "@/lib/format";
import { SCENARIOS } from "@/lib/workload/scenarios";
import type { BenchRunConfig, LabResponse } from "@/workers/protocol";
import {
  DisplayOptions,
  DriftPanel,
  ExportButtons,
  MeansPanel,
  PairedPanel,
  RegretPanel,
  type SweepPoint,
} from "./bench-results";
import { BenchControls } from "./bench-controls";
import { INITIAL, SWEEP, benchReducer, defaultBench } from "./state";

export function BenchFromUrl() {
  const dataset = useSearchParams().get("dataset");
  const initial: DatasetId = isDatasetId(dataset) ? dataset : "tpch";
  return <BenchApp key={initial} initialDataset={initial} />;
}

/**
 * A plan is kept only while the settings match the ones the model was shown
 * (data, scenario, seed, rounds, budget); otherwise it would be measured on a
 * workload it never saw.
 */
function keepPlan(next: BenchRunConfig): BenchRunConfig {
  return next.llm && !sameProposalSettings(next.llm.request, next) ? { ...next, llm: null } : next;
}

export function BenchApp({ initialDataset = "tpch" }: { initialDataset?: DatasetId }) {
  const [config, setRaw] = useState<BenchRunConfig>(() => defaultBench(initialDataset));
  const setConfig = (next: BenchRunConfig) => setRaw(keepPlan(next));
  const [state, dispatch] = useReducer(benchReducer, INITIAL);
  const [metric, setMetric] = useState<Metric>("total");
  const [baseline, setBaseline] = useState<AdvisorId>("autoadmin");
  const onMessage = useCallback((msg: LabResponse) => dispatch({ type: "msg", msg }), []);
  const { post, restart } = useLabWorker(onMessage);
  const results = useRef<HTMLElement>(null);

  const run = (sweep: boolean) => {
    // The sweep runs workloads the model never saw, so it leaves the LLM out.
    const c: BenchRunConfig = sweep
      ? { ...config, sweep: SWEEP, advisors: config.advisors.filter((a) => a !== "llm"), llm: null }
      : { ...config, sweep: null };
    restart();
    dispatch({ type: "start", config: c });
    post({ type: "bench:run", config: c });
    if (window.matchMedia("(max-width: 1023px)").matches)
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const stop = () => {
    restart();
    dispatch({ type: "stop" });
  };

  const used = state.config;
  const groups = useMemo(() => {
    const m = new Map<number | null, ReplicateResult[]>();
    for (const { drift, result } of state.results) m.set(drift, [...(m.get(drift) ?? []), result]);
    return m;
  }, [state.results]);
  const ran = (used?.advisors ?? []).filter((a) => a !== "llm" || used?.llm);
  const comparator: AdvisorId = ran.includes(baseline)
    ? baseline
    : ran.includes("autoadmin")
      ? "autoadmin"
      : (ran[0] ?? "none");
  const summaries = useMemo(
    () =>
      [...groups.entries()].map(([drift, rs]) => ({
        drift,
        summary: summarise(rs, { metric, baseline: comparator }),
      })),
    [groups, metric, comparator],
  );
  const single =
    summaries.length === 1 && summaries[0].drift === null ? summaries[0].summary : null;
  const sweepPoints: SweepPoint[] = summaries
    .filter((s): s is { drift: number; summary: typeof s.summary } => s.drift !== null)
    .sort((a, b) => a.drift - b.drift);
  const [shownDrift, setShownDrift] = useState<number | null>(null);
  const detail =
    single ??
    (sweepPoints.length
      ? (sweepPoints.find((p) => p.drift === shownDrift) ?? sweepPoints[sweepPoints.length - 1])
          .summary
      : null);

  // Measuring an approved LLM proposal appends a measurement record linked to
  // its call, but only when the LLM advisor really ran and was compared.
  const recorded = useRef<string | null>(null);
  const budgetBytes = state.setup?.budgetBytes ?? 0;
  useEffect(() => {
    if (state.status !== "done" || !used?.llm) return;
    const key = `${used.llm.auditId}:${state.elapsedMs}`;
    if (recorded.current === key) return;
    recorded.current = key;
    const entry = measurementEntry(
      {
        ...proposalSettings(used),
        engine: used.engine,
        advisors: used.advisors,
        sweep: used.sweep !== null,
        llm: used.llm,
      },
      groups.get(null) ?? [],
      budgetBytes,
    );
    if (entry) void appendEntry(entry).catch(() => undefined);
  }, [state.status, state.elapsedMs, used, groups, budgetBytes]);

  const running = state.status === "running";
  const total = state.setup?.total ?? (used ? used.replicates * (used.sweep?.length ?? 1) : 0);
  const progress = total ? state.done / total : 0;
  const dataset = DATASETS[used?.dataset ?? config.dataset];
  const context = used
    ? {
        dataset: used.dataset,
        engine: used.engine,
        scenario: used.sweep ? "drifting (sweep)" : used.scenario,
        drift: used.sweep
          ? used.sweep.join("/")
          : used.scenario === "drifting"
            ? used.drift
            : "n/a",
        rounds: used.rounds,
        replicates: used.replicates,
        first_seed: used.seed,
      }
    : null;

  const exportCsv = () =>
    download(
      `sddb-benchmark-${used?.dataset}-${used?.engine}.csv`,
      [...groups.entries()]
        .map(([drift, rs]) =>
          replicatesToCsv(rs, {
            dataset: used?.dataset ?? "",
            engine: used?.engine ?? "",
            scenario: drift === null ? (used?.scenario ?? "") : "drifting",
            drift: String(drift ?? (used?.scenario === "drifting" ? used.drift : "")),
          }),
        )
        .map((csv, i) => (i === 0 ? csv : csv.split("\n").slice(1).join("\n")))
        .join(""),
      "text/csv",
    );
  const exportJson = () =>
    download(
      `sddb-benchmark-${used?.dataset}-${used?.engine}.json`,
      JSON.stringify(
        {
          generated: new Date().toISOString(),
          site: "Self-Driving DB Lab benchmark",
          settings: {
            ...used,
            llm: used?.llm
              ? { config: used.llm.config, model: used.llm.model, latencyMs: used.llm.latencyMs }
              : null,
          },
          budgetBytes: state.setup?.budgetBytes,
          dataBytes: state.setup?.info.dataBytes,
          sqliteVersion: state.setup?.info.sqliteVersion,
          metric,
          baseline: comparator,
          summaries: summaries.map(({ drift, summary }) => ({ drift, summary })),
          replicates: state.results,
        },
        null,
        2,
      ),
      "application/json",
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Benchmark settings">
          <Panel className="p-4">
            <BenchControls
              config={config}
              onChange={setConfig}
              running={running}
              onRun={run}
              onStop={stop}
            />
          </Panel>
        </aside>

        <section
          ref={results}
          aria-labelledby="bench-results"
          className="min-w-0 scroll-mt-20 space-y-5"
        >
          <h2 id="bench-results" className="sr-only">
            Results
          </h2>
          <Panel className="overflow-hidden">
            <div
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-5"
              aria-live="polite"
            >
              <span className="flex items-center gap-2 text-sm">
                {running ? (
                  <LoaderCircle className="text-mint size-4 animate-spin" aria-hidden />
                ) : state.status === "error" ? (
                  <TriangleAlert className="text-coral size-4" aria-hidden />
                ) : (
                  <Database className="text-muted-foreground size-4" aria-hidden />
                )}
                {running
                  ? `${state.phase} · ${state.done} of ${total} replicates`
                  : state.status === "done"
                    ? `Finished ${state.done} replicates in ${formatMs(state.elapsedMs ?? 0)}`
                    : state.status === "stopped"
                      ? `Stopped after ${state.done} replicates. The summaries use the complete ones.`
                      : state.status === "error"
                        ? "The benchmark failed"
                        : "Ready"}
              </span>
              {state.setup && used && (
                <span className="text-muted-foreground font-mono text-xs">
                  {dataset.short} ·{" "}
                  {used.engine === "sqlite"
                    ? `SQLite ${state.setup.info.sqliteVersion ?? ""}`
                    : "simulated engine"}{" "}
                  · {used.sweep ? "drift sweep" : SCENARIOS[used.scenario].label.toLowerCase()} ·{" "}
                  {used.rounds} rounds · budget {formatBytes(state.setup.budgetBytes)}
                </span>
              )}
            </div>
            {running && (
              <div
                className="bg-surface-2 h-1"
                role="progressbar"
                aria-label="Benchmark progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div
                  className="bg-mint h-full transition-[width] duration-300"
                  style={{ width: `${Math.max(2, progress * 100)}%` }}
                />
              </div>
            )}
          </Panel>

          {state.status === "error" && (
            <Panel className="border-coral/50 p-5 text-sm">
              <p className="font-medium">Something went wrong in the worker.</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">{state.error}</p>
            </Panel>
          )}

          {!detail && state.status !== "error" && (
            <Panel className="bg-console-grid relative overflow-hidden">
              <div className="from-surface/40 to-surface relative bg-gradient-to-b p-6 sm:p-10">
                <Sigma className="text-mint size-8" aria-hidden />
                <h3 className="mt-4 text-2xl font-semibold">One run is an anecdote</h3>
                <div className="prose-lab mt-3 max-w-2xl text-sm">
                  <p>
                    The benchmark repeats the arena R times, each on its own seeded workload, and
                    reports every advisor&apos;s mean cumulative workload time with a 95% bootstrap
                    interval. Advisors replay the same workloads, in a seeded random order after one
                    discarded warm-up replicate, so the comparison against the greedy what-if
                    advisor (AutoAdmin) is paired: the difference, the change, the effect size d_z,
                    an exact sign test and the share of replicates won.
                  </p>
                  <p>
                    The intervals are conditional on this browser session: they describe how results
                    vary from workload to workload, not from run to run. Running the same seeds
                    again moves measured times by more than that, so compare two runs before
                    trusting a small difference.
                  </p>
                  <p>
                    The bandit&apos;s regret is measured against a hindsight reference: the
                    configuration CoPhy&apos;s branch and bound finds best, under the what-if model,
                    for the whole workload, and the page says whether it proved it optimal. The
                    drift sweep repeats everything at five levels between a static and a shifting
                    workload. How each number is computed is on the{" "}
                    <Link href="/methods#evaluation">methods page</Link>.
                  </p>
                </div>
                <Button className="mt-5" onClick={() => run(false)} disabled={running}>
                  Run the default benchmark
                </Button>
              </div>
            </Panel>
          )}

          {detail && used && (
            <>
              <Panel className="p-4 sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <DisplayOptions
                    metric={metric}
                    onMetric={setMetric}
                    baseline={comparator}
                    onBaseline={setBaseline}
                    options={ran}
                  />
                  <ExportButtons onCsv={exportCsv} onJson={exportJson} />
                </div>
                {sweepPoints.length > 1 && (
                  <label className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                    <span className="kicker">Details for drift</span>
                    <select
                      value={String(shownDrift ?? sweepPoints[sweepPoints.length - 1].drift)}
                      onChange={(e) => setShownDrift(Number(e.target.value))}
                      className="border-input bg-surface rounded-md border px-2 py-1.5 text-sm"
                    >
                      {sweepPoints.map((p) => (
                        <option key={p.drift} value={p.drift}>
                          {p.drift.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {context && (
                  <p className="text-muted-foreground mt-3 font-mono text-[11px] break-words">
                    {Object.entries(context)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(" · ")}
                  </p>
                )}
              </Panel>
              <DriftPanel points={sweepPoints} />
              <MeansPanel summary={detail} llmModel={used.llm?.model} />
              <PairedPanel summary={detail} llmModel={used.llm?.model} />
              <RegretPanel summary={detail} />
            </>
          )}
        </section>
      </div>

      <section aria-labelledby="llm-h" className="space-y-5">
        <div className="max-w-3xl space-y-2 pt-6">
          <p className="kicker text-mint">Optional · bring your own key</p>
          <h2 id="llm-h" className="text-3xl font-semibold">
            Evaluating an LLM as an index advisor
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Ask your own model for a configuration, review it, then tick &ldquo;LLM advisor&rdquo;
            in the settings and run the benchmark: the same seeded workloads, the same paired
            statistics, against the greedy what-if advisor and the bandit. Compare on &ldquo;build +
            run&rdquo; time, since a provider&apos;s response time says nothing about the advice.
            Each measurement is linked to its call in the{" "}
            <Link href="/ai-log" className="text-foreground decoration-mint underline">
              audit log
            </Link>
            .
          </p>
        </div>
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <LlmAdvisorPanel
            level={3}
            request={{
              dataset: config.dataset,
              scale: config.scale,
              seed: config.seed,
              scenario: config.scenario,
              drift: config.drift,
              rounds: config.rounds,
              budget: config.budget,
            }}
            plan={config.llm}
            onPlan={(plan) =>
              setRaw((c) =>
                plan
                  ? {
                      // Accepting returns the settings to the ones the model saw.
                      ...c,
                      ...plan.request,
                      llm: plan,
                      advisors: c.advisors.includes("llm") ? c.advisors : [...c.advisors, "llm"],
                    }
                  : { ...c, llm: null },
              )
            }
          />
          <InvalidRatePanel />
        </div>
      </section>
    </div>
  );
}

/** The invalid-proposal rates of the LLM calls logged in this browser, per model group. */
function InvalidRatePanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => {
    const load = () =>
      listEntries()
        .then(setEntries)
        .catch(() => setEntries([]));
    load();
    return onAuditChange(load);
  }, []);
  return (
    <Panel>
      <PanelHeader
        title="Invalid-proposal rate"
        sub="Per model, prompt version and dataset, over the LLM advisor calls logged in this browser. 95% intervals."
      />
      <div className="space-y-3 p-4 sm:p-5">
        <InvalidRateGroups rates={invalidRates(entries)} />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Every model output is shown with an <AiGeneratedLabel className="mx-0.5" /> label.
        </p>
      </div>
    </Panel>
  );
}
