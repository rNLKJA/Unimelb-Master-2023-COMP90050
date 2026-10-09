/** Shared types for the bring-your-own-key AI feature (the LLM index advisor). */

export type Provider = "anthropic" | "openai";

export const PROVIDER_LABEL: Record<Provider, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
};

/** Claude models offered in AI settings (current ids from Anthropic's model list, checked 9 October 2026). */
export const ANTHROPIC_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Default. Fastest and cheapest." },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "Stronger reasoning; about twice the price per token.",
  },
] as const;

export const DEFAULT_ANTHROPIC_MODEL: string = ANTHROPIC_MODELS[0].id;

/** OpenAI's model list changes often, so the id is free text with a small default. */
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

export interface AiSettings {
  provider: Provider;
  anthropicModel: string;
  openaiModel: string;
  /** Keep the key in localStorage (this device) instead of sessionStorage (this tab). */
  remember: boolean;
  /**
   * When Claude Sonnet 5.5 declines a request on safety grounds, let Anthropic
   * re-run it on its fallback model. The audit log and the evaluation record
   * which model actually answered.
   */
  allowFallback: boolean;
}

export const DEFAULT_SETTINGS: AiSettings = {
  provider: "anthropic",
  anthropicModel: DEFAULT_ANTHROPIC_MODEL,
  openaiModel: DEFAULT_OPENAI_MODEL,
  remember: false,
  allowFallback: true,
};

export function modelFor(s: AiSettings): string {
  return s.provider === "anthropic" ? s.anthropicModel : s.openaiModel;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export type AiErrorKind =
  | "no_key"
  | "invalid_key"
  | "rate_limited"
  | "quota"
  | "overloaded"
  | "model_not_found"
  | "bad_request"
  | "network"
  | "refusal"
  | "truncated"
  | "invalid_output"
  | "aborted"
  | "server";

const HINT: Record<AiErrorKind, string> = {
  no_key: "Add your own API key in AI settings to use this feature.",
  invalid_key:
    "The provider rejected the key. Check it in AI settings, and that it belongs to the selected provider.",
  rate_limited: "The provider is rate-limiting this key. Wait a moment and try again.",
  quota: "The key has no remaining credit or quota with the provider.",
  overloaded: "The provider is overloaded right now. Try again shortly.",
  model_not_found:
    "The provider does not recognise this model id for your key. Pick another model in AI settings.",
  bad_request: "The provider refused the request.",
  network:
    "Could not reach the provider from your browser. Check your connection; a privacy extension or network policy may be blocking the call (CORS).",
  refusal: "The model declined to answer this request.",
  truncated: "The model's reply was cut off before it finished.",
  invalid_output: "The model's reply did not match the expected structure, so it was discarded.",
  aborted: "Cancelled.",
  server: "The provider returned a server error. Try again shortly.",
};

/**
 * Failures that are the model's own doing: it answered, but the reply was
 * malformed, cut off or a refusal. The invalid-proposal rate counts these
 * against the model. Every other kind (key, quota, rate limit, network,
 * provider outage) is an infrastructure failure that says nothing about it.
 */
export const MODEL_FAILURE_KINDS: readonly AiErrorKind[] = [
  "invalid_output",
  "truncated",
  "refusal",
];

export function isModelFailure(kind: string | undefined): boolean {
  return !!kind && (MODEL_FAILURE_KINDS as readonly string[]).includes(kind);
}

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly status?: number;
  readonly detail?: string;
  /** Tokens the provider billed for the failed call, when it reported them. */
  usage: TokenUsage | null;
  /** Time from request to failure. */
  latencyMs?: number;
  constructor(
    kind: AiErrorKind,
    opts: { status?: number; detail?: string; usage?: TokenUsage | null; latencyMs?: number } = {},
  ) {
    super(opts.detail ? `${HINT[kind]} (${opts.detail})` : HINT[kind]);
    this.name = "AiError";
    this.kind = kind;
    this.status = opts.status;
    this.detail = opts.detail;
    this.usage = opts.usage ?? null;
    this.latencyMs = opts.latencyMs;
  }
}

/** The raw result of one provider call, before validation. */
export interface ProviderReply {
  text: string;
  usage: TokenUsage | null;
  /** The model id the provider reports it served. */
  model: string;
  /** Anthropic re-ran the request on its fallback model after a refusal. */
  fallbackUsed: boolean;
}

export interface ProviderRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** JSON Schema of the reply (structured outputs). */
  schemaName: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  /** Anthropic only: allow the server-side refusal fallback (Sonnet 5.5). */
  allowFallback?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}
