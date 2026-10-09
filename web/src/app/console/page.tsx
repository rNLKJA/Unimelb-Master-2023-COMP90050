import type { Metadata } from "next";
import { ConsoleApp } from "@/components/console/console-app";

export const metadata: Metadata = {
  title: "SQL console",
  description:
    "Query a TPC-H-shaped SQLite database in your browser, build indexes, and compare SQLite's EXPLAIN QUERY PLAN and timing with the what-if cost model the index advisors use.",
};

export default function ConsolePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="kicker text-mint">SQLite · WebAssembly · this tab only</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">SQL console</h1>
        <p className="text-muted-foreground leading-relaxed">
          Every advisor in the arena rests on one question to the optimiser:{" "}
          <em>what would this query cost if that index existed?</em> Ask it yourself. Run a
          template, read SQLite&apos;s plan and timing, see what the what-if model predicts for each
          candidate index, then build one and watch the plan change.
        </p>
      </header>
      <ConsoleApp />
    </div>
  );
}
