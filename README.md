<div align="center">

# Self-Driving DB Lab — COMP90050

An interactive revival of Group 40's survey on **self-driving databases** for COMP90050 Advanced Database Systems (University of Melbourne, 2023 Winter term). Five index advisors from 1985 to 2023 race a no-index baseline on a live SQLite database in your browser, QueryBot 5000's forecasting pipeline feeds an index tuner, and the survey itself becomes a filterable map of the field.

[![University of Melbourne](https://img.shields.io/badge/University%20of%20Melbourne-COMP90050-094183?style=flat-square)](https://handbook.unimelb.edu.au/2023/subjects/comp90050)
[![Term](https://img.shields.io/badge/Term-2023%20Winter-1f6feb?style=flat-square)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![SQLite](https://img.shields.io/badge/SQLite-3.49%20WASM-003B57?style=flat-square&logo=sqlite)](https://sql.js.org)
[![CI](https://github.com/rNLKJA/Unimelb-Master-2023-COMP90050/actions/workflows/ci.yml/badge.svg)](https://github.com/rNLKJA/Unimelb-Master-2023-COMP90050/actions/workflows/ci.yml)

**Live demo:** [comp90050-self-driving-db.vercel.app](https://comp90050-self-driving-db.vercel.app)

</div>

## What the coursework asked, and what this adds

COMP90050 asked groups of four to write a survey of a current topic in databases: a 10 to 16 page report that categorises and critiques the main approaches (not an annotated bibliography), plus a 25-minute talk. Group 40 chose self-driving databases and split the work in two: **index selection** (Runqiu Fei and Sunchuangyu Huang) and **workload-driven optimisation** (Xiaoyi Liu and Qingxuan Yang). The report traced index selection from heuristics (DROP, AutoAdmin) through constraint and linear programming (DB2 Advisor, CoPhy) to machine learning (multi-armed bandits, Monte Carlo tree search), and organised workload-driven optimisation around forecasting (QB5000), behaviour modelling (ModelBot2) and action planning (PilotBot0).

The survey was written, not implemented. This revival implements the algorithms it described and lets anyone run them:

| Route       | What it does                                                                                                                                                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`         | Landing page: the survey's argument as a scroll-driven explainer (autonomy levels, predictor / tuner / organiser), a timeline of index selection, and the report's key result (Table 2: MAB vs a commercial tuning tool).                     |
| `/arena`    | **Index advisor arena.** DROP, AutoAdmin, DB2 Advisor, CoPhy and the C²UCB bandit tune a TPC-H-shaped SQLite database (sql.js in a Web Worker) over static, shifting, random or HTAP workloads; total time = recommendation + creation + execution. |
| `/forecast` | **Forecasting lab.** QB5000's templatise, cluster and forecast pipeline (LR, kernel regression, HYBRID) on a synthetic three-week trace, then forecast-driven vs reactive vs static index tuning.                                              |
| `/console`  | **SQL console.** Query the database, read `EXPLAIN QUERY PLAN`, compare SQLite's timing with the what-if cost model's estimate, and build the candidate indexes it suggests.                                                                  |
| `/survey`   | **Survey map.** Every system the report covered, filterable by component, technique, venue and year, with links to the papers and two corrected citations.                                                                                    |
| `/about`    | Subject, team, original vs revived stack, how faithful each port is, and the academic-integrity note.                                                                                                                                         |

### Key results from the original report

- The report's Table 2 (from Perera et al., IEEE TKDE 2023): the bandit recommends in seconds where the commercial tool takes minutes, and finishes 5 of 6 workloads sooner, taking up to 61% less time on random TPC-DS, while the commercial tool still wins static TPC-H. A parity test (`web/src/lib/survey/survey.test.ts`) pins every number the site repeats.
- The report's central caveat, that index selection algorithms are hard to compare because every paper benchmarks differently, is what the arena addresses: one engine, one workload, one stopwatch.
- Two citations in the 2023 report were mis-attributed (references 11 and 21); the survey map lists the corrections.

## Tech stack

- **Next.js 16** (App Router, static prerendering), **React 19**, **TypeScript** (strict)
- **Tailwind CSS v4**, shadcn/ui on Base UI, IBM Plex Sans / Condensed / Mono via `next/font`, `next-themes` (light, dark, system)
- **sql.js 1.14** (SQLite 3.49 compiled to WebAssembly) running in a **Web Worker** with every advisor
- Hand-rolled SVG charts, `lucide-react` icons
- **Vitest** unit and parity tests, ESLint, Prettier, GitHub Actions CI, Vercel hosting

No backend and no database server: every page is static, and all computation happens either at build time or in the visitor's browser. Nothing a visitor does is stored: each tab gets its own in-memory SQLite database, discarded when the tab closes, so there are no records to inspect and no environment variables to set.

## Repository structure

```text
.
├── README.md                  this file
├── .github/workflows/ci.yml   lint, format, typecheck, test and build on every push and PR
├── coursework/                the original 2023 material, moved here with git mv (history preserved)
│   ├── README.md              what is inside and how to read it
│   ├── NOTES.md               the long-form COMP90050 revision notes (formerly the root README)
│   ├── images/                screenshots referenced by the notes
│   ├── presentation/          Group 40's report drafts and slide deck (PDF, student numbers redacted)
│   ├── project/REFERENCES.md  the survey's reading list, as citations
│   └── _archive/              the pre-2026 README, verbatim
└── web/                       the deployable Next.js app (Vercel root)
    ├── scripts/copy-sqlite-wasm.mjs   copies sql.js's .wasm into public/vendor/ before dev/build
    └── src/
        ├── app/               routes: /, /arena, /forecast, /console, /survey, /about, not-found, OG image
        ├── components/        layout/, home/, arena/, forecast/, console/, survey/, charts/, shared/, ui/
        ├── hooks/             use-lab-worker, use-element-width
        ├── workers/           lab.worker.ts (SQLite + advisors + forecasting) and its message protocol
        └── lib/               framework-free domain logic, each module unit-tested
            ├── db/            deterministic TPC-H-like generator and optimiser statistics
            ├── engine/        what-if cost model, EXPLAIN parser, SQLite and simulated executors
            ├── workload/      12 query templates + 1 UPDATE; static, shifting, random, HTAP scenarios
            ├── advisors/      DROP, AutoAdmin, DB2 Advisor, CoPhy, MAB (C²UCB) and the registry
            ├── arena/         the round loop (recommendation + creation + execution)
            ├── forecast/      QB5000: templatizer, clusterer, LR / KR / HYBRID, tuning loop
            ├── console/       starter statements and the what-if report
            └── survey/        report facts (Tables 1 and 2), taxonomy of surveyed papers
```

## Deployment

The site is a Vercel project (`comp90050-self-driving-db`) whose root directory is `web/`. From `web/`, `vercel deploy --prod` builds it with the Next.js defaults; every route is prerendered, so the free tier serves it as static files.

## Local development

Requirements: Node 20 or newer and pnpm 10 (`corepack enable`).

```bash
cd web
pnpm install
pnpm dev            # http://localhost:3000
```

Quality gates (the same ones CI runs):

```bash
pnpm lint
pnpm format:check
pnpm typecheck      # next typegen && tsc --noEmit
pnpm test           # vitest run
pnpm build
```

## Data and generated artefacts

There are no precomputed data files and no course datasets in the app.

- **Database.** `web/src/lib/db/generate.ts` builds a TPC-H-shaped database (region, nation, supplier, customer, part, orders, lineitem) from a seed, following TPC-H's value domains, date rules and cardinality ratios at a browser-friendly scale (3k to 15k orders). The Web Worker loads it into SQLite on demand.
- **Workloads and traces.** Query instances and the forecasting lab's three-week arrival-rate trace are generated from seeds, so every run is reproducible.
- **Build-time numbers.** The landing page's pipeline counts and the forecasting lab's default run are computed during `next build` by the same TypeScript modules the browser uses.
- **SQLite binary.** `web/scripts/copy-sqlite-wasm.mjs` copies `sql-wasm.wasm` from the installed `sql.js` package into `web/public/vendor/` (git-ignored) before `dev` and `build`.

## Credits

**Group 40, COMP90050 Winter 2023:** Xiaoyi Liu, Runqiu Fei, Qingxuan Yang and Sunchuangyu Huang wrote the survey report and presentation. The 2026 interactive revival was built by Sunchuangyu (Rin) Huang.

The algorithms belong to their authors; see the survey map for full references, in particular Whang (DROP), Chaudhuri and Narasayya (AutoAdmin), Valentin et al. (DB2 Advisor), Dash, Polyzotis and Ailamaki (CoPhy), Perera, Oetomo, Rubinstein and Borovica-Gajic (DBA bandits / No DBA? No regret!), Ma et al. (QueryBot 5000) and Kossmann and Schlosser (the self-driving component framework).

## Academic integrity

The original report drafts and slides are preserved under [`coursework/presentation/`](coursework/presentation/) for reference (with the team's student numbers and e-mail addresses redacted) and are not served by the website. University teaching material, the assignment brief and third-party papers were removed from the current tree in 2026; see [`coursework/README.md`](coursework/README.md#what-changed-in-2026). The site paraphrases the assignment brief rather than reproducing it, and paper summaries are our own words. If you are taking COMP90050 or a similar subject, do your own work: submitting any part of this repository as your own is academic misconduct.
