import { BreakdownBars, TIME_SEGMENTS } from "@/components/charts/breakdown-bars";
import { comparisons } from "@/lib/survey/report";

const minutes = (v: number) => `${v.toFixed(v >= 100 ? 0 : 1)} min`;

/** The report's Table 2 (from Perera et al.) as paired stacked bars. */
export function Table2Chart() {
  const groups = comparisons();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {(["TPC-H", "TPC-DS"] as const).map((wl) => {
        const rows = groups.filter((g) => g.workload === wl);
        const max = Math.max(...rows.flatMap((g) => [g.pdtool.total, g.mab.total]));
        return (
          <div key={wl} className="space-y-3">
            <p className="kicker">{wl}</p>
            {rows.map((g) => (
              <div key={g.mode}>
                <p className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{g.mode}</span>
                  <span
                    className={
                      g.change < 0 ? "text-mint font-mono text-xs" : "text-coral font-mono text-xs"
                    }
                  >
                    MAB {g.change < 0 ? "" : "+"}
                    {(g.change * 100).toFixed(0)}%
                  </span>
                </p>
                <BreakdownBars
                  caption={`${wl} ${g.mode}: total workload time, PDTool vs MAB (minutes)`}
                  segments={TIME_SEGMENTS}
                  format={minutes}
                  max={max}
                  className="[&_figcaption]:hidden"
                  rows={[g.pdtool, g.mab].map((r) => ({
                    id: r.tool,
                    text: r.tool,
                    label: r.tool,
                    values: {
                      recommendation: r.recommendation,
                      creation: r.creation,
                      execution: r.execution,
                    },
                    total: r.total,
                    highlight: r.tool === "MAB",
                  }))}
                />
              </div>
            ))}
          </div>
        );
      })}
      <div
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs md:col-span-2"
        aria-hidden
      >
        {TIME_SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
