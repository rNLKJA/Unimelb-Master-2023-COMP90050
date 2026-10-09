import type { Metadata } from "next";
import { Suspense } from "react";
import { BenchApp, BenchFromUrl } from "@/components/bench/bench-app";

export const metadata: Metadata = {
  title: "Advisor benchmark",
  description:
    "Repeated, seeded runs of the index advisors with bootstrap confidence intervals, paired comparisons against greedy what-if search, the bandit's regret, a workload-drift sweep and an evaluation harness for a bring-your-own-key LLM advisor.",
};

export default function BenchmarkPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 max-w-3xl space-y-3">
        <p className="kicker text-mint">Repeated runs, with uncertainty</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">Advisor benchmark</h1>
        <p className="text-muted-foreground leading-relaxed">
          The arena shows one run. Here every advisor runs R times on seeded workloads, and each
          number comes with a 95% interval: mean workload time, paired comparisons against greedy
          what-if search, the bandit&apos;s regret against a hindsight optimum, and how all of it
          moves as the workload drifts. It runs on both datasets, in your browser.
        </p>
      </header>
      <Suspense fallback={<BenchApp />}>
        <BenchFromUrl />
      </Suspense>
    </div>
  );
}
