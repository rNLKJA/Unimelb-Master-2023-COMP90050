# coursework/ — the original 2023 material

Everything in this folder predates the 2026 revival and is kept unchanged for reference. It was moved here from the repository root with `git mv`, so `git log --follow` still shows its history. The interactive lab lives in [`../web/`](../web/); see the [root README](../README.md).

## What is inside

| Path                                     | Contents                                                                                                                                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`NOTES.md`](NOTES.md)                   | Long-form revision notes for the whole subject (storage hardware, query processing and optimisation, indexing, transactions, concurrency, recovery), written while taking it. This was the repository's README before 2026.                                              |
| [`images/`](images/)                     | Screenshots and diagrams referenced by `NOTES.md` (relative links, so the notes render on GitHub and in any Markdown viewer).                                                                                                                                            |
| [`presentation/`](presentation/)         | Group 40's survey: the report, _Self-Driving Databases: Index Selection & Workload-driven Optimization_ (19 July 2023 draft, LaTeX, two copies), and the slide deck presented on 20 July 2023 (five exported revisions; `-5` is the latest). Also a similarity-check report of the draft. |
| [`project/`](project/)                   | The group-project brief and the survey's reading list: `intro/` (Pavlo et al. 2017 and 2021, Kossmann and Schlosser 2020, Lin Ma's thesis) and `indexing/` (AutoAdmin 2000, DB2 Advisor, Azure auto-indexing, the hands-free optimiser, budget-aware MCTS, and the MAB tuner). |
| `lectures/`, `tutorials/`                | Weekly lecture decks, tutorial sheets and solutions, and tutorial session transcripts, kept from the original repository.                                                                                                                                            |
| [`_archive/README.original.md`](_archive/README.original.md) | The pre-2026 README, verbatim.                                                                                                                                                                                                                 |

## How to use it

There is nothing to build or run: the original deliverables were a written survey and a talk, with no implementation code.

- Read `NOTES.md` on GitHub or locally; the table of contents at the top links to every topic, and images load from `images/`.
- Open the PDFs in `presentation/` with any PDF viewer.

The algorithms the survey described are implemented, tested and runnable in the web app: DROP, AutoAdmin, DB2 Advisor, CoPhy and the C²UCB bandit in `web/src/lib/advisors/`, and QueryBot 5000's forecasting pipeline in `web/src/lib/forecast/`.

## Notes and corrections

- The report is the 19 July 2023 draft; its abstract and reflection sections were still placeholders at that point.
- Two references in the report are mis-attributed. Reference 11, _No DBA? No regret!_, is by R. Malinga Perera, Bastian Oetomo, Benjamin Rubinstein and Renata Borovica-Gajic (IEEE TKDE 2023), not Kraska et al. Reference 21, _Budget-aware Index Tuning with Reinforcement Learning_, is by Wentao Wu, Chi Wang, Tarique Siddiqui, Junxiong Wang, Vivek Narasayya, Surajit Chaudhuri and Philip A. Bernstein (SIGMOD 2022), not Zhang and Kraska. The files are left as submitted; the website's survey map carries the corrections.

## Academic integrity

These files are the group's own coursework plus University of Melbourne teaching material, kept for personal reference. They are not served by the website. Do not submit any of it as your own work.
