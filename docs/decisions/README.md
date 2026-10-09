# Decision records

Each record explains one decision that shaped the 2026 revival and upgrade of the COMP90050 survey. A record gives the
context, the decision (stated first), the options I considered, why I chose as I did, what happened (including the weak
numbers) and what I would change. Records are never edited after they are accepted. A later record supersedes an
earlier one instead.

| Record                                           | Decision                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [DR-001](DR-001-survey-scope-index-selection.md) | Make index selection the working core of the revival and keep workload forecasting as a smaller lab         |
| [DR-002](DR-002-sqlite-wasm-cost-proxy.md)       | Time real SQLite in WebAssembly as the cost proxy, with a calibrated what-if model for the advisors         |
| [DR-003](DR-003-bandit-formulation.md)           | Port the C²UCB bandit as published and measure its regret against a hindsight optimum                       |
| [DR-004](DR-004-louvre-dataset-in-the-arena.md)  | Bring the INFO20003 Louvre database into the arena with an index-free physical design and a museum workload |
| [DR-005](DR-005-llm-index-advisor.md)            | Let a visitor's own LLM propose indexes, then validate, measure and log every proposal                      |

The site renders these records under `/methods/decisions`. `web/content/` holds a copy for the Vercel build, which
only uploads `web/`. Run `pnpm docs:sync` in `web/` after editing anything here. A unit test fails while the
copies differ.
