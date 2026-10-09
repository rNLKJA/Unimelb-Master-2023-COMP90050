import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/content/markdown";
import { getDecision, listDecisions } from "@/server/content";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await listDecisions()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/methods/decisions/[slug]">): Promise<Metadata> {
  const record = await getDecision((await params).slug);
  return record ? { title: `${record.id}: ${record.title}`, description: record.title } : {};
}

const link =
  "text-foreground decoration-mint hover:text-mint underline decoration-2 underline-offset-4";

export default async function DecisionPage({ params }: PageProps<"/methods/decisions/[slug]">) {
  const record = await getDecision((await params).slug);
  if (!record) notFound();
  const all = await listDecisions();
  const i = all.findIndex((d) => d.slug === record.slug);
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8 space-y-3">
        <p className="kicker text-mint">Decision record {record.id}</p>
        <h1 className="text-3xl font-semibold sm:text-4xl">{record.title}</h1>
        <dl className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-1.5">
            <dt>Status:</dt>
            <dd className="text-foreground">{record.status}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Decided:</dt>
            <dd className="text-foreground">{record.decided}</dd>
          </div>
        </dl>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Scope: <span className="font-mono break-words">{record.scope.replaceAll("`", "")}</span>
        </p>
      </header>
      <Markdown source={record.body} />
      <nav
        aria-label="Decision records"
        className="border-border mt-12 flex flex-wrap justify-between gap-4 border-t pt-6 text-sm"
      >
        {i > 0 ? (
          <Link className={link} href={`/methods/decisions/${all[i - 1].slug}`}>
            ← {all[i - 1].id}
          </Link>
        ) : (
          <span />
        )}
        <Link className={link} href="/methods#decisions">
          All decision records
        </Link>
        {i < all.length - 1 ? (
          <Link className={link} href={`/methods/decisions/${all[i + 1].slug}`}>
            {all[i + 1].id} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
