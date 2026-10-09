/**
 * Where the visitor's AI settings and key live: only in their browser.
 *
 * - Settings (provider, model ids, the "remember" choice) are not secret and
 *   live in localStorage.
 * - The key lives in sessionStorage by default (gone when the tab closes), and
 *   in localStorage only if the visitor ticks "remember on this device".
 * - "Forget key" removes it from both.
 *
 * Nothing here is ever sent to this site's server, and the key is never
 * written to the audit log (audit-log.ts also redacts defensively).
 */
import { DEFAULT_SETTINGS, type AiSettings, type Provider } from "./types";

const STORAGE_PREFIX = "sddb.ai.";
const SETTINGS_KEY = `${STORAGE_PREFIX}settings`;
const KEY_PREFIX = `${STORAGE_PREFIX}key.`;
const PROVIDERS: Provider[] = ["anthropic", "openai"];

function stores(): { session: Storage | null; local: Storage | null } {
  const g = globalThis as { sessionStorage?: Storage; localStorage?: Storage };
  try {
    return { session: g.sessionStorage ?? null, local: g.localStorage ?? null };
  } catch {
    // storage access throws when blocked by privacy settings
    return { session: null, local: null };
  }
}

const listeners = new Set<() => void>();
let version = 0;
let cached: AiState | null = null;

function emit() {
  version++;
  cached = null;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(STORAGE_PREFIX)) emit();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function loadSettings(): AiSettings {
  const { local } = stores();
  try {
    const raw = local?.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const v = JSON.parse(raw) as Partial<AiSettings>;
    return {
      provider: v.provider === "openai" ? "openai" : "anthropic",
      anthropicModel:
        typeof v.anthropicModel === "string" && v.anthropicModel.trim()
          ? v.anthropicModel
          : DEFAULT_SETTINGS.anthropicModel,
      openaiModel:
        typeof v.openaiModel === "string" && v.openaiModel.trim()
          ? v.openaiModel
          : DEFAULT_SETTINGS.openaiModel,
      remember: v.remember === true,
      allowFallback: v.allowFallback !== false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AiSettings): void {
  const { local } = stores();
  try {
    local?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // storage full or blocked: settings fall back to defaults next time
  }
  emit();
}

export function getKey(provider: Provider): string | null {
  const { session, local } = stores();
  try {
    return session?.getItem(KEY_PREFIX + provider) || local?.getItem(KEY_PREFIX + provider) || null;
  } catch {
    return null;
  }
}

/** Store a key for this tab, and on this device too when `remember` is set. An empty key removes it. */
export function setKey(provider: Provider, key: string, remember: boolean): void {
  const { session, local } = stores();
  const k = key.trim();
  try {
    if (!k) {
      session?.removeItem(KEY_PREFIX + provider);
      local?.removeItem(KEY_PREFIX + provider);
    } else {
      session?.setItem(KEY_PREFIX + provider, k);
      if (remember) local?.setItem(KEY_PREFIX + provider, k);
      else local?.removeItem(KEY_PREFIX + provider);
    }
  } catch {
    // blocked storage: the key simply is not kept
  }
  emit();
}

/**
 * Re-file every stored key under one "remember on this device" choice. The
 * setting covers all providers, so turning it off must take every key off the
 * device, not only the selected provider's.
 */
export function applyRemember(remember: boolean): void {
  for (const p of PROVIDERS) {
    const k = getKey(p);
    if (k) setKey(p, k, remember);
  }
}

/** Remove every stored key (both providers, both storages). */
export function forgetKeys(): void {
  const { session, local } = stores();
  for (const p of PROVIDERS) {
    try {
      session?.removeItem(KEY_PREFIX + p);
      local?.removeItem(KEY_PREFIX + p);
    } catch {
      // ignore
    }
  }
  emit();
}

/** Mask a key for display: its prefix and last four characters. */
export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

/** Whether a key looks like it belongs to the other provider (a common paste mistake). */
export function keyLooksWrong(provider: Provider, key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  if (provider === "openai") return k.startsWith("sk-ant-");
  return k.startsWith("sk-") && !k.startsWith("sk-ant-");
}

export interface AiState {
  settings: AiSettings;
  hasKey: boolean;
  version: number;
}

/** Snapshot for useSyncExternalStore (stable between changes). */
export function getState(): AiState {
  if (!cached) {
    const settings = loadSettings();
    cached = { settings, hasKey: !!getKey(settings.provider), version };
  }
  return cached;
}

export const SERVER_STATE: AiState = { settings: DEFAULT_SETTINGS, hasKey: false, version: -1 };
