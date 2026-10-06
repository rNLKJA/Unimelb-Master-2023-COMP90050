import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GithubMark } from "@/components/layout/github-mark";
import { Callout, SectionHeading } from "@/components/shared/section";
import { ADVISORS } from "@/lib/advisors/registry";
import { PAPER_BY_ID } from "@/lib/survey/papers";
import { TEAM } from "@/lib/survey/report";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About this project",
  description:
    "COMP90050 Advanced Database Systems, University of Melbourne, Winter term 2023 — Group 40's survey of self-driving databases, revived as an interactive lab.",
};

const FIDELITY: { name: string; what: string; differs: string }[] = [
  {
    name: "DROP (Whang 1985)",
    what: "Starts from every single-column candidate and drops the index whose removal hurts least, until the budget fits.",
    differs: "Single-column only, as in the original and in Kossmann et al.'s re-implementation.",
  },
  {
    name: "AutoAdmin (Chaudhuri & Narasayya 1997)",
    what: "Per-query candidate selection, Greedy(m, k) over what-if costs, multi-column indexes widened one column at a time.",
    differs: "Indexes only; materialised views (the 2000 extension) are out of scope.",
  },
  {
    name: "DB2 Advisor (Valentin et al. 2000)",
    what: "Credits each query's gain to the indexes its best plan uses, solves a knapsack by benefit per byte, then tries random swaps (TRY_VARIATION).",
    differs: "Plans come from the lab's what-if model instead of DB2's optimiser.",
  },
  {
    name: "CoPhy (Dash et al. 2011)",
    what: "Index selection as a binary integer program over INUM-style cached costs, with a storage-budget constraint.",
    differs:
      "Solved exactly by branch and bound (the workloads are small) rather than handed to a commercial LP solver.",
  },
  {
    name: "MAB / C²UCB (Perera et al. 2021, 2023)",
    what: "Workload-generated arms and contexts, C²UCB scoring, a greedy oracle for the super arm, rewards from observed runtimes, focused updates and forgetting on workload shift.",
    differs:
      "Contexts are built over this schema's columns; hyper-parameters follow the authors' TPC-H settings.",
  },
  {
    name: "QB5000 (Ma et al. 2018)",
    what: "Templatisation, on-line clustering by arrival-rate history, linear and kernel regression, and the HYBRID spike rule.",
    differs:
      "No LSTM in the browser: linear regression stands in for the LR + LSTM ensemble. The trace is synthetic.",
  },
];

const STACKS = {
  original: [
    "A 20-page LaTeX report (draft) and a 35-slide deck (PDF)",
    "Figures and results quoted from the surveyed papers",
    "No implementation: the brief asked for a written survey",
  ],
  revived: [
    "Next.js 16 (App Router) · React 19 · TypeScript (strict)",
    "Tailwind CSS v4 · shadcn/ui on Base UI · IBM Plex type family",
    "SQLite 3.49 compiled to WebAssembly (sql.js) inside a Web Worker",
    "Hand-rolled SVG charts · next-themes for light and dark",
    "Vitest unit and parity tests · GitHub Actions CI · Vercel",
  ],
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-14 max-w-3xl space-y-3">
        <p className="kicker text-mint">About this project</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          From a written survey to a working lab
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {SITE.subject} at {SITE.university} asked each group to survey a current topic in
          databases — a report that categorises and critiques the main approaches, and a talk to the
          class. This site keeps that survey&apos;s argument and adds what a written survey cannot:
          the algorithms, running.
        </p>
      </header>

      <section aria-labelledby="facts" className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_1.2fr]">
        <dl className="border-border bg-surface grid content-start gap-4 rounded-2xl border p-6 sm:grid-cols-2">
          {[
            ["Subject", "COMP90050 Advanced Database Systems"],
            ["University", SITE.university],
            ["Term", "Winter term 2023 (June–July)"],
            ["Group", "Group 40"],
            ["Topic", "Self-driving databases: index selection & workload-driven optimisation"],
            ["Delivered", "Talk on 20 July 2023 · report due 24 July 2023"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="kicker">{k}</dt>
              <dd className="mt-1 text-sm">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-border bg-surface rounded-2xl border p-6">
          <h2 id="facts" className="text-2xl font-semibold">
            Team
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            No team leader: ideas were proposed by anyone and settled by majority. After choosing
            the topic the group split in two pairs and wrote the introduction, discussion and
            conclusion together.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
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
          <p className="text-muted-foreground mt-4 text-xs">
            The 2026 revival (this site, the TypeScript ports and the tests) was built by
            Sunchuangyu Huang on top of the group&apos;s survey.
          </p>
        </div>
      </section>

      <section aria-labelledby="stack" className="mt-20">
        <SectionHeading
          kicker="Then and now"
          title="Original deliverables, revived stack"
          id="stack"
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {(["original", "revived"] as const).map((k) => (
            <div key={k} className="border-border bg-surface rounded-xl border p-5">
              <p className="kicker text-mint">
                {k === "original" ? "2023 · coursework" : "2026 · revival"}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {STACKS[k].map((s) => (
                  <li key={s} className="flex gap-2">
                    <span aria-hidden className="text-mint">
                      ▸
                    </span>
                    <span className="text-muted-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="fidelity" className="mt-20">
        <SectionHeading
          kicker="How faithful are the ports?"
          title="What runs, and where it departs from the paper"
          id="fidelity"
        >
          <p>
            The report described these algorithms; it did not implement them. For the revival each
            one was re-implemented from its paper in framework-free TypeScript and unit-tested —
            CoPhy against brute force, Greedy(m, k) against exhaustive search, the bandit against
            the worked example in Perera et al., and the what-if planner against SQLite&apos;s own
            plan choices. Parity tests also pin every number the site repeats from the report.
          </p>
        </SectionHeading>
        <div
          role="region"
          aria-label="How faithful each port is"
          tabIndex={0}
          className="border-border bg-surface mt-8 overflow-x-auto rounded-xl border focus-visible:-outline-offset-2"
        >
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-border text-muted-foreground border-b text-left text-xs">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Algorithm
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Implemented
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Differs from the paper
                </th>
              </tr>
            </thead>
            <tbody>
              {FIDELITY.map((f) => (
                <tr key={f.name} className="border-border/60 border-b align-top last:border-0">
                  <th scope="row" className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {f.name}
                  </th>
                  <td className="text-muted-foreground px-4 py-3">{f.what}</td>
                  <td className="text-muted-foreground px-4 py-3">{f.differs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground mt-4 text-sm">
          Not implemented: Dexter, DTA, budget-aware MCTS (Wu et al. 2022), ModelBot2 and PilotBot0
          — they appear in the{" "}
          <Link href="/survey" className="text-mint underline underline-offset-2">
            survey map
          </Link>{" "}
          with links to their papers. {ADVISORS.length - 1} advisors plus a no-index baseline race
          in the{" "}
          <Link href="/arena" className="text-mint underline underline-offset-2">
            arena
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="integrity" className="mt-20 grid gap-6 lg:grid-cols-2">
        <div>
          <SectionHeading
            kicker="Academic integrity"
            title="Shared for learning, not for reuse"
            id="integrity"
          />
          <div className="prose-lab mt-4 text-sm">
            <p>
              The group&apos;s original report and slides are preserved unchanged in the
              repository&apos;s <code>coursework/</code> folder for reference. They are not served
              by this site. If you are taking COMP90050 or a similar subject, write your own survey:
              reusing this work as yours is academic misconduct.
            </p>
            <p>
              The university&apos;s assignment brief is paraphrased, never reproduced. Paper
              summaries on this site are our own words; follow the links for the originals. Two
              citation errors in the 2023 report are corrected on the{" "}
              <Link href="/survey#errata">survey map</Link>, starting with{" "}
              {PAPER_BY_ID.get("perera-mab")?.system}.
            </p>
          </div>
        </div>
        <Callout title="Source code" className="self-start">
          <p>
            Everything — the Next.js app, the algorithm ports, the tests and the original coursework
            — is on GitHub.
          </p>
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            className="border-border bg-surface mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 !no-underline"
          >
            <GithubMark className="size-4" /> rNLKJA/Unimelb-Master-2023-COMP90050
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </Callout>
      </section>
    </div>
  );
}
