import Link from "next/link";
import { PAPER_BY_ID } from "@/lib/survey/papers";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { year: 1985, id: "whang-drop", era: "Heuristic", arena: true },
  { year: 1997, id: "autoadmin-1997", era: "Heuristic", arena: true },
  { year: 2000, id: "db2-advisor", era: "Constraint / LP", arena: true },
  { year: 2011, id: "cophy", era: "Constraint / LP", arena: true },
  { year: 2017, id: "dexter", era: "Open source", arena: false },
  { year: 2018, id: "qb5000", era: "Forecasting", arena: false },
  { year: 2021, id: "dba-bandits", era: "Bandit", arena: true },
  { year: 2022, id: "wu-mcts", era: "Reinforcement learning", arena: false },
] as const;

export function Timeline() {
  return (
    <ol
      className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Milestones in index selection"
    >
      {MILESTONES.map((m) => {
        const p = PAPER_BY_ID.get(m.id)!;
        return (
          <li
            key={m.id}
            className="group border-border bg-surface hover:border-mint/60 relative rounded-xl border p-4 transition-colors"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display tabular text-3xl font-semibold">{m.year}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase",
                  m.arena
                    ? "bg-mint-soft text-accent-foreground"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {m.arena ? "in the arena" : m.era}
              </span>
            </div>
            <p className="mt-2 font-medium">{p.system}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{p.summary}</p>
            <p className="text-muted-foreground mt-3 font-mono text-[11px]">
              {p.authors} · {p.venue}
            </p>
            <Link
              href={m.arena ? "/arena" : `/survey#${p.id}`}
              className="absolute inset-0 rounded-xl"
              aria-label={`${p.system} (${m.year}) — ${m.arena ? "run it in the arena" : "see it in the survey map"}`}
            />
          </li>
        );
      })}
    </ol>
  );
}
