import { Sparkline } from "@/components/charts/sparkline";
import type { ForecastView } from "@/lib/forecast/view";
import { GROUP_LABELS, type TemplateGroup } from "@/lib/workload/templates";
import { clusterColor } from "./shared";

/** Hidden behaviours the trace was generated from, to check the clustering against. */
function matchesGroups(view: ForecastView): boolean {
  const groups = new Map<TemplateGroup, Set<number>>();
  for (const t of view.templates) {
    if (!groups.has(t.group)) groups.set(t.group, new Set());
    groups.get(t.group)!.add(t.cluster);
  }
  return (
    view.clusters.length === groups.size &&
    [...groups.values()].every((clusters) => clusters.size === 1)
  );
}

/** QB5000's clusters, shown on the second training week (one full weekly cycle). */
export function ClusterGrid({ view }: { view: ForecastView }) {
  const from = view.testStart - 7 * 24;
  const to = view.testStart;
  const ok = matchesGroups(view);
  return (
    <div className="space-y-3">
      <p className="text-muted-foreground font-mono text-xs">
        ρ = {view.settings.rho.toFixed(2)} → {view.clusters.length} cluster
        {view.clusters.length === 1 ? "" : "s"} from {view.templates.length} templates ·{" "}
        <span className={ok ? "text-mint" : "text-amber"}>
          {ok ? "matches the three hidden behaviours" : "differs from the three hidden behaviours"}
        </span>
      </p>
      <ol
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        aria-label="Template clusters"
      >
        {view.clusters.map((c, i) => {
          const color = clusterColor(i);
          const members = view.templates.filter((t) => t.cluster === i);
          return (
            <li key={c.members.join(",")} className="border-border bg-surface rounded-xl border">
              <div className="border-border border-b px-4 pt-3 pb-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display flex items-center gap-2 font-semibold">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: color }}
                      aria-hidden
                    />
                    Cluster {i + 1}
                  </p>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    {members.length} template{members.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Sparkline values={c.volume.slice(from, to)} color={color} className="mt-2 h-12" />
                <p className="text-muted-foreground mt-1 flex justify-between font-mono text-[10px]">
                  <span>Mon</span>
                  <span>total hourly volume, training week 2</span>
                  <span>Sun</span>
                </p>
              </div>
              <ul className="divide-border/60 divide-y">
                {members.map((t) => (
                  <li
                    key={t.id}
                    className="grid grid-cols-[2.25rem_minmax(0,1fr)_5.5rem] items-center gap-2 px-4 py-1.5"
                  >
                    <span className="text-muted-foreground font-mono text-xs">{t.id}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{t.title}</span>
                      <span className="text-muted-foreground block text-[11px]">
                        {GROUP_LABELS[t.group]}
                      </span>
                    </span>
                    <Sparkline
                      values={t.series.slice(from, to)}
                      color={color}
                      fill={false}
                      className="h-6"
                    />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
