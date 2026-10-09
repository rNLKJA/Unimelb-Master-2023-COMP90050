"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GalleryShot {
  name: string;
  title: string;
  caption: string;
  /** Full-size WebP for the lightbox. */
  src: string;
  /** Smaller WebP for the grid. */
  thumb: string;
  width: number;
  height: number;
  mobile: boolean;
}

/** Screenshot grid; each thumbnail opens a lightbox with previous / next (buttons or arrow keys). */
export function ScreenshotGallery({ shots }: { shots: GalleryShot[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : shots[open];
  const step = (d: number) =>
    setOpen((i) => (i === null ? i : (i + d + shots.length) % shots.length));
  const desktop = shots.map((s, i) => ({ s, i })).filter(({ s }) => !s.mobile);
  const mobile = shots.map((s, i) => ({ s, i })).filter(({ s }) => s.mobile);

  const thumb = ({ s, i }: { s: GalleryShot; i: number }) => (
    <li key={s.name}>
      <button
        type="button"
        onClick={() => setOpen(i)}
        className="group border-border bg-surface hover:border-mint/60 focus-visible:border-mint flex h-full w-full flex-col overflow-hidden rounded-xl border text-left transition-[transform,border-color] hover:-translate-y-0.5"
      >
        <span className="border-border bg-surface-2 relative block overflow-hidden border-b">
          <Image
            src={s.thumb}
            alt=""
            width={s.width}
            height={s.height}
            unoptimized
            className={cn("h-auto w-full", s.mobile && "aspect-[390/600] object-cover object-top")}
          />
          <span className="border-border bg-surface/85 text-muted-foreground absolute top-2 right-2 grid size-7 place-items-center rounded-md border opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Expand className="size-3.5" aria-hidden />
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-1 p-3">
          <span className="text-sm font-medium">{s.title}</span>
          <span className="text-muted-foreground text-xs leading-relaxed">{s.caption}</span>
          <span className="sr-only">Open a larger view</span>
        </span>
      </button>
    </li>
  );

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{desktop.map(thumb)}</ul>
      {mobile.length > 0 && (
        <>
          <h3 className="mt-10 text-sm font-semibold">On a phone (390 px)</h3>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:max-w-3xl">
            {mobile.map(thumb)}
          </ul>
        </>
      )}

      <Dialog open={current !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          className="bg-surface w-[calc(100%-1.5rem)] max-w-6xl gap-3 p-3 sm:max-w-6xl sm:p-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") step(-1);
            if (e.key === "ArrowRight") step(1);
          }}
        >
          {current && (
            <>
              <div className="pr-8">
                <DialogTitle className="font-display text-base font-semibold">
                  {current.title}
                </DialogTitle>
                <DialogDescription>{current.caption}</DialogDescription>
              </div>
              <Image
                key={current.name}
                src={current.src}
                alt={`Screenshot: ${current.title}`}
                width={current.width}
                height={current.height}
                unoptimized
                className={cn(
                  "border-border mx-auto h-auto rounded-lg border",
                  current.mobile ? "max-h-[72dvh] w-auto" : "max-h-[76dvh] w-auto",
                )}
              />
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" size="sm" onClick={() => step(-1)}>
                  <ChevronLeft aria-hidden /> Previous
                </Button>
                <span className="text-muted-foreground font-mono text-xs" aria-live="polite">
                  {(open ?? 0) + 1} / {shots.length}
                </span>
                <Button variant="outline" size="sm" onClick={() => step(1)}>
                  Next <ChevronRight aria-hidden />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
