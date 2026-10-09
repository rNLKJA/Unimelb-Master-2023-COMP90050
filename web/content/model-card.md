# Model card: the models inside the Self-Driving DB Lab

The lab contains four models. Two make decisions (the C²UCB bandit and the optional LLM index advisor), one estimates
costs for the offline advisors (the what-if cost model), and three small forecasters predict query arrivals (QB5000's
linear regression, kernel regression and HYBRID rule). None of them is trained on personal data, and none of them is
used outside this teaching and portfolio site.

Every interval below is a 95% interval. Proportions use Wilson intervals. Replicate r uses workload seed 2023 + r.
Measured times come from `docs/benchmark-numbers.json`, which `pnpm bench:report` regenerates with the lab's own code
(sql.js under Node 26 on an Apple M4 laptop, the same WebAssembly build a browser runs). It runs five independent
sessions (a fresh process each) over the same 10 seeds, with the advisors in a seeded random order after a discarded
warm-up replicate. Benchmark means and ratios use a pigeonhole percentile bootstrap over sessions and seeds (B = 2000,
resampling seed 90050), which includes run-to-run variation, and the file gives the range of single-session estimates
next to each. The forecasting intervals are percentile-bootstrap intervals over traces. A visitor's browser gives
different absolute times, and its intervals describe one session only.

## 1. What-if cost model

**What it is.** A System R style cost model (`web/src/lib/engine/cost-model.ts`) that estimates a query's cost, its
access path and an index's size and build time for any hypothetical configuration. AutoAdmin, DB2 Advisor, DROP and
CoPhy ask it every what-if question, and the SQL console's what-if panel shows its estimates.

**Intended use.** Ranking candidate index configurations for the advisors in this lab. It is not a general SQLite
cost model.

**Provenance of its constants.** Ten constants (per row scanned, per index entry, per rowid fetch, per B-tree level and
so on) were fitted to warmed-up median timings of sql.js 1.14 (SQLite 3.49) under Node on an Apple-silicon laptop, on
the TPC-H-like data. Selectivities come from distinct-value counts and value ranges computed from the loaded rows,
assuming uniform and independent columns.

**Evaluation.**

- Plan agreement with SQLite's planner: the unit tests check 10 hand-picked (template, index) cases on the TPC-H-like
  data and 13 on the Louvre data, and the model picks the same index as SQLite in all of them. The tests must pass for
  CI to be green and cover the templates I expected to agree, so they are a regression check, not an agreement rate.
  Templates Q6, Q7 and Q9 (TPC-H-like) and L9 (Louvre) are not covered. An agreement rate would need a random sample
  of (query, candidate index) pairs, with disagreements recorded rather than failing the build.
- Index sizes: within 10% of SQLite's page counts on the tested TPC-H-like indexes and within 15% on the Louvre ones.
- Timings: with no indexes, the simulated engine (built on this model) estimates 976 ms (939 to 1010) for 25 static
  TPC-H-like rounds where measured SQLite takes 534 ms (530 to 541), and 255 ms where SQLite takes 211 ms (204 to 222)
  on the Louvre data. It ranks configurations better than it predicts milliseconds.

**Known failure modes.** Correlated columns and skewed values break the uniform-independence assumption. SQLite's
skip-scan plans are not modelled, so the arena switches skip-scan off by default (the advanced settings can turn it
on to show the surprise). Constants fitted on one laptop and on TPC-H-like data drift on other machines and on text
timestamps.

## 2. C²UCB bandit index tuner

**What it is.** The contextual combinatorial bandit of Perera et al. (IEEE TKDE 2023), ported in
`web/src/lib/advisors/mab/`. It never asks the what-if model anything and learns only from execution times it
observes. DR-003 records the formulation.

**Intended use.** Online index tuning in the arena and the benchmark, to compare a learned tuner with the heuristic and
integer-programming advisors under one stopwatch.

**Training data.** None before a run. It starts every run empty and learns from that run's observed runtimes. Its
hyperparameters (α = 1, λ = 0.5, α shrinking 5% per round) are the authors' published TPC-H settings, not tuned on
this lab's data.

**Evaluation** (measured SQLite, five sessions of 10 replicates, 25 rounds, 200% budget, against AutoAdmin's greedy
what-if search). "Single sessions" gives the lowest and highest single-session estimate of the change.

| Dataset        | Workload | Bandit vs greedy, total time | Single sessions | Final regret vs hindsight reference            |
| -------------- | -------- | ---------------------------- | --------------- | ---------------------------------------------- |
| TPC-H-like (S) | Static   | 23% less (24% to 21% less)   | 23% to 22% less | 56 ms (54 to 60), 70% of the reference's total |
| TPC-H-like (S) | Shifting | 27% more (22% to 32% more)   | 25% to 29% more | 134 ms (130 to 143), 163%                      |
| TPC-H-like (S) | HTAP     | 14% less (18% to 9% less)    | 15% to 12% less | 88 ms (81 to 92), 83%                          |
| Louvre         | Static   | 47% less (50% to 42% less)   | 51% to 39% less | 47 ms (40 to 55), 136%                         |
| Louvre         | Shifting | 25% more (12% to 38% more)   | 14% to 38% more | 57 ms (52 to 68), 173%                         |
| Louvre         | HTAP     | 50% less (53% to 43% less)   | 52% to 42% less | 50 ms (44 to 64), 127%                         |

The hindsight reference was proven optimal in all 50 replicate runs of every row. On build + run time without
recommendation, the bandit was slower than greedy on the same static runs (12% on TPC-H-like, 10% to 14%, and 49% on
Louvre, 45% to 54%). Its total-time advantage comes from never running a what-if
search, and DR-002 explains why that weighs so much on workloads this small.

**Known failure modes.** It relearns from scratch after a large workload shift, so it loses on shifting workloads.
Tables under 1,000 rows are never indexed. At budgets of 100% or less its first choices can crowd out later ones.

## 3. QB5000 forecasters

**What they are.** Linear regression on the last 24 hours, Nadaraya-Watson kernel regression on the last 168 hours,
and QB5000's HYBRID rule that switches to kernel regression when it predicts a spike (`web/src/lib/forecast/`).
QB5000's LSTM is not implemented, and linear regression stands in for its LR plus LSTM ensemble.

**Training data.** Two weeks of a synthetic hourly trace of the arena's twelve TPC-H-like templates, with daily and
weekly cycles, a nightly batch, a Monday spike and noise. Templates are clustered by their training history.

**Evaluation** (test week, log mean squared error averaged over clusters, 10 traces from seeds 2023 to 2032).

- LR 0.343 (0.334 to 0.352), KR 0.635 (0.628 to 0.641), HYBRID 0.333 (0.323 to 0.343).
- HYBRID against LR: 3% lower error, with an interval from 7% lower to 1% higher. Ten traces do not settle this
  comparison. KR was worse than LR on all 10 traces (85% higher error, 81% to 89%).
- Forecast-driven index tuning cost 9% less than reactive tuning in estimated query and build cost (10% to 7% less,
  10 of 10 traces), and an oracle that knows the next window cost 15% less.

**Known failure modes.** The trace is synthetic and regular, so these errors flatter all three models compared with
real traces. The tuning-loop costs are what-if estimates, not measured runtimes.

## 4. LLM index advisor (bring your own key)

**What it is.** A third-party large language model chosen by the visitor (Claude Haiku 4.5 by default, Claude Sonnet
5.5, or an OpenAI model id), called from the visitor's browser with the visitor's own key. It proposes indexes in a
fixed JSON structure. DR-005 records the design.

**Intended use.** An optional advisor whose proposals are validated, reviewed by a person and then measured against
the lab's own advisors. It never acts on the database directly.

**Training data.** Not known to this project and not changed by it. The site does not train or fine-tune anything.

**Evaluation.** The benchmark measures any accepted proposal with the same seeded workloads and paired statistics as
the other advisors, only on the settings the model was shown, and records the result in the browser's audit log. The
invalid-proposal rate is reported separately for each provider, model (the one that answered), prompt version and
dataset, never pooled. The share of calls with any rejected index or an unusable reply gets a Wilson interval, since
calls are independent. The share of proposed indexes the validator rejected gets a percentile-bootstrap interval that
resamples whole calls, since indexes from one reply share its mistakes. No results are published here because there
is no budget for API calls.

**Known failure modes.** Columns that do not exist on the named table (likely on the Louvre schema, where names like
ticket_id repeat across tables), indexes on a table's primary key, configurations over the storage budget, malformed
or truncated replies, refusals and different answers to the same prompt. The validator catches the first four, the
client reports the rest, and the audit log keeps the evidence.

## Ethical considerations

- All data the models see is synthetic: the TPC-H-like rows, the generated workloads and trace, and the Louvre
  database from INFO20003, whose names and card digits are invented (see the data card).
- The LLM advisor sends the schema, its statistics, one round of SQL with literals from the synthetic data, and query
  plans to the visitor's chosen provider. The prompt contains nothing about the visitor. As with any direct web
  request, the provider sees the visitor's IP address and browser headers, under its own privacy terms.
- With Claude Sonnet 5.5 the refusal fallback is on by default, so a request Sonnet declines may be re-run on another
  Claude model. The audit log records the model that answered, and the invalid-proposal rate scores it separately.
- API keys stay in the visitor's browser and are never written to the audit log. Calls are billed to the visitor's
  key, and the site says so before the first call.
- Every model output is labelled "AI-generated", and a person accepts, edits or rejects every proposal before
  anything is built. A proposal whose call could not be written to the audit log cannot be accepted. The approach is
  informed by the Australian Government's policy for the responsible use of AI in government, the EU AI Act's
  transparency principles and the NIST AI Risk Management Framework. It is not a claim of compliance with any of them.
