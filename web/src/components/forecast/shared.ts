const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Hour 0 of the synthetic trace is a Monday at midnight. */
export function hourLabel(h: number): string {
  return `${DAYS[Math.floor(h / 24) % 7]} ${String(h % 24).padStart(2, "0")}:00`;
}

export function dayName(h: number): string {
  return DAYS[Math.floor(h / 24) % 7];
}

const CLUSTER_COLORS = [
  "var(--mint)",
  "var(--sky)",
  "var(--amber)",
  "var(--violet)",
  "var(--coral)",
  "var(--adv-none)",
];

export function clusterColor(i: number): string {
  return i < 0 ? "var(--muted-foreground)" : CLUSTER_COLORS[i % CLUSTER_COLORS.length];
}

export const MODEL_COLORS = {
  actual: "var(--seg-exec)",
  lr: "var(--sky)",
  kr: "var(--violet)",
  hybrid: "var(--mint)",
} as const;

export const STRATEGY_COLORS: Record<string, string> = {
  none: "var(--adv-none)",
  static: "var(--amber)",
  reactive: "var(--coral)",
  proactive: "var(--mint)",
  oracle: "var(--violet)",
};

/** Text-safe variants of STRATEGY_COLORS (at least 4.5:1 on the page in both themes). */
export const STRATEGY_TEXT_COLORS: Record<string, string> = {
  ...STRATEGY_COLORS,
  none: "var(--muted-foreground)",
  static: "var(--amber-ink)",
};
