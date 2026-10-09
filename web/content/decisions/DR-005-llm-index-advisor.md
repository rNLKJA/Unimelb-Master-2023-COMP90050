# DR-005: Let a visitor's own LLM propose indexes, then validate, measure and log every proposal

- **Status:** accepted
- **Decided:** 9 October 2026
- **Scope:** `web/src/lib/ai/`, `web/src/components/ai/`, the LLM sections of `/arena` and `/benchmark`, `/ai-log`

## Context

Large language models are now asked to tune databases, including index selection. The interesting question for this
lab is how such advice compares with the advisors the survey covered, measured the same way, and how often it is
unusable. There is no budget for AI calls, the site is static with no server, and nothing a visitor enters may be
stored anywhere but their own browser.

## Decision

The LLM index advisor is optional and uses the visitor's own key (Anthropic by default, OpenAI as an alternative). The
key stays in sessionStorage, or in localStorage only if the visitor ticks "remember on this device", and a "forget
key" button removes it. Calls go directly from the browser to the provider. The model receives the schema with
row counts and distinct-value counts, a summary of round 1 of the workload with each template's share of estimated
cost, SQLite's current query plans and the storage budget. It must reply in a fixed JSON structure: a list of indexes,
each a table, an ordered list of columns and a one-sentence rationale. The lab never runs text from the model. A
validator rebuilds each index from the schema's own names and rejects unknown tables or columns, more than four
columns, repeated columns, the primary key alone, duplicates, indexes beyond the first twelve and anything that would
exceed the budget, each with a reason. The person sees the proposal labelled "AI-generated" and accepts it, edits it
by unticking indexes, or rejects it. An accepted configuration then runs in the arena or the benchmark like an offline
tool's first invocation: built at the start of round 2, charged the provider's response time as recommendation time.
Every call, decision and measurement is appended to an audit log in the browser's IndexedDB, viewable at `/ai-log`
with JSON and CSV export, and never containing the key.

## Options considered

1. **No AI feature.** Simplest, but it leaves out the question the lab is now best placed to answer.
2. **A server-side model with the owner's key.** Costs money, needs a server, and sends visitors' sessions through it.
3. **Let the model write CREATE INDEX statements.** Flexible, but running model-written SQL is exactly the risk a
   validator should remove.
4. **Bring your own key, structured proposals, validation, measurement and a local audit log (chosen).**

## Why

Validating a structured proposal against the schema, and building the indexes from the schema's own names, means no
model output reaches the database. Measuring the result with the same seeded workloads and the same paired statistics
as the other advisors turns the feature into an evaluation instead of a demonstration. The invalid-proposal rate is
reported with Wilson intervals over every logged call, so an unreliable model shows up as a number. The audit log and
the AI use statement on `/methods` make every step traceable. That approach is informed by the Australian Government's
policy for the responsible use of AI in government, the EU AI Act's transparency principles and the NIST AI Risk
Management Framework. It is not a claim of compliance with any of them.

## What happened

- The client, the validator and the audit log are unit tested with mocked network calls: the request formats for both
  providers, error mapping (invalid key, rate limit, quota, refusal, truncation, network and CORS failures), key
  storage and redaction, and validation of malformed and out-of-schema proposals.
- No proposal results are reported here. There is no budget for API calls, so measured LLM results exist only in the
  browsers of visitors who bring a key, in their own audit logs.
- The benchmark compares the LLM on build + run time by default in its measurement records, because a provider's
  response time (seconds) would otherwise dominate workloads that take a few hundred milliseconds.
- The model sees round 1 only and is not consulted again after a shift, to keep each experiment to one call. On
  shifting workloads that puts it at the same disadvantage as an offline tool that is never re-invoked.

## What I'd change

- Re-consult the model after each detected shift, at the cost of more calls, and compare against the re-invoked
  offline tools.
- Run a fixed evaluation set (both datasets, three scenarios, five seeds) with each model and publish the logs, once
  there is a budget for it.
- Show the model the what-if cost of its own proposal and let it revise once, then measure whether the revision helps.
