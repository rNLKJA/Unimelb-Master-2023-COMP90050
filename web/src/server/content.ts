/**
 * Decision records, the model and data cards and the canonical benchmark
 * numbers, read at build time from web/content/ (a mirror of the repository's
 * docs/, see scripts/sync-docs.mjs). Imported only by server components.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

const CONTENT = path.join(process.cwd(), "content");

export interface DecisionRecord {
  slug: string;
  /** e.g. "DR-003". */
  id: string;
  title: string;
  status: string;
  decided: string;
  scope: string;
  /** Markdown after the metadata list. */
  body: string;
}

function field(md: string, name: string): string {
  const m = new RegExp(`^- \\*\\*${name}:\\*\\* ([\\s\\S]+?)(?=\\n- \\*\\*|\\n\\n)`, "m").exec(md);
  return m ? m[1].replace(/\s*\n\s*/g, " ").trim() : "";
}

export function parseDecision(slug: string, md: string): DecisionRecord {
  const first = md.split("\n", 1)[0];
  const m = /^# (DR-\d{3}): (.+)$/.exec(first);
  if (!m) throw new Error(`${slug}: the first line must be "# DR-NNN: Title"`);
  const rest = md.slice(first.length);
  const body = rest.slice(rest.indexOf("\n## ")).trim();
  return {
    slug,
    id: m[1],
    title: m[2],
    status: field(md, "Status"),
    decided: field(md, "Decided"),
    scope: field(md, "Scope"),
    body,
  };
}

export const listDecisions = cache(async (): Promise<DecisionRecord[]> => {
  const dir = path.join(CONTENT, "decisions");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  return Promise.all(
    files.map(async (f) =>
      parseDecision(f.replace(/\.md$/, ""), await readFile(path.join(dir, f), "utf8")),
    ),
  );
});

export async function getDecision(slug: string): Promise<DecisionRecord | null> {
  return (await listDecisions()).find((d) => d.slug === slug) ?? null;
}

export type CardName = "model-card" | "data-card";

export const getCard = cache(async (name: CardName): Promise<{ title: string; body: string }> => {
  const md = await readFile(path.join(CONTENT, `${name}.md`), "utf8");
  const first = md.split("\n", 1)[0];
  return { title: first.replace(/^# /, ""), body: md.slice(first.length).trim() };
});

interface Interval {
  estimate: number;
  lower: number;
  upper: number;
}

export interface BenchmarkNumbers {
  generated: string;
  node: string;
  platform: string;
  settings: Record<string, unknown>;
  results: Record<
    string,
    | {
        total: {
          meanMs: Record<string, Interval>;
          vsGreedy: Record<string, { ratio: Interval; wins: number; losses: number }>;
          regret: { finalMs: Interval; relative: Interval } | null;
        };
        buildRun: { vsGreedy: Record<string, { ratio: Interval }> };
      }
    | Record<string, { vsGreedy: Record<string, { ratio: Interval }> }>
  >;
}

/** The numbers quoted in the decision records and the model card (pnpm bench:report). */
export const getBenchmarkNumbers = cache(async (): Promise<BenchmarkNumbers> => {
  return JSON.parse(
    await readFile(path.join(CONTENT, "benchmark-numbers.json"), "utf8"),
  ) as BenchmarkNumbers;
});
