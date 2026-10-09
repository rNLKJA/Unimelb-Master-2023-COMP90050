import { Panel, PanelHeader } from "@/components/shared/section";
import type { SeedSpread } from "@/lib/forecast/seeds";
import type { ForecastSettings } from "@/lib/forecast/view";
import { formatInterval, formatP, pctChange } from "@/lib/stats/format";
import { cn } from "@/lib/utils";

const MODEL_LABEL = {
  lr: "Linear regression (LR)",
  kr: "Kernel regression (KR)",
  hybrid: "HYBRID",
};
const f3 = (x: number) => x.toFixed(3);
const f0 = (x: number) => Math.round(x).toLocaleString("en-AU");

function Cell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td
      className={cn("tabular py-2 pr-3 text-right font-mono text-xs whitespace-nowrap", className)}
    >
      {children}
    </td>
  );
}

/** The forecasting pipeline on ten seeded traces: spread, intervals and paired comparisons. */
export function SeedSpreadPanel({
  spread,
  settings,
}: {
  spread: SeedSpread;
  /** The settings the spread was computed with (the lab's defaults, at build time). */
  settings: ForecastSettings;
}) {
  const n = spread.seeds.length;
  const used = `horizon ${settings.horizon} h, cluster threshold ρ = ${settings.rho}, ${settings.windowHours}-hour tuning windows, budget ${Math.round(settings.budget * 100)}% of the data`;
  return (
    <Panel>
      <PanelHeader
        level={2}
        title={`Across ${n} traces, not one`}
        sub={`The default settings (${used}), not the ones chosen in the lab above, on traces generated from seeds ${spread.seeds[0]} to ${spread.seeds[n - 1]}. Means with 95% percentile-bootstrap intervals over traces (B = ${spread.bootstrap.B}, seed ${spread.bootstrap.seed}). Comparisons are paired by trace.`}
      />
      <div className="grid gap-6 p-4 sm:p-5 xl:grid-cols-2">
        <div
          role="region"
          aria-label="Forecast error across traces"
          tabIndex={0}
          className="overflow-x-auto focus-visible:-outline-offset-2"
        >
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="text-muted-foreground mb-2 text-left text-xs">
              Test-week log MSE, averaged over each trace&apos;s clusters (lower is better).
            </caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Model
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Mean [95% CI]
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  vs LR [95% CI]
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Better / worse
                </th>
              </tr>
            </thead>
            <tbody>
              {spread.models.map((m) => {
                const vs = spread.vsLr.find((x) => x.id === m.id);
                return (
                  <tr key={m.id} className="border-border/50 border-b last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal">
                      {MODEL_LABEL[m.id]}
                    </th>
                    <Cell>
                      {f3(m.mean.estimate)}{" "}
                      <span className="text-muted-foreground">{formatInterval(m.mean, f3)}</span>
                    </Cell>
                    <Cell>
                      {vs ? (
                        <>
                          {pctChange(vs.ratio.estimate)}{" "}
                          <span className="text-muted-foreground">
                            {formatInterval(vs.ratio, (x) => pctChange(x))}
                          </span>
                        </>
                      ) : (
                        "reference"
                      )}
                    </Cell>
                    <Cell className="pr-0">
                      {vs ? `${vs.sign.wins} / ${vs.sign.losses} (p ${formatP(vs.sign.p)})` : "–"}
                    </Cell>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          role="region"
          aria-label="Tuning-loop cost across traces"
          tabIndex={0}
          className="overflow-x-auto focus-visible:-outline-offset-2"
        >
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="text-muted-foreground mb-2 text-left text-xs">
              Estimated query + build cost of the test week (what-if model, ms).
            </caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
                  Strategy
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Mean [95% CI]
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  vs reactive [95% CI]
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Cheaper / dearer
                </th>
              </tr>
            </thead>
            <tbody>
              {spread.strategies.map((s) => (
                <tr key={s.id} className="border-border/50 border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {s.label}
                  </th>
                  <Cell>
                    {f0(s.mean.estimate)}{" "}
                    <span className="text-muted-foreground">{formatInterval(s.mean, f0)}</span>
                  </Cell>
                  <Cell
                    className={cn(
                      s.vsReactive && s.vsReactive.upper < 1 && "text-mint",
                      s.vsReactive && s.vsReactive.lower > 1 && "text-coral",
                    )}
                  >
                    {s.vsReactive ? (
                      <>
                        {pctChange(s.vsReactive.estimate)}{" "}
                        <span className="text-muted-foreground">
                          {formatInterval(s.vsReactive, (x) => pctChange(x))}
                        </span>
                      </>
                    ) : (
                      "reference"
                    )}
                  </Cell>
                  <Cell className="pr-0">
                    {s.sign ? `${s.sign.wins} / ${s.sign.losses} (p ${formatP(s.sign.p)})` : "–"}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed xl:col-span-2">
          An interval that crosses 0% means the traces do not settle the comparison. The oracle
          tunes for the true next window and is a ceiling, not a contender. All costs are what-if
          estimates on one generated database, so they rank strategies rather than predict
          milliseconds.
        </p>
      </div>
    </Panel>
  );
}
