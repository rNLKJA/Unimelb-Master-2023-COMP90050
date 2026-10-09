import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ArrowRight, Captions, Clapperboard, Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Callout } from "@/components/shared/section";
import { ScreenshotGallery, type GalleryShot } from "@/components/tour/screenshot-gallery";
import { TourVideo } from "@/components/tour/tour-video";
import {
  DESKTOP_VIEWPORT,
  MOBILE_OUTPUT,
  SHOWCASE_PUBLIC_DIR,
  SHOWCASE_REPLICATES,
  SHOWCASE_SEED,
  SHOWCASE_SHOTS,
  SHOWCASE_WORKFLOWS,
  VIDEO_SIZE,
  routeLabel,
  routePath,
} from "@/lib/showcase";

export const metadata: Metadata = {
  title: "Tour",
  description:
    "Captioned walkthroughs of the main workflows (the levels of autonomy, the index advisor arena on the INFO20003 Louvre database, and the bring-your-own-key LLM advisor) and screenshots of every feature.",
};

/** Start time of each caption, read from the WebVTT file at build time (empty if the media is missing). */
function cueStarts(slug: string): number[] {
  const file = join(process.cwd(), "public", SHOWCASE_PUBLIC_DIR, `${slug}.vtt`);
  if (!existsSync(file)) return [];
  const toSeconds = (t: string) => t.split(":").reduce((s, part) => s * 60 + Number(part), 0);
  const times = [...readFileSync(file, "utf8").matchAll(/^([\d:.]+) --> ([\d:.]+)$/gm)];
  const starts = times.map((m) => toSeconds(m[1]));
  if (times.length) starts.push(toSeconds(times[times.length - 1][2]));
  return starts;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function TourPage() {
  const shots: GalleryShot[] = SHOWCASE_SHOTS.map((s) => ({
    name: s.name,
    title: s.title,
    caption: s.caption,
    src: `${SHOWCASE_PUBLIC_DIR}/${s.name}.webp`,
    thumb: `${SHOWCASE_PUBLIC_DIR}/${s.name}-thumb.webp`,
    width: s.viewport === "mobile" ? MOBILE_OUTPUT.width : DESKTOP_VIEWPORT.width,
    height: s.viewport === "mobile" ? MOBILE_OUTPUT.height : DESKTOP_VIEWPORT.height,
    mobile: s.viewport === "mobile",
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-12 max-w-3xl space-y-3">
        <p className="kicker text-mint">Showcase · workflows and screenshots</p>
        <h1 className="text-4xl font-semibold sm:text-5xl">A guided tour of the lab</h1>
        <p className="text-muted-foreground leading-relaxed">
          Three short recordings of the main workflows, each step captioned on screen, followed by
          screenshots of every feature. A scripted browser tour made them against this site, so
          anyone with the repository can re-record them with the same seeds (workload seed{" "}
          {SHOWCASE_SEED}, {SHOWCASE_REPLICATES} replicates). Measured SQLite timings vary from run
          to run, so the numbers in a re-recording will differ slightly.
        </p>
        <ul className="flex flex-wrap gap-2 pt-2 text-xs" aria-label="What this page contains">
          <li className="border-border bg-surface inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
            <Clapperboard className="text-mint size-3.5" aria-hidden /> {SHOWCASE_WORKFLOWS.length}{" "}
            walkthroughs
          </li>
          <li className="border-border bg-surface inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
            <Captions className="text-mint size-3.5" aria-hidden /> captions and transcripts
          </li>
          <li className="border-border bg-surface inline-flex items-center gap-1.5 rounded-full border px-3 py-1">
            <Images className="text-mint size-3.5" aria-hidden /> {SHOWCASE_SHOTS.length}{" "}
            screenshots, light, dark and mobile
          </li>
        </ul>
      </header>

      <section aria-labelledby="walkthroughs" className="space-y-6">
        <div className="max-w-3xl space-y-2">
          <p className="kicker text-mint">Workflow walkthroughs</p>
          <h2 id="walkthroughs" className="text-3xl font-semibold sm:text-4xl">
            Watch the main journeys
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The videos are silent. Each step is captioned on screen, the player also offers the
            captions as a text track, and the numbered steps beside each video are its transcript,
            with the time each step starts.
          </p>
        </div>

        {SHOWCASE_WORKFLOWS.map((w, wi) => {
          const starts = cueStarts(w.slug);
          const duration = starts.at(-1);
          return (
            <article
              key={w.slug}
              id={w.slug}
              aria-labelledby={`${w.slug}-title`}
              className="border-border bg-surface scroll-mt-20 rounded-xl border p-4 sm:p-6"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="kicker">
                    Walkthrough {wi + 1}
                    {duration !== undefined && ` · ${clock(duration)}`}
                  </p>
                  <h3 id={`${w.slug}-title`} className="font-display mt-1 text-xl font-semibold">
                    {w.title}
                  </h3>
                  <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-relaxed">
                    {w.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {w.routes.map((r) => (
                    <Link
                      key={r}
                      href={r}
                      className="border-border text-mint hover:border-mint/60 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors"
                    >
                      Open {routeLabel(r) ?? routePath(r)}{" "}
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <TourVideo
                  src={`${SHOWCASE_PUBLIC_DIR}/${w.slug}.mp4`}
                  poster={`${SHOWCASE_PUBLIC_DIR}/${w.slug}-poster.webp`}
                  captions={`${SHOWCASE_PUBLIC_DIR}/${w.slug}.vtt`}
                  label={`Walkthrough ${wi + 1}: ${w.title}`}
                  width={VIDEO_SIZE.width}
                  height={VIDEO_SIZE.height}
                />
                <div>
                  <h4 className="text-sm font-semibold">Steps and transcript</h4>
                  <ol className="mt-3 space-y-3 text-sm">
                    {w.steps.map((step, i) => (
                      <li key={step} className="flex gap-3">
                        <span className="bg-mint-soft text-accent-foreground mt-px grid size-6 shrink-0 place-items-center rounded-full font-mono text-xs">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground leading-relaxed">
                          {starts[i] !== undefined && (
                            <span className="text-foreground mr-1.5 font-mono text-xs">
                              {clock(starts[i])}
                            </span>
                          )}
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </article>
          );
        })}

        <Callout title="About the LLM walkthrough">
          The third recording uses a mocked reply, written for the tour and labelled on screen as a
          mocked response for illustration. A placeholder was typed as the key and every request to
          the AI providers was intercepted, so no model was called and nothing left the browser.
          With your own key the same screens show a real model&apos;s proposal; see the{" "}
          <Link href="/methods#ai-use">AI use statement</Link>.
        </Callout>
      </section>

      <section aria-labelledby="screens" className="mt-20">
        <div className="mb-6 max-w-3xl space-y-2">
          <p className="kicker text-mint">Screenshots</p>
          <h2 id="screens" className="text-3xl font-semibold sm:text-4xl">
            Every feature at a glance
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Desktop shots are 1440 × 900. Select one to open a larger view; the arrow keys move
            between them.
          </p>
        </div>
        <ScreenshotGallery shots={shots} />
      </section>

      <section
        aria-labelledby="made"
        className="border-border bg-surface mt-20 rounded-xl border p-6"
      >
        <h2 id="made" className="font-display text-lg font-semibold">
          How these were made
        </h2>
        <ul className="text-muted-foreground mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            A Playwright script (<code className="font-mono text-xs">pnpm showcase</code>) drives
            Google Chrome through each journey at a human pace, adds the caption banner and a
            visible cursor, and records the screen at 1280 × 800. The same script is an end-to-end
            test: it checks what each journey should show (the Louvre dataset selected, every run
            finished, ten replicates, the validator&apos;s verdicts, the audit record) as it goes.
          </li>
          <li>
            Seeds are the site&apos;s defaults, so a re-recording replays the same workloads.
            Measured SQLite timings are wall-clock times in your browser and differ between runs and
            machines; the published numbers on the{" "}
            <Link href="/methods#results" className="text-foreground decoration-mint underline">
              methods page
            </Link>{" "}
            pool five independent sessions.
          </li>
          <li>
            The recordings are trimmed and converted with ffmpeg (H.264 for this page, GIF for the
            README); the captions above come from the same step list as the on-screen banner.
          </li>
        </ul>
      </section>
    </div>
  );
}
