/**
 * Provider adapters. Both call the provider's HTTP API directly from the
 * visitor's browser with the visitor's own key; nothing goes through this
 * site, which is static and has no server code, AI code or key of its own.
 * Raw `fetch` rather than an SDK keeps the client bundle small, gives one
 * adapter shape for both providers and lets tests mock the network
 * (docs/decisions/DR-005).
 */
import { AiError, type ProviderReply, type ProviderRequest, type TokenUsage } from "./types";

export const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
/** Beta header for Anthropic's server-side refusal fallback ("default" routing). */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

async function send(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetchImpl(url, init);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new AiError("aborted");
    throw new AiError("network");
  }
}

interface ErrorBody {
  type?: string;
  code?: string;
  message?: string;
}

async function errorDetail(res: Response): Promise<ErrorBody> {
  try {
    const body = (await res.json()) as { error?: ErrorBody };
    return body.error ?? {};
  } catch {
    return {};
  }
}

export function mapStatus(status: number, detail: ErrorBody): AiError {
  const msg = detail.message?.slice(0, 200);
  const text = detail.message ?? "";
  if (status === 401 || status === 403) return new AiError("invalid_key", { status, detail: msg });
  if (status === 404) return new AiError("model_not_found", { status, detail: msg });
  if (status === 429) {
    if (detail.code === "insufficient_quota" || /quota|credit/i.test(text))
      return new AiError("quota", { status, detail: msg });
    return new AiError("rate_limited", { status, detail: msg });
  }
  if (status === 529 || status === 503) return new AiError("overloaded", { status, detail: msg });
  if (status >= 500) return new AiError("server", { status, detail: msg });
  if (/credit balance/i.test(text)) return new AiError("quota", { status, detail: msg });
  if (/model/i.test(text) && /not found|invalid|does not exist|not exist/i.test(text))
    return new AiError("model_not_found", { status, detail: msg });
  return new AiError("bad_request", { status, detail: msg });
}

/**
 * Parse a 2xx body. A success status with a body that is not JSON comes from
 * something between the browser and the provider (a captive portal or a
 * proxy), not from the model, so it is reported as a network problem.
 */
async function successBody<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new AiError("network", {
      status: res.status,
      detail: "the response was not JSON; a proxy or captive portal may be in the way",
    });
  }
}

interface AnthropicMessage {
  model: string;
  content: { type: string; text?: string }[];
  stop_reason: string | null;
  usage?: { input_tokens?: number; output_tokens?: number; iterations?: { type?: string }[] };
}

const isHaiku = (model: string) => model.startsWith("claude-haiku");
const isSonnet55 = (model: string) => model === "claude-sonnet-5-5";

/**
 * The request body for the Anthropic Messages API with structured outputs
 * (`output_config.format`). Per-model settings, from Anthropic's model notes:
 *
 * - Haiku 4.5 takes no effort setting and runs without thinking unless asked;
 *   temperature 0 is allowed, which makes repeated evaluation runs as stable
 *   as the provider allows.
 * - Sonnet 5.5 rejects non-default temperatures and thinks adaptively;
 *   effort "medium" keeps cost in check for a single proposal.
 * - The server-side refusal fallback ("default" routing) is supported on
 *   Sonnet 5.5 through the Claude API, and only used when allowed.
 */
export function anthropicBody(req: ProviderRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: req.model,
    max_tokens: req.maxTokens,
    system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: req.user }],
    output_config: isHaiku(req.model)
      ? { format: { type: "json_schema", schema: req.schema } }
      : { format: { type: "json_schema", schema: req.schema }, effort: "medium" },
  };
  if (isHaiku(req.model)) body.temperature = 0;
  if (req.allowFallback && isSonnet55(req.model)) body.fallbacks = "default";
  return body;
}

/**
 * One call to the Anthropic Messages API. The
 * `anthropic-dangerous-direct-browser-access` header is Anthropic's explicit
 * opt-in for calls made from a browser; it is appropriate here because the
 * key belongs to the person using the browser.
 */
export async function callAnthropic(req: ProviderRequest): Promise<ProviderReply> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const body = anthropicBody(req);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": req.apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (body.fallbacks) headers["anthropic-beta"] = FALLBACK_BETA;
  const res = await send(fetchImpl, ANTHROPIC_URL, {
    method: "POST",
    signal: req.signal,
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw mapStatus(res.status, await errorDetail(res));
  const msg = await successBody<AnthropicMessage>(res);
  const usage: TokenUsage | null = msg.usage
    ? { inputTokens: msg.usage.input_tokens ?? 0, outputTokens: msg.usage.output_tokens ?? 0 }
    : null;
  const fallbackUsed =
    (Array.isArray(msg.content) && msg.content.some((b) => b.type === "fallback")) ||
    (msg.usage?.iterations ?? []).some((it) => it.type === "fallback_message");
  if (msg.stop_reason === "refusal") throw new AiError("refusal", { usage });
  if (msg.stop_reason === "max_tokens") throw new AiError("truncated", { usage });
  const text = Array.isArray(msg.content)
    ? msg.content.find((b) => b.type === "text")?.text
    : undefined;
  if (!text) throw new AiError("invalid_output", { detail: "no text in the reply", usage });
  return { text, model: msg.model, usage, fallbackUsed };
}

interface OpenAiCompletion {
  model: string;
  choices: {
    finish_reason: string;
    message: { content: string | null; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** OpenAI Chat Completions with a strict JSON-schema response format. */
export async function callOpenAi(req: ProviderRequest): Promise<ProviderReply> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const res = await send(fetchImpl, OPENAI_URL, {
    method: "POST",
    signal: req.signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${req.apiKey}` },
    body: JSON.stringify({
      model: req.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: req.schemaName, strict: true, schema: req.schema },
      },
      max_completion_tokens: req.maxTokens,
    }),
  });
  if (!res.ok) throw mapStatus(res.status, await errorDetail(res));
  const body = await successBody<OpenAiCompletion>(res);
  const usage = body.usage
    ? {
        inputTokens: body.usage.prompt_tokens ?? 0,
        outputTokens: body.usage.completion_tokens ?? 0,
      }
    : null;
  const choice = body.choices?.[0];
  if (!choice) throw new AiError("invalid_output", { detail: "no choices in the reply", usage });
  if (choice.message?.refusal)
    throw new AiError("refusal", { detail: choice.message.refusal.slice(0, 200), usage });
  if (choice.finish_reason === "length") throw new AiError("truncated", { usage });
  if (!choice.message?.content)
    throw new AiError("invalid_output", { detail: "empty reply", usage });
  return { text: choice.message.content, model: body.model, usage, fallbackUsed: false };
}
