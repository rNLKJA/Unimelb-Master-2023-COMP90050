/**
 * Showcase media: the screenshots and workflow recordings made by the
 * Playwright tour (`pnpm showcase`, see e2e/showcase.spec.ts and
 * scripts/showcase-media.mjs). The tour, the /tour page and the README use
 * the same names, captions and step lists, so they live here.
 *
 * Output locations
 *   docs/showcase/<shot>.png                         optimised screenshots (README)
 *   docs/showcase/<workflow>.gif                     optimised walkthroughs (README)
 *   web/public/showcase/<shot>.webp, <shot>-thumb.webp   screenshots for /tour
 *   web/public/showcase/<workflow>.mp4, -poster.webp, .vtt   videos for /tour
 */

import { NAV } from "./site";

export const SHOWCASE_PUBLIC_DIR = "/showcase";

/** Production site the tour runs against unless BASE_URL is set. */
export const SHOWCASE_DEFAULT_BASE_URL = "https://comp90050-self-driving-db.vercel.app";

export const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
/** Captured at deviceScaleFactor 2 (780 × 1688), then downscaled by the media script. */
export const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
export const MOBILE_OUTPUT = { width: 585, height: 1266 } as const;
export const THUMB_WIDTH = 720;
export const VIDEO_SIZE = { width: 1280, height: 800 } as const;

/** Seeds and settings the tour uses, so the captions can state them. */
export const SHOWCASE_SEED = 2023;
export const SHOWCASE_REPLICATES = 10;

/** Shown on screen whenever the mocked LLM reply is in view. */
export const MOCK_AI_NOTICE = "Mocked AI response for illustration · no model was called";

export interface ShowcaseShot {
  /** File name without extension. */
  name: string;
  title: string;
  /** One line, used as the README caption and the image description. */
  caption: string;
  route: string;
  viewport: "desktop" | "mobile";
  theme: "light" | "dark";
}

export const SHOWCASE_SHOTS = [
  {
    name: "01-landing-light",
    title: "Landing page",
    caption:
      "Landing page: the 2023 survey rebuilt as a lab where five index advisors race on SQLite in the browser.",
    route: "/",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "02-landing-dark",
    title: "Landing page, dark theme",
    caption: "The same page in the dark theme.",
    route: "/",
    viewport: "desktop",
    theme: "dark",
  },
  {
    name: "03-explainer-autonomy",
    title: "Levels of autonomy explainer",
    caption:
      "Scroll-driven explainer: the autonomy ladder from level 0 (manual) to a self-driving DBMS.",
    route: "/#explainer",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "04-survey-taxonomy",
    title: "Survey map taxonomy",
    caption:
      "Survey map: every system the report covered, filtered here to index selection systems that run in the arena.",
    route: "/survey#taxonomy",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "05-arena-louvre",
    title: "Arena on the Louvre database",
    caption:
      "Arena on the INFO20003 Louvre database: total time split into recommendation, index builds and queries, round by round.",
    route: "/arena?dataset=louvre",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "06-arena-index-timeline",
    title: "Index timeline and per-template times",
    caption:
      "Which indexes each advisor held in each round, and where the execution time went per museum query.",
    route: "/arena?dataset=louvre",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "07-benchmark-means",
    title: "Benchmark with confidence intervals",
    caption:
      "Benchmark: 10 seeded replicates per advisor, mean cumulative time with 95% percentile-bootstrap intervals.",
    route: "/benchmark?dataset=louvre",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "08-benchmark-paired",
    title: "Paired comparison and regret",
    caption:
      "Paired comparison against greedy what-if search (change, d_z, sign test, Wilson share won) and the bandit's regret.",
    route: "/benchmark?dataset=louvre",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "09-forecast",
    title: "Forecasting lab",
    caption:
      "QueryBot 5000's pipeline: templatise statements, cluster templates that move together, forecast each cluster.",
    route: "/forecast",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "10-console",
    title: "SQL console",
    caption:
      "SQL console: SQLite's query plan and timing next to the what-if model's estimate for each candidate index.",
    route: "/console",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "11-ai-settings",
    title: "Bring-your-own-key AI settings",
    caption:
      "Optional AI settings: your own Anthropic or OpenAI key, kept in this browser and sent only to that provider.",
    route: "/benchmark",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "12-llm-proposal-mocked",
    title: "LLM proposal, validated (mocked)",
    caption:
      "LLM index advisor with a mocked reply for illustration: labelled AI-generated, checked by the validator, decided by a person.",
    route: "/benchmark?dataset=louvre#llm",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "13-ai-log",
    title: "AI audit log",
    caption:
      "AI audit log: every call, the validator's verdict, the human decision and the measurement, exportable as JSON or CSV.",
    route: "/ai-log",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "14-methods",
    title: "Methods and decisions",
    caption:
      "Methods: provenance, evaluation design, limitations, the AI use statement, model and data cards, decision records.",
    route: "/methods",
    viewport: "desktop",
    theme: "light",
  },
  {
    name: "15-mobile-landing",
    title: "Mobile: landing",
    caption: "Mobile (390 px): landing page.",
    route: "/",
    viewport: "mobile",
    theme: "light",
  },
  {
    name: "16-mobile-arena",
    title: "Mobile: arena results",
    caption: "Mobile: the arena's leaderboard after a run on the Louvre database.",
    route: "/arena?dataset=louvre",
    viewport: "mobile",
    theme: "light",
  },
  {
    name: "17-mobile-benchmark",
    title: "Mobile: benchmark, dark theme",
    caption: "Mobile, dark theme: benchmark means with their 95% intervals.",
    route: "/benchmark?dataset=louvre",
    viewport: "mobile",
    theme: "dark",
  },
] as const satisfies readonly ShowcaseShot[];

export type ShowcaseShotName = (typeof SHOWCASE_SHOTS)[number]["name"];

export interface ShowcaseWorkflow {
  /** File name of the recording (mp4, gif, poster, vtt). */
  slug: string;
  title: string;
  summary: string;
  /** Pages the journey visits (links on /tour). */
  routes: readonly string[];
  /** On-screen captions, one per step, in order. */
  steps: readonly string[];
  /** Which step's midpoint makes the poster frame (0-based). */
  posterStep: number;
}

export const SHOWCASE_WORKFLOWS = [
  {
    slug: "levels-of-autonomy",
    title: "Levels of autonomy",
    summary:
      "Scroll the survey's explainer from a manual database to a self-driving one, then filter the taxonomy of every system the report covered.",
    routes: ["/", "/survey"],
    steps: [
      "The survey's argument as a scroll-driven explainer. Level 0: people choose every index.",
      "Levels 1 and 2: advisors such as AutoAdmin recommend, and a DBA still decides.",
      "Levels 3 to 5, then the predictor, tuner and organiser of a self-driving system.",
      "The survey map: Table 1's six levels of autonomy, then a taxonomy of every system covered.",
      "Filter by component: index selection only. Then by technique: multi-armed bandits.",
      "Only the systems implemented in this lab's arena, or a search by name. Clear to see all.",
    ],
    posterStep: 1,
  },
  {
    slug: "louvre-arena",
    title: "Index advisor arena on the Louvre DB",
    summary:
      "Load the Louvre database from INFO20003, generate a museum workload, race no index against greedy what-if search and the bandit, then repeat it ten times for intervals.",
    routes: ["/arena?dataset=louvre", "/benchmark?dataset=louvre"],
    steps: [
      "The arena: index advisors tune a live SQLite database (WebAssembly) in your browser.",
      "Pick the Louvre database designed in INFO20003: 19 tables of synthetic museum activity.",
      "A museum workload from seed 2023, in three phases: box office, gallery floor, exhibitions.",
      "Three contenders: no index, AutoAdmin's greedy what-if search and the C²UCB bandit.",
      "One measured run: recommendation, index builds and queries, and cumulative time per round.",
      "One run is an anecdote. The benchmark replays 10 seeded workloads (seeds 2023 to 2032).",
      "Mean cumulative time with 95% bootstrap intervals, then paired differences against greedy.",
      "Change, effect size d_z, sign test and the share won; then the bandit's regret with its band.",
    ],
    posterStep: 4,
  },
  {
    slug: "llm-advisor",
    title: "LLM as advisor (bring your own key)",
    summary:
      "Open the bring-your-own-key settings, ask the LLM index advisor for a proposal (a mocked reply here), let the validator and a person decide, then benchmark it and read the audit log.",
    routes: ["/benchmark?dataset=louvre", "/ai-log"],
    steps: [
      "Optional AI: open AI settings. Your own Anthropic or OpenAI key stays in this browser.",
      "Here a placeholder key is typed and every provider request is intercepted. No model is called.",
      "Ask the LLM index advisor. It is sent the schema, round 1 of the workload and SQLite's plans.",
      "A mocked reply for illustration, labelled AI-generated. The validator rejects invalid indexes.",
      "A person decides: untick one index and accept the edit. The decision is logged first.",
      "The approved indexes join the benchmark: same seeded workloads, paired against greedy.",
      "Compare on build + run time: the provider's response time says nothing about the advice.",
      "The audit log: call, validator verdict, decision and measurement. JSON and CSV export.",
    ],
    posterStep: 3,
  },
] as const satisfies readonly ShowcaseWorkflow[];

export type ShowcaseWorkflowSlug = (typeof SHOWCASE_WORKFLOWS)[number]["slug"];

/** "/benchmark?dataset=louvre#llm" → "/benchmark". */
export const routePath = (route: string) => route.replace(/[?#].*$/, "") || "/";

/** Pages the tour visits that are not in the main navigation. */
const EXTRA_LABELS: Record<string, string> = { "/ai-log": "AI audit log" };

/** The navigation label of a route ("/arena?dataset=louvre" → "Arena"), or null if unknown. */
export function routeLabel(route: string): string | null {
  const path = routePath(route);
  return NAV.find((n) => n.href === path)?.label ?? EXTRA_LABELS[path] ?? null;
}
