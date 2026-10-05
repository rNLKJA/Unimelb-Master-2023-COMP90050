"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ArchitectureDiagram, AutonomyLadder, PipelineDiagram } from "./diagrams";

export interface Step {
  kicker: string;
  title: string;
  body: React.ReactNode;
  visual:
    | { kind: "ladder"; from: number; to: number }
    | { kind: "architecture"; highlight: "predictor" | "tuner" | "organiser" | "all" }
    | { kind: "pipeline" };
}

function Visual({
  v,
  counts,
}: {
  v: Step["visual"];
  counts: Parameters<typeof PipelineDiagram>[0]["counts"];
}) {
  if (v.kind === "ladder") return <AutonomyLadder from={v.from} to={v.to} />;
  if (v.kind === "architecture") return <ArchitectureDiagram highlight={v.highlight} />;
  return <PipelineDiagram counts={counts} />;
}

/** Scroll-driven explainer: text steps on the left, a sticky diagram on the right. */
export function Scrolly({
  steps,
  counts,
}: {
  steps: Step[];
  counts: Parameters<typeof PipelineDiagram>[0]["counts"];
}) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        {steps.map((s, i) => (
          <section
            key={s.title}
            ref={(el) => {
              refs.current[i] = el;
            }}
            data-step={i}
            aria-labelledby={`step-${i}`}
            className="flex min-h-[auto] flex-col justify-center py-8 lg:min-h-[72vh]"
          >
            <p className={cn("kicker transition-colors", active === i && "text-mint")}>
              {s.kicker}
            </p>
            <h3 id={`step-${i}`} className="mt-2 text-2xl font-semibold sm:text-3xl">
              {s.title}
            </h3>
            <div className="prose-lab mt-3 max-w-xl">{s.body}</div>
            <div className="mt-6 lg:hidden">
              <Visual v={s.visual} counts={counts} />
            </div>
          </section>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-24 flex min-h-[calc(100vh-8rem)] items-center">
          <div className="border-border bg-surface/70 w-full rounded-2xl border p-6 shadow-sm">
            <Visual v={steps[active].visual} counts={counts} />
            <p className="text-muted-foreground mt-4 font-mono text-[11px]">
              {String(active + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
