<div align="center">

# Self-Driving DB Lab — COMP90050

An interactive revival of Group 40's survey on **self-driving databases** for COMP90050 Advanced Database Systems (University of Melbourne, 2023 Winter term). Five index advisors from 1985 to 2023 race a no-index baseline on a live SQLite database in your browser, QueryBot 5000's forecasting pipeline feeds an index tuner, and the survey itself becomes a filterable map of the field. The 2026 upgrade adds a repeated-run benchmark with confidence intervals, the Louvre database from Rin's INFO20003 design as a second dataset, and an optional bring-your-own-key LLM index advisor that is validated, measured and audit-logged.

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

| Route        | What it does                                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`          | Landing page: the survey's argument as a scroll-driven explainer (autonomy levels, predictor / tuner / organiser), a timeline of index selection, the report's key result (Table 2: MAB vs a commercial tuning tool) and the database journey from INFO20003 to COMP90050.                                                       |
| `/arena`     | **Index advisor arena.** DROP, AutoAdmin, DB2 Advisor, CoPhy, the C²UCB bandit and, with your own key, an LLM tune a SQLite database (sql.js in a Web Worker): the TPC-H-shaped dataset or the INFO20003 Louvre database (`/arena?dataset=louvre`). Total time = recommendation + creation + execution.                          |
| `/benchmark` | **Advisor benchmark.** R seeded replicates per advisor: mean cumulative workload time with bootstrap CIs, paired comparisons against greedy what-if search (difference, change, d_z, sign test, win share), the bandit's regret against a hindsight optimum, a drift sweep, and the LLM evaluation harness. CSV and JSON export. |
| `/forecast`  | **Forecasting lab.** QB5000's templatise, cluster and forecast pipeline (LR, kernel regression, HYBRID) on a synthetic three-week trace, then forecast-driven vs reactive vs static index tuning, summarised over ten seeded traces with intervals.                                                                              |
| `/console`   | **SQL console.** Query the database, read `EXPLAIN QUERY PLAN`, compare SQLite's timing with the what-if cost model's estimate, and build the candidate indexes it suggests.                                                                                                                                                     |
| `/survey`    | **Survey map.** Every system the report covered, filterable by component, technique, venue and year, with links to the papers and two corrected citations.                                                                                                                                                                       |
| `/methods`   | **Methods.** Data provenance, methods, evaluation design, headline results, assumptions, limitations, what I'd change, the AI use statement, the model card, the data card and the decision records (`/methods/decisions/DR-00N-…`).                                                                                             |
| `/ai-log`    | **AI audit log.** Every LLM call made from this browser, with the message sent, the proposal, the validator's verdict, latency, tokens, the human decision and the measured result. JSON and CSV export. Stored only in the browser.                                                                                             |
| `/about`     | Subject, team, original vs revived stack, how faithful each port is, and the academic-integrity note.                                                                                                                                                                                                                            |

## The 2026 upgrade: statistical rigour and governed GenAI

- **Benchmark with uncertainty.** Every advisor runs on R seeded replicate workloads (default 10). Means carry 95% percentile-bootstrap intervals, comparisons with AutoAdmin's greedy what-if search are paired (mean difference, ratio of means, Cohen's d_z, exact sign test, Wilson interval on the share of replicates won), and the bandit's regret is measured against the hindsight-optimal fixed configuration. A drift sweep repeats everything from a static to a shifting workload. Seeds are shown with every result.
- **Statistics you can check.** The helpers in `web/src/lib/stats/` are unit tested against numpy, scipy and statsmodels (`scripts/verify_stats.py`) and base R (`scripts/verify_stats.R`).
- **Database journey.** The Louvre database Rin designed in INFO20003 (2020) ships byte for byte and runs in the arena and the benchmark with a museum workload: ticket sales by hour, takings, barcode checks, wing footfall, entrance arrivals, audio-guide hires and exhibition bookings. The landing page and `/methods` link it to [its 2020 design](https://info20003-louvre-ops-db.vercel.app).
- **LLM index advisor, bring your own key.** See below.
- **Methods, decision records and cards.** `/methods` documents provenance, evaluation design, assumptions and limitations. Five decision records and the model and data cards live in [`docs/`](docs/).

### What the benchmark found

On measured SQLite with 10 replicates, the bandit beat greedy what-if search on total time for static and HTAP workloads (for example 24% less on the TPC-H-like static workload, 95% CI 26% to 21% less) and lost on shifting workloads (28% more, 26% to 30% more). On build + run time, without recommendation, it was slower than greedy on the static workloads too: its advantage on these small workloads is that it never pays for a what-if search. The numbers, and why they differ from the paper the report quoted, are in [DR-003](docs/decisions/DR-003-bandit-formulation.md) and [`docs/benchmark-numbers.json`](docs/benchmark-numbers.json).

## Bring your own key (optional AI)

The site is fully functional without any AI. The LLM index advisor on `/arena` and `/benchmark` is optional:

1. Open **AI settings** (the key icon in the header). Choose Anthropic (default, Claude Haiku 4.5 or Claude Sonnet 5.5) or OpenAI (any model id) and paste **your own** API key.
2. The key is kept in `sessionStorage` (this tab) unless you tick "remember on this device" (`localStorage`). "Forget key" removes it. It is sent only to the provider, directly from your browser. This site has no server, never receives the key and never logs it.
3. Ask for a proposal. The model sees the schema and its statistics, round 1 of the workload and SQLite's plans, and replies in a fixed JSON structure. The lab validates every index against the schema and the budget, writes the `CREATE INDEX` statements itself, labels the output "AI-generated" and builds nothing until you accept, edit or reject it.
4. Run the arena or the benchmark with "LLM advisor" ticked to measure the proposal against greedy and the bandit with the same seeded workloads and paired statistics.

Every call, decision and measurement is appended to an audit log in your browser's IndexedDB. View it at `/ai-log` and export it as JSON or CSV. The AI use statement on `/methods` says what the AI does, what it never does and what is sent to the provider. The approach is informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk Management Framework. It is not a claim of compliance with any of them.

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
- **zod** for validating LLM replies, `react-markdown` for the decision records and cards, `fake-indexeddb` in tests

No backend and no database server: every page is static, and all computation happens either at build time or in the visitor's browser. Each tab gets its own in-memory SQLite database, discarded when the tab closes. The only things that persist are in the visitor's own browser: optional AI settings, the key if they choose to keep it, and the AI audit log. There are no environment variables to set.

## Repository structure

```text
.
├── README.md                  this file
├── .github/workflows/ci.yml   lint, format, typecheck, test and build on every push and PR
├── docs/
│   ├── decisions/             DR-001 … DR-005 (rendered under /methods/decisions)
│   ├── model-card.md          what-if model, C²UCB bandit, QB5000 forecasters, LLM advisor
│   ├── data-card.md           TPC-H-like data, the Louvre database, workloads, what the site stores
│   └── benchmark-numbers.json the numbers the docs quote (pnpm bench:report)
├── scripts/
│   ├── verify_stats.py        reference values from numpy, scipy and statsmodels (uv run)
│   └── verify_stats.R         reference values from base R
├── coursework/                the original 2023 material, moved here with git mv (history preserved)
│   ├── README.md              what is inside and how to read it
│   ├── NOTES.md               the long-form COMP90050 revision notes (formerly the root README)
│   ├── images/                screenshots referenced by the notes
│   ├── presentation/          Group 40's report drafts and slide deck (PDF, student numbers redacted)
│   ├── project/REFERENCES.md  the survey's reading list, as citations
│   └── _archive/              the pre-2026 README, verbatim
└── web/                       the deployable Next.js app (Vercel root)
    ├── content/               mirror of docs/ for the Vercel build (pnpm docs:sync)
    ├── public/data/louvre.db.gz       the INFO20003 Louvre database (SHA-256 checked in tests)
    ├── scripts/copy-sqlite-wasm.mjs   copies sql.js's .wasm into public/vendor/ before dev/build
    ├── scripts/sync-docs.mjs          mirrors docs/ into content/
    ├── scripts/bench-report.report.ts regenerates docs/benchmark-numbers.json
    └── src/
        ├── app/               routes: /, /arena, /benchmark, /forecast, /console, /survey, /methods, /ai-log, /about
        ├── components/        layout/, home/, arena/, bench/, ai/, journey/, content/, forecast/, console/, survey/, charts/, shared/, ui/
        ├── hooks/             use-lab-worker, use-element-width, use-ai-settings
        ├── server/            build-time loader for the decision records, cards and benchmark numbers
        ├── workers/           lab.worker.ts (SQLite + advisors + benchmark + forecasting) and its message protocol
        └── lib/               framework-free domain logic, each module unit-tested
            ├── db/            schema types, deterministic TPC-H-like generator and optimiser statistics
            ├── datasets/      dataset registry; louvre/ (schema, provenance, loader, museum workload)
            ├── stats/         bootstrap, Wilson, sign test, d_z (checked against Python and R)
            ├── bench/         the repeated-run benchmark and its summaries
            ├── ai/            BYOK provider adapters, key storage, index-advisor prompt and validator, audit log
            ├── engine/        what-if cost model, EXPLAIN parser, SQLite and simulated executors
            ├── workload/      12 query templates + 1 UPDATE; static, shifting, random, HTAP scenarios
            ├── advisors/      DROP, AutoAdmin, DB2 Advisor, CoPhy, MAB (C²UCB), the LLM and hindsight advisors
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

Documentation and reference numbers:

```bash
pnpm docs:sync      # after editing docs/: mirror it into web/content/ (a test fails until you do)
pnpm bench:report   # about two minutes: regenerate docs/benchmark-numbers.json, then pnpm docs:sync
cd .. && uv run scripts/verify_stats.py && Rscript scripts/verify_stats.R   # refresh the stats fixtures
```

## Data and generated artefacts

There are no course datasets in the app. The one shipped data file is the Louvre database from Rin's own INFO20003 revival.

- **Louvre database.** `web/public/data/louvre.db.gz` is the INFO20003 revival's `web/data/louvre.db` (main branch, commit c0312f0), gzip-compressed. Its uncompressed SHA-256 (`b762146e…`) is checked by a unit test and matches the [public download](https://info20003-louvre-ops-db.vercel.app/data/louvre.db). The data is synthetic: five years of simulated museum activity from seed 20200403. The arena loads every table with only its INTEGER PRIMARY KEY, so every secondary index is an advisor's choice ([DR-004](docs/decisions/DR-004-louvre-dataset-in-the-arena.md), [data card](docs/data-card.md)).
- **Database.** `web/src/lib/db/generate.ts` builds a TPC-H-shaped database (region, nation, supplier, customer, part, orders, lineitem) from a seed, following TPC-H's value domains, date rules and cardinality ratios at a browser-friendly scale (3k to 15k orders). The Web Worker loads it into SQLite on demand.
- **Workloads and traces.** Query instances and the forecasting lab's three-week arrival-rate trace are generated from seeds, so every run is reproducible.
- **Build-time numbers.** The landing page's pipeline counts and the forecasting lab's default run are computed during `next build` by the same TypeScript modules the browser uses.
- **SQLite binary.** `web/scripts/copy-sqlite-wasm.mjs` copies `sql-wasm.wasm` from the installed `sql.js` package into `web/public/vendor/` (git-ignored) before `dev` and `build`.

## Credits

**Group 40, COMP90050 Winter 2023:** Xiaoyi Liu, Runqiu Fei, Qingxuan Yang and Sunchuangyu Huang wrote the survey report and presentation. The 2026 interactive revival was built by Sunchuangyu (Rin) Huang.

The algorithms belong to their authors; see the survey map for full references, in particular Whang (DROP), Chaudhuri and Narasayya (AutoAdmin), Valentin et al. (DB2 Advisor), Dash, Polyzotis and Ailamaki (CoPhy), Perera, Oetomo, Rubinstein and Borovica-Gajic (DBA bandits / No DBA? No regret!), Ma et al. (QueryBot 5000) and Kossmann and Schlosser (the self-driving component framework).

## Academic integrity

The original report drafts and slides are preserved under [`coursework/presentation/`](coursework/presentation/) for reference (with the team's student numbers and e-mail addresses redacted) and are not served by the website. University teaching material, the assignment brief and third-party papers were removed from the current tree in 2026; see [`coursework/README.md`](coursework/README.md#what-changed-in-2026). The site paraphrases the assignment brief rather than reproducing it, and paper summaries are our own words. If you are taking COMP90050 or a similar subject, do your own work: submitting any part of this repository as your own is academic misconduct.
