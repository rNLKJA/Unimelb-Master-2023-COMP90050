"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const ORDER = ["system", "light", "dark"] as const;
const ICON = { system: Monitor, light: Sun, dark: Moon };
const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = (mounted ? theme : "system") as (typeof ORDER)[number];
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICON[current] ?? Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="text-muted-foreground hover:border-border hover:bg-surface-2 hover:text-foreground inline-flex size-9 items-center justify-center rounded-md border border-transparent transition-colors"
      aria-label={`Colour theme: ${current}. Switch to ${next}.`}
      title={`Theme: ${current}`}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
