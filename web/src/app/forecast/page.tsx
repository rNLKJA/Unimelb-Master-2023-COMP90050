import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ForecastLab, StepHeading } from "@/components/forecast/forecast-lab";
import { SeedSpreadPanel } from "@/components/forecast/seed-spread";
import { Callout } from "@/components/shared/section";
import {
  DEFAULT_SETTINGS,
  buildForecastView,
  forecastDatabaseStats,
  templatizeExamples,
} from "@/lib/forecast/view";
import { SPREAD_SEEDS, seedSpread } from "@/lib/forecast/seeds";
import { PAPER_BY_ID } from "@/lib/survey/papers";
import { TEMPLATE_BY_ID } from "@/lib/workload/templates";

export const metadata: Metadata = {
  title: "Workload forecasting lab",
  description:
    "QueryBot 5000's templatise, cluster and forecast pipeline on a synthetic three-week query trace, feeding an index tuner ahead of demand.",
};

const SOURCES = ["qb5000", "ma-thesis", "kossmann-schlosser", "autoadmin-1997"] as const;

export default function ForecastPage() {
  const stats = forecastDatabaseStats();
  const view = buildForecastView(stats, DEFAULT_SETTINGS);
  const examples = templatizeExamples(stats);
  const spread = seedSpread(stats, DEFAULT_SETTINGS, SPREAD_SEEDS);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-12 max-w-3xl space-y-3">
        <p className="kicker text-mint">Workload predictor · tuner · organiser</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Forecasting lab</h1>
        <p className="text-muted-foreground leading-relaxed">
          The workload-driven half of our survey started from QueryBot 5000: a self-driving database
          should know what is coming before it tunes. Here QB5000&apos;s pipeline runs end to end on
          a synthetic three-week trace of the arena&apos;s queries — two weeks to learn from, one to
          test on — and its forecast then drives an index tuner, so you can see what predicting the
          workload is worth.
        </p>
      </header>

      <section aria-labelledby="templatise" className="mb-16 space-y-6">
        <StepHeading n={1} id="templatise" title="Turn statements into templates">
          QB5000&apos;s pre-processor strips the constants out of every statement, so queries that
          differ only in their parameters count as one template. Forecasting then works on twelve
          arrival-rate series instead of {view.totalStatements.toLocaleString("en-AU")} individual
          statements.
        </StepHeading>
        <div className="border-border bg-surface overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">Raw statements and the templates they reduce to</caption>
            <thead>
              <tr className="border-border text-muted-foreground border-b text-xs">
                <th scope="col" className="w-16 px-4 py-2 text-left font-medium">
                  Template
                </th>
                <th scope="col" className="px-4 py-2 text-left font-medium">
                  Statement as executed → as templatised
                </th>
              </tr>
            </thead>
            <tbody>
              {examples.map((e, i) => (
                <tr
                  key={`${e.template}-${i}`}
                  className="border-border/60 border-b align-top last:border-0"
                >
                  <th scope="row" className="px-4 py-2.5 text-left font-normal">
                    <span className="text-mint font-mono text-xs">{e.template}</span>
                    <span className="text-muted-foreground mt-0.5 block text-[11px] leading-tight">
                      {TEMPLATE_BY_ID.get(e.template)?.title}
                    </span>
                  </th>
                  <td className="min-w-0 px-4 py-2.5 font-mono text-[12px] leading-relaxed">
                    <code className="text-foreground/90 block break-words">{e.sql}</code>
                    <code className="text-muted-foreground mt-1 block break-words">
                      <span aria-hidden className="text-mint">
                        →{" "}
                      </span>
                      {e.normalised}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ForecastLab initial={view} />

      <section aria-label="Spread across traces" className="mt-16">
        <SeedSpreadPanel spread={spread} settings={DEFAULT_SETTINGS} />
      </section>

      <section aria-labelledby="caveats" className="mt-20 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-3">
          <h2 id="caveats" className="text-2xl font-semibold">
            What is real here, and what is simplified
          </h2>
          <div className="prose-lab space-y-3 text-sm">
            <p>
              The pre-processor, the on-line clusterer, linear regression, Nadaraya–Watson kernel
              regression and the HYBRID switching rule follow QB5000 as Ma describes it. The trace
              is synthetic — three behaviours with daily and weekly cycles plus noise — because the
              admissions, bus-tracking and online-course traces QB5000 was evaluated on are not
              public.
            </p>
            <p>
              The tuner is the same AutoAdmin implementation the <Link href="/arena">arena</Link>{" "}
              uses, scored with the lab&apos;s what-if cost model rather than live SQLite runs, so a
              week of 3-hour windows evaluates in milliseconds. PilotBot0&apos;s Monte Carlo tree
              search over action sequences is not implemented: the organiser here simply builds each
              window&apos;s configuration as it starts.
            </p>
          </div>
        </div>
        <Callout title="Sources">
          <ul className="space-y-1.5">
            {SOURCES.map((id) => {
              const p = PAPER_BY_ID.get(id)!;
              return (
                <li key={id}>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    {p.title}
                  </a>{" "}
                  — {p.authors}, {p.venue} {p.year}.
                </li>
              );
            })}
          </ul>
          <Link href="/survey#taxonomy" className="mt-3 inline-flex items-center gap-1">
            Every system in the survey map <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </Callout>
      </section>
    </div>
  );
}
