import type { Metadata } from "next";
import { ArenaApp } from "@/components/arena/arena-app";

export const metadata: Metadata = {
  title: "Index advisor arena",
  description:
    "Five index advisors from 1985 to 2023 tune a live SQLite database in your browser: DROP, AutoAdmin, DB2 Advisor, CoPhy and a C²UCB multi-armed bandit.",
};

export default function ArenaPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="kicker text-mint">Live experiment</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Index advisor arena</h1>
        <p className="text-muted-foreground leading-relaxed">
          Our survey traced index selection from 1985 heuristics to 2020s bandits. Here they run
          against each other: the same workload, the same storage budget, a real SQLite engine, and
          a stopwatch on everything — what-if calls, index builds and queries.
        </p>
      </header>
      <ArenaApp />
    </div>
  );
}
