import type { Metadata } from "next";
import { Suspense } from "react";
import { ArenaApp, ArenaFromUrl } from "@/components/arena/arena-app";

export const metadata: Metadata = {
  title: "Index advisor arena",
  description:
    "Five index advisors from 1985 to 2023, and optionally your own LLM, tune a live SQLite database in your browser, on a TPC-H-like dataset or the Louvre database from INFO20003.",
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
          a stopwatch on everything — what-if calls, index builds and queries. Pick the TPC-H-like
          benchmark or the Louvre ticketing database designed in INFO20003.
        </p>
      </header>
      <Suspense fallback={<ArenaApp />}>
        <ArenaFromUrl />
      </Suspense>
    </div>
  );
}
