# DR-002: Time real SQLite in WebAssembly as the cost proxy, with a calibrated what-if model for the advisors

- **Status:** accepted
- **Decided:** 9 October 2026 (recording a choice made in the September 2026 revival)
- **Scope:** `web/src/lib/engine/` (cost model, SQLite and simulated executors), `web/src/lib/arena/run.ts`,
  `web/src/lib/bench/`

## Context

Every advisor in the survey needs two things. Offline tools need a what-if optimiser that estimates a query's cost
under hypothetical indexes, and every advisor needs a way to measure what a configuration actually costs. Commercial
tools use the DBMS's own optimiser for both. A static website has no database server, so both have to run in the
visitor's browser.

## Decision

The stopwatch is real: sql.js (SQLite 3.49 compiled to WebAssembly) runs in a Web Worker, and index creation and query
execution are wall-clock measurements on the visitor's machine. The what-if questions go to a System R style cost
model whose constants were calibrated against sql.js timings and whose access-path rules mirror SQLite's planner.
Recommendation time is the advisors' own JavaScript run time plus a nominal 0.02 ms per what-if call. A simulated
engine charges each plan with a second, deliberately different set of constants plus seeded noise. It is used for
instant runs, for tests and as a check on the measured results.

## Options considered

1. **SQLite only, asking SQLite for estimates.** SQLite has no what-if interface for hypothetical indexes, so every
   candidate would have to be built to be costed. That defeats the offline tools.
2. **Cost model only.** Fast and deterministic, but it would compare advisors against the model they optimise, which
   is circular.
3. **Real SQLite for measurement and a calibrated model for what-if calls (chosen),** plus a simulated engine.
4. **A hosted PostgreSQL with HypoPG.** Faithful to the papers, but it needs a server, costs money and stores
   visitors' sessions.

## Why

Measuring on a real engine keeps the comparison honest: an advisor that trusts a wrong estimate pays for it in
measured milliseconds, which is the misestimation problem that motivated learned tuners. Keeping the what-if model in
the lab's own code makes it inspectable. Unit tests check that it picks the same index as SQLite's planner for 10 of
the 13 TPC-H-like templates and 12 of the 13 Louvre templates, and that it estimates index sizes within 10% (TPC-H-like)
and 15% (Louvre) of SQLite's page counts.

## What happened

- The model and SQLite agree on which index the tested templates use, but not on how long things take. With no
  indexes, the simulated engine estimates 976 ms (95% CI 938 to 1010) for 25 static TPC-H rounds, averaged over 10
  replicates, where measured SQLite takes 539 ms (95% CI 528 to 557). On the Louvre data it estimates 255 ms where
  SQLite takes 208 ms, about 23% too high. The constants were fitted on the TPC-H-like data, and Louvre's text
  timestamps compare at a different cost. (Numbers from `docs/benchmark-numbers.json`.)
- The direction of the bandit-against-greedy comparison matched between the two engines in all 16 settings I ran (two
  datasets, each with three scenarios and five drift levels), and the sizes did not. For example, the bandit against AutoAdmin on static
  TPC-H was 17% faster on the simulated engine and 24% faster on SQLite.
- Charging recommendation as real JavaScript time is the weakest part of the design. The workloads are small (hundreds
  of milliseconds in total), so an advisor's own search time is a large share of the total. On static TPC-H,
  AutoAdmin spent 61 ms recommending on average, about as much as it then spent running queries (64 ms). In the papers the report quoted,
  recommendation is minutes against hours of execution. This is why the benchmark also reports build + run time
  without recommendation. Because recommendation is always measured, even the simulated engine's totals vary slightly
  from run to run.
- Timings vary with the visitor's machine and browser. The benchmark's intervals describe variation across seeded
  workloads on one machine, not across machines.

## What I'd change

- Fit the cost constants per dataset from a short calibration run in the worker, instead of one set fitted on TPC-H.
- Report recommendation time two ways, measured and as a count of what-if calls times a configurable optimiser
  latency, so the reader can see how the ranking moves with the assumed cost of an optimiser call.
- Repeat the benchmark on two or three different machines and browsers to estimate machine-to-machine variation.
