"use client";

import { ExternalLink, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  COMPONENT_LABELS,
  PAPERS,
  TECHNIQUE_LABELS,
  type Component,
  type Paper,
  type Technique,
} from "@/lib/survey/papers";
import { cn } from "@/lib/utils";

const TECH_COLOR: Record<Technique, string> = {
  heuristic: "var(--amber)",
  "constraint-lp": "var(--violet)",
  "machine-learning": "var(--sky)",
  "reinforcement-learning": "var(--coral)",
  bandit: "var(--mint)",
  analytical: "var(--adv-none)",
  framework: "var(--muted-foreground)",
};

function Chip({
  on,
  onClick,
  children,
  color,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        on
          ? "border-foreground/30 bg-surface-2 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}

function venueFamily(v: string): string {
  if (v.startsWith("SIGMOD")) return "SIGMOD";
  if (v === "PVLDB" || v === "VLDB") return "VLDB / PVLDB";
  if (v.includes("thesis")) return "Thesis";
  if (["ICDE", "CIDR", "IEEE TKDE", "EDBT"].includes(v)) return v;
  return "Other";
}

export function TaxonomyExplorer() {
  const [components, setComponents] = useState<Set<Component>>(new Set());
  const [techniques, setTechniques] = useState<Set<Technique>>(new Set());
  const [venues, setVenues] = useState<Set<string>>(new Set());
  const [onlyArena, setOnlyArena] = useState(false);
  const [query, setQuery] = useState("");
  const years = PAPERS.map((p) => p.year);
  const [from, setFrom] = useState(Math.min(...years));
  const [to, setTo] = useState(Math.max(...years));

  const venueList = useMemo(() => [...new Set(PAPERS.map((p) => venueFamily(p.venue)))].sort(), []);
  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PAPERS.filter(
      (p) =>
        (components.size === 0 || components.has(p.component)) &&
        (techniques.size === 0 || techniques.has(p.technique)) &&
        (venues.size === 0 || venues.has(venueFamily(p.venue))) &&
        (!onlyArena || p.arena) &&
        p.year >= from &&
        p.year <= to &&
        (q === "" || `${p.system} ${p.title} ${p.authors} ${p.summary}`.toLowerCase().includes(q)),
    ).sort((a, b) => a.year - b.year || a.system.localeCompare(b.system));
  }, [components, techniques, venues, onlyArena, from, to, query]);

  const reset = () => {
    setComponents(new Set());
    setTechniques(new Set());
    setVenues(new Set());
    setOnlyArena(false);
    setQuery("");
    setFrom(Math.min(...years));
    setTo(Math.max(...years));
  };
  const yearOptions = [...new Set(years)].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="border-border bg-surface space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex min-w-[14rem] flex-1 items-center">
            <Search
              className="text-muted-foreground pointer-events-none absolute left-3 size-4"
              aria-hidden
            />
            <span className="sr-only">Search systems, titles and authors</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search systems, titles, authors…"
              className="border-input bg-surface-2/60 placeholder:text-muted-foreground w-full rounded-lg border py-2 pr-3 pl-9 text-sm"
            />
          </label>
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <span className="kicker">Years</span>
            <select
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="border-input bg-surface rounded-md border px-2 py-1.5 font-mono text-xs"
              aria-label="From year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <span aria-hidden>–</span>
            <select
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="border-input bg-surface rounded-md border px-2 py-1.5 font-mono text-xs"
              aria-label="To year"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <Chip on={onlyArena} onClick={() => setOnlyArena((v) => !v)} color="var(--mint)">
            Runs in the arena
          </Chip>
        </div>
        <div className="grid gap-3 md:grid-cols-[7rem_1fr]">
          <p className="kicker pt-1.5">Component</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(COMPONENT_LABELS) as Component[]).map((c) => (
              <Chip
                key={c}
                on={components.has(c)}
                onClick={() => toggle(components, c, setComponents)}
              >
                {COMPONENT_LABELS[c]}
              </Chip>
            ))}
          </div>
          <p className="kicker pt-1.5">Technique</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(TECHNIQUE_LABELS) as Technique[]).map((t) => (
              <Chip
                key={t}
                on={techniques.has(t)}
                onClick={() => toggle(techniques, t, setTechniques)}
                color={TECH_COLOR[t]}
              >
                {TECHNIQUE_LABELS[t]}
              </Chip>
            ))}
          </div>
          <p className="kicker pt-1.5">Venue</p>
          <div className="flex flex-wrap gap-1.5">
            {venueList.map((v) => (
              <Chip key={v} on={venues.has(v)} onClick={() => toggle(venues, v, setVenues)}>
                {v}
              </Chip>
            ))}
          </div>
        </div>
        <div className="border-border flex items-center justify-between border-t pt-3 text-sm">
          <p aria-live="polite" className="text-muted-foreground">
            <span className="text-foreground font-mono">{rows.length}</span> of {PAPERS.length}{" "}
            systems
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            <X className="size-3.5" aria-hidden /> Clear filters
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-xl border border-dashed p-10 text-center text-sm">
          Nothing matches those filters.{" "}
          <button type="button" className="text-mint underline" onClick={reset}>
            Clear them
          </button>
          .
        </div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((p) => (
            <PaperRow key={p.id} p={p} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PaperRow({ p }: { p: Paper }) {
  return (
    <li id={p.id} className="border-border bg-surface scroll-mt-24 rounded-xl border p-4 sm:p-5">
      <div className="grid gap-3 md:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
        <span className="font-display text-muted-foreground tabular text-2xl font-semibold">
          {p.year}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{p.system}</h3>
            <span className="bg-surface-2 text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px]">
              <span
                className="size-1.5 rounded-full"
                style={{ background: TECH_COLOR[p.technique] }}
                aria-hidden
              />
              {TECHNIQUE_LABELS[p.technique]}
            </span>
            <span className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]">
              {COMPONENT_LABELS[p.component]}
            </span>
            {p.arena && (
              <span className="bg-mint-soft text-accent-foreground rounded-full px-2 py-0.5 text-[11px]">
                in the arena
              </span>
            )}
            {p.reportRef && (
              <span className="text-muted-foreground font-mono text-[11px]">
                report [{p.reportRef}]
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{p.summary}</p>
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="italic">{p.title}</span> — {p.authors}, {p.venue} {p.year}
          </p>
          {p.erratum && (
            <p className="border-amber/40 bg-amber/10 text-foreground mt-2 rounded-md border px-3 py-2 text-xs">
              <span className="font-medium">Correction: </span>
              {p.erratum}
            </p>
          )}
        </div>
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className="border-border text-muted-foreground hover:text-foreground inline-flex h-fit items-center gap-1 self-start rounded-md border px-2.5 py-1 text-xs"
          aria-label={`Open ${p.system} paper (${p.url.includes("doi.org") ? "DOI" : "link"})`}
        >
          {p.url.includes("doi.org")
            ? "DOI"
            : p.url.includes("dblp")
              ? "dblp"
              : p.url.includes("arxiv")
                ? "arXiv"
                : "Link"}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </li>
  );
}
