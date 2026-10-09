/** Display helpers for intervals. */

export interface Interval {
  lower: number;
  upper: number;
}

/** "[lo, hi]" with a formatter, or "–" when undefined. */
export function formatInterval(ci: Interval, f: (x: number) => string = (x) => x.toFixed(2)) {
  if (!Number.isFinite(ci.lower) || !Number.isFinite(ci.upper)) return "–";
  return `[${f(ci.lower)}, ${f(ci.upper)}]`;
}

/** A signed percentage change from a ratio: 0.82 -> "−18%", 1.1 -> "+10%". */
export function pctChange(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return "–";
  const p = (ratio - 1) * 100;
  const s = Math.abs(p).toFixed(digits);
  if (Number(s) === 0) return `0%`;
  return `${p < 0 ? "−" : "+"}${s}%`;
}

/** p-values: "< 0.001" below a thousandth, otherwise 3 significant digits. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "–";
  if (p < 0.001) return "< 0.001";
  return p.toPrecision(2);
}
