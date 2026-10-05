"use client";

import { useId, useMemo, useState } from "react";
import { useElementWidth } from "@/hooks/use-element-width";
import { niceTicks } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Series {
  id: string;
  label: string;
  /** CSS colour, e.g. var(--adv-mab). */
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  width?: number;
}

export interface Marker {
  x: number;
  label: string;
}

interface Props {
  series: Series[];
  /** Number of x positions (defaults to the longest series). */
  length?: number;
  height?: number;
  xLabel?: (i: number) => string;
  yFormat?: (v: number) => string;
  yLabel?: string;
  markers?: Marker[];
  /** Shaded x ranges, e.g. the test period. */
  bands?: { from: number; to: number; label?: string }[];
  ariaLabel: string;
  className?: string;
  /** Preferred tick positions; thinned automatically when the chart is narrow. */
  xTicks?: number[];
  /** Tick text, when it should be shorter than the tooltip's `xLabel`. */
  xTickLabel?: (i: number) => string;
}

const PAD = { top: 14, right: 16, bottom: 28, left: 56 };

export function LineChart({
  series,
  length,
  height = 260,
  xLabel = (i) => String(i + 1),
  yFormat = (v) => v.toFixed(0),
  yLabel,
  markers = [],
  bands = [],
  ariaLabel,
  className,
  xTicks,
  xTickLabel,
}: Props) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const clip = useId();
  const n = length ?? Math.max(0, ...series.map((s) => s.values.length));
  const max = useMemo(
    () =>
      Math.max(
        1e-9,
        ...series.flatMap((s) =>
          s.values.filter((v): v is number => v !== null && Number.isFinite(v)),
        ),
      ),
    [series],
  );
  const ticks = niceTicks(max, 4);
  const top = ticks[ticks.length - 1] || 1;
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const xs = (() => {
    if (!xTicks) {
      const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(innerW / 70))));
      const out: number[] = [];
      for (let i = 0; i < n; i += step) out.push(i);
      return out;
    }
    // Keep every k-th preferred tick so labels stay at least ~56px apart.
    const gap = xTicks.length > 1 ? x(xTicks[1]) - x(xTicks[0]) : innerW;
    const k = Math.max(1, Math.ceil(56 / Math.max(1, gap)));
    return xTicks.filter((_, j) => j % k === 0);
  })();

  const path = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - box.left) / box.width;
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };

  const tipLeft = hover !== null ? Math.min(Math.max(x(hover) + 12, 8), width - 200) : 0;

  return (
    <div ref={ref} className={cn("relative w-full select-none", className)}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id={clip}>
            <rect x={PAD.left} y={PAD.top - 2} width={innerW} height={innerH + 4} />
          </clipPath>
        </defs>
        {bands.map((b, i) => (
          <g key={i}>
            <rect
              x={x(b.from)}
              y={PAD.top}
              width={Math.max(0, x(b.to) - x(b.from))}
              height={innerH}
              className="fill-mint-soft/40"
            />
            {b.label && (
              <text
                x={x(b.from) + 6}
                y={PAD.top + 12}
                className="fill-muted-foreground font-mono text-[10px]"
              >
                {b.label}
              </text>
            )}
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={PAD.left + innerW}
              y1={y(t)}
              y2={y(t)}
              className="stroke-grid"
              strokeDasharray={t === 0 ? undefined : "2 4"}
            />
            <text
              x={PAD.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted-foreground tabular font-mono text-[10px]"
            >
              {yFormat(t)}
            </text>
          </g>
        ))}
        {yLabel && (
          <text
            transform={`translate(12 ${PAD.top + innerH / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px] tracking-wider uppercase"
          >
            {yLabel}
          </text>
        )}
        {xs.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            className="fill-muted-foreground tabular font-mono text-[10px]"
          >
            {(xTickLabel ?? xLabel)(i)}
          </text>
        ))}
        {markers.map((m) => (
          <g key={`${m.x}-${m.label}`}>
            <line
              x1={x(m.x)}
              x2={x(m.x)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="stroke-muted-foreground/50"
              strokeDasharray="3 3"
            />
            <text
              x={x(m.x) + 4}
              y={PAD.top + 10}
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {m.label}
            </text>
          </g>
        ))}
        <g clipPath={`url(#${clip})`}>
          {series.map((s) => (
            <path
              key={s.id}
              d={path(s.values)}
              fill="none"
              stroke={s.color}
              strokeWidth={s.width ?? 2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </g>
        {hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="stroke-foreground/30"
            />
            {series.map((s) => {
              const v = s.values[hover];
              return v === null || v === undefined || !Number.isFinite(v) ? null : (
                <circle
                  key={s.id}
                  cx={x(hover)}
                  cy={y(v)}
                  r={3.5}
                  fill={s.color}
                  className="stroke-background"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div
          className="border-border bg-popover/95 pointer-events-none absolute top-2 z-10 w-48 rounded-md border p-2.5 text-xs shadow-lg backdrop-blur"
          style={{ left: tipLeft }}
          role="status"
        >
          <p className="text-muted-foreground mb-1.5 font-mono text-[10px] tracking-wider uppercase">
            {xLabel(hover)}
          </p>
          <ul className="space-y-1">
            {series
              .map((s) => ({ s, v: s.values[hover] }))
              .filter(({ v }) => v !== null && v !== undefined && Number.isFinite(v))
              .sort((a, b) => (b.v as number) - (a.v as number))
              .map(({ s, v }) => (
                <li key={s.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="tabular font-mono">{yFormat(v as number)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Legend({
  items,
  className,
}: {
  items: { label: string; color: string; dashed?: boolean }[];
  className?: string;
}) {
  return (
    <ul className={cn("text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 text-xs", className)}>
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="18" height="6" aria-hidden>
            <line
              x1="1"
              x2="17"
              y1="3"
              y2="3"
              stroke={i.color}
              strokeWidth="2.5"
              strokeDasharray={i.dashed ? "4 3" : undefined}
              strokeLinecap="round"
            />
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}
