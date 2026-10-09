"use client";

import { Play, RotateCcw, Square, Waves } from "lucide-react";
import { ARENA_ADVISORS } from "@/components/arena/controls";
import { advisorColor } from "@/components/arena/state";
import { RangeField } from "@/components/shared/range-field";
import { Segmented } from "@/components/shared/segmented";
import { Button } from "@/components/ui/button";
import type { AdvisorId } from "@/lib/advisors/types";
import { DATASETS, DATASET_IDS } from "@/lib/datasets/registry";
import { SCALES } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { SCENARIOS, SCENARIO_IDS, scenarioBlurb, type ScenarioId } from "@/lib/workload/scenarios";
import type { BenchRunConfig } from "@/workers/protocol";
import { SWEEP, defaultBench } from "./state";

interface Props {
  config: BenchRunConfig;
  onChange: (c: BenchRunConfig) => void;
  running: boolean;
  onRun: (sweep: boolean) => void;
  onStop: () => void;
}

export function BenchControls({ config, onChange, running, onRun, onStop }: Props) {
  const set = <K extends keyof BenchRunConfig>(key: K, value: BenchRunConfig[K]) =>
    onChange({ ...config, [key]: value });
  const toggle = (id: AdvisorId) => {
    const has = config.advisors.includes(id);
    const next = has ? config.advisors.filter((a) => a !== id) : [...config.advisors, id];
    set(
      "advisors",
      ARENA_ADVISORS.map((a) => a.id).filter((a) => next.includes(a)),
    );
  };
  const dataset = DATASETS[config.dataset];
  const needsPlan = config.advisors.includes("llm") && !config.llm;
  const blocked = config.advisors.length === 0 || needsPlan;
  const runs = config.replicates * (config.advisors.length + 1);

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running && !blocked) onRun(false);
      }}
    >
      <Segmented
        label="Dataset"
        value={config.dataset}
        disabled={running}
        onChange={(v) => set("dataset", v)}
        options={DATASET_IDS.map((d) => ({
          value: d,
          label: DATASETS[d].short,
          hint: DATASETS[d].label,
        }))}
      />
      <Segmented
        label="Engine"
        value={config.engine}
        disabled={running}
        onChange={(v) => set("engine", v)}
        options={[
          {
            value: "sqlite",
            label: "SQLite · measured",
            hint: "Wall-clock timings in WebAssembly",
          },
          { value: "simulated", label: "Simulated", hint: "Cost-model engine with noise, fast" },
        ]}
      />
      <div>
        <Segmented
          label="Workload"
          value={config.scenario}
          disabled={running}
          onChange={(v) => set("scenario", v as ScenarioId)}
          options={SCENARIO_IDS.map((s) => ({ value: s, label: SCENARIOS[s].label }))}
        />
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          {scenarioBlurb(config.scenario, dataset.suite)}
        </p>
      </div>
      {config.scenario === "drifting" && (
        <RangeField
          label="Drift"
          value={config.drift}
          min={0}
          max={1}
          step={0.25}
          disabled={running}
          onChange={(v) => set("drift", v)}
          format={(v) => `${Math.round(v * 100)}% focused`}
        />
      )}
      {dataset.scalable && (
        <Segmented
          label="Data size"
          value={config.scale}
          disabled={running}
          onChange={(v) => set("scale", v)}
          options={Object.values(SCALES).map((s) => ({
            value: s.id,
            label: s.label.split(" · ")[0],
            hint: s.label,
          }))}
        />
      )}
      <RangeField
        label="Replicates (R)"
        value={config.replicates}
        min={5}
        max={30}
        step={5}
        disabled={running}
        onChange={(v) => set("replicates", v)}
        hint={`Replicate r runs workload seed ${config.seed} + r. Every advisor replays the same workloads, so comparisons are paired.`}
      />
      <RangeField
        label="Rounds"
        value={config.rounds}
        min={10}
        max={40}
        step={5}
        disabled={running}
        onChange={(v) => set("rounds", v)}
      />
      <RangeField
        label="Index budget"
        value={config.budget}
        min={0.25}
        max={3}
        step={0.25}
        disabled={running}
        onChange={(v) => set("budget", v)}
        format={(v) => `${Math.round(v * 100)}% of data`}
      />

      <fieldset disabled={running}>
        <legend className="kicker mb-1.5">Advisors</legend>
        <ul className="grid gap-1">
          {ARENA_ADVISORS.map((a) => {
            const on = config.advisors.includes(a.id);
            return (
              <li key={a.id}>
                <label
                  className={cn(
                    "hover:bg-surface-2 has-[:focus-visible]:outline-ring flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm has-[:focus-visible]:outline-2",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() => toggle(a.id)}
                  />
                  <span
                    aria-hidden
                    className="flex size-4 items-center justify-center rounded-[4px] border-2"
                    style={{
                      borderColor: advisorColor(a.id),
                      background: on ? advisorColor(a.id) : "transparent",
                    }}
                  />
                  <span className="flex-1">
                    {a.id === "autoadmin" ? "AutoAdmin (greedy what-if)" : a.name}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          The hindsight reference always runs too: it is the yardstick for the bandit&apos;s regret.
        </p>
        {needsPlan && (
          <p className="text-muted-foreground mt-1.5 text-xs" role="status">
            The LLM advisor needs an approved proposal: see the LLM section below.
          </p>
        )}
      </fieldset>

      <details className="border-border bg-surface-2/50 rounded-lg border px-3 py-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
          Advanced settings
        </summary>
        <div className="mt-3 space-y-4 pb-1">
          <RangeField
            label="MAB exploration α"
            value={config.mabAlpha}
            min={0.25}
            max={4}
            step={0.25}
            disabled={running}
            onChange={(v) => set("mabAlpha", v)}
            format={(v) => v.toFixed(2)}
          />
          <RangeField
            label="What-if call cost"
            value={config.whatIfLatencyMs}
            min={0}
            max={0.2}
            step={0.01}
            disabled={running}
            onChange={(v) => set("whatIfLatencyMs", v)}
            format={(v) => `${v.toFixed(2)} ms`}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>First workload seed</span>
            <input
              type="number"
              value={config.seed}
              min={1}
              max={99999}
              disabled={running}
              onChange={(e) =>
                set("seed", Math.max(1, Math.min(99999, Number(e.target.value) || 1)))
              }
              className="border-input bg-surface w-24 rounded-md border px-2 py-1 text-right font-mono text-sm"
            />
          </label>
        </div>
      </details>

      <div className="space-y-2">
        <div className="flex gap-2">
          {running ? (
            <Button
              key="stop"
              type="button"
              variant="outline"
              className="flex-1"
              onClick={(e) => {
                e.preventDefault();
                onStop();
              }}
            >
              <Square className="size-3.5" aria-hidden /> Stop
            </Button>
          ) : (
            <Button key="run" type="submit" className="flex-1" disabled={blocked}>
              <Play className="size-3.5" aria-hidden /> Run benchmark
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={running}
            onClick={() => onChange({ ...defaultBench(config.dataset), llm: config.llm })}
            aria-label="Reset settings to defaults"
            title="Reset settings"
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={running || blocked}
          onClick={() => onRun(true)}
        >
          <Waves className="size-3.5" aria-hidden /> Drift sweep ({SWEEP.length} levels)
        </Button>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {runs} runs of {config.rounds} rounds per benchmark
          {config.engine === "sqlite"
            ? ". About 10 to 30 seconds on SQLite, five times that for the sweep."
            : ". A few seconds on the simulated engine."}
        </p>
      </div>
    </form>
  );
}
