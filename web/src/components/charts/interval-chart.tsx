"use client";

import { useElementWidth } from "@/hooks/use-element-width";
import { niceTicksRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface IntervalRow {
  id: string;
  label: string;
  color: string;
  estimate: number;
  lower: number;
  upper: number;
  /** Shown at the right of the row (e.g. the formatted estimate and interval). */
  note?: string;
  dashed?: boolean;
}

/**
 * Dot-and-whisker chart: one row per estimate with its interval on a shared
 * axis, with an optional reference line (0% change, 1x speed-up). A table
 * behind it carries the same numbers for screen readers.
 */
export function IntervalChart({
  rows,
  format,
  reference,
  caption,
  className,
  rowHeight = 30,
}: {
  rows: IntervalRow[];
  format: (v: number) => string;
  reference?: { value: number; label: string };
  caption: string;
  className?: string;
  rowHeight?: number;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const finite = rows.flatMap((r) => [r.lower, r.upper, r.estimate]).filter(Number.isFinite);
  const lo = Math.min(reference?.value ?? Infinity, ...finite);
  const hi = Math.max(reference?.value ?? -Infinity, ...finite);
  const pad = (hi - lo) * 0.06 || Math.abs(hi) * 0.1 || 1;
  const ticks = niceTicksRange(lo - pad, hi + pad, 4);
  const min = Math.min(ticks[0], lo - pad);
  const max = Math.max(ticks[ticks.length - 1], hi + pad);
  // Room for the longest label (12px IBM Plex Sans averages about 6.6px a character).
  const longest = Math.max(0, ...rows.map((r) => r.label.length));
  const labelW = Math.min(width * 0.45, Math.max(60, longest * 6.6 + 6));
  const left = labelW + 8;
  const right = 12;
  const inner = Math.max(40, width - left - right);
  const x = (v: number) => left + ((v - min) / (max - min || 1)) * inner;
  const top = 6;
  const height = top + rows.length * rowHeight + 24;

  return (
    <figure className={cn("w-full", className)}>
      <div ref={ref} className="w-full" aria-hidden>
        <svg width={width} height={height} className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={top}
                y2={height - 20}
                className="stroke-grid"
                strokeDasharray="2 4"
              />
              <text
                x={x(t)}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground tabular font-mono text-[10px]"
              >
                {format(t)}
              </text>
            </g>
          ))}
          {reference && (
            <g>
              <line
                x1={x(reference.value)}
                x2={x(reference.value)}
                y1={top}
                y2={height - 20}
                className="stroke-muted-foreground"
                strokeDasharray="4 3"
              />
            </g>
          )}
          {rows.map((r, i) => {
            const cy = top + i * rowHeight + rowHeight / 2;
            const ok = Number.isFinite(r.lower) && Number.isFinite(r.upper);
            return (
              <g key={r.id}>
                <text
                  x={labelW}
                  y={cy}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-foreground text-[12px]"
                >
                  {r.label}
                </text>
                {ok && (
                  <>
                    <line
                      x1={x(r.lower)}
                      x2={x(r.upper)}
                      y1={cy}
                      y2={cy}
                      stroke={r.color}
                      strokeWidth={2.5}
                      strokeDasharray={r.dashed ? "4 3" : undefined}
                      strokeLinecap="round"
                    />
                    {[r.lower, r.upper].map((v, j) => (
                      <line
                        key={j}
                        x1={x(v)}
                        x2={x(v)}
                        y1={cy - 5}
                        y2={cy + 5}
                        stroke={r.color}
                        strokeWidth={2}
                      />
                    ))}
                  </>
                )}
                {Number.isFinite(r.estimate) && (
                  <circle
                    cx={x(r.estimate)}
                    cy={cy}
                    r={4.5}
                    fill={r.color}
                    className="stroke-surface"
                    strokeWidth={1.5}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {/* A table ignores sr-only's 1px width and grows with its contents, so the
          wrapper is the element that is visually hidden. */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Estimate</th>
              <th scope="col">95% interval</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.label}</th>
                <td>{format(r.estimate)}</td>
                <td>
                  {format(r.lower)} to {format(r.upper)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reference && (
        <figcaption className="text-muted-foreground mt-1 text-[11px]">
          Dashed line: {reference.label}. Whiskers: 95% intervals.
        </figcaption>
      )}
    </figure>
  );
}
