import { ArrowRight, BookOpen, FlaskConical, Radar, Sigma, Terminal } from "lucide-react";
import Link from "next/link";
import { HeroConsole } from "@/components/home/hero-console";
import { Scrolly, type Step } from "@/components/home/scrolly";
import { Table2Chart } from "@/components/home/table2";
import { Timeline } from "@/components/home/timeline";
import { DatabaseJourney } from "@/components/journey/database-journey";
import { Callout, SectionHeading } from "@/components/shared/section";
import { pipelineCounts } from "@/lib/arena/pipeline-stats";
import { COURSEWORK_DATES, TEAM, comparisons } from "@/lib/survey/report";
import { SITE } from "@/lib/site";

const STEPS: Step[] = [
  {
    kicker: "Level 0",
    title: "A database that does nothing on its own",
    body: (
      <p>
        Every index, memory setting and partition is chosen by a database administrator, usually
        after something has already gone slow. Pavlo et al. call this{" "}
        <strong>level 0: manual</strong>. Most production systems in 2023 still lived here for
        physical design.
      </p>
    ),
    visual: { kind: "ladder", from: 0, to: 0 },
  },
  {
    kicker: "Levels 1–2",
    title: "Advisors that recommend, people who decide",
    body: (
      <p>
        Tools such as AutoAdmin (1997) and DB2 Advisor (2000) ask the optimiser <em>what if</em> an
        index existed, then recommend a set. A DBA still picks the workload to tune for and when to
        apply the change — levels 1 and 2 on the autonomy ladder.
      </p>
    ),
    visual: { kind: "ladder", from: 1, to: 2 },
  },
  {
    kicker: "Levels 3–5",
    title: "Components that act, then a system that drives",
    body: (
      <p>
        A self-driving DBMS removes the human from the loop: it anticipates the workload, chooses
        actions, applies them at the right moment and learns from what happened. Level 5 is fully
        autonomous; our survey asked how far index selection and workload-driven optimisation had
        got.
      </p>
    ),
    visual: { kind: "ladder", from: 3, to: 5 },
  },
  {
    kicker: "Predictor",
    title: "First, guess what is coming",
    body: (
      <p>
        Kossmann and Schlosser split a self-driving system into a predictor, tuners and an
        organiser. The predictor forecasts the workload: QueryBot 5000 turns queries into templates,
        clusters templates that rise and fall together, and forecasts each cluster. You can run that
        pipeline on the <Link href="/forecast">forecasting page</Link>.
      </p>
    ),
    visual: { kind: "architecture", highlight: "predictor" },
  },
  {
    kicker: "Tuners",
    title: "Then decide what to change",
    body: (
      <p>
        Tuners turn the forecast into candidate actions — build this index, resize that buffer — and
        behaviour models such as ModelBot2 estimate what each action would cost and save. Index
        advisors are tuners; so are knob tuners such as OtterTune.
      </p>
    ),
    visual: { kind: "architecture", highlight: "tuner" },
  },
  {
    kicker: "Organiser",
    title: "And when to change it",
    body: (
      <p>
        Building an index takes time and storage, so the organiser schedules actions ahead of
        demand. PilotBot0 plans over a receding horizon with Monte Carlo tree search. Online tuners
        close the loop the other way: the multi-armed bandit learns only from runtimes it actually
        observed.
      </p>
    ),
    visual: { kind: "architecture", highlight: "organiser" },
  },
  {
    kicker: "Index selection",
    title: "Enumerate, select, explore",
    body: (
      <p>
        Whatever the era, index advisors follow the same three steps: enumerate candidate indexes
        from the workload, prune them to the promising ones, then explore configurations under a
        storage budget. The numbers on the right are AutoAdmin running on this lab&apos;s own
        twelve-query workload.
      </p>
    ),
    visual: { kind: "pipeline" },
  },
];

export default function HomePage() {
  const counts = pipelineCounts();
  const c = comparisons();
  const wins = c.filter((x) => x.change < 0).length;
  const best = c.reduce((a, b) => (a.change < b.change ? a : b));
  const maxMabRec = Math.max(...c.map((x) => x.mab.recommendation));
  const maxPdRec = Math.max(...c.map((x) => x.pdtool.recommendation));

  return (
    <>
      {/* Hero */}
      <section className="border-border relative overflow-hidden border-b">
        <div
          className="bg-console-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)] opacity-60"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pt-14 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-20 lg:pb-24">
          <div className="space-y-6">
            <p className="kicker text-mint">
              {SITE.subject.split(" ")[0]} · {SITE.group} · {SITE.term}
            </p>
            <h1 className="text-display font-semibold">How databases learn to tune themselves.</h1>
            <p className="text-muted-foreground max-w-xl text-lg leading-relaxed">
              In 2023 our group surveyed{" "}
              <strong className="text-foreground">self-driving databases</strong> — systems that
              forecast their own workload and choose their own indexes. This lab rebuilds the survey
              as something you can run: five index advisors from 1985 to 2023 compete on a live
              SQLite database inside your browser.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/arena"
                className="bg-primary text-primary-foreground hover:bg-primary/85 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
              >
                Open the advisor arena <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="/survey"
                className="border-border bg-surface hover:bg-surface-2 inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors"
              >
                Browse the survey map
              </Link>
            </div>
            <dl className="grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 pt-4 sm:grid-cols-4">
              {[
                ["5", "index advisors, 1985–2023"],
                ["21", "references in our report"],
                ["2", "datasets, incl. the INFO20003 Louvre"],
                ["0", "servers needed"],
              ].map(([n, l]) => (
                <div key={l}>
                  <dt className="sr-only">{l}</dt>
                  <dd>
                    <span className="font-display tabular block text-3xl font-semibold">{n}</span>
                    <span className="text-muted-foreground text-xs">{l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroConsole />
        </div>
      </section>

      {/* The coursework */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="coursework">
        <SectionHeading
          kicker="The coursework"
          title="A survey, a talk, and now a lab"
          id="coursework"
        >
          <p>
            COMP90050 asked groups of four to survey a hot topic in databases — not an annotated
            bibliography, but a categorisation and critique of the main approaches — in a 10–16 page
            report and a 25-minute talk. Group 40 chose <strong>self-driving databases</strong> and
            split the work in two: index selection, and workload-driven optimisation.
          </p>
        </SectionHeading>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            {
              icon: BookOpen,
              title: "What the brief asked",
              body: "Find the key papers, group them into families, explain how each extends the last, compare their strengths and limits, and reflect on the process. At least two papers had to be from 2021 or later.",
            },
            {
              icon: Radar,
              title: "What we argued in 2023",
              body: "Index selection moved from heuristics to constraint programming to machine learning; learned tuners recommend far faster than commercial tools, but results are hard to compare because every paper benchmarks differently.",
            },
            {
              icon: FlaskConical,
              title: "What the lab adds",
              body: "The algorithms the survey described, implemented and racing on one engine with one stopwatch — so the comparison we said was missing can finally be run, by anyone, in a browser tab.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="border-border bg-surface rounded-xl border p-5">
              <Icon className="text-mint size-5" aria-hidden />
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{body}</p>
            </article>
          ))}
        </div>
        <ol
          className="border-border mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6 text-sm"
          aria-label="Coursework timeline"
        >
          {COURSEWORK_DATES.map((d) => (
            <li key={d.date} className="flex items-baseline gap-2">
              <time dateTime={d.date} className="text-mint font-mono text-xs">
                {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </time>
              <span className="text-muted-foreground">{d.label}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Scrollytelling */}
      <section className="border-border bg-surface/40 border-y" aria-labelledby="explainer">
        <div className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
          <SectionHeading
            kicker="Explainer"
            title="From level 0 to self-driving, in seven steps"
            id="explainer"
          >
            <p>Scroll through the survey&apos;s argument. The diagram follows along.</p>
          </SectionHeading>
          <Scrolly steps={STEPS} counts={counts} />
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="timeline">
        <SectionHeading
          kicker="Forty years of index selection"
          title="Heuristics, then solvers, then learners"
          id="timeline"
        >
          <p>
            Our report followed Kossmann et al.&apos;s timeline: greedy heuristics first, then
            integer programming, then machine learning. Five of them run in the arena; the{" "}
            <Link href="/about#fidelity">About page</Link> lists where each port departs from its
            paper.
          </p>
        </SectionHeading>
        <div className="mt-10">
          <Timeline />
        </div>
      </section>

      {/* Results reported */}
      <section className="border-border bg-surface/40 border-y" aria-labelledby="results">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading
            kicker="Key result we reported"
            title="Bandits beat a commercial tuner, mostly"
            id="results"
          >
            <p>
              The report&apos;s Table 2 reproduced Perera et al.&apos;s comparison of a multi-armed
              bandit (MAB) with a commercial physical design tool (PDTool) on TPC-H and TPC-DS. The
              bandit never spent more than {maxMabRec.toFixed(1)} minutes recommending (the tool
              needed up to {maxPdRec.toFixed(0)}) and finished <strong>{wins} of 6</strong>{" "}
              workloads sooner, taking up to{" "}
              <strong>{Math.abs(best.change * 100).toFixed(0)}% less time</strong> on{" "}
              {best.workload} {best.mode.toLowerCase()}. The commercial tool still won static TPC-H,
              the setting offline tools are designed for.
            </p>
          </SectionHeading>
          <div className="border-border bg-surface mt-10 rounded-2xl border p-5 sm:p-6">
            <Table2Chart />
            <p className="text-muted-foreground mt-4 text-xs">
              Minutes, from Perera et al., IEEE TKDE 2023, as tabulated in our report. The report
              attributed this paper to Kraska et al.; the{" "}
              <Link href="/survey#errata" className="decoration-mint underline underline-offset-2">
                survey map
              </Link>{" "}
              lists the correction.
            </p>
          </div>
          <Callout className="mt-6" title="Does it hold up in the lab?">
            Try it: the arena replays the same protocol — offline tools tuned on round 1 and
            re-tuned after shifts, the bandit learning every round — on SQLite. Rankings move with
            the workload and the budget, which is exactly the benchmarking problem our report
            flagged.
          </Callout>
        </div>
      </section>

      {/* Explore */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="explore">
        <SectionHeading kicker="Explore" title="Five ways in" id="explore" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {[
            {
              href: "/arena",
              icon: FlaskConical,
              title: "Advisor arena",
              body: "Race DROP, AutoAdmin, DB2 Advisor, CoPhy and a C²UCB bandit on a live SQLite database.",
            },
            {
              href: "/benchmark",
              icon: Sigma,
              title: "Benchmark",
              body: "Repeated seeded runs with 95% intervals, paired comparisons, the bandit's regret, a drift sweep and a BYOK LLM advisor.",
            },
            {
              href: "/forecast",
              icon: Radar,
              title: "Forecasting lab",
              body: "QB5000's templatise–cluster–forecast pipeline, feeding an index tuner ahead of demand.",
            },
            {
              href: "/console",
              icon: Terminal,
              title: "SQL console",
              body: "Query the synthetic TPC-H data, add indexes, and read SQLite's plan next to the what-if estimate.",
            },
            {
              href: "/survey",
              icon: BookOpen,
              title: "Survey map",
              body: "Every system we covered, filterable by technique, component, venue and year, with corrected citations.",
            },
          ].map(({ href, icon: Icon, title, body }) => (
            <Link
              key={href}
              href={href}
              className="group border-border bg-surface hover:border-mint/60 hover:bg-surface-2/60 flex flex-col rounded-xl border p-5 transition-colors"
            >
              <Icon className="text-mint size-5" aria-hidden />
              <span className="font-display mt-3 text-lg font-semibold">{title}</span>
              <span className="text-muted-foreground mt-1.5 flex-1 text-sm leading-relaxed">
                {body}
              </span>
              <span className="text-mint mt-4 inline-flex items-center gap-1 text-sm">
                Open{" "}
                <ArrowRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Database journey */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6" aria-label="Database journey">
        <DatabaseJourney />
      </section>

      {/* About teaser */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="team">
        <div className="border-border bg-surface grid gap-8 rounded-2xl border p-6 sm:p-8 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="kicker text-mint">About this project</p>
            <h2 id="team" className="mt-2 text-2xl font-semibold">
              {SITE.subject}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {SITE.university} · {SITE.term} · {SITE.group}
            </p>
            <Link
              href="/about"
              className="text-mint mt-4 inline-flex items-center gap-1 text-sm hover:underline"
            >
              Team, stack and academic-integrity note{" "}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {TEAM.map((m) => (
              <li
                key={m.name}
                className="border-border bg-surface-2/60 rounded-lg border px-4 py-3"
              >
                <p className="font-medium">{m.name}</p>
                <p className="text-muted-foreground text-xs">{m.focus}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
