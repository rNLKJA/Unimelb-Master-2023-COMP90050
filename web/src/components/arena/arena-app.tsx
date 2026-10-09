"use client";

import { Database, FlaskConical, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useReducer, useRef, useState } from "react";
import { LlmAdvisorPanel } from "@/components/ai/llm-advisor-panel";
import { ADVISOR_BY_ID } from "@/lib/advisors/registry";
import { DATASETS, isDatasetId, type DatasetId } from "@/lib/datasets/registry";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { useLabWorker } from "@/hooks/use-lab-worker";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/section";
import type { ArenaConfig, LabResponse } from "@/workers/protocol";
import { ArenaControls } from "./controls";
import {
  ConfigMap,
  FinalPlans,
  Leaderboard,
  MabInspector,
  TemplateTable,
  TimeCharts,
} from "./results";
import { INITIAL, defaultConfig, reducer } from "./state";

/** The arena with its dataset taken from the URL (/arena?dataset=louvre). */
export function ArenaFromUrl() {
  const dataset = useSearchParams().get("dataset");
  const initial: DatasetId = isDatasetId(dataset) ? dataset : "tpch";
  return <ArenaApp key={initial} initialDataset={initial} />;
}

/**
 * A plan is proposed for one dataset and storage budget; changing either
 * drops it, because its indexes may no longer exist or fit.
 */
function keepPlan(prev: ArenaConfig, next: ArenaConfig): ArenaConfig {
  return next.llm && (next.dataset !== prev.dataset || next.budget !== prev.budget)
    ? { ...next, llm: null }
    : next;
}

export function ArenaApp({ initialDataset = "tpch" }: { initialDataset?: DatasetId }) {
  const [config, setRawConfig] = useState<ArenaConfig>(() => defaultConfig(initialDataset));
  const setConfig = (next: ArenaConfig) => setRawConfig((prev) => keepPlan(prev, next));
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const onMessage = useCallback((msg: LabResponse) => dispatch({ type: "msg", msg }), []);
  const { post, restart } = useLabWorker(onMessage);
  const results = useRef<HTMLElement>(null);

  const run = (c: ArenaConfig = config) => {
    restart();
    dispatch({ type: "start", config: c });
    post({ type: "arena:run", config: c });
    // On phones the settings sit above the results; bring the progress into view.
    if (window.matchMedia("(max-width: 1023px)").matches)
      results.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const runDefault = () => {
    const c = defaultConfig(config.dataset);
    setConfig(c);
    run(c);
  };
  const stop = () => {
    restart();
    dispatch({ type: "stop" });
  };

  const running = state.status === "running";
  const used = state.config;
  const done = used ? used.advisors.filter((a) => state.runs[a]?.totals).length : 0;
  const currentRounds = state.current ? (state.runs[state.current]?.rounds.length ?? 0) : 0;
  const progress = used
    ? (done * used.rounds +
        (state.current && !state.runs[state.current]?.totals ? currentRounds : 0)) /
      (used.advisors.length * used.rounds)
    : 0;
  const hasResults = Object.keys(state.runs).length > 0;
  const dataset = DATASETS[config.dataset];
  const usedDataset = DATASETS[used?.dataset ?? config.dataset];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start" aria-label="Experiment settings">
        <Panel className="p-4">
          <ArenaControls
            config={config}
            onChange={setConfig}
            running={running}
            onRun={() => run()}
            onStop={stop}
          />
        </Panel>
      </aside>

      <section
        ref={results}
        aria-labelledby="arena-results"
        className="min-w-0 scroll-mt-20 space-y-5"
      >
        <h2 id="arena-results" className="sr-only">
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
                ? state.current
                  ? `Running ${ADVISOR_BY_ID.get(state.current)?.name} · round ${currentRounds} of ${used?.rounds}`
                  : state.phase
                : state.status === "done"
                  ? `Finished in ${formatMs(state.elapsedMs ?? 0)}`
                  : state.status === "stopped"
                    ? hasResults
                      ? "Stopped. The rounds that finished are shown below."
                      : "Stopped before the first round finished."
                    : state.status === "error"
                      ? "The experiment failed"
                      : "Ready"}
            </span>
            {state.setup && (
              <span className="text-muted-foreground font-mono text-xs">
                {usedDataset.short} ·{" "}
                {formatInt(state.setup.info.rows[usedDataset.headlineTable] ?? 0)}{" "}
                {usedDataset.headlineNoun} · {formatBytes(state.setup.info.dataBytes)} data · budget{" "}
                {formatBytes(state.setup.budgetBytes)}
                {used?.engine === "sqlite" && state.setup.info.sqliteVersion
                  ? ` · SQLite ${state.setup.info.sqliteVersion}`
                  : " · simulated engine"}
              </span>
            )}
          </div>
          {running && (
            <div
              className="bg-surface-2 h-1"
              role="progressbar"
              aria-label="Experiment progress"
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
            <Button className="mt-3" variant="outline" onClick={() => run()}>
              Try again
            </Button>
          </Panel>
        )}

        {config.advisors.includes("llm") && (
          <LlmAdvisorPanel
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
            onPlan={(plan) => setRawConfig((c) => ({ ...c, llm: plan }))}
          />
        )}

        {!hasResults && state.status !== "error" && (
          <Panel className="bg-console-grid relative overflow-hidden">
            <div className="from-surface/40 to-surface relative bg-gradient-to-b p-6 sm:p-10">
              <FlaskConical className="text-mint size-8" aria-hidden />
              <h3 className="mt-4 text-2xl font-semibold">Pick a workload, then press run</h3>
              <div className="prose-lab mt-3 max-w-2xl text-sm">
                <p>
                  {dataset.id === "louvre"
                    ? "The worker downloads the Louvre database from INFO20003 (1.2 MB compressed), loads its 19 tables into SQLite compiled to WebAssembly without any secondary index, and replays the same rounds of box-office, gallery and exhibition queries once per advisor."
                    : "The worker generates a TPC-H-like database (about 30,000 line items at size S), loads it into SQLite compiled to WebAssembly, and replays the same rounds of queries once per advisor."}{" "}
                  Before each round an advisor may build or drop indexes; every millisecond it
                  spends recommending, building and querying is counted.
                </p>
                <p>
                  Offline tools (DROP, AutoAdmin, DB2 Advisor, CoPhy) are invoked at the start of
                  round 2 with round 1 as their representative workload, and again after a shift —
                  the protocol Perera et al. used for their commercial baseline. The bandit tunes
                  every round from observed runtimes.
                </p>
              </div>
              <Button className="mt-5" onClick={runDefault} disabled={running}>
                Run the default experiment
              </Button>
            </div>
          </Panel>
        )}

        {hasResults && (
          <>
            <p className="text-muted-foreground px-1 text-xs">
              One run on one seeded workload. For repeated runs with 95% confidence intervals,
              paired comparisons and the bandit&apos;s regret, open the{" "}
              <Link
                href={`/benchmark?dataset=${used?.dataset ?? config.dataset}`}
                className="text-foreground decoration-mint underline underline-offset-2"
              >
                benchmark
              </Link>
              .
            </p>
            <Leaderboard state={state} />
            <TimeCharts state={state} />
            <ConfigMap state={state} />
            <TemplateTable state={state} />
            <MabInspector state={state} />
            <FinalPlans state={state} />
          </>
        )}
      </section>
    </div>
  );
}
