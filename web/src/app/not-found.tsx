import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NAV } from "@/lib/site";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <figure className="border-border overflow-hidden rounded-xl border bg-[oklch(0.17_0.032_262)] text-[oklch(0.9_0.02_250)]">
        <pre className="px-4 py-5 font-mono text-[11.5px] leading-relaxed break-words whitespace-pre-wrap sm:px-5 sm:text-[13px]">
          <code>
            <span className="text-white/45">sqlite&gt; </span>SELECT * FROM pages WHERE path = ?;
            {"\n"}
            <span className="text-[oklch(0.83_0.13_80)]">`--SCAN</span> pages{"\n"}
            <span className="text-white/45">-- 0 rows · no index could help with this one</span>
          </code>
        </pre>
      </figure>
      <p className="kicker text-mint mt-10">404</p>
      <h1 className="mt-2 text-4xl font-semibold">This page is not in the database</h1>
      <p className="text-muted-foreground mt-3">
        The address may have a typo, or the page may never have existed. Try one of these instead.
      </p>
      <ul className="mt-8 grid gap-2 sm:grid-cols-2">
        {NAV.map((n) => (
          <li key={n.href}>
            <Link
              href={n.href}
              className="group border-border bg-surface hover:border-mint/60 flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors"
            >
              {n.label}
              <ArrowRight
                className="text-muted-foreground group-hover:text-mint size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
