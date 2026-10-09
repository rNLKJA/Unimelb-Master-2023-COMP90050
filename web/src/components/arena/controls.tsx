"use client";

import { Play, RotateCcw, Square } from "lucide-react";
import { ADVISORS, LLM_ADVISOR } from "@/lib/advisors/registry";
import type { AdvisorId } from "@/lib/advisors/types";
import { DATASETS, DATASET_IDS } from "@/lib/datasets/registry";
import { SCALES } from "@/lib/db/schema";
import { INFO20003 } from "@/lib/site";
import { SCENARIOS, SCENARIO_IDS, scenarioBlurb, type ScenarioId } from "@/lib/workload/scenarios";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RangeField } from "@/components/shared/range-field";
import { Segmented } from "@/components/shared/segmented";
import { cn } from "@/lib/utils";
import type { ArenaConfig } from "@/workers/protocol";
import { advisorColor, defaultConfig } from "./state";

/** Every advisor the arena offers: the survey's six and the bring-your-own-key LLM. */
export const ARENA_ADVISORS = [...ADVISORS, LLM_ADVISOR];

interface Props {
  config: ArenaConfig;
  onChange: (c: ArenaConfig) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
}

export function ArenaControls({ config, onChange, running, onRun, onStop }: Props) {
  const set = <K extends keyof ArenaConfig>(key: K, value: ArenaConfig[K]) =>
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

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!running) onRun();
      }}
    >
      <div>
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
        <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
          {dataset.blurb}{" "}
          {config.dataset === "louvre" && (
            <a
              href={INFO20003.erd}
              className="text-foreground decoration-mint underline underline-offset-2"
            >
              See its 2020 design
            </a>
          )}
        </p>
      </div>

      <Segmented
        label="Engine"
        value={config.engine}
        disabled={running}
        onChange={(v) => set("engine", v)}
        options={[
          {
            value: "sqlite",
            label: "SQLite · measured",
            hint: "Real SQLite 3.49 in WebAssembly; wall-clock timings",
          },
          {
            value: "simulated",
            label: "Simulated",
            hint: "Deterministic cost-model engine; instant",
          },
        ]}
      />

      <div>
        <Segmented
          label="Workload"
          value={config.scenario}
          disabled={running}
          onChange={(v) => set("scenario", v as ScenarioId)}
          options={SCENARIO_IDS.map((s) => ({
            value: s,
            label: SCENARIOS[s].label,
          }))}
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
          hint="Share of each round drawn from the current phase's group: 0 is static, 1 is shifting."
        />
      )}

      {dataset.scalable ? (
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
      ) : (
        <div>
          <p className="kicker mb-1.5">Data size</p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Fixed: the INFO20003 file, 19 tables and about 66,000 rows of synthetic activity
            (largest table: 19,545 wing scans).
          </p>
        </div>
      )}

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
        hint="Perera et al. gave every tuner a generous budget; at 100% or less the bandit's first choices crowd out later ones."
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
                    "hover:bg-surface-2 has-[:focus-visible]:outline-ring flex cursor-pointer items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-sm has-[:focus-visible]:outline-2",
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
                    className={cn(
                      "flex size-4 items-center justify-center rounded-[4px] border-2 transition-colors",
                    )}
                    style={{
                      borderColor: advisorColor(a.id),
                      background: on ? advisorColor(a.id) : "transparent",
                    }}
                  />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {a.year || "—"}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      {needsPlan && (
        <p className="text-muted-foreground -mt-3 text-xs" role="status">
          The LLM advisor needs an approved proposal first, from the LLM index advisor panel.
        </p>
      )}

      <details className="group border-border bg-surface-2/50 rounded-lg border px-3 py-2">
        <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm select-none">
          Advanced settings
        </summary>
        <div className="mt-3 space-y-4 pb-1">
          <RangeField
            label="What-if call cost"
            value={config.whatIfLatencyMs}
            min={0}
            max={0.2}
            step={0.01}
            disabled={running}
            onChange={(v) => set("whatIfLatencyMs", v)}
            format={(v) => `${v.toFixed(2)} ms`}
            hint="Each optimiser what-if call is a JavaScript function here, so this nominal cost is added to recommendation time."
          />
          <RangeField
            label="MAB exploration α"
            value={config.mabAlpha}
            min={0.25}
            max={4}
            step={0.25}
            disabled={running}
            onChange={(v) => set("mabAlpha", v)}
            format={(v) => v.toFixed(2)}
            hint="The authors used α = 1 for TPC-H (shrinking 5% per round)."
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="block">Allow SQLite skip-scan</span>
              <span className="text-muted-foreground block text-xs">
                A real optimiser surprise the what-if model can&apos;t see.
              </span>
            </span>
            <Switch
              checked={config.skipScan}
              disabled={running || config.engine !== "sqlite"}
              onCheckedChange={(v) => set("skipScan", Boolean(v))}
              aria-label="Allow SQLite skip-scan"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Random seed</span>
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

      <div className="flex gap-2">
        {/* Distinct keys: reusing one <button> and flipping it to type="submit" inside
            the Stop click would let the browser submit the form and restart the run. */}
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
          <Button
            key="run"
            type="submit"
            className="flex-1"
            disabled={config.advisors.length === 0 || needsPlan}
          >
            <Play className="size-3.5" aria-hidden /> Run experiment
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={running}
          onClick={() => onChange(defaultConfig(config.dataset))}
          aria-label="Reset settings to defaults"
          title="Reset settings"
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
