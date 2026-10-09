import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Ban, Check, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { Markdown } from "@/components/content/markdown";
import { DatabaseJourney } from "@/components/journey/database-journey";
import { MAX_INDEXES, MAX_WIDTH, PROMPT_VERSION } from "@/lib/ai/index-advisor";
import { ANTHROPIC_MODELS, DEFAULT_OPENAI_MODEL } from "@/lib/ai/types";
import { LOUVRE_PROVENANCE } from "@/lib/datasets/louvre/schema";
import { STATS_SEED } from "@/lib/stats";
import {
  getBenchmarkNumbers,
  getCard,
  listDecisions,
  type BenchmarkNumbers,
} from "@/server/content";

export const metadata: Metadata = {
  title: "Methods",
  description:
    "Data provenance, methods, evaluation design, assumptions, limitations, the AI use statement, the model and data cards, and the decision records behind the Self-Driving DB Lab.",
};

const CONTENTS = [
  ["journey", "Database journey"],
  ["provenance", "Data provenance"],
  ["methods", "Methods"],
  ["evaluation", "Evaluation design"],
  ["results", "Headline results"],
  ["assumptions", "Assumptions"],
  ["limitations", "Limitations"],
  ["change", "What I'd change"],
  ["ai-use", "AI use statement"],
  ["model-card", "Model card"],
  ["data-card", "Data card"],
  ["decisions", "Decision records"],
] as const;

const a =
  "text-foreground decoration-mint hover:text-mint underline decoration-2 underline-offset-4";
const code = "bg-surface-2 rounded px-1 py-0.5 font-mono text-[0.85em] break-words";

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="border-border scroll-mt-20 border-t py-12 first:border-t-0 first:pt-0"
      aria-labelledby={`${id}-h`}
    >
      <p className="kicker text-mint">{kicker}</p>
      <h2 id={`${id}-h`} className="mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      <div className="text-muted-foreground mt-5 space-y-4 text-[15px] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="marker:text-mint list-disc space-y-2 pl-6">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  );
}

type Interval = { estimate: number; lower: number; upper: number };
const pct = (r: Interval) => {
  const f = (x: number) => `${x < 1 ? "−" : "+"}${Math.abs((x - 1) * 100).toFixed(0)}%`;
  return `${f(r.estimate)} [${f(r.lower)}, ${f(r.upper)}]`;
};
const ms = (x: Interval) =>
  `${x.estimate.toFixed(0)} [${x.lower.toFixed(0)}, ${x.upper.toFixed(0)}]`;

function ResultsTable({ numbers }: { numbers: BenchmarkNumbers }) {
  const rows = (["tpch", "louvre"] as const).flatMap((ds) =>
    (["static", "shifting", "htap"] as const).map((sc) => {
      const r = numbers.results[`${ds}/sqlite/${sc}`] as {
        total: {
          meanMs: Record<string, Interval>;
          vsGreedy: Record<string, { ratio: Interval }>;
          regret: { finalMs: Interval; relative: Interval } | null;
        };
        buildRun: { vsGreedy: Record<string, { ratio: Interval }> };
      };
      return { ds, sc, r };
    }),
  );
  return (
    <div
      role="region"
      aria-label="Headline benchmark results"
      tabIndex={0}
      className="border-border overflow-x-auto rounded-lg border focus-visible:-outline-offset-2"
    >
      <table className="w-full min-w-[48rem] text-sm">
        <thead>
          <tr className="bg-surface-2/70 text-foreground text-left text-xs">
            <th scope="col" className="px-3 py-2 font-medium">
              Dataset · workload
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              No index (ms)
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Greedy (ms)
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Bandit (ms)
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Bandit vs greedy, total
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Bandit vs greedy, build + run
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ds, sc, r }) => (
            <tr key={`${ds}-${sc}`} className="border-border border-t">
              <th scope="row" className="text-foreground px-3 py-2 text-left font-normal">
                {ds === "tpch" ? "TPC-H-like (S)" : "Louvre"} · {sc === "htap" ? "HTAP" : sc}
              </th>
              <td className="tabular px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                {ms(r.total.meanMs.none)}
              </td>
              <td className="tabular px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                {ms(r.total.meanMs.autoadmin)}
              </td>
              <td className="tabular px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                {ms(r.total.meanMs.mab)}
              </td>
              <td className="tabular px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                {pct(r.total.vsGreedy.mab.ratio)}
              </td>
              <td className="tabular px-3 py-2 text-right font-mono text-xs whitespace-nowrap">
                {pct(r.buildRun.vsGreedy.mab.ratio)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function MethodsPage() {
  const [decisions, modelCard, dataCard, numbers] = await Promise.all([
    listDecisions(),
    getCard("model-card"),
    getCard("data-card"),
    getBenchmarkNumbers(),
  ]);
  const generated = new Date(numbers.generated).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-12 max-w-3xl space-y-3">
        <p className="kicker text-mint">Methods</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">How the lab was built and checked</h1>
        <p className="text-muted-foreground leading-relaxed">
          Where every number on this site comes from, how it was measured, what it assumes and where
          it is weak. The optional AI feature is documented here too: what it does, what it never
          does, and how its advice is measured.
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-20 space-y-1.5 text-sm">
            {CONTENTS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted-foreground hover:text-foreground">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl min-w-0">
          <section id="journey" className="scroll-mt-20 pb-12" aria-label="Database journey">
            <DatabaseJourney />
          </section>

          <Section id="provenance" kicker="Where the data comes from" title="Data provenance">
            <p>
              <strong className="text-foreground">The 2023 coursework.</strong> The survey&apos;s
              claims, its Table 2 (Perera et al.&apos;s comparison of a bandit with a commercial
              tool) and its corrected citations are quoted from Group 40&apos;s report as written. A
              parity test pins every number the site repeats. The lab adds analysis around those
              results and does not change them.
            </p>
            <p>
              <strong className="text-foreground">The TPC-H-like database</strong> is generated in
              the browser from a seed, following the TPC-H specification&apos;s value domains, date
              rules and table ratios at 3,000 to 15,000 orders. No code or data from TPC&apos;s
              dbgen is used.
            </p>
            <p>
              <strong className="text-foreground">The Louvre database</strong> is the file from
              Rin&apos;s 2020 INFO20003 assignment, as rebuilt by its 2026 revival with five years
              of synthetic museum activity (seed {LOUVRE_PROVENANCE.seed}). The lab ships it
              gzip-compressed and a unit test checks the uncompressed file&apos;s SHA-256 (
              <code className={code}>{LOUVRE_PROVENANCE.sha256.slice(0, 16)}…</code>), which matches
              the{" "}
              <a className={a} href={LOUVRE_PROVENANCE.download}>
                public download
              </a>{" "}
              on the INFO20003 site. See the{" "}
              <a className={a} href="#data-card">
                data card
              </a>{" "}
              and{" "}
              <Link className={a} href="/methods/decisions/DR-004-louvre-dataset-in-the-arena">
                DR-004
              </Link>
              .
            </p>
            <p>
              <strong className="text-foreground">Workloads and the forecasting trace</strong> are
              generated from seeds, so every run on the site can be reproduced from the seed it
              shows. Nothing a visitor does is sent to a server, because there is none.
            </p>
          </Section>

          <Section id="methods" kicker="What runs" title="Methods">
            <p>
              Every experiment runs in a Web Worker on SQLite 3.49 compiled to WebAssembly (sql.js).
              The arena replays the same rounds of queries once per advisor. Before each round an
              advisor may build or drop indexes, and total workload time is the sum of
              recommendation, index creation and query execution, the breakdown of the report&apos;s
              Table 2.
            </p>
            <Bullets
              items={[
                <>
                  <strong className="text-foreground">Offline advisors</strong> (DROP, AutoAdmin,
                  DB2 Advisor, CoPhy) ask a what-if cost model about hypothetical indexes. Following
                  Perera et al.&apos;s protocol, they tune at the start of round 2 with round 1 as
                  their workload and again whenever the template mix changes by more than half.
                </>,
                <>
                  <strong className="text-foreground">The C²UCB bandit</strong> learns only from
                  runtimes it observes (
                  <Link className={a} href="/methods/decisions/DR-003-bandit-formulation">
                    DR-003
                  </Link>
                  ).
                </>,
                <>
                  <strong className="text-foreground">The LLM advisor</strong> proposes a
                  configuration once, from the schema, round 1 and SQLite&apos;s plans. The lab
                  validates it, a person reviews it, and it is built at the start of round 2 (
                  <Link className={a} href="/methods/decisions/DR-005-llm-index-advisor">
                    DR-005
                  </Link>
                  ).
                </>,
                <>
                  <strong className="text-foreground">The hindsight reference</strong> builds,
                  before round 1, the configuration CoPhy proves optimal under the what-if model for
                  the whole workload. It exists to measure regret.
                </>,
                <>
                  <strong className="text-foreground">Engines.</strong> Measured SQLite times every
                  build and query on the visitor&apos;s machine. The simulated engine charges plans
                  with a second set of cost constants plus seeded noise (
                  <Link className={a} href="/methods/decisions/DR-002-sqlite-wasm-cost-proxy">
                    DR-002
                  </Link>
                  ).
                </>,
                <>
                  <strong className="text-foreground">Workloads.</strong> Static, shifting, random
                  and HTAP follow Perera et al. The drifting workload, new in 2026, puts a share of
                  each round (the drift) on the current phase&apos;s group and spreads the rest over
                  all twelve read templates. Drift 0 is the static mix and drift 1 the shifting mix.
                </>,
                <>
                  <strong className="text-foreground">Forecasting.</strong> QB5000&apos;s
                  templatiser, clusterer, linear and kernel regression and HYBRID rule on a
                  synthetic trace, feeding AutoAdmin window by window.
                </>,
              ]}
            />
          </Section>

          <Section id="evaluation" kicker="How results are compared" title="Evaluation design">
            <p>
              A single arena run is one sample. The{" "}
              <Link className={a} href="/benchmark">
                benchmark
              </Link>{" "}
              runs every advisor on R replicate workloads (10 by default), where replicate r uses
              workload seed s + r. Inside a replicate every advisor replays the same queries, so
              each replicate is a matched pair and comparisons are paired.
            </p>
            <Bullets
              items={[
                <>
                  <strong className="text-foreground">Means</strong> of cumulative workload time per
                  advisor carry 95% percentile-bootstrap intervals over replicates (B = 2,000,
                  resampling seed {STATS_SEED}).
                </>,
                <>
                  <strong className="text-foreground">Paired comparisons</strong> against the greedy
                  what-if advisor (AutoAdmin) report the mean difference and the ratio of means,
                  both with intervals from resampling whole pairs, Cohen&apos;s d_z, an exact
                  two-sided sign test and the share of replicates won with a Wilson interval. The
                  page shows effect sizes first because ten replicates cannot give a sign-test p
                  below 0.002.
                </>,
                <>
                  <strong className="text-foreground">Two metrics.</strong> Total time includes
                  recommendation. Build + run leaves it out, which matters for the LLM, whose
                  response time is network and provider latency.
                </>,
                <>
                  <strong className="text-foreground">Regret</strong> is the bandit&apos;s
                  cumulative time above the hindsight reference, round by round, with pointwise
                  bootstrap bands.
                </>,
                <>
                  <strong className="text-foreground">Drift sensitivity</strong> repeats everything
                  at drift 0, 0.25, 0.5, 0.75 and 1.
                </>,
                <>
                  <strong className="text-foreground">The invalid-proposal rate</strong> of the LLM
                  advisor is the share of proposed indexes the validator rejects, and the share of
                  calls with an unusable reply or any rejection, each with a Wilson interval over
                  every call logged in the browser. Provider and network failures are left out.
                </>,
                <>
                  <strong className="text-foreground">Forecasting</strong> is summarised over ten
                  seeded traces, with paired comparisons against linear regression and against
                  reactive tuning.
                </>,
              ]}
            />
            <p>
              The statistical helpers live in <code className={code}>web/src/lib/stats/</code>.
              Their unit tests compare them with numpy, scipy and statsmodels (
              <code className={code}>scripts/verify_stats.py</code>, run with uv) and with base R (
              <code className={code}>scripts/verify_stats.R</code>). Analytic quantities agree to
              about 1e-10. Bootstrap intervals agree with scipy&apos;s within Monte Carlo error.
            </p>
          </Section>

          <Section id="results" kicker="What the benchmark found" title="Headline results">
            <p>
              Measured SQLite, 10 replicates, 25 rounds, 200% budget, means in milliseconds with 95%
              intervals. Negative change means the bandit was faster than greedy. These numbers come
              from <code className={code}>pnpm bench:report</code> ({numbers.platform}, Node{" "}
              {numbers.node}, {generated}). A browser on another machine gives different absolute
              times.
            </p>
            <ResultsTable numbers={numbers} />
            <p>
              On static and HTAP workloads the bandit beat greedy on total time but lost on build +
              run time. Its advantage is that it never pays for a what-if search, which weighs a lot
              when the whole workload takes a few hundred milliseconds. On shifting workloads it
              lost on both. The decision records give the details.
            </p>
          </Section>

          <Section id="assumptions" kicker="What the numbers rely on" title="Assumptions">
            <Bullets
              items={[
                "The what-if model assumes uniform, independent columns and fixed per-row costs fitted on one laptop.",
                "Recommendation time is the advisors' own JavaScript run time plus 0.02 ms per what-if call, standing in for an optimiser call that would take milliseconds in a server DBMS.",
                "Replicates differ only in query literals and noise. The data, schema and template mix stay fixed, so the intervals describe workload-to-workload variation on one dataset and one machine.",
                "Every index is a plain B-tree in SQLite. There are no INCLUDE columns, partial indexes or materialised views.",
                "The Louvre data is synthetic and small (about two visiting parties a day), and the museum workload's mix and parameters are my own choices.",
              ]}
            />
          </Section>

          <Section id="limitations" kicker="Where it is weak" title="Limitations">
            <Bullets
              items={[
                "Workloads take hundreds of milliseconds, so recommendation time weighs far more than in the papers the survey quoted. Rankings on total time can flip on build + run time.",
                "Percentile-bootstrap intervals from ten replicates are somewhat too narrow. Raise R in the benchmark for firmer intervals.",
                "The simulated engine's constants were fitted on TPC-H-like data and overestimate the Louvre's no-index time by about 23%.",
                "The forecasting lab uses synthetic traces and no LSTM.",
                "LLM results exist only in the browsers of visitors who bring a key. None are published here.",
                "Measured times depend on the visitor's hardware, browser and other open tabs.",
              ]}
            />
          </Section>

          <Section id="change" kicker="Next time" title="What I'd change">
            <Bullets
              items={[
                "Run the benchmark at larger scale outside the browser, where execution dominates as it does in the papers.",
                "Calibrate the cost constants per dataset and per machine in a short warm-up.",
                "Re-consult the LLM after each workload shift and compare it with re-invoked offline tools.",
                "Add Monte Carlo tree search, the report's other learned index tuner.",
                "Offer the INFO20003 schema's own seven indexes as an as-designed configuration to compare with the advisors.",
              ]}
            />
          </Section>

          <Section id="ai-use" kicker="Transparency" title="AI use statement">
            <p>
              The site has one optional AI feature, the LLM index advisor on the{" "}
              <Link className={a} href="/arena">
                arena
              </Link>{" "}
              and{" "}
              <Link className={a} href="/benchmark#llm">
                benchmark
              </Link>{" "}
              pages. Everything else works without it.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border-border bg-surface rounded-xl border p-4">
                <p className="text-foreground flex items-center gap-2 font-medium">
                  <Check className="text-mint size-4" aria-hidden /> What the AI does
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li>
                    Proposes up to {MAX_INDEXES} secondary indexes of 1 to {MAX_WIDTH} columns, with
                    a one-sentence rationale each, in a fixed JSON structure.
                  </li>
                  <li>Explains its overall strategy in a short note.</li>
                </ul>
              </div>
              <div className="border-border bg-surface rounded-xl border p-4">
                <p className="text-foreground flex items-center gap-2 font-medium">
                  <Ban className="text-coral size-4" aria-hidden /> What it never does
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li>Write or run SQL. The lab writes every CREATE INDEX itself.</li>
                  <li>Build anything a person has not accepted.</li>
                  <li>See the visitor&apos;s key, the audit log or anything about the visitor.</li>
                </ul>
              </div>
            </div>
            <Bullets
              items={[
                <>
                  <strong className="text-foreground">Data sent to the provider.</strong> The schema
                  with row counts and distinct-value counts, round 1 of the workload (SQL with
                  literals from the synthetic data, and each template&apos;s share of estimated
                  cost), SQLite&apos;s query plans and the storage budget. The full message is kept
                  in the audit log.
                </>,
                <>
                  <strong className="text-foreground">Models.</strong> Anthropic by default (
                  {ANTHROPIC_MODELS.map((m) => m.label).join(" or ")}), or any OpenAI model id
                  (default {DEFAULT_OPENAI_MODEL}). Prompt version{" "}
                  <code className={code}>{PROMPT_VERSION}</code>.
                </>,
                <>
                  <strong className="text-foreground">Your key.</strong> Kept in sessionStorage, or
                  in localStorage only if you tick &ldquo;remember on this device&rdquo;. It is sent
                  only to the provider, directly from your browser, and &ldquo;forget key&rdquo;
                  removes it. Calls are billed to your key.
                </>,
                <>
                  <strong className="text-foreground">Human in the loop.</strong> Every output is
                  labelled AI-generated. The validator rejects anything outside the schema or the
                  budget with a reason, and a person accepts, edits or rejects the rest before
                  anything is built.
                </>,
                <>
                  <strong className="text-foreground">Audit trail.</strong> Every call, decision and
                  measurement is appended to an audit log in your browser (IndexedDB), viewable and
                  exportable as JSON or CSV at{" "}
                  <Link className={a} href="/ai-log">
                    /ai-log
                  </Link>
                  . The key is never written to it.
                </>,
                <>
                  <strong className="text-foreground">Frameworks.</strong> The design is informed by
                  the Australian Government&apos;s policy for the responsible use of AI in
                  government, the EU AI Act&apos;s transparency principles and the NIST AI Risk
                  Management Framework. It is not a claim of compliance with any of them.
                </>,
              ]}
            />
          </Section>

          <Section id="model-card" kicker="Models" title={modelCard.title}>
            <Markdown source={modelCard.body} demote />
          </Section>

          <Section id="data-card" kicker="Data" title={dataCard.title}>
            <Markdown source={dataCard.body} demote />
          </Section>

          <Section id="decisions" kicker="Why it is built this way" title="Decision records">
            <p>
              Each record gives the context, the decision, the options considered, why, what
              happened (including the weak numbers) and what I would change. Records are never
              edited after they are accepted. A later record supersedes an earlier one.
            </p>
            <ol className="space-y-3">
              {decisions.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/methods/decisions/${d.slug}`}
                    className="group border-border bg-surface hover:border-mint/60 flex items-start gap-3 rounded-xl border p-4 transition-colors"
                  >
                    <FileText className="text-mint mt-0.5 size-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="text-mint font-mono text-xs">{d.id}</span>
                      <span className="text-foreground block font-medium">{d.title}</span>
                      <span className="text-muted-foreground block text-xs">
                        {d.status} · {d.decided}
                      </span>
                    </span>
                    <ArrowRight
                      className="text-muted-foreground mt-1 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>
    </div>
  );
}
