import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { LogoMark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface/60 mt-24 border-t">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-7" />
            <span className="font-display font-semibold">{SITE.name}</span>
          </div>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            A revival of the {SITE.group} survey for {SITE.subject}, {SITE.university}, {SITE.term}.
            Survey by Sunchuangyu Huang, Runqiu Fei, Xiaoyi Liu and Qingxuan Yang; interactive lab
            rebuilt in 2026.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Shared for learning and as a portfolio piece. The original report and slides stay in the
            repository for reference; please do not reuse them as your own coursework.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="kicker mb-3">Explore</p>
          <ul className="grid gap-2 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="text-muted-foreground hover:text-foreground">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="kicker mb-3">Built with</p>
          <ul className="text-muted-foreground grid gap-2 text-sm">
            <li>SQLite 3.49 in WebAssembly (sql.js)</li>
            <li>Next.js 16 · React 19 · TypeScript</li>
            <li>Web Workers for every experiment</li>
            <li>
              <Link href="/ai-log" className="hover:text-foreground">
                AI audit log (this browser)
              </Link>
            </li>
            <li>
              <a href={SITE.repo} className="hover:text-foreground">
                Source on GitHub →
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
