import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Links between decision records ("DR-002-....md") point at their pages on the site. */
export function rewriteHref(href: string | undefined): string | undefined {
  if (!href) return href;
  const dr = /^(?:\.\/|\.\.\/decisions\/|decisions\/)?(DR-\d{3}-[a-z0-9-]+)\.md$/.exec(href);
  if (dr) return `/methods/decisions/${dr[1]}`;
  return href;
}

const link = "text-foreground decoration-mint hover:text-mint underline decoration-2 underline-offset-4";

const components: Components = {
  h2: ({ children }) => (
    <h2 className="text-foreground mt-10 mb-3 text-2xl font-semibold first:mt-0 sm:text-3xl">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mt-6 mb-2 text-xl font-semibold">{children}</h3>
  ),
  p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="marker:text-mint my-3 list-disc space-y-1.5 pl-6 leading-relaxed">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="marker:text-mint my-3 list-decimal space-y-1.5 pl-6 leading-relaxed">
      {children}
    </ol>
  ),
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  code: ({ children }) => (
    <code className="bg-surface-2 rounded px-1 py-0.5 font-mono text-[0.85em] break-words">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const to = rewriteHref(href);
    return to?.startsWith("/") || to?.startsWith("#") ? (
      <Link className={link} href={to}>
        {children}
      </Link>
    ) : (
      <a className={link} href={to} rel="noreferrer">
        {children}
      </a>
    );
  },
  table: ({ children }) => (
    <div
      role="region"
      aria-label="Table"
      tabIndex={0}
      className="border-border my-4 overflow-x-auto rounded-lg border focus-visible:-outline-offset-2"
    >
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-surface-2/70 text-foreground px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border-border border-t px-3 py-2 align-top">{children}</td>,
};

/** One heading level lower, for documents rendered inside a page section that has its own h2. */
const demoted: Components = {
  ...components,
  h2: ({ children }) => (
    <h3 className="text-foreground mt-8 mb-3 text-xl font-semibold first:mt-0 sm:text-2xl">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="font-display text-foreground mt-6 mb-2 text-lg font-semibold">{children}</h4>
  ),
};

/** Server-rendered markdown from the repository's own docs (trusted content, no raw HTML). */
export function Markdown({
  source,
  className,
  demote = false,
}: {
  source: string;
  className?: string;
  /** Render ## as h3 (inside a section whose heading is the h2). */
  demote?: boolean;
}) {
  return (
    <div className={cn("text-muted-foreground text-[15px] [&_li>p]:my-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={demote ? demoted : components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
