/**
 * The AI audit log: one record per AI call, kept in the visitor's own browser
 * (IndexedDB), viewable and exportable at /ai-log. The site is static and has
 * no accounts or server, so there is no server-side copy; that is deliberate
 * (docs/decisions/DR-005).
 *
 * A call record holds what was sent (the prompt version and the full user
 * message: schema, workload summary and plans), which provider and model
 * answered, the raw proposal, what the validator accepted and rejected and
 * why, how long the call took, the token usage the provider reported and what
 * the person did with the proposal. It never holds the API key:
 * `redactSecrets` strips the active key and anything shaped like a provider
 * key before every write.
 *
 * Records are append-only for everything the AI produced: once written, only
 * the human decision (`decision`, `decidedAt`, `finalConfig`) is ever
 * updated. Measuring a proposal appends a separate "measurement" record that
 * points at the call through `parentId`.
 */
import { toCsv, type Cell } from "@/lib/csv";
import { AUDIT_STORE, tx } from "./idb";
import type { Provider, TokenUsage } from "./types";

export type AuditFeature = "llm-index-advisor";
export type AuditKind = "call" | "measurement";
export type HumanDecision = "pending" | "accepted" | "edited" | "rejected" | "not-applicable";

export interface ProposedIndex {
  table: string;
  columns: string[];
  rationale: string;
}

export interface MeasurementRecord {
  dataset: string;
  engine: string;
  scenario: string;
  replicates: number;
  seeds: number[];
  metric: string;
  /** Mean workload time per advisor with its 95% bootstrap interval, ms. */
  advisors: { id: string; mean: number; lower: number; upper: number }[];
  /** LLM mean / comparator mean (ratio of means) with its 95% interval. */
  comparisons: {
    against: string;
    ratio: number;
    lower: number;
    upper: number;
    wins: number;
    losses: number;
  }[];
}

export interface AuditEntry {
  id: string;
  /** The call record a measurement belongs to. */
  parentId?: string;
  kind: AuditKind;
  /** ISO 8601, when the call started; never changed afterwards. */
  timestamp: string;
  feature: AuditFeature;
  provider: Provider;
  /** Model id requested. */
  model: string;
  /** Model id the provider reported serving. */
  servedModel?: string;
  /** Anthropic re-ran the request on its fallback model after a refusal. */
  fallbackUsed?: boolean;
  input: {
    /** Version of the system prompt, so answers can be traced to the instructions given. */
    promptVersion: string;
    dataset: string;
    scenario: string;
    seed: number;
    rounds: number;
    budgetBytes: number;
    /** The full user message sent (schema, workload summary, plans). Never the key. */
    message: string;
  };
  output: {
    indexes?: ProposedIndex[];
    notes?: string;
    measurement?: MeasurementRecord;
  };
  validation?: { accepted: string[]; rejected: { index: string; reason: string }[] };
  /** Time the provider took to answer, ms. */
  latencyMs: number;
  usage?: TokenUsage | null;
  decision: HumanDecision;
  /** ISO 8601, when the person made the decision. */
  decidedAt?: string;
  /** The configuration the person approved (differs from the accepted set when edited). */
  finalConfig?: string[];
  error?: string;
  /** AiError kind when the call failed. */
  errorKind?: string;
}

export type DecisionPatch = Pick<AuditEntry, "decision" | "decidedAt" | "finalConfig">;

/** The only change a record accepts after it is written: the human decision. */
export function decisionPatch(
  decision: HumanDecision,
  finalConfig?: string[],
  at: Date = new Date(),
): DecisionPatch {
  return { decision, decidedAt: at.toISOString(), finalConfig };
}

/** Anything shaped like an Anthropic or OpenAI secret key. */
const KEY_PATTERN = /\b(sk-ant-[A-Za-z0-9_-]{8,}|sk-(proj-|svcacct-)?[A-Za-z0-9_-]{16,})/g;

/** Remove `secrets` (and any provider-key-shaped string) from a record before it is stored. */
export function redactSecrets<T>(value: T, secrets: (string | null | undefined)[] = []): T {
  let json = JSON.stringify(value);
  for (const s of secrets) {
    if (s && s.length >= 8) json = json.split(JSON.stringify(s).slice(1, -1)).join("[redacted]");
  }
  json = json.replace(KEY_PATTERN, "[redacted]");
  return JSON.parse(json) as T;
}

export function newId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const listeners = new Set<() => void>();
export function onAuditChange(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const changed = () => listeners.forEach((l) => l());

/** Append a record (redacted). */
export async function appendEntry(entry: AuditEntry, secrets: (string | null)[] = []) {
  await tx(AUDIT_STORE, "readwrite", (s) => s.put(redactSecrets(entry, secrets)));
  changed();
}

/** Record the human decision on a stored call. Nothing else about it can change. */
export async function updateDecision(id: string, patch: DecisionPatch) {
  const current = (await tx<AuditEntry>(AUDIT_STORE, "readonly", (s) => s.get(id))) as
    AuditEntry | undefined;
  if (!current) return;
  const next: AuditEntry = {
    ...current,
    decision: patch.decision,
    decidedAt: patch.decidedAt,
    finalConfig: patch.finalConfig,
  };
  await tx(AUDIT_STORE, "readwrite", (s) => s.put(next));
  changed();
}

/** All records, newest first. */
export async function listEntries(): Promise<AuditEntry[]> {
  const all = ((await tx<AuditEntry[]>(AUDIT_STORE, "readonly", (s) => s.getAll())) ??
    []) as AuditEntry[];
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function clearEntries() {
  await tx(AUDIT_STORE, "readwrite", (s) => s.clear());
  changed();
}

export interface AuditCounts {
  calls: number;
  tokens: number;
  /** Proposals that came back and got a human decision. */
  decided: number;
  proposals: number;
  measurements: number;
}

export function auditCounts(all: readonly AuditEntry[]): AuditCounts {
  const calls = all.filter((e) => e.kind === "call");
  const proposals = calls.filter((e) => !e.error);
  return {
    calls: calls.length,
    tokens: calls.reduce(
      (s, e) => s + (e.usage ? e.usage.inputTokens + e.usage.outputTokens : 0),
      0,
    ),
    decided: proposals.filter((e) => e.decision !== "pending" && e.decision !== "not-applicable")
      .length,
    proposals: proposals.length,
    measurements: all.filter((e) => e.kind === "measurement").length,
  };
}

export const CSV_COLUMNS = [
  "id",
  "parent_id",
  "kind",
  "timestamp",
  "feature",
  "provider",
  "model",
  "served_model",
  "fallback_used",
  "prompt_version",
  "dataset",
  "scenario",
  "seed",
  "rounds",
  "budget_bytes",
  "input_message",
  "proposed_indexes",
  "notes",
  "accepted_indexes",
  "rejected_indexes",
  "measurement",
  "latency_ms",
  "input_tokens",
  "output_tokens",
  "decision",
  "decided_at",
  "final_config",
  "error",
] as const;

const opt = (v: Cell) => (v === undefined || v === null ? "" : v);

export function entriesToCsv(entries: readonly AuditEntry[]): string {
  return toCsv(
    CSV_COLUMNS,
    entries.map((e) => [
      e.id,
      opt(e.parentId),
      e.kind,
      e.timestamp,
      e.feature,
      e.provider,
      e.model,
      opt(e.servedModel),
      opt(e.fallbackUsed),
      e.input.promptVersion,
      e.input.dataset,
      e.input.scenario,
      e.input.seed,
      e.input.rounds,
      e.input.budgetBytes,
      e.input.message,
      opt(e.output.indexes?.map((i) => `${i.table}(${i.columns.join(", ")})`).join(" | ")),
      opt(e.output.notes),
      opt(e.validation?.accepted.join(" | ")),
      opt(e.validation?.rejected.map((r) => `${r.index}: ${r.reason}`).join(" | ")),
      opt(e.output.measurement ? JSON.stringify(e.output.measurement) : undefined),
      e.latencyMs,
      opt(e.usage?.inputTokens),
      opt(e.usage?.outputTokens),
      e.decision,
      opt(e.decidedAt),
      opt(e.finalConfig?.join(" | ")),
      opt(e.error),
    ]),
  );
}

export function entriesToJson(entries: readonly AuditEntry[], exported: Date = new Date()): string {
  return JSON.stringify(
    {
      exported: exported.toISOString(),
      source: "Self-Driving DB Lab AI audit log (this browser only)",
      note: "API keys are never stored in this log.",
      entries,
    },
    null,
    2,
  );
}
