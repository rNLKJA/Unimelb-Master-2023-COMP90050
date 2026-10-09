/**
 * The systems and papers our 2023 survey covered, re-classified for the
 * interactive taxonomy. Summaries are our own paraphrases. Links point to the
 * DOI where it was checked against the paper itself; otherwise to a dblp
 * search for the exact title, which always resolves.
 *
 * `reportRef` is the reference number in the group report's bibliography.
 * Two of those entries were mis-attributed in the 2023 report; `erratum`
 * records the correction.
 */

export type Component =
  | "architecture"
  | "workload-forecasting"
  | "behaviour-modelling"
  | "action-planning"
  | "index-selection"
  | "evaluation";

export type Technique =
  | "heuristic"
  | "constraint-lp"
  | "machine-learning"
  | "reinforcement-learning"
  | "bandit"
  | "analytical"
  | "framework";

export interface Paper {
  id: string;
  system: string;
  title: string;
  authors: string;
  venue: string;
  year: number;
  url: string;
  component: Component;
  technique: Technique;
  summary: string;
  reportRef?: number;
  erratum?: string;
  /** On the group's reading list (coursework/project/REFERENCES.md). */
  readingList?: boolean;
  /** Advisor id in the arena, if implemented. */
  arena?: string;
}

const dblp = (title: string) => `https://dblp.org/search?q=${encodeURIComponent(title)}`;
const doi = (id: string) => `https://doi.org/${id}`;

export const COMPONENT_LABELS: Record<Component, string> = {
  architecture: "Architecture & vision",
  "workload-forecasting": "Workload forecasting",
  "behaviour-modelling": "Behaviour modelling",
  "action-planning": "Action planning & tuning",
  "index-selection": "Index selection",
  evaluation: "Evaluation",
};

export const TECHNIQUE_LABELS: Record<Technique, string> = {
  heuristic: "Heuristic",
  "constraint-lp": "Constraint / LP",
  "machine-learning": "Machine learning",
  "reinforcement-learning": "Reinforcement learning",
  bandit: "Multi-armed bandit",
  analytical: "Analytical model",
  framework: "Framework",
};

export const PAPERS: Paper[] = [
  {
    id: "peloton",
    system: "Peloton",
    title: "Self-Driving Database Management Systems",
    authors: "Pavlo et al.",
    venue: "CIDR",
    year: 2017,
    url: dblp("Self-Driving Database Management Systems Pavlo CIDR"),
    component: "architecture",
    technique: "framework",
    summary:
      "The paper that named the field: a DBMS designed from the start to forecast its workload and apply tuning actions without a DBA.",
    reportRef: 17,
    readingList: true,
  },
  {
    id: "kossmann-schlosser",
    system: "Predictor / tuner / organiser",
    title: "Self-driving database systems: a conceptual approach",
    authors: "Kossmann & Schlosser",
    venue: "DAPD",
    year: 2020,
    url: doi("10.1007/s10619-020-07288-w"),
    component: "architecture",
    technique: "framework",
    summary:
      "A component framework: a workload predictor feeds tuners for each feature (indexes, knobs, ...), and an organiser decides which tuning to apply and when.",
    reportRef: 9,
    readingList: true,
  },
  {
    id: "noisepage",
    system: "NoisePage",
    title: "Make Your Database System Dream of Electric Sheep: Towards Self-Driving Operation",
    authors: "Pavlo et al.",
    venue: "PVLDB",
    year: 2021,
    url: doi("10.14778/3476311.3476411"),
    component: "architecture",
    technique: "framework",
    summary:
      "Implementation lessons from NoisePage and the six levels of DBMS autonomy, from manual (0) to fully self-driving (5).",
    reportRef: 16,
    readingList: true,
  },
  {
    id: "ma-thesis",
    system: "Forecast · model · plan",
    title: "Self-Driving Database Management Systems: Forecasting, Modeling, and Planning",
    authors: "Lin Ma",
    venue: "PhD thesis, CMU",
    year: 2021,
    url: dblp("Self-Driving Database Management Systems: Forecasting, Modeling, and Planning"),
    component: "architecture",
    technique: "framework",
    summary:
      "Brings QB5000, ModelBot2 and PilotBot0 together into one pipeline; the backbone of our workload-driven optimisation section.",
    reportRef: 12,
    readingList: true,
  },
  {
    id: "qb5000",
    system: "QueryBot 5000",
    title: "Query-based Workload Forecasting for Self-Driving Database Management Systems",
    authors: "Ma et al.",
    venue: "SIGMOD",
    year: 2018,
    url: dblp("Query-based Workload Forecasting for Self-Driving Database Management Systems"),
    component: "workload-forecasting",
    technique: "machine-learning",
    summary:
      "Templatises queries, clusters templates by arrival-rate history, and forecasts each cluster with linear regression, an LSTM and kernel regression (the HYBRID model catches rare spikes).",
  },
  {
    id: "resource-advisor",
    system: "Resource Advisor",
    title: "Continuous resource monitoring for self-predicting DBMS",
    authors: "Narayanan, Thereska & Ailamaki",
    venue: "MASCOTS",
    year: 2005,
    url: dblp("Continuous resource monitoring for self-predicting DBMS"),
    component: "behaviour-modelling",
    technique: "analytical",
    summary:
      "White-box models that predict how an OLTP system responds to resource changes such as a larger buffer pool.",
    reportRef: 15,
  },
  {
    id: "duggan",
    system: "Contender / B2L",
    title: "Performance prediction for concurrent database workloads",
    authors: "Duggan et al.",
    venue: "SIGMOD",
    year: 2011,
    url: dblp("Performance prediction for concurrent database workloads"),
    component: "behaviour-modelling",
    technique: "analytical",
    summary:
      "Predicts the latency of analytical queries running concurrently from their buffer-access behaviour.",
    reportRef: 8,
  },
  {
    id: "ahmad",
    system: "Interaction-aware models",
    title:
      "Predicting completion times of batch query workloads using interaction-aware models and simulation",
    authors: "Ahmad et al.",
    venue: "EDBT",
    year: 2011,
    url: dblp(
      "Predicting completion times of batch query workloads using interaction-aware models and simulation",
    ),
    component: "behaviour-modelling",
    technique: "analytical",
    summary:
      "Models how analytical queries in a batch interfere with each other, then simulates the batch to predict its completion time.",
    reportRef: 4,
  },
  {
    id: "dbseer",
    system: "DBSeer",
    title: "Performance and resource modeling in highly-concurrent OLTP workloads",
    authors: "Mozafari et al.",
    venue: "SIGMOD",
    year: 2013,
    url: dblp("Performance and resource modeling in highly-concurrent OLTP workloads"),
    component: "behaviour-modelling",
    technique: "analytical",
    summary:
      "Clusters transaction types and predicts disk I/O, CPU and lock contention for what-if workload changes; tied to MySQL.",
    reportRef: 14,
  },
  {
    id: "dbsherlock",
    system: "DBSherlock",
    title: "DBSherlock: A Performance Diagnostic Tool for Transactional Databases",
    authors: "Yoon, Niu & Mozafari",
    venue: "SIGMOD",
    year: 2016,
    url: dblp("DBSherlock: A Performance Diagnostic Tool for Transactional Databases"),
    component: "behaviour-modelling",
    technique: "analytical",
    summary:
      "Explains performance anomalies to a DBA with predicates over system metrics and causal models.",
    reportRef: 20,
  },
  {
    id: "qppnet",
    system: "QPPNet",
    title: "Plan-Structured Deep Neural Network Models for Query Performance Prediction",
    authors: "Marcus & Papaemmanouil",
    venue: "PVLDB",
    year: 2019,
    url: dblp("Plan-Structured Deep Neural Network Models for Query Performance Prediction"),
    component: "behaviour-modelling",
    technique: "machine-learning",
    summary:
      "A neural network shaped like the query plan, with one small network per operator, predicts query latency.",
  },
  {
    id: "gpredictor",
    system: "GPredictor",
    title: "Query Performance Prediction for Concurrent Queries using Graph Embedding",
    authors: "Zhou et al.",
    venue: "PVLDB",
    year: 2020,
    url: dblp("Query Performance Prediction for Concurrent Queries using Graph Embedding"),
    component: "behaviour-modelling",
    technique: "machine-learning",
    summary:
      "Encodes concurrently running operators and their interactions as a graph and learns to predict latency from it.",
  },
  {
    id: "mb2",
    system: "ModelBot2 (MB2)",
    title: "MB2: Decomposed Behavior Modeling for Self-Driving Database Management Systems",
    authors: "Ma et al.",
    venue: "SIGMOD",
    year: 2021,
    url: dblp("MB2: Decomposed Behavior Modeling for Self-Driving Database Management Systems"),
    component: "behaviour-modelling",
    technique: "machine-learning",
    summary:
      "Splits the DBMS into small operating units, trains a model per unit from runner data, and combines them to predict the cost and impact of any candidate action.",
    reportRef: 13,
  },
  {
    id: "greedy-seq",
    system: "GREEDY-SEQ",
    title: "Automatic physical design tuning: workload as a sequence",
    authors: "Agrawal, Chu & Narasayya",
    venue: "SIGMOD",
    year: 2006,
    url: dblp("Automatic physical design tuning: workload as a sequence"),
    component: "action-planning",
    technique: "heuristic",
    summary:
      "Treats the workload as a sequence and picks when to apply each design change, merging per-step recommendations greedily.",
  },
  {
    id: "colt",
    system: "COLT",
    title: "COLT: continuous on-line tuning",
    authors: "Schnaitter et al.",
    venue: "SIGMOD (demo)",
    year: 2006,
    url: dblp("COLT: continuous on-line tuning"),
    component: "action-planning",
    technique: "heuristic",
    summary:
      "Online index tuning that profiles candidate indexes as queries arrive and adjusts the physical design continuously.",
  },
  {
    id: "bruno-online",
    system: "Online physical design",
    title: "An Online Approach to Physical Design Tuning",
    authors: "Bruno & Chaudhuri",
    venue: "ICDE",
    year: 2007,
    url: dblp("An Online Approach to Physical Design Tuning"),
    component: "action-planning",
    technique: "heuristic",
    summary:
      "Keeps adjusting indexes in response to the running workload, using execution statistics to pick candidates.",
  },
  {
    id: "ottertune",
    system: "OtterTune",
    title: "Automatic Database Management System Tuning Through Large-scale Machine Learning",
    authors: "Van Aken et al.",
    venue: "SIGMOD",
    year: 2017,
    url: dblp("Automatic Database Management System Tuning Through Large-scale Machine Learning"),
    component: "action-planning",
    technique: "machine-learning",
    summary:
      "Recommends knob settings by mapping a new workload onto past ones and running Bayesian optimisation.",
  },
  {
    id: "qtune",
    system: "QTune",
    title: "QTune: A Query-Aware Database Tuning System with Deep Reinforcement Learning",
    authors: "Li et al.",
    venue: "PVLDB",
    year: 2019,
    url: dblp("QTune: A Query-Aware Database Tuning System with Deep Reinforcement Learning"),
    component: "action-planning",
    technique: "reinforcement-learning",
    summary: "Featurises the incoming queries and tunes knobs with deep reinforcement learning.",
  },
  {
    id: "udo",
    system: "UDO",
    title: "UDO: Universal Database Optimization using Reinforcement Learning",
    authors: "Wang, Trummer & Basu",
    venue: "PVLDB",
    year: 2021,
    url: dblp("UDO: Universal Database Optimization using Reinforcement Learning"),
    component: "action-planning",
    technique: "reinforcement-learning",
    summary:
      "Tunes transaction code, physical design and parameters together with reinforcement learning and Monte Carlo tree search.",
  },
  {
    id: "pilotbot",
    system: "PilotBot0 (PB0)",
    title: "Self-Driving Database Management Systems: Forecasting, Modeling, and Planning",
    authors: "Lin Ma",
    venue: "PhD thesis, CMU",
    year: 2021,
    url: dblp("Self-Driving Database Management Systems: Forecasting, Modeling, and Planning"),
    component: "action-planning",
    technique: "reinforcement-learning",
    summary:
      "Plans a sequence of actions over a receding horizon with Monte Carlo tree search, using forecasts and behaviour models, and applies the first action each time.",
    reportRef: 12,
  },
  {
    id: "whang-drop",
    system: "DROP",
    title: "Index selection in relational databases",
    authors: "Whang",
    venue: "Foundations of Data Organization",
    year: 1985,
    url: dblp("Index selection in relational databases Whang"),
    component: "index-selection",
    technique: "heuristic",
    summary:
      "Starts from all single-column indexes and repeatedly drops the one whose removal hurts least. Presented in 1985, published in 1987.",
    reportRef: 19,
    arena: "drop",
  },
  {
    id: "autoadmin-1997",
    system: "AutoAdmin",
    title: "An efficient, cost-driven index selection tool for Microsoft SQL Server",
    authors: "Chaudhuri & Narasayya",
    venue: "VLDB",
    year: 1997,
    url: dblp("An efficient, cost-driven index selection tool for Microsoft SQL Server"),
    component: "index-selection",
    technique: "heuristic",
    summary:
      "Introduced the what-if optimiser call: per-query candidate selection, Greedy(m, k) enumeration, and multi-column indexes built up one column at a time.",
    reportRef: 6,
    arena: "autoadmin",
  },
  {
    id: "agrawal-2000",
    system: "Indexes + views",
    title: "Automated Selection of Materialized Views and Indexes for SQL Databases",
    authors: "Agrawal, Chaudhuri & Narasayya",
    venue: "VLDB",
    year: 2000,
    url: dblp("Automated Selection of Materialized Views and Indexes for SQL Databases"),
    component: "index-selection",
    technique: "heuristic",
    summary:
      "Extends AutoAdmin to choose indexes and materialised views together, the basis of SQL Server's tuning advisor.",
    reportRef: 3,
    readingList: true,
  },
  {
    id: "db2-advisor",
    system: "DB2 Advisor",
    title: "DB2 Advisor: An Optimizer Smart Enough to Recommend Its Own Indexes",
    authors: "Valentin et al.",
    venue: "ICDE",
    year: 2000,
    url: dblp("DB2 Advisor: An Optimizer Smart Enough to Recommend Its Own Indexes"),
    component: "index-selection",
    technique: "constraint-lp",
    summary:
      "Lets the optimiser plan each query with virtual indexes, credits the gain to the indexes used, solves a knapsack by benefit per byte, then tries random swaps.",
    reportRef: 18,
    readingList: true,
    arena: "db2advis",
  },
  {
    id: "cophy",
    system: "CoPhy",
    title: "CoPhy: A Scalable, Portable, and Interactive Index Advisor for Large Workloads",
    authors: "Dash, Polyzotis & Ailamaki",
    venue: "PVLDB",
    year: 2011,
    url: doi("10.14778/1978665.1978668"),
    component: "index-selection",
    technique: "constraint-lp",
    summary:
      "Formulates index selection as a binary integer program over cached plan costs and hands it to a solver; quality depends on how far the solver gets.",
    reportRef: 7,
    arena: "cophy",
  },
  {
    id: "dexter",
    system: "Dexter",
    title: "Dexter: the automatic indexer for Postgres",
    authors: "Andrew Kane",
    venue: "Open source",
    year: 2017,
    url: "https://github.com/ankane/dexter",
    component: "index-selection",
    technique: "heuristic",
    summary:
      "Groups queries by template, creates hypothetical indexes with HypoPG and keeps those the planner says reduce cost.",
  },
  {
    id: "azure-auto-indexing",
    system: "Azure SQL auto-indexing",
    title: "Automatically Indexing Millions of Databases in Microsoft Azure SQL Database",
    authors: "Das et al.",
    venue: "SIGMOD",
    year: 2019,
    url: dblp("Automatically Indexing Millions of Databases in Microsoft Azure SQL Database"),
    component: "index-selection",
    technique: "heuristic",
    summary:
      "Runs index tuning as a cloud service, validating every change against production performance and reverting regressions.",
    readingList: true,
  },
  {
    id: "dta-anytime",
    system: "DTA (anytime)",
    title: "Anytime Algorithm of Database Tuning Advisor for Microsoft SQL Server",
    authors: "Chaudhuri & Narasayya",
    venue: "Microsoft Research",
    year: 2020,
    url: "https://www.microsoft.com/en-us/research/publication/anytime-algorithm-of-database-tuning-advisor-for-microsoft-sql-server/",
    component: "index-selection",
    technique: "heuristic",
    summary:
      "SQL Server's tuning advisor as an anytime algorithm: it returns the best configuration found within a time limit.",
    reportRef: 5,
  },
  {
    id: "neo-handsfree",
    system: "Hands-free optimiser",
    title: "Towards a Hands-Free Query Optimizer through Deep Learning",
    authors: "Marcus & Papaemmanouil",
    venue: "CIDR",
    year: 2019,
    url: "https://arxiv.org/abs/1809.10212",
    component: "index-selection",
    technique: "reinforcement-learning",
    summary:
      "A vision for a query optimiser trained end to end with deep reinforcement learning instead of hand-written cost models.",
    readingList: true,
  },
  {
    id: "dba-bandits",
    system: "DBA bandits",
    title:
      "DBA bandits: Self-driving index tuning under ad-hoc, analytical workloads with safety guarantees",
    authors: "Perera et al.",
    venue: "ICDE",
    year: 2021,
    url: dblp(
      "DBA bandits: Self-driving index tuning under ad-hoc, analytical workloads with safety guarantees",
    ),
    component: "index-selection",
    technique: "bandit",
    summary:
      "The conference version of the MAB tuner: C²UCB over workload-generated index arms, learning from observed runtimes.",
    arena: "mab",
  },
  {
    id: "perera-mab",
    system: "MAB (No DBA? No regret!)",
    title:
      "No DBA? No regret! Multi-armed bandits for index tuning of analytical and HTAP workloads with provable guarantees",
    authors: "Perera, Oetomo, Rubinstein & Borovica-Gajic",
    venue: "IEEE TKDE",
    year: 2023,
    url: doi("10.1109/TKDE.2023.3271664"),
    component: "index-selection",
    technique: "bandit",
    summary:
      "Extends DBA bandits to HTAP workloads with a corrected regret proof and focused updates; beats a commercial tuning tool on dynamic and random workloads.",
    reportRef: 11,
    erratum:
      "The 2023 report credited this paper to “Tim Kraska et al.” (SIGMOD 2022). It is by R. Malinga Perera, Bastian Oetomo, Benjamin Rubinstein and Renata Borovica-Gajic (University of Melbourne), IEEE TKDE 2023.",
    readingList: true,
    arena: "mab",
  },
  {
    id: "wu-mcts",
    system: "Budget-aware MCTS",
    title: "Budget-aware Index Tuning with Reinforcement Learning",
    authors: "Wu et al.",
    venue: "SIGMOD",
    year: 2022,
    url: doi("10.1145/3514221.3526128"),
    component: "index-selection",
    technique: "reinforcement-learning",
    summary:
      "When what-if calls are rationed, spends them with Monte Carlo tree search over configurations instead of greedy enumeration.",
    reportRef: 21,
    erratum:
      "The 2023 report credited this paper to “Yuhao Zhang and Tim Kraska”. It is by Wentao Wu, Chi Wang, Tarique Siddiqui, Junxiong Wang, Vivek Narasayya, Surajit Chaudhuri and Philip A. Bernstein (Microsoft Research and Cornell).",
    readingList: true,
  },
  {
    id: "magic-mirror",
    system: "Index-selection benchmark",
    title:
      "Magic Mirror in My Hand, Which is the Best in the Land? An Experimental Evaluation of Index Selection Algorithms",
    authors: "Kossmann et al.",
    venue: "PVLDB",
    year: 2020,
    url: doi("10.14778/3407790.3407832"),
    component: "evaluation",
    technique: "framework",
    summary:
      "Re-implements eight index selection algorithms on one platform and compares their quality, runtime and what-if calls on TPC-H, TPC-DS and JOB.",
    reportRef: 10,
  },
];

export const PAPER_BY_ID = new Map(PAPERS.map((p) => [p.id, p]));
