# DR-001: Make index selection the working core of the revival and keep workload forecasting as a smaller lab

- **Status:** accepted
- **Decided:** 9 October 2026 (recording a choice made in the September 2026 revival)
- **Scope:** `web/src/lib/advisors/`, `web/src/lib/arena/`, `web/src/lib/bench/`, `web/src/lib/forecast/`, the
  `/arena`, `/benchmark` and `/forecast` pages

## Context

Group 40's 2023 survey split self-driving databases into two halves. Runqiu Fei and I wrote about index selection, from
heuristics (DROP, AutoAdmin) through integer programming (DB2 Advisor, CoPhy) to learned tuners (multi-armed bandits,
Monte Carlo tree search). Xiaoyi Liu and Qingxuan Yang wrote about workload-driven optimisation: forecasting (QB5000),
behaviour models (ModelBot2) and action planning (PilotBot0). The survey was written, not implemented. Its own
conclusion was that index selection algorithms are hard to compare because every paper benchmarks them differently.

A browser revival cannot implement everything the report covered. It has one SQLite engine, a few megabytes of data
and a few seconds of a visitor's attention.

## Decision

The revival implements the index-selection half in depth. Five advisors from the report run in one arena against a
no-index baseline, with one engine, one workload and one stopwatch. The 2026 upgrade adds a repeated-run benchmark with
confidence intervals, a second dataset and an LLM advisor on top of the same loop. The workload-driven half is
represented by a smaller forecasting lab that runs QB5000's pipeline on a synthetic trace and feeds an index tuner.
Knob tuning, learned cardinality estimation, ModelBot2 and PilotBot0 stay on the survey map as reading, not as code.

## Options considered

1. **A reading site.** The report as web pages with the survey map. Cheap, but it repeats the gap the report itself
   pointed out: nothing can be compared.
2. **Both halves in equal depth.** QB5000 needs weeks of traces and an LSTM to be faithful, and ModelBot2 and PilotBot0
   need a DBMS with internal metrics. In a browser they would be thin imitations.
3. **Index selection in depth, forecasting as a lab (chosen).**
4. **Broaden to knob tuning (OtterTune) and learned optimisers.** Interesting, but outside what Group 40 wrote, so the
   site would stop being a revival of the coursework.

## Why

Index selection has a measurable objective that fits a browser: total workload time under a storage budget, split into
recommendation, index creation and execution, the same breakdown the report's Table 2 used. It was also my half of the
report, so the ports are checked against papers I had already read closely. Implementing it answers the report's own
complaint by putting every algorithm on one engine with one stopwatch.

## What happened

- The arena runs DROP, AutoAdmin, DB2 Advisor, CoPhy and the C²UCB bandit, plus a no-index baseline. CoPhy is solved
  by branch and bound, with a node limit to keep the browser responsive, so the lab has a what-if optimum to compare
  the heuristics against whenever the search finishes.
- The benchmark repeats the arena on seeded workloads. On the TPC-H-like data at size S with measured SQLite timings,
  10 replicates, 25 rounds and a 200% budget, run in five independent sessions, the bandit took 23% less total time
  than AutoAdmin's greedy what-if search on the static workload (95% CI 24% to 21% less) and 27% more on the shifting
  workload (95% CI 22% to 32% more). These and every other benchmark number in the docs come from
  `docs/benchmark-numbers.json`, which `pnpm bench:report` regenerates (sql.js under Node 26 on an Apple M4 laptop).
  The report quoted Perera et al. finding the opposite pattern against a commercial tool: the tool won static TPC-H
  and the bandit won the dynamic workload. The lab does not reproduce that, and DR-003 explains the main reason.
- The forecasting lab stayed small. It has one synthetic three-week trace, and linear regression stands in for QB5000's
  LSTM. Its error figures describe that one trace.

## What I'd change

- Add Monte Carlo tree search (the report's other learned family) to the arena, so both learned approaches the report
  discussed can be compared.
- Give the forecasting lab several seeded traces, so its forecast errors can carry intervals like the benchmark's.
- Run the benchmark at a larger scale outside the browser, where what-if search time is small next to execution, which
  is closer to the setting the surveyed papers measured.
