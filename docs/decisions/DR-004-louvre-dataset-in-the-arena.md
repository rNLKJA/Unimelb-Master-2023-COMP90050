# DR-004: Bring the INFO20003 Louvre database into the arena with an index-free physical design and a museum workload

- **Status:** accepted
- **Decided:** 9 October 2026
- **Scope:** `web/public/data/louvre.db.gz`, `web/src/lib/datasets/`, `web/src/lib/workload/scenarios.ts`,
  `web/src/workers/lab.worker.ts`, the database journey panels on `/` and `/methods`

## Context

In 2020 I designed a ticketing and visitor database for the Louvre in INFO20003 Database Systems: a Chen diagram, a
Crow's foot model and a relational schema. Its 2026 revival (info20003-louvre-ops-db.vercel.app) refined the schema and
filled it with five years of synthetic museum activity. COMP90050 in 2023 covered what happens after design: storage,
indexing, query optimisation and self-driving index selection. The two projects are one journey through databases, but
until now the advanced course only ran on TPC-H-shaped data that nobody designed.

## Decision

The arena and the benchmark gain a second dataset, "Louvre (from INFO20003)". The lab ships the INFO20003 file byte for
byte (gzip-compressed, SHA-256 checked by a unit test) and loads every table and row into its own tables. Each table
keeps only its INTEGER PRIMARY KEY. UNIQUE constraints, foreign keys, CHECKs, triggers and the refined schema's own
secondary indexes are left out, so every index beyond the rowid is an advisor's choice, the same rule the TPC-H-like
data follows. A museum workload of twelve reads and one UPDATE runs on it, in three groups that become the phases of
the shifting and drifting scenarios. The box office runs ticket sales by hour, takings by payment method, barcode
checks and a refund-desk join. The gallery floor runs wing footfall, entrance arrivals by transport, a visitor's route
and audio-guide hires by language. The exhibitions team runs slot fill (a join), bookings on a ticket, Hall Napoléon
admissions and bookings per week. The UPDATE moves a ticket's exhibition booking to another slot. A new drifting
scenario, available on both datasets, mixes every template with the current phase's group, with a drift parameter
from 0 (static) to 1 (shifting).

## Options considered

1. **Load the refined schema as it is, with its indexes and constraints.** Faithful to the INFO20003 design, but the
   no-index baseline would already have seven secondary indexes and many UNIQUE indexes, so the advisors would compete
   on a different footing on each dataset.
2. **Index-free physical design, same rule as TPC-H (chosen).**
3. **Generate fresh museum data in the lab.** It would allow a scale setting, but it would no longer be the INFO20003
   data, and the journey between the two projects would be a story rather than a shared file.
4. **Link to the INFO20003 site only.** No shared data, so no comparison on a schema I designed.

## Why

Keeping the file byte-identical makes the provenance checkable: the SHA-256 in `lib/datasets/louvre/schema.ts` matches
the INFO20003 repository and its public download. Stripping only the physical design keeps the 2020 logical design
(tables, columns, keys as data) intact while giving every advisor the same starting point. A workload written from the
museum's point of view, with literals drawn from real column values, makes the queries realistic. Frequent languages
and payment methods are drawn more often, as they would be at a real box office.

## What happened

- The what-if model picks the same index as SQLite's planner for 12 of the 13 Louvre templates in the unit tests, and
  estimates index sizes within 15% of SQLite's page counts. The Louvre tables need column names qualified by table in
  the bandit's context, which led to a schema-generic engine and cost model (the TPC-H results were checked to be
  identical to the last digit before and after the refactor).
- The database is small. Its largest table has 19,545 wing scans and the whole file is 2.1 MB of data, so a full scan
  costs about a millisecond. With no indexes, 25 static rounds took 211 ms on SQLite (95% CI 204 to 222 ms, over five
  sessions of the same 10 replicates). At that size AutoAdmin's own search time (110 ms on average) outweighed what its
  indexes saved, and it was only 1.39 times faster than no index at all (95% CI 1.36 to 1.46). (Numbers from
  `docs/benchmark-numbers.json`.)
- The simulated engine, calibrated on TPC-H, overestimates Louvre's no-index time by about 21% (DR-002).
- The data has a fixed size, so the arena's size setting does not apply to it.

## What I'd change

- Add a scale option that replays the INFO20003 generator at 10 and 100 times the volume, so the Louvre runs say
  something about a museum-sized database.
- Offer the refined schema's own seven indexes as an "as designed" configuration, so the 2020 to 2026 design can be
  measured against the advisors.
- Add INSERT-heavy templates (scans arriving at the gates), which matter more to a museum than updates.
