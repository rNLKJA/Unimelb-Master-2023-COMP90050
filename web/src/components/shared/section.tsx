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
  level = 3,
}: {
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  /** Heading level; panels directly under a page's h1 should use 2. */
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className="border-border flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <Heading className="font-display text-base font-semibold">{title}</Heading>
        {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
      </div>
      {right}
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
