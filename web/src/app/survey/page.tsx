import type { Metadata } from "next";
import Link from "next/link";
import { Table2Chart } from "@/components/home/table2";
import { AutonomyLadder } from "@/components/home/diagrams";
import { TaxonomyExplorer } from "@/components/survey/taxonomy-explorer";
import { Callout, SectionHeading } from "@/components/shared/section";
import { PAPERS } from "@/lib/survey/papers";
import { TABLE_2 } from "@/lib/survey/report";

export const metadata: Metadata = {
  title: "Survey map",
  description:
    "The self-driving database systems our COMP90050 survey covered — forecasting, behaviour modelling, action planning and index selection — filterable by technique, component, venue and year.",
};

const BENCHMARKS = [
  {
    ref: 1,
    text: "Transaction Processing Performance Council. TPC Benchmark H, standard specification v2.17.1.",
    url: "https://www.tpc.org/tpch/",
  },
  {
    ref: 2,
    text: "Transaction Processing Performance Council. TPC-DS, standard specification v2.1.0.",
    url: "https://www.tpc.org/tpcds/",
  },
];

export default function SurveyPage() {
  const corrected = PAPERS.filter((p) => p.erratum);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10 max-w-3xl space-y-3">
        <p className="kicker text-mint">Survey map</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          What we read, and how it fits together
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          Our report organised the field around Kossmann and Schlosser&apos;s three components —
          predict the workload, tune, organise — and followed index selection from heuristics to
          learning. Every system below is summarised in our own words and linked to the paper.
        </p>
      </header>

      <section
        aria-labelledby="levels"
        className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center"
      >
        <SectionHeading kicker="Report, Table 1" title="Six levels of autonomy" id="levels">
          <p>
            Pavlo et al. grade a DBMS by how much it does without a person. Level 1 tools recommend;
            level 3 components act on their own; level 5 is a database that drives itself. Index
            advisors such as AutoAdmin sit at levels 1–2; online tuners such as the MAB bandit reach
            level 3 for index selection.
          </p>
        </SectionHeading>
        <AutonomyLadder from={0} to={5} />
      </section>

      <section aria-labelledby="taxonomy" className="mt-20">
        <SectionHeading kicker="Taxonomy" title="Systems by component and technique" id="taxonomy">
          <p>
            Filter by the part of the self-driving loop a system addresses, the technique it uses,
            where it was published and when. Systems marked{" "}
            <span className="text-mint">in the arena</span> are implemented in this lab.
          </p>
        </SectionHeading>
        <div className="mt-8">
          <TaxonomyExplorer />
        </div>
      </section>

      <section aria-labelledby="table2" className="mt-20">
        <SectionHeading
          kicker="Report, Table 2"
          title="Total workload time, PDTool vs MAB"
          id="table2"
        >
          <p>
            Perera et al. broke each tuner&apos;s end-to-end time into recommendation, index
            creation and execution. The arena reports exactly this breakdown for every advisor it
            runs.
          </p>
        </SectionHeading>
        <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_1fr]">
          <div className="border-border bg-surface rounded-2xl border p-5">
            <Table2Chart />
          </div>
          <div
            role="region"
            aria-label="Report Table 2 as a table"
            tabIndex={0}
            className="border-border bg-surface overflow-x-auto rounded-2xl border focus-visible:-outline-offset-2"
          >
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">
                Total time breakdown for analytical workloads (minutes)
              </caption>
              <thead>
                <tr className="border-border text-muted-foreground border-b text-xs">
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Workload
                  </th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">
                    Tool
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Rec.
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Creation
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Execution
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE_2.map((r) => (
                  <tr
                    key={`${r.workload}-${r.mode}-${r.tool}`}
                    className="border-border/50 border-b last:border-0"
                  >
                    <td className="text-muted-foreground px-3 py-1.5">
                      {r.workload} ({r.mode})
                    </td>
                    <td className={r.tool === "MAB" ? "text-mint px-3 py-1.5" : "px-3 py-1.5"}>
                      {r.tool}
                    </td>
                    {[r.recommendation, r.creation, r.execution, r.total].map((v, i) => (
                      <td key={i} className="tabular px-3 py-1.5 text-right font-mono text-xs">
                        {v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="errata" className="mt-20 max-w-4xl">
        <SectionHeading kicker="Corrections" title="What we got wrong in 2023" id="errata">
          <p>
            Reading the papers again for this revival turned up two attribution mistakes in the
            report&apos;s bibliography. The arguments built on these papers stand; the credits did
            not.
          </p>
        </SectionHeading>
        <div className="mt-6 space-y-3">
          {corrected.map((p) => (
            <Callout key={p.id} title={`Reference [${p.reportRef}] — ${p.system}`}>
              {p.erratum}{" "}
              <a href={p.url} target="_blank" rel="noreferrer">
                Paper
              </a>
              .
            </Callout>
          ))}
          <Callout title="Benchmarks cited in the report">
            <ul className="space-y-1">
              {BENCHMARKS.map((b) => (
                <li key={b.ref}>
                  [{b.ref}] {b.text}{" "}
                  <a href={b.url} target="_blank" rel="noreferrer">
                    tpc.org
                  </a>
                </li>
              ))}
            </ul>
          </Callout>
        </div>
        <p className="text-muted-foreground mt-6 text-sm">
          Want to see these algorithms rather than read about them?{" "}
          <Link href="/arena" className="text-mint underline underline-offset-2">
            Open the arena
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
