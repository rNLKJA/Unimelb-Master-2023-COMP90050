"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { AiSettingsDialog } from "@/components/ai/ai-settings-dialog";
import { GithubMark } from "./github-mark";
import { LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="border-border/80 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <a
        href="#main"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md"
          aria-label={`${SITE.name} home`}
        >
          <LogoMark className="size-7" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[0.95rem] font-semibold tracking-tight">
              {SITE.name}
            </span>
            <span className="text-muted-foreground font-mono text-[0.62rem] tracking-[0.12em] uppercase">
              COMP90050 · G40
            </span>
          </span>
        </Link>
        <nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:bg-surface-2 hover:text-foreground rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive(item.href) && "bg-surface-2 text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 xl:ml-2">
          <a
            href={SITE.repo}
            className="text-muted-foreground hover:bg-surface-2 hover:text-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors"
            aria-label="Source code on GitHub"
          >
            <GithubMark className="size-4" />
          </a>
          <AiSettingsDialog />
          <ThemeToggle />
          <button
            type="button"
            className="text-muted-foreground hover:bg-surface-2 hover:text-foreground inline-flex size-9 items-center justify-center rounded-md xl:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-border border-t px-4 pb-3 xl:hidden"
        >
          <ul className="grid gap-1 pt-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "text-muted-foreground hover:bg-surface-2 hover:text-foreground block rounded-md px-3 py-2 text-sm",
                    isActive(item.href) && "bg-surface-2 text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
