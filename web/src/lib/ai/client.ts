import type { z } from "zod";
import { callAnthropic, callOpenAi } from "./providers";
import {
  AiError,
  modelFor,
  type AiSettings,
  type Provider,
  type ProviderReply,
  type TokenUsage,
} from "./types";

export interface StructuredCall<T extends z.ZodType> {
  settings: AiSettings;
  apiKey: string | null;
  system: string;
  user: string;
  schemaName: string;
  /** JSON Schema sent to the provider. */
  jsonSchema: Record<string, unknown>;
  /** The same contract, enforced again on our side. */
  zodSchema: T;
  maxTokens?: number;
  /** Allow Anthropic's refusal fallback for this call (Sonnet 5.5 only). */
  allowFallback?: boolean;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export interface StructuredResult<T> {
  data: T;
  provider: Provider;
  /** The model id requested. */
  model: string;
  /** The model id the provider reports. */
  servedModel: string;
  fallbackUsed: boolean;
  usage: TokenUsage | null;
  latencyMs: number;
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * One structured-output call to the visitor's chosen provider. The provider
 * is asked to follow a JSON Schema; the reply is then parsed and validated
 * with zod here too, because a schema-following model can still fail
 * (refusals, truncation, a provider bug), and unvalidated output never
 * reaches the page.
 */
export async function callStructured<T extends z.ZodType>(
  call: StructuredCall<T>,
): Promise<StructuredResult<z.infer<T>>> {
  if (!call.apiKey) throw new AiError("no_key");
  const provider = call.settings.provider;
  const model = modelFor(call.settings).trim();
  if (!model) throw new AiError("model_not_found", { detail: "no model id set" });
  const started = now();
  const req = {
    apiKey: call.apiKey,
    model,
    system: call.system,
    user: call.user,
    schemaName: call.schemaName,
    schema: call.jsonSchema,
    maxTokens: call.maxTokens ?? (model.startsWith("claude-haiku") ? 4000 : 16000),
    allowFallback: call.allowFallback ?? false,
    signal: call.signal,
    fetchImpl: call.fetchImpl,
  };
  let reply: ProviderReply;
  try {
    reply = provider === "anthropic" ? await callAnthropic(req) : await callOpenAi(req);
  } catch (e) {
    // keep the time of a failed call: an evaluation has to count it
    if (e instanceof AiError) e.latencyMs ??= Math.round(now() - started);
    throw e;
  }
  const latencyMs = Math.round(now() - started);
  const usage = reply.usage;
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.text);
  } catch {
    throw new AiError("invalid_output", { detail: "reply was not JSON", usage, latencyMs });
  }
  const result = call.zodSchema.safeParse(parsed);
  if (!result.success) {
    throw new AiError("invalid_output", {
      detail: result.error.issues[0]?.message?.slice(0, 120),
      usage,
      latencyMs,
    });
  }
  return {
    data: result.data,
    provider,
    model,
    servedModel: reply.model,
    fallbackUsed: reply.fallbackUsed,
    usage,
    latencyMs,
  };
}
