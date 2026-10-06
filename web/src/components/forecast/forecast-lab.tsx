"use client";

import { LoaderCircle, RotateCcw, Shuffle, TriangleAlert } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/shared/section";
import { RangeField } from "@/components/shared/range-field";
import { Segmented } from "@/components/shared/segmented";
import { useLabWorker } from "@/hooks/use-lab-worker";
import { formatMs } from "@/lib/format";
import { DEFAULT_SETTINGS, type ForecastSettings, type ForecastView } from "@/lib/forecast/view";
import type { LabResponse } from "@/workers/protocol";
import { ClusterGrid } from "./cluster-grid";
import { ForecastChart } from "./forecast-chart";
import { LoopResults } from "./loop-results";

const same = (a: ForecastSettings, b: ForecastSettings) =>
  a.seed === b.seed &&
  a.horizon === b.horizon &&
  a.rho === b.rho &&
  a.windowHours === b.windowHours &&
  a.budget === b.budget;

export function ForecastLab({ initial }: { initial: ForecastView }) {
  const [settings, setSettings] = useState<ForecastSettings>(initial.settings);
  const [view, setView] = useState<ForecastView>(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const latest = useRef(settings);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMessage = useCallback((msg: LabResponse) => {
    if (msg.type === "forecast:result") {
      if (!same(msg.view.settings, latest.current)) return; // superseded
      setView(msg.view);
      setLastMs(msg.ms);
      setPending(false);
    } else if (msg.type === "error") {
      setError(msg.message);
      setPending(false);
    }
  }, []);
  const { post } = useLabWorker(onMessage);

  const update = (patch: Partial<ForecastSettings>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    if (same(next, view.settings)) {
      setPending(false);
      return;
    }
    setPending(true);
    timer.current = setTimeout(() => post({ type: "forecast:run", settings: next }), 180);
  };

  return (
    <div className="space-y-16">
      <Panel className="border-border/90 bg-surface/95 backdrop-blur-md lg:sticky lg:top-16 lg:z-30">
        <form
          className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_auto] lg:items-end"
          onSubmit={(e) => e.preventDefault()}
          aria-label="Forecasting lab settings"
        >
          <Segmented
            label="Forecast horizon"
            value={String(settings.horizon)}
            onChange={(v) => update({ horizon: Number(v) })}
            options={[1, 3, 6, 12, 24].map((h) => ({
              value: String(h),
              label: `${h} h`,
              hint: `Predict the volume ${h} hour${h === 1 ? "" : "s"} ahead`,
            }))}
          />
          <RangeField
            label="Cluster threshold ρ"
            value={settings.rho}
            min={0.3}
            max={0.95}
            step={0.05}
            onChange={(v) => update({ rho: Number(v.toFixed(2)) })}
            format={(v) => v.toFixed(2)}
          />
          <Segmented
            label="Tuning window"
            value={String(settings.windowHours)}
            onChange={(v) => update({ windowHours: Number(v) })}
            options={[1, 3, 6].map((h) => ({ value: String(h), label: `${h} h` }))}
          />
          <RangeField
            label="Index budget"
            value={settings.budget}
            min={0.1}
            max={1}
            step={0.05}
            onChange={(v) => update({ budget: Number(v.toFixed(2)) })}
            format={(v) => `${Math.round(v * 100)}% of data`}
          />
          <div className="flex items-end gap-1.5 sm:col-span-2 lg:col-span-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => update({ seed: 1 + Math.floor(Math.random() * 99_998) })}
              title="Generate a new three-week trace"
            >
              <Shuffle className="size-3.5" aria-hidden /> New trace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => update(DEFAULT_SETTINGS)}
              aria-label="Reset settings to defaults"
              title="Reset settings"
            >
              <RotateCcw className="size-4" aria-hidden />
            </Button>
          </div>
        </form>
        <div
          className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2 font-mono text-[11px]"
          aria-live="polite"
        >
          {error ? (
            <span className="text-coral flex items-center gap-1.5">
              <TriangleAlert className="size-3.5" aria-hidden /> {error}
            </span>
          ) : pending ? (
            <span className="text-foreground flex items-center gap-1.5">
              <LoaderCircle className="text-mint size-3.5 animate-spin" aria-hidden />
              Recomputing in a Web Worker…
            </span>
          ) : (
            <span>
              {lastMs === null
                ? "Default run, computed when the site was built."
                : `Recomputed in your browser in ${formatMs(lastMs)}.`}
            </span>
          )}
          <span>trace seed {view.settings.seed}</span>
          <span>{view.totalStatements.toLocaleString("en-AU")} statements over 21 days</span>
        </div>
      </Panel>

      <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        <section aria-labelledby="cluster" className="space-y-6">
          <StepHeading n={2} id="cluster" title="Cluster templates that rise and fall together">
            Forecasting every template separately does not scale, so QB5000&apos;s clusterer groups
            templates by the shape of their arrival-rate history: a template joins the cluster whose
            centre is most similar (cosine similarity above ρ; the paper uses 0.8), and clusters
            whose centres converge are merged. The trace below was generated from three hidden
            behaviours — office-hours ordering, a nightly shipping batch with a Monday spike, and
            evening browsing — so a good clustering finds three groups. Lower ρ and they collapse.
          </StepHeading>
          <ClusterGrid view={view} />
        </section>

        <section aria-labelledby="forecast" className="mt-16 space-y-6">
          <StepHeading n={3} id="forecast" title="Forecast each cluster's volume">
            Each cluster&apos;s hourly volume is forecast {view.settings.horizon} hour
            {view.settings.horizon === 1 ? "" : "s"} ahead on the log scale. Linear regression looks
            at the last day; kernel regression compares the last week with every week it has seen,
            so it remembers periodic spikes. QB5000&apos;s HYBRID rule trusts kernel regression only
            when it predicts a spike more than 150% above the regular forecast. Accuracy is the mean
            squared error of log volumes on the held-out third week, as in the paper.
          </StepHeading>
          <ForecastChart view={view} />
        </section>

        <section aria-labelledby="loop" className="mt-16 space-y-6">
          <StepHeading n={4} id="loop" title="Tune before the demand arrives">
            This is the loop Kossmann and Schlosser describe and our report built on: the predictor
            hands a forecast to a tuner, and the organiser applies the tuner&apos;s configuration
            before each {view.loop.windowHours}-hour window starts. The tuner is AutoAdmin&apos;s
            Greedy search under a {Math.round(view.settings.budget * 100)}% storage budget; costs
            are the what-if model&apos;s estimates in milliseconds for the test week&apos;s real
            statements, plus the time to build each new index. The forecast-driven tuner only sees
            data from before each window: it uses {view.loop.forecastHorizon}-hour-ahead forecasts
            {view.loop.forecastHorizon > view.settings.horizon
              ? `, refitted for the loop because a ${view.settings.horizon}-hour forecast of a ${view.loop.windowHours}-hour window would peek inside it`
              : ""}
            .
          </StepHeading>
          <LoopResults view={view} />
        </section>
      </div>
    </div>
  );
}

export function StepHeading({
  n,
  id,
  title,
  children,
}: {
  n: number;
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[3.5rem_minmax(0,1fr)]">
      <span
        className="font-display text-mint tabular text-4xl font-semibold md:text-5xl"
        aria-hidden
      >
        {String(n).padStart(2, "0")}
      </span>
      <div className="max-w-3xl space-y-2">
        <h2 id={id} className="text-2xl font-semibold sm:text-3xl">
          {title}
        </h2>
        <p className="text-muted-foreground leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
