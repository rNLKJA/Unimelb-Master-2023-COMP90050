import { AUTONOMY_LEVELS } from "@/lib/survey/report";
import { cn } from "@/lib/utils";

export function AutonomyLadder({ from, to }: { from: number; to: number }) {
  return (
    <ol className="space-y-1.5" aria-label="Levels of autonomy">
      {[...AUTONOMY_LEVELS].reverse().map((l) => {
        const on = l.level >= from && l.level <= to;
        return (
          <li
            key={l.level}
            className={cn(
              "grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-lg border px-3 py-2.5 transition-all duration-500",
              on ? "border-mint/60 bg-mint-soft/60" : "border-border bg-surface opacity-55",
            )}
            style={{ marginLeft: `${(5 - l.level) * 4}%` }}
          >
            <span
              className={cn(
                "font-display tabular text-2xl font-semibold",
                on ? "text-mint" : "text-muted-foreground",
              )}
            >
              {l.level}
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{l.name}</span>
              <span className="text-muted-foreground block text-xs">{l.description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Part = "predictor" | "tuner" | "organiser" | "all";

function Box({
  x,
  y,
  w,
  h,
  title,
  lines,
  on,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  on: boolean;
}) {
  return (
    <g className="transition-opacity duration-500" opacity={on ? 1 : 0.35}>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className={on ? "fill-mint-soft stroke-mint" : "fill-surface stroke-border"}
        strokeWidth={1.5}
      />
      <text
        x={x + 14}
        y={y + 24}
        className="fill-foreground font-display text-[15px] font-semibold"
      >
        {title}
      </text>
      {lines.map((l, i) => (
        <text
          key={l}
          x={x + 14}
          y={y + 44 + i * 17}
          className="fill-muted-foreground font-mono text-[11px]"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

/** Kossmann & Schlosser's predictor / tuner / organiser loop, annotated with the systems we surveyed. */
export function ArchitectureDiagram({ highlight }: { highlight: Part }) {
  const on = (p: Part) => highlight === "all" || highlight === p;
  return (
    <svg
      viewBox="0 0 520 430"
      className="h-auto w-full"
      role="img"
      aria-label="Self-driving database architecture: a workload predictor feeds tuners, an organiser applies their actions to the DBMS, and observed runtimes flow back"
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
        </marker>
      </defs>
      <rect
        x={170}
        y={8}
        width={180}
        height={34}
        rx={17}
        className="fill-surface-2 stroke-border"
      />
      <text x={260} y={30} textAnchor="middle" className="fill-foreground font-mono text-[12px]">
        incoming queries
      </text>
      <path
        d="M260 42 V70"
        className="stroke-muted-foreground"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      <Box
        x={20}
        y={72}
        w={480}
        h={88}
        title="Workload predictor"
        lines={[
          "templatise → cluster → forecast arrival rates",
          "QB5000 · LR, LSTM, kernel regression (HYBRID)",
        ]}
        on={on("predictor")}
      />
      <path
        d="M260 160 V188"
        className="stroke-muted-foreground"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      <Box
        x={20}
        y={190}
        w={230}
        h={104}
        title="Tuners"
        lines={["what to change", "index advisors · knob tuners", "behaviour models (MB2)"]}
        on={on("tuner")}
      />
      <Box
        x={270}
        y={190}
        w={230}
        h={104}
        title="Organiser"
        lines={["when and in what order", "receding-horizon planning", "PilotBot0 · MCTS"]}
        on={on("organiser")}
      />
      <path
        d="M250 242 H268"
        className="stroke-muted-foreground"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      <path
        d="M385 294 V322"
        className="stroke-muted-foreground"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
      <rect
        x={270}
        y={324}
        width={230}
        height={52}
        rx={10}
        className="fill-surface-2 stroke-border"
      />
      <text
        x={385}
        y={355}
        textAnchor="middle"
        className="fill-foreground font-display text-[15px] font-semibold"
      >
        DBMS
      </text>
      <path
        d="M270 350 H135 V296"
        className="stroke-mint"
        strokeWidth={1.5}
        strokeDasharray="5 4"
        markerEnd="url(#arrow)"
        fill="none"
      />
      <text x={140} y={392} className="fill-muted-foreground font-mono text-[11px]">
        observed runtimes feed back (the bandit&apos;s reward)
      </text>
    </svg>
  );
}

/** The three stages every index advisor goes through, with counts from our own workload. */
export function PipelineDiagram({
  counts,
}: {
  counts: { candidates: number; perQuery: number; chosen: number; calls: number };
}) {
  const steps = [
    {
      n: counts.candidates,
      label: "Enumerate",
      text: "syntactically relevant indexes from the workload's predicates",
    },
    {
      n: counts.perQuery,
      label: "Select",
      text: "candidates that win for at least one query on their own",
    },
    {
      n: counts.chosen,
      label: "Explore",
      text: `indexes kept by Greedy(2, k) under the budget, after ${counts.calls.toLocaleString("en-AU")} what-if calls`,
    },
  ];
  return (
    <ol className="grid gap-3" aria-label="Index selection pipeline">
      {steps.map((s, i) => (
        <li key={s.label} className="border-border bg-surface relative rounded-xl border p-4">
          <div className="flex items-baseline gap-3">
            <span className="text-muted-foreground font-mono text-xs">0{i + 1}</span>
            <span className="font-display text-lg font-semibold">{s.label}</span>
            <span className="font-display text-mint tabular ml-auto text-3xl font-semibold">
              {s.n}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{s.text}</p>
          <div className="bg-surface-2 mt-3 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-mint h-full rounded-full"
              style={{ width: `${(s.n / steps[0].n) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
