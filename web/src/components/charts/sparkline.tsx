import { cn } from "@/lib/utils";

/** A tiny trend line, scaled to its own maximum. Decorative: pair it with text. */
export function Sparkline({
  values,
  color,
  className,
  height = 36,
  fill = true,
}: {
  values: number[];
  color: string;
  className?: string;
  height?: number;
  fill?: boolean;
}) {
  const w = 200;
  const max = Math.max(1e-9, ...values);
  const n = values.length;
  const pts = values.map((v, i) => [
    (i / Math.max(1, n - 1)) * w,
    height - 2 - (v / max) * (height - 4),
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn("block h-9 w-full", className)}
      aria-hidden
    >
      {fill && n > 1 && (
        <path d={`${line}L${w},${height}L0,${height}Z`} fill={color} opacity={0.14} />
      )}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}
