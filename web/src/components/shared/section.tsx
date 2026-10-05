import { cn } from "@/lib/utils";

export function SectionHeading({
  kicker,
  title,
  children,
  className,
  id,
}: {
  kicker?: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("max-w-3xl space-y-3", className)}>
      {kicker && <p className="kicker text-mint">{kicker}</p>}
      <h2 id={id} className="text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      {children && <div className="prose-lab text-base">{children}</div>}
    </div>
  );
}

export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border-border bg-surface rounded-xl border shadow-[0_1px_0_0_var(--border)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "mint" | "default";
}) {
  return (
    <div className="min-w-0">
      <p className="kicker">{label}</p>
      <p
        className={cn(
          "font-display tabular mt-1 text-2xl font-semibold",
          tone === "mint" && "text-mint",
        )}
      >
        {value}
      </p>
      {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
    </div>
  );
}

export function Callout({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <aside
      className={cn(
        "border-border border-l-mint bg-surface-2/60 rounded-lg border border-l-4 px-4 py-3 text-sm",
        className,
      )}
    >
      {title && <p className="mb-1 font-medium">{title}</p>}
      <div className="text-muted-foreground [&_a]:text-foreground [&_a]:decoration-mint [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </aside>
  );
}
