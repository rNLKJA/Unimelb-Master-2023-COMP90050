import { ArrowDown, ArrowRight, ArrowUpRight, DraftingCompass, Gauge } from "lucide-react";
import Link from "next/link";
import { LOUVRE_PROVENANCE } from "@/lib/datasets/louvre/schema";
import { INFO20003 } from "@/lib/site";
import { cn } from "@/lib/utils";

const STOPS = [
  {
    year: "2020",
    subject: INFO20003.subject,
    term: "Semester 1",
    icon: DraftingCompass,
    verb: "Design the database",
    body: "A ticketing and visitor database for the Louvre, designed from a written brief: who buys what, which entrance and wing a ticket passes, audio guides, timed exhibition slots.",
    topics: [
      "Conceptual ER model (Chen)",
      "Crow's foot physical model",
      "Relational schema",
      "SQL",
    ],
  },
  {
    year: "2023",
    subject: "COMP90050 Advanced Database Systems",
    term: "Winter term",
    icon: Gauge,
    verb: "Make it run well, on its own",
    body: "What happens after design: how rows are stored, how indexes and the optimiser decide a query's cost, and how a self-driving database chooses its own indexes.",
    topics: ["Storage", "Indexing", "Query optimisation", "Self-driving index selection"],
  },
] as const;

const button =
  "border-border bg-surface hover:bg-surface-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors";

/**
 * The database journey: the Louvre database designed in INFO20003 (2020) is
 * the same file the COMP90050 arena (2023 coursework, 2026 lab) tunes.
 */
export function DatabaseJourney({
  className,
  headingLevel = 2,
}: {
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <div
      className={cn(
        "border-border bg-surface relative overflow-hidden rounded-2xl border",
        className,
      )}
    >
      <div
        className="bg-console-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black_10%,transparent_65%)] opacity-40"
        aria-hidden
      />
      <div className="relative space-y-6 p-5 sm:p-8">
        <div className="max-w-3xl space-y-2">
          <p className="kicker text-mint">Database journey</p>
          <Heading className="text-2xl font-semibold sm:text-3xl">
            One Louvre database, from design to self-tuning
          </Heading>
          <p className="text-muted-foreground leading-relaxed">
            In 2020 Sunchuangyu (Rin) Huang designed this database for an individual INFO20003
            assignment. In 2023, COMP90050 taught what a database does with a design once it runs.
            The arena now loads the INFO20003 file byte for byte and lets the survey&apos;s index
            advisors, and your own LLM if you bring a key, tune it.
          </p>
        </div>

        <ol className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
          {STOPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.year} className="contents">
                {i === 1 && (
                  <span
                    aria-hidden
                    className="text-mint flex items-center justify-center py-1 md:px-1"
                  >
                    <ArrowRight className="hidden size-5 md:block" />
                    <ArrowDown className="size-5 md:hidden" />
                  </span>
                )}
                <article className="border-border bg-surface-2/60 flex flex-col rounded-xl border p-4 sm:p-5">
                  <p className="flex items-center gap-2">
                    <span className="bg-mint text-primary-foreground rounded-md px-2 py-0.5 font-mono text-xs font-medium">
                      {s.year}
                    </span>
                    <span className="text-muted-foreground font-mono text-[11px] tracking-wide uppercase">
                      {s.term}
                    </span>
                  </p>
                  <p className="mt-3 flex items-center gap-2 font-medium">
                    <Icon className="text-mint size-4 shrink-0" aria-hidden />
                    {s.subject}
                  </p>
                  <p className="font-display mt-1 text-lg font-semibold">{s.verb}</p>
                  <p className="text-muted-foreground mt-1.5 flex-1 text-sm leading-relaxed">
                    {s.body}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${s.subject} topics`}>
                    {s.topics.map((t) => (
                      <li
                        key={t}
                        className="border-border bg-surface rounded-full border px-2 py-0.5 text-[11px]"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/arena?dataset=louvre"
            className={cn(
              button,
              "bg-primary text-primary-foreground hover:bg-primary/85 border-transparent",
            )}
          >
            Tune the Louvre in the arena <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/benchmark?dataset=louvre" className={button}>
            Benchmark it
          </Link>
          <a href={INFO20003.site} className={button}>
            The 2020 design: Louvre Ops DB <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          <a href={INFO20003.erd} className={button}>
            Its ER diagrams <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </div>
        <p className="text-muted-foreground font-mono text-[11px] leading-relaxed break-words">
          Shared file: louvre.db · 19 tables · about 66,000 synthetic rows · SHA-256{" "}
          {LOUVRE_PROVENANCE.sha256.slice(0, 12)}… ·{" "}
          <Link
            href="/methods/decisions/DR-004-louvre-dataset-in-the-arena"
            className="text-foreground decoration-mint underline underline-offset-2"
          >
            why the arena drops its indexes (DR-004)
          </Link>
        </p>
      </div>
    </div>
  );
}
