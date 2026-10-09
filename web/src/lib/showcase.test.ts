import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NAV } from "@/lib/site";
import { SHOWCASE_SHOTS, SHOWCASE_WORKFLOWS, routeLabel, routePath } from "./showcase";

const web = process.cwd();
const publicDir = path.join(web, "public", "showcase");
const docsDir = path.resolve(web, "..", "docs", "showcase");

describe("showcase metadata", () => {
  it("names shots and workflows uniquely, in order", () => {
    const names = SHOWCASE_SHOTS.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    names.forEach((n, i) => expect(n.startsWith(String(i + 1).padStart(2, "0") + "-")).toBe(true));
    const slugs = SHOWCASE_WORKFLOWS.map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every caption short enough for the one-line banner", () => {
    for (const w of SHOWCASE_WORKFLOWS) {
      expect(w.steps.length).toBeGreaterThan(2);
      expect(w.posterStep).toBeLessThan(w.steps.length);
      for (const step of w.steps) expect(step.length, step).toBeLessThanOrEqual(100);
    }
  });

  it("links only to known pages", () => {
    expect(NAV.some((n) => n.href === "/tour")).toBe(true);
    for (const w of SHOWCASE_WORKFLOWS)
      for (const r of w.routes) expect(routeLabel(r), r).not.toBeNull();
    for (const s of SHOWCASE_SHOTS) expect(routeLabel(s.route), s.route).not.toBeNull();
    expect(routeLabel("/arena?dataset=louvre")).toBe("Arena");
    expect(routeLabel("/ai-log")).toBe("AI audit log");
    expect(routeLabel("/nowhere")).toBeNull();
  });

  it("strips queries and fragments from routes", () => {
    expect(routePath("/benchmark?dataset=louvre#llm")).toBe("/benchmark");
    expect(routePath("/#explainer")).toBe("/");
    expect(routePath("/")).toBe("/");
  });
});

describe("showcase media", () => {
  const size = (p: string) => statSync(p).size;

  it("ships every screenshot for the site and the README, within budget", () => {
    for (const s of SHOWCASE_SHOTS) {
      for (const f of [`${s.name}.webp`, `${s.name}-thumb.webp`])
        expect(existsSync(path.join(publicDir, f)), f).toBe(true);
      if (existsSync(docsDir)) {
        const png = path.join(docsDir, `${s.name}.png`);
        expect(existsSync(png), png).toBe(true);
        expect(size(png)).toBeLessThan(600 * 1024);
      }
    }
  });

  it("ships every walkthrough as MP4, poster and captions, and as a README GIF", () => {
    for (const w of SHOWCASE_WORKFLOWS) {
      const mp4 = path.join(publicDir, `${w.slug}.mp4`);
      expect(existsSync(mp4), mp4).toBe(true);
      expect(size(mp4)).toBeLessThanOrEqual(8 * 1024 * 1024);
      expect(existsSync(path.join(publicDir, `${w.slug}-poster.webp`))).toBe(true);
      const vtt = readFileSync(path.join(publicDir, `${w.slug}.vtt`), "utf8");
      expect(vtt.startsWith("WEBVTT")).toBe(true);
      // one cue per on-screen step, with the same text
      w.steps.forEach((step, i) =>
        expect(vtt).toContain(`Step ${i + 1} of ${w.steps.length}: ${step}`),
      );
      if (existsSync(docsDir)) {
        const gif = path.join(docsDir, `${w.slug}.gif`);
        expect(existsSync(gif), gif).toBe(true);
        expect(size(gif)).toBeLessThanOrEqual(8 * 1024 * 1024);
      }
    }
  });
});
