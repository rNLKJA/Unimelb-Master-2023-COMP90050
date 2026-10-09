"use client";

import { LoaderCircle, Play, RefreshCw, Square, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/shared/section";
import { PlanTree } from "@/components/shared/plan-tree";
import { Segmented } from "@/components/shared/segmented";
import { useLabWorker } from "@/hooks/use-lab-worker";
import type { ScalePreset } from "@/lib/db/schema";
import { SCALES } from "@/lib/db/schema";
import type { IndexDef } from "@/lib/engine/types";
import { formatBytes, formatInt, formatMs } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  ConsoleExampleInfo,
  ConsoleResult,
  DatabaseInfo,
  LabResponse,
} from "@/workers/protocol";
import { IndexPanel, SchemaPanel } from "./side-panels";
import { ResultTable } from "./result-table";
import { WhatIfPanel } from "./what-if-panel";

const SEED = 2023;

interface State {
  status: "loading" | "ready" | "error";
  phase: string;
  info: DatabaseInfo | null;
  examples: ConsoleExampleInfo[];
  indexes: { index: IndexDef; bytes: number }[];
  result: ConsoleResult | null;
  /** The statement `result` belongs to. */
  ran: { sql: string; exampleId?: string } | null;
  running: boolean;
  sqlError: string | null;
  fatal: string | null;
  notice: string | null;
}

const INITIAL: State = {
  status: "loading",
  phase: "Starting the worker",
  info: null,
  examples: [],
  indexes: [],
  result: null,
  ran: null,
  running: false,
  sqlError: null,
  fatal: null,
  notice: null,
};

export function ConsoleApp() {
  const [scale, setScale] = useState<ScalePreset["id"]>("s");
  const [state, setState] = useState<State>(INITIAL);
  const [sql, setSql] = useState("");
  const [exampleId, setExampleId] = useState<string | undefined>(undefined);
  const pendingRun = useRef<{ sql: string; exampleId?: string } | null>(null);
  const lastRun = useRef<{ sql: string; exampleId?: string } | null>(null);

  const onMessage = useCallback((msg: LabResponse) => {
    switch (msg.type) {
      case "status":
        setState((s) => ({ ...s, phase: msg.phase }));
        break;
      case "console:ready": {
        const first = msg.examples.find((e) => e.id === "Q3") ?? msg.examples[0];
        setState((s) => ({
          ...s,
          status: "ready",
          info: msg.info,
          examples: msg.examples,
          indexes: [],
          result: null,
          ran: null,
          sqlError: null,
          notice: null,
        }));
        if (first) {
          setSql(first.sql);
          setExampleId(first.id);
        }
        break;
      }
      case "console:result":
        lastRun.current = pendingRun.current;
        setState((s) => ({
          ...s,
          running: false,
          result: msg.result,
          ran: pendingRun.current,
          sqlError: null,
        }));
        break;
      case "console:error":
        setState((s) => ({ ...s, running: false, sqlError: msg.message }));
        break;
      case "console:indexes":
        setState((s) => ({
          ...s,
          indexes: msg.indexes,
          notice: `${msg.action === "create" ? "Built" : "Dropped"} in ${formatMs(msg.ms)}${
            lastRun.current ? " · re-running the last statement" : ""
          }`,
        }));
        break;
      case "error":
        setState((s) => ({ ...s, status: "error", running: false, fatal: msg.message }));
        break;
    }
  }, []);
  const { post, restart } = useLabWorker(onMessage);

  // Re-run the last statement after an index change so the plan updates in place.
  const rerunAfterIndex = useRef(false);
  useEffect(() => {
    if (!rerunAfterIndex.current || !lastRun.current) return;
    rerunAfterIndex.current = false;
    pendingRun.current = lastRun.current;
    post({ type: "console:exec", ...lastRun.current });
  }, [state.indexes, post]);

  const open = useCallback(
    (s: ScalePreset["id"]) => {
      restart();
      lastRun.current = null;
      post({ type: "console:open", scale: s, seed: SEED });
    },
    [post, restart],
  );

  useEffect(() => {
    post({ type: "console:open", scale: "s", seed: SEED });
  }, [post]);

  const ready = state.status === "ready";

  const run = () => {
    if (!ready || state.running || sql.trim() === "") return;
    pendingRun.current = { sql, exampleId };
    setState((s) => ({ ...s, running: true, sqlError: null, notice: null }));
    post({ type: "console:exec", sql, exampleId });
  };

  const indexAction = (action: "create" | "drop", index: IndexDef) => {
    if (!ready) return;
    rerunAfterIndex.current = true;
    post({ type: "console:index", action, index });
  };

  const reload = (s: ScalePreset["id"]) => {
    setScale(s);
    setState({ ...INITIAL, phase: "Reloading the database" });
    open(s);
  };

  const pick = (e: ConsoleExampleInfo) => {
    setSql(e.sql);
    setExampleId(e.id);
  };

  const templated = state.examples.filter((e) => e.templated);
  const catalogue = state.examples.filter((e) => !e.templated);
  const current = state.examples.find((e) => e.id === exampleId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
      {/* The query editor comes first in the DOM so phones reach it before the sidebar. */}
      <section className="min-w-0 space-y-5 lg:col-start-2 lg:row-start-1" aria-label="SQL console">
        {state.status === "error" && (
          <Panel className="border-coral/50 p-5 text-sm">
            <p className="flex items-center gap-2 font-medium">
              <TriangleAlert className="text-coral size-4" aria-hidden /> The database worker
              failed.
            </p>
            <p className="text-muted-foreground mt-1 font-mono text-xs">{state.fatal}</p>
            <Button className="mt-3" variant="outline" onClick={() => reload(scale)}>
              Try again
            </Button>
          </Panel>
        )}

        <Panel>
          <PanelHeader
            level={2}
            title="Query"
            sub="One statement at a time. Ctrl/⌘ + Enter runs it. The database lives only in this tab."
          />
          <div className="space-y-3 p-4 sm:p-5">
            {state.examples.length > 0 ? (
              <div className="space-y-2">
                <ExampleRow label="Templates" items={templated} active={exampleId} onPick={pick} />
                <ExampleRow label="Catalogue" items={catalogue} active={exampleId} onPick={pick} />
              </div>
            ) : (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <LoaderCircle className="text-mint size-4 animate-spin" aria-hidden /> {state.phase}
                …
              </p>
            )}
            <label className="block">
              <span className="sr-only">SQL statement</span>
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
                rows={5}
                spellCheck={false}
                placeholder={ready ? "SELECT …" : "Loading SQLite…"}
                className="border-input block w-full resize-y rounded-lg border bg-[oklch(0.17_0.032_262)] px-3.5 py-3 font-mono text-[13px] leading-relaxed text-[oklch(0.92_0.02_250)] caret-[oklch(0.86_0.14_166)] placeholder:text-white/40"
              />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={run}
                disabled={!ready || state.running || sql.trim() === ""}
              >
                {state.running ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Play className="size-3.5" aria-hidden />
                )}
                Run
              </Button>
              {state.running && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => reload(scale)}
                  title="Stop the statement and reload a pristine copy of the database"
                >
                  <Square className="size-3.5" aria-hidden /> Cancel
                </Button>
              )}
              {current && (
                <p className="text-muted-foreground min-w-0 text-xs">
                  <span className="text-mint font-mono">{current.id}</span> · {current.blurb}
                </p>
              )}
            </div>
          </div>
        </Panel>

        <div aria-live="polite" className="space-y-5">
          {state.sqlError && (
            <Panel className="border-coral/50 px-4 py-3 text-sm">
              <p className="text-coral font-medium">SQLite rejected the statement</p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">{state.sqlError}</p>
            </Panel>
          )}
          {state.notice && (
            <p className="text-muted-foreground font-mono text-xs">{state.notice}</p>
          )}
          {state.result && (
            <>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Panel>
                  <PanelHeader
                    title="EXPLAIN QUERY PLAN"
                    sub="What SQLite decided to do. Green rows seek through an index; amber rows read the whole table."
                  />
                  <div className="p-4 sm:p-5">
                    <PlanTree nodes={state.result.plan} />
                    <p className="border-border text-muted-foreground mt-4 border-t pt-3 font-mono text-xs">
                      measured {formatMs(state.result.ms)}
                      {state.result.runs > 1 ? ` (median of ${state.result.runs} runs)` : ""} ·{" "}
                      {state.result.changes > 0
                        ? `${formatInt(state.result.changes)} row${state.result.changes === 1 ? "" : "s"} changed`
                        : `${formatInt(state.result.rows.length)}${state.result.truncated ? "+" : ""} row${
                            state.result.rows.length === 1 ? "" : "s"
                          }`}
                    </p>
                  </div>
                </Panel>
                <WhatIfPanel
                  result={state.result}
                  templated={Boolean(
                    state.ran?.exampleId &&
                    state.examples.find((e) => e.id === state.ran?.exampleId)?.templated,
                  )}
                  disabled={!ready}
                  onBuild={(ix) => indexAction("create", ix)}
                />
              </div>
              <ResultTable result={state.result} />
            </>
          )}
        </div>
      </section>
      <aside
        className="space-y-5 lg:sticky lg:top-20 lg:col-start-1 lg:row-start-1 lg:self-start"
        aria-label="Database and indexes"
      >
        <Panel className="space-y-4 p-4">
          <Segmented
            label="Data size"
            value={scale}
            disabled={!ready && state.status !== "error"}
            onChange={(v) => reload(v)}
            options={Object.values(SCALES).map((s) => ({
              value: s.id,
              label: s.label.split(" · ")[0],
              hint: s.label,
            }))}
          />
          <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
            <span className="font-mono">
              {state.info
                ? `${formatBytes(state.info.dataBytes)} · SQLite ${state.info.sqliteVersion ?? ""}`
                : state.phase}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reload(scale)}
              disabled={!ready && state.status !== "error"}
              title="Reload a pristine copy of the database"
            >
              <RefreshCw className="size-3.5" aria-hidden /> Reset
            </Button>
          </div>
        </Panel>
        <IndexPanel indexes={state.indexes} disabled={!ready} onAction={indexAction} />
        <SchemaPanel rows={state.info?.rows ?? null} />
      </aside>
    </div>
  );
}

function ExampleRow({
  label,
  items,
  active,
  onPick,
}: {
  label: string;
  items: ConsoleExampleInfo[];
  active?: string;
  onPick: (e: ConsoleExampleInfo) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="kicker mr-1 w-20 shrink-0">{label}</span>
      {items.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onPick(e)}
          aria-pressed={active === e.id}
          title={`${e.title}: ${e.blurb}`}
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-xs transition-colors",
            active === e.id
              ? "border-mint/60 bg-mint-soft text-accent-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {e.templated ? e.id : e.title}
        </button>
      ))}
    </div>
  );
}
