# DR-003: Port the C²UCB bandit as published and measure its regret against a hindsight optimum

- **Status:** accepted
- **Decided:** 9 October 2026 (the port dates from September 2026 and the regret yardstick is new)
- **Scope:** `web/src/lib/advisors/mab/`, `HindsightAdvisor` in `web/src/lib/advisors/offline.ts`,
  `web/src/lib/bench/benchmark.ts`

## Context

The report's key result came from Perera et al. ("No DBA? No regret!", IEEE TKDE 2023): a multi-armed bandit that
learns index choices from observed runtimes, never asking the optimiser what-if questions, against a commercial
physical design tool. A bandit can be formulated many ways (what an arm is, what context it sees, what the reward is,
how it forgets), and each choice changes its behaviour. "Regret", the quantity bandit papers bound, also needs a
concrete yardstick before it can be measured.

## Decision

The arena's bandit follows the paper's Algorithm 2 around C²UCB as closely as SQLite allows. Arms are permutations of
each query's predicate columns up to length 2, plus covering variants that append the payload columns (SQLite has no
INCLUDE). Tables under 1,000 rows are never indexed. The context has one component per database column, 10 to the
power of minus j for a predicate column at index position j, plus a covering flag, the index size relative to the
data (zero once built) and recent usage. Scores use α = 1, λ = 0.5 and α shrinking by 1.05 per round, the authors'
TPC-H settings. A greedy oracle picks the super arm within the storage budget. Rewards come only from observed
execution times: each query's gain over its recent full-scan time is shared among the indexes it used, and building an
index costs its creation time. A workload shift above 50% new templates resets the learner, and a smaller shift
discounts its history.

Regret is measured against the best fixed configuration in hindsight, the textbook yardstick for bandits. Before round
1, a reference advisor builds the configuration that CoPhy's integer program finds optimal, under the what-if model,
for the whole workload within the same budget. Its branch and bound gets a node budget of five million, large enough
to prove optimality on every dataset, scenario and budget the benchmark offers at the default scale, and the
benchmark reports in how many replicates it was proven. Where it is not, regret is labelled as measured against the
best configuration found. The reference is charged for index creation and execution but not for recommending,
because no real advisor knows the future workload.

## Options considered

1. **Keep the paper's formulation (chosen),** with the context keyed by table and column since 2026 so the Louvre
   schema's repeated column names (ticket_id, scanned_at) stay apart.
2. **A simpler epsilon-greedy bandit over single-column indexes.** Easier to explain, but it would not be the
   algorithm the report described.
3. **Regret against the best advisor in each round.** Easy to compute, but the per-round winner changes, so the curve
   mixes different strategies and has no meaning a bandit paper would recognise.
4. **Regret against a per-round clairvoyant optimum,** which rebuilds the ideal indexes before every round. It charges
   heavy creation costs on shifting workloads and penalises the reference for clairvoyance.

## Why

A faithful port is the only way the arena can say anything about the result the report repeated. The hindsight
reference matches the regret definition in the bandit literature, uses a solver the lab already has, and gives a
fixed target the reader can inspect in the benchmark tables.

## What happened

All numbers below are from measured SQLite runs (sql.js under Node 26 on an Apple M4 laptop) with 10 seeded
replicates, 25 rounds and a 200% budget, run in five independent sessions over the same seeds and compared against
AutoAdmin's greedy what-if search. Intervals are 95% pigeonhole-bootstrap intervals over sessions and workload seeds.
They are in `docs/benchmark-numbers.json`, which `pnpm bench:report` regenerates, with the range of single-session
estimates next to each one.

- On total time the bandit beat greedy on static workloads, by 23% on the TPC-H-like data (95% CI 24% to 21%) and by
  47% on the Louvre data (95% CI 50% to 42%; single sessions ranged from 51% to 39%). On build + run time alone, which
  leaves out recommendation, it was slower than greedy on the same runs, by 12% on TPC-H (10% to 14%) and 49% on
  Louvre (45% to 54%). Its whole advantage on
  these small workloads is that it never pays for a what-if search. Perera et al. reported the same mechanism (seconds
  of recommendation against minutes), but here it decides the ranking because execution takes only hundreds of
  milliseconds.
- On shifting workloads the bandit lost on both datasets, taking 27% more total time on TPC-H (22% to 32%) and 25%
  more on Louvre (12% to 38%). Every phase change brings only new templates, which resets the learner, so it starts
  from scratch in each of the three phases while AutoAdmin is re-invoked with a fresh what-if search.
- The drift sweep shows where the switch happens. The bandit stayed ahead of greedy from drift 0 to 0.75 and fell
  behind at 1 (TPC-H: 23% faster at 0, 14% faster at 0.75, 27% slower at 1). One reason is in the offline protocol
  itself. Below drift 1 every round still contains most templates, so the offline tools' shift detector (template-set
  overlap under 50%) never fires and AutoAdmin keeps its round-1 configuration for all 25 rounds.
- Regret against the hindsight reference was large. On static TPC-H the bandit's final regret was 56 ms (95% CI 54 to
  60), 70% of the reference's total time, and on shifting TPC-H 134 ms, 163% of it. The regret curve starts below zero
  because the reference pays for all its indexes before round 1. The reference was proven optimal in all 50 replicate
  runs of every setting.
- A review before release caught two problems with the first version of these numbers. The reference was described as
  CoPhy's exact optimum, but its search stopped at 200,000 nodes, and for Louvre HTAP at the default budget it had not
  proven optimality in any replicate; the configuration it found turned out to be the optimum once the limit was
  raised, but that was luck, not a guarantee. And the intervals came from one run's replicates, so they left out
  run-to-run variation: re-running the same seeds in fresh processes put most estimates outside their own intervals.
  Both are fixed as described above, and DR-002 has the details of the second.
- The intervals are still fairly narrow because replicates differ only in query literals on the same data. They cover
  variation across workloads and across runs on one machine, not across machines, and they would be wider with fewer
  rounds or noisier hardware.

## What I'd change

- Add a recommendation-time-only view of regret, so the cost of learning can be separated from the cost of building.
- Try the paper's weighted forgetting on large shifts instead of a hard reset, and measure whether it closes the gap
  on shifting workloads.
- Replace the template-set shift detector for offline tools with one that compares template frequencies, so drift
  below 1 can trigger re-tuning, and report both detectors side by side.
