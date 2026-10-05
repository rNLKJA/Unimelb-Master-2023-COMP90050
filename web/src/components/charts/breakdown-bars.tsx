import { cn } from "@/lib/utils";

export interface Segment {
  key: string;
  label: string;
  color: string;
}

export interface BreakdownRow {
  id: string;
  label: React.ReactNode;
  /** Plain-text label for screen readers. */
  text: string;
  values: Record<string, number>;
  total: number;
  highlight?: boolean;
  note?: string;
}

interface Props {
  rows: BreakdownRow[];
  segments: Segment[];
  format: (v: number) => string;
  max?: number;
  caption: string;
  className?: string;
}

/** Horizontal stacked bars with a screen-reader table behind them. */
export function BreakdownBars({ rows, segments, format, max, caption, className }: Props) {
  const top = max ?? Math.max(1e-9, ...rows.map((r) => r.total));
  return (
    <figure className={cn("space-y-2", className)}>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Row</th>
              {segments.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row">{r.text}</th>
                {segments.map((s) => (
                  <td key={s.key}>{format(r.values[s.key] ?? 0)}</td>
                ))}
                <td>{format(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div aria-hidden className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className="grid grid-cols-[minmax(6.5rem,9rem)_1fr_auto] items-center gap-3"
          >
            <div
              className={cn(
                "truncate text-sm",
                r.highlight ? "text-foreground font-medium" : "text-muted-foreground",
              )}
            >
              {r.label}
            </div>
            <div className="bg-surface-2 flex h-5 overflow-hidden rounded-[3px]">
              {segments.map((s) => {
                const v = r.values[s.key] ?? 0;
                if (v <= 0) return null;
                return (
                  <div
                    key={s.key}
                    title={`${s.label}: ${format(v)}`}
                    className="border-background/60 h-full border-r last:border-r-0"
                    style={{ width: `${(v / top) * 100}%`, background: s.color }}
                  />
                );
              })}
            </div>
            <div className="tabular min-w-[4.5rem] text-right font-mono text-xs">
              {format(r.total)}
              {r.note && <span className="text-muted-foreground ml-1.5">{r.note}</span>}
            </div>
          </div>
        ))}
      </div>
      <figcaption
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs"
        aria-hidden
      >
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export const TIME_SEGMENTS: Segment[] = [
  { key: "execution", label: "Query execution", color: "var(--seg-exec)" },
  { key: "creation", label: "Index creation", color: "var(--seg-create)" },
  { key: "recommendation", label: "Recommendation", color: "var(--seg-rec)" },
];
