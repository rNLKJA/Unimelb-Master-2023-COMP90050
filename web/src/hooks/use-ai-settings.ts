"use client";

import { useSyncExternalStore } from "react";
import { getState, SERVER_STATE, subscribe, type AiState } from "@/lib/ai/settings";

/** The visitor's AI settings and whether a key is stored (never the key itself). */
export function useAiSettings(): AiState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
}
