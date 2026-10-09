/**
 * Showcase tour: end-to-end checks of the main journeys that also produce the
 * README and /tour media. Run with `pnpm showcase` (tour + optimisation) or
 * `pnpm showcase:e2e` (tour only). Raw output goes to web/.showcase/:
 *
 *   .showcase/screens/<shot>.png        1440 × 900 (mobile: 780 × 1688)
 *   .showcase/videos/<workflow>.webm    1280 × 800 recordings
 *   .showcase/videos/<workflow>.json    caption timings for trimming and WebVTT
 *
 * Everything is deterministic where the site allows it: the seeds are the
 * site's defaults (workload seed 2023, ten replicates). Measured SQLite
 * timings still vary from run to run, so the tour checks structure and
 * labels, not timings.
 *
 * No real API key is ever entered and no AI provider is ever called. The LLM
 * journey types an obvious placeholder and intercepts every request to the
 * Anthropic and OpenAI APIs with a canned reply, which is captioned on
 * screen as a mocked response for illustration.
 */
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DESKTOP_VIEWPORT,
  MOBILE_VIEWPORT,
  MOCK_AI_NOTICE,
  SHOWCASE_REPLICATES,
  SHOWCASE_SEED,
  SHOWCASE_WORKFLOWS,
  VIDEO_SIZE,
  type ShowcaseShotName,
  type ShowcaseWorkflowSlug,
} from "../src/lib/showcase";

const OUT = path.resolve(__dirname, "..", ".showcase");
const SCREENS = path.join(OUT, "screens");
const VIDEOS = path.join(OUT, "videos");
/** Clearance for the sticky header when scrolling a section into view. */
const HEADER_OFFSET = 72;
/** An obvious placeholder, never a real key. Every request it could reach is intercepted. */
const PLACEHOLDER_KEY = "sk-ant-placeholder-for-the-showcase-not-a-real-key";

test.describe.configure({ mode: "serial" });

// ---------------------------------------------------------------------------
// the mocked LLM reply

/**
 * A canned proposal for the Louvre workload, written for this tour (no model
 * produced it). Two entries are deliberately invalid so the validator has
 * something to reject: the ticket table's primary key, and a table that does
 * not exist.
 */
const MOCK_PROPOSAL = {
  indexes: [
    {
      table: "wing_scan",
      columns: ["wing_id", "scanned_at"],
      rationale: "L5: equality on wing_id, then the day's range on scanned_at.",
    },
    {
      table: "wing_scan",
      columns: ["ticket_id", "scanned_at"],
      rationale: "L7: one ticket's scans, already in scanned_at order for the ORDER BY.",
    },
    {
      table: "ticket",
      columns: ["barcode"],
      rationale: "L3: the desk looks a ticket up by its barcode.",
    },
    {
      table: "purchase_order",
      columns: ["payment_id"],
      rationale: "L4: find the order behind a payment before joining its lines.",
    },
    {
      table: "payment",
      columns: ["method", "paid_at", "amount_cents"],
      rationale: "L2: one method over a week; amount_cents last makes it covering.",
    },
    {
      table: "entry_scan",
      columns: ["entrance_id", "is_first_entry", "scanned_at"],
      rationale: "L6: one entrance's first entries over a week.",
    },
    {
      table: "exhibition_booking",
      columns: ["ticket_id"],
      rationale: "L10 reads a ticket's bookings; LU1 updates them by ticket_id.",
    },
    {
      table: "audio_guide_hire",
      columns: ["language_code", "issued_at"],
      rationale: "L8: one language's hires over a month.",
    },
    {
      table: "ticket",
      columns: ["ticket_id"],
      rationale: "L7 and L10 look tickets up by id.",
    },
    {
      table: "visitor",
      columns: ["email"],
      rationale: "Visitor lookups by e-mail.",
    },
  ],
  notes:
    "Mocked response for illustration: no model was called. Equality columns first, then the range column, for the busiest box-office and gallery templates.",
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
};

/** Intercept every AI provider request: Anthropic gets the canned reply, anything else fails. */
async function mockProviders(context: BrowserContext) {
  await context.route("https://api.anthropic.com/**", async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    // a short, visible wait, as a real call would take
    await new Promise((done) => setTimeout(done, 1800));
    await route.fulfill({
      status: 200,
      headers: { ...CORS, "content-type": "application/json" },
      body: JSON.stringify({
        id: "msg_mocked_for_the_showcase",
        type: "message",
        role: "assistant",
        // the label on screen names this, not a real model
        model: "mocked-response",
        content: [{ type: "text", text: JSON.stringify(MOCK_PROPOSAL) }],
        stop_reason: "end_turn",
      }),
    });
  });
  await context.route("https://api.openai.com/**", (route) => route.abort());
}

// ---------------------------------------------------------------------------
// shared helpers

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
}

/** Scroll a section (any Playwright selector) to `offset` px below the top of the viewport. */
async function scrollToSection(
  page: Page,
  selector: string | Locator,
  offset = HEADER_OFFSET,
  smooth = false,
) {
  const target = (typeof selector === "string" ? page.locator(selector) : selector).first();
  await target.waitFor();
  await target.evaluate(
    (el, { offset, smooth }) => {
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" });
    },
    { offset, smooth },
  );
  await page.waitForTimeout(smooth ? 1300 : 300);
}

/** A panel's heading, located by its text (panels have no ids). */
const panel = (page: Page, title: string) =>
  page.locator(`h3:text-is("${title}"), h2:text-is("${title}")`).first();

/** The whole panel around that heading. */
const panelBody = (page: Page, title: string) =>
  panel(page, title).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' rounded-xl ')][1]",
  );

async function screenshot(page: Page, name: ShowcaseShotName) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(SCREENS, `${name}.png`) });
}

/** Run the arena on the Louvre database with no index, greedy what-if and the bandit. */
async function runLouvreArena(page: Page) {
  const advisors = page.getByRole("group", { name: "Advisors" });
  for (const name of ["DROP heuristic", "DB2 Advisor", "CoPhy (exact BIP)"])
    await advisors.locator("label", { hasText: name }).click();
  await page.getByRole("button", { name: "Run experiment" }).click();
  await expect(page.getByText(/^Finished in /)).toBeVisible();
}

async function runBenchmark(page: Page) {
  await page.getByRole("button", { name: "Run benchmark" }).click();
  await expect(
    page.getByText(`Finished ${SHOWCASE_REPLICATES} replicates`, { exact: false }),
  ).toBeVisible({
    timeout: 4 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// on-screen overlay

/**
 * Injected into every recorded page: a caption banner (step number and text),
 * an optional notice pill (the mocked-AI label) and, for recordings, a
 * visible cursor with a click pulse. Headless video has no cursor, so without
 * it the viewer cannot see what is being clicked.
 */
function tourOverlay({ cursor: withCursor }: { cursor: boolean }) {
  type Tour = {
    caption: (step: number, total: number, title: string, text: string) => void;
    notice: (text: string | null) => void;
  };
  const w = window as unknown as { __tour?: Tour; __tourNotice?: string | null };
  const ensure = () => {
    if (!document.body) return null;
    let root = document.getElementById("__tour");
    if (!root) {
      const style = document.createElement("style");
      style.textContent = `
        #__tour { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
        #__tour-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; margin: -11px 0 0 -11px;
          border-radius: 999px; background: rgba(16, 163, 127, 0.25); border: 2px solid rgba(5, 120, 90, 0.95);
          box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.8), 0 2px 10px rgba(0, 0, 0, 0.25);
          transition: transform 120ms ease-out; opacity: 0; }
        #__tour-cursor.down { transform: scale(0.72); background: rgba(16, 163, 127, 0.55); }
        .__tour-pulse { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 999px;
          border: 2px solid rgba(5, 120, 90, 0.9); animation: __tour-pulse 650ms ease-out forwards; }
        @keyframes __tour-pulse { to { transform: scale(2.6); opacity: 0; } }
        #__tour-caption { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
          width: min(1160px, calc(100vw - 48px)); display: flex; align-items: center; gap: 14px;
          padding: 12px 18px; border-radius: 14px; background: rgba(11, 18, 34, 0.92); color: #fff;
          font: 500 17px/1.35 var(--font-plex-sans), "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.14);
          opacity: 0; transition: opacity 250ms ease; }
        #__tour-caption.on { opacity: 1; }
        #__tour-step { flex: none; padding: 4px 10px; border-radius: 999px; background: rgb(4, 120, 87);
          font: 600 14px/1.2 var(--font-plex-mono), ui-monospace, SFMono-Regular, Menlo, monospace; }
        #__tour-title { flex: none; font: 600 12px/1.2 var(--font-plex-mono), ui-monospace, monospace;
          text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255, 255, 255, 0.62); }
        #__tour-notice { position: fixed; right: 24px; bottom: 84px;
          padding: 7px 14px; border-radius: 999px; background: #fef3c7; color: #78350f;
          border: 1.5px solid #d97706; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
          font: 600 14px/1.2 var(--font-plex-sans), "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
          display: none; white-space: nowrap; }
        #__tour-notice.on { display: block; }
      `;
      root = document.createElement("div");
      root.id = "__tour";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML =
        '<div id="__tour-notice"></div><div id="__tour-caption"><span id="__tour-step"></span><span id="__tour-title"></span><span id="__tour-text"></span></div><div id="__tour-cursor"></div>';
      root.prepend(style);
      document.body.appendChild(root);
    }
    return root;
  };
  const cursor = () => ensure()?.querySelector<HTMLElement>("#__tour-cursor") ?? null;
  if (withCursor) {
    document.addEventListener(
      "pointermove",
      (e) => {
        const c = cursor();
        if (!c) return;
        c.style.left = `${e.clientX}px`;
        c.style.top = `${e.clientY}px`;
        c.style.opacity = "1";
      },
      true,
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        const root = ensure();
        if (!root) return;
        cursor()?.classList.add("down");
        const pulse = document.createElement("div");
        pulse.className = "__tour-pulse";
        pulse.style.left = `${e.clientX}px`;
        pulse.style.top = `${e.clientY}px`;
        root.appendChild(pulse);
        setTimeout(() => pulse.remove(), 700);
      },
      true,
    );
    document.addEventListener("pointerup", () => cursor()?.classList.remove("down"), true);
  }
  w.__tour = {
    caption(step, total, title, text) {
      const root = ensure();
      if (!root) return;
      root.querySelector("#__tour-step")!.textContent = `${step} / ${total}`;
      root.querySelector("#__tour-title")!.textContent = title;
      root.querySelector("#__tour-text")!.textContent = text;
      root.querySelector("#__tour-caption")!.classList.add("on");
    },
    notice(text) {
      const el = ensure()?.querySelector<HTMLElement>("#__tour-notice");
      if (!el) return;
      el.textContent = text ?? "";
      el.classList.toggle("on", Boolean(text));
    },
  };
}

type TourWindow = {
  __tour: {
    caption: (a: number, b: number, c: string, d: string) => void;
    notice: (text: string | null) => void;
  };
};

async function showNotice(page: Page, text: string | null) {
  await page.evaluate((t) => (window as unknown as TourWindow).__tour.notice(t), text);
}

interface Cue {
  start: number;
  end: number;
  text: string;
}

/** A recorded journey: paced input, captions and their timings. */
class Recorder {
  private t0 = Date.now();
  private cues: Cue[] = [];
  private step = 0;
  private mouse = { x: VIDEO_SIZE.width / 2, y: VIDEO_SIZE.height / 2 };
  constructor(
    readonly page: Page,
    private readonly workflow: (typeof SHOWCASE_WORKFLOWS)[number],
  ) {}

  private now() {
    return (Date.now() - this.t0) / 1000;
  }

  pause(ms: number) {
    return this.page.waitForTimeout(ms);
  }

  private show(step: number) {
    const steps = this.workflow.steps;
    return this.page.evaluate(
      ({ step, total, title, text }) =>
        (window as unknown as TourWindow).__tour.caption(step, total, title, text),
      { step, total: steps.length, title: this.workflow.title, text: steps[step - 1] },
    );
  }

  /** Show the next caption (in order) and give the viewer time to read it. */
  async caption(readMs = 2600) {
    const steps = this.workflow.steps;
    const text = steps[this.step];
    if (text === undefined) throw new Error(`${this.workflow.slug} has only ${steps.length} steps`);
    this.step += 1;
    const at = this.now();
    const prev = this.cues.at(-1);
    if (prev) prev.end = at;
    this.cues.push({ start: at, end: at, text });
    await this.show(this.step);
    await this.pause(readMs);
  }

  /** Re-show the current caption after a full page load. */
  async recaption() {
    if (this.step > 0) await this.show(this.step);
  }

  async glideTo(x: number, y: number, msPerStep = 14) {
    const dist = Math.hypot(x - this.mouse.x, y - this.mouse.y);
    const steps = Math.max(8, Math.min(60, Math.round(dist / 12)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // ease in-out
      await this.page.mouse.move(
        this.mouse.x + (x - this.mouse.x) * e,
        this.mouse.y + (y - this.mouse.y) * e,
      );
      await this.page.waitForTimeout(msPerStep);
    }
    this.mouse = { x, y };
  }

  /** Glide to a point of the target; large targets are not scrolled, and the point stays on screen. */
  async hover(target: Locator, dx = 0.5, dy = 0.5) {
    const first = (await target.boundingBox())!;
    const large = first.height >= VIDEO_SIZE.height * 0.6;
    if (!large) await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    // keep points on large targets clear of the sticky header and the caption banner
    const x = Math.min(VIDEO_SIZE.width - 20, Math.max(20, box.x + box.width * dx));
    const y = large
      ? Math.min(VIDEO_SIZE.height - 110, Math.max(70, box.y + box.height * dy))
      : box.y + box.height * dy;
    await this.glideTo(x, y);
  }

  async click(target: Locator) {
    await this.hover(target);
    await this.pause(250);
    await this.page.mouse.down();
    await this.pause(90);
    await this.page.mouse.up();
    await this.pause(350);
  }

  /** Type into a field at a readable pace. */
  async type(target: Locator, text: string, delay = 45) {
    await this.click(target);
    await target.pressSequentially(text, { delay });
    await this.pause(300);
  }

  async scrollTo(selector: string | Locator, offset = HEADER_OFFSET) {
    await scrollToSection(this.page, selector, offset, true);
  }

  /** Smooth-scroll by a number of pixels. */
  async scrollBy(dy: number, ms = 1300) {
    await this.page.evaluate((dy) => window.scrollBy({ top: dy, behavior: "smooth" }), dy);
    await this.pause(ms);
  }

  timings() {
    const last = this.cues.at(-1);
    if (last) last.end = this.now();
    if (this.step !== this.workflow.steps.length)
      throw new Error(
        `${this.workflow.slug}: showed ${this.step} of ${this.workflow.steps.length} captions`,
      );
    return {
      slug: this.workflow.slug,
      recordedAt: new Date().toISOString(),
      end: this.now(),
      cues: this.cues,
    };
  }
}

async function record(
  browser: Browser,
  slug: ShowcaseWorkflowSlug,
  journey: (r: Recorder, page: Page, context: BrowserContext) => Promise<void>,
) {
  const workflow = SHOWCASE_WORKFLOWS.find((w) => w.slug === slug)!;
  mkdirSync(VIDEOS, { recursive: true });
  const context = await browser.newContext({
    viewport: VIDEO_SIZE,
    colorScheme: "light",
    reducedMotion: "no-preference",
    recordVideo: { dir: path.join(OUT, "video-tmp"), size: VIDEO_SIZE },
  });
  await context.addInitScript(tourOverlay, { cursor: true });
  const page = await context.newPage();
  const r = new Recorder(page, workflow);
  await journey(r, page, context);
  await r.pause(1800);
  const timings = r.timings();
  await context.close();
  await page.video()!.saveAs(path.join(VIDEOS, `${slug}.webm`));
  await page.video()!.delete();
  writeFileSync(path.join(VIDEOS, `${slug}.json`), JSON.stringify(timings, null, 2) + "\n");
}

// ---------------------------------------------------------------------------
// screenshots

async function desktopPage(browser: Browser, theme: "light" | "dark") {
  const context = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    colorScheme: theme,
    reducedMotion: "no-preference",
  });
  await context.addInitScript(tourOverlay, { cursor: false });
  return { context, page: await context.newPage() };
}

test.describe("screenshots", () => {
  test.beforeAll(() => mkdirSync(SCREENS, { recursive: true }));

  test("landing, light and dark, and the explainer", async ({ browser }) => {
    for (const theme of ["light", "dark"] as const) {
      const { context, page } = await desktopPage(browser, theme);
      await page.goto("/");
      await settle(page);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "How databases learn to tune themselves",
      );
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await page.waitForTimeout(800);
      await screenshot(page, theme === "light" ? "01-landing-light" : "02-landing-dark");

      if (theme === "light") {
        // the explainer's second step, with the ladder highlighting levels 1-2
        const step = page.locator('section[data-step="1"]');
        await step.evaluate((el) => {
          const r = el.getBoundingClientRect();
          window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2 });
        });
        await page.waitForTimeout(900);
        await expect(step.locator("p.kicker")).toHaveClass(/text-mint/);
        await screenshot(page, "03-explainer-autonomy");
      }
      await context.close();
    }
  });

  test("survey map, filtered", async ({ browser }) => {
    const { context, page } = await desktopPage(browser, "light");
    await page.goto("/survey");
    await settle(page);
    const taxonomy = page.locator("section[aria-labelledby=taxonomy]");
    await taxonomy.getByRole("button", { name: "Index selection", exact: true }).click();
    await taxonomy.getByRole("button", { name: "Runs in the arena" }).click();
    await expect(taxonomy.getByRole("button", { name: "Runs in the arena" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await scrollToSection(page, "#taxonomy", 84);
    await screenshot(page, "04-survey-taxonomy");
    await context.close();
  });

  test("arena and benchmark on the Louvre database", async ({ browser }) => {
    const { context, page } = await desktopPage(browser, "light");
    await page.goto("/arena?dataset=louvre");
    await settle(page);
    await expect(
      page.getByRole("group", { name: "Dataset" }).getByRole("radio", { name: "Louvre" }),
    ).toBeChecked();
    await runLouvreArena(page);
    await expect(page.getByText(/Louvre · [\d,]+ wing scans/)).toBeVisible();
    await scrollToSection(page, "main header", 56);
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(400);
    await screenshot(page, "05-arena-louvre");
    await scrollToSection(page, panel(page, "Index timeline"), 84);
    await screenshot(page, "06-arena-index-timeline");

    await page.goto("/benchmark?dataset=louvre");
    await settle(page);
    await page
      .getByRole("group", { name: "Workload" })
      .locator("label", { hasText: "Shifting" })
      .click();
    await runBenchmark(page);
    await expect(panel(page, "Mean cumulative workload time")).toBeVisible();
    await expect(page.getByText(`first_seed=${SHOWCASE_SEED}`)).toBeVisible();
    await scrollToSection(page, panel(page, "Mean cumulative workload time"), 84);
    await screenshot(page, "07-benchmark-means");
    await scrollToSection(
      page,
      panel(page, "Paired comparison against AutoAdmin (greedy what-if)"),
      84,
    );
    await screenshot(page, "08-benchmark-paired");
    await context.close();
  });

  test("forecasting lab and SQL console", async ({ browser }) => {
    const { context, page } = await desktopPage(browser, "light");
    await page.goto("/forecast");
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Forecasting lab");
    await scrollToSection(page, "h2:text-is('Cluster templates that rise and fall together')", 84);
    await screenshot(page, "09-forecast");

    await page.goto("/console");
    await settle(page);
    await page.getByRole("button", { name: "Run", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Query result" }).or(page.getByLabel("Query result")),
    ).toBeVisible();
    await page.waitForTimeout(800);
    await scrollToSection(page, "main h1", 84);
    await page.evaluate(() => window.scrollBy(0, 260));
    await page.waitForTimeout(400);
    await screenshot(page, "10-console");
    await context.close();
  });

  test("AI settings, a mocked LLM proposal and the audit log", async ({ browser }) => {
    const { context, page } = await desktopPage(browser, "light");
    await mockProviders(context);
    await page.goto("/benchmark?dataset=louvre");
    await settle(page);

    // the dialog as a visitor first sees it: no key stored
    await page.getByRole("button", { name: /^AI settings/ }).click();
    const dialog = page.getByRole("dialog", { name: "AI settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Anthropic API key")).toHaveValue("");
    await page.waitForTimeout(500);
    await screenshot(page, "11-ai-settings");

    // a placeholder key; every provider request is intercepted
    await dialog.getByLabel("Anthropic API key").fill(PLACEHOLDER_KEY);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    const llm = page.locator("#llm");
    await llm.getByRole("button", { name: "Ask for a proposal" }).click();
    await expect(llm.getByText("AI-generated").first()).toBeVisible();
    await expect(llm.getByText("Valid indexes (8 of 10)")).toBeVisible();
    await expect(llm.getByText("Rejected by the validator")).toBeVisible();
    await expect(llm).toContainText("Mocked response for illustration");
    await showNotice(page, MOCK_AI_NOTICE);
    await scrollToSection(page, llm, 116);
    await screenshot(page, "12-llm-proposal-mocked");

    await llm.getByRole("button", { name: "Accept" }).click();
    await expect(llm.getByText(/Approved: 8 indexes/)).toBeVisible();
    await runBenchmark(page);
    await page.getByRole("link", { name: "audit log" }).first().click();
    await page.waitForURL("**/ai-log");
    await settle(page);
    await expect(page.getByText("mocked-response").first()).toBeVisible();
    await showNotice(page, MOCK_AI_NOTICE);
    await screenshot(page, "13-ai-log");
    await context.close();
  });

  test("methods", async ({ browser }) => {
    const { context, page } = await desktopPage(browser, "light");
    await page.goto("/methods");
    await settle(page);
    await expect(page.locator("#decisions")).toBeAttached();
    await screenshot(page, "14-methods");
    await context.close();
  });

  test("mobile", async ({ browser }) => {
    for (const [name, route, theme] of [
      ["15-mobile-landing", "/", "light"],
      ["16-mobile-arena", "/arena?dataset=louvre", "light"],
      ["17-mobile-benchmark", "/benchmark?dataset=louvre", "dark"],
    ] as const) {
      const context = await browser.newContext({
        viewport: MOBILE_VIEWPORT,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: theme,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      await page.goto(route);
      await settle(page);
      if (route.startsWith("/arena")) {
        await runLouvreArena(page);
        await scrollToSection(page, panel(page, "Total workload time"), 64);
      }
      if (route.startsWith("/benchmark")) {
        await runBenchmark(page);
        await scrollToSection(page, panel(page, "Mean cumulative workload time"), 64);
      }
      // nothing may overflow the 390 px viewport sideways
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(SCREENS, `${name}.png`) });
      await context.close();
    }
  });
});

// ---------------------------------------------------------------------------
// workflow recordings

/** Centre an explainer step in the viewport, smoothly, so its diagram becomes active. */
async function centreStep(r: Recorder, i: number) {
  const step = r.page.locator(`section[data-step="${i}"]`);
  await step.evaluate((el) => {
    const b = el.getBoundingClientRect();
    window.scrollTo({
      top: b.top + window.scrollY + b.height / 2 - window.innerHeight / 2 + 40,
      behavior: "smooth",
    });
  });
  await r.pause(1400);
  await expect(step.locator("p.kicker")).toHaveClass(/text-mint/);
}

test.describe("workflow recordings", () => {
  test("1 · levels of autonomy: the explainer and the taxonomy", async ({ browser }) => {
    await record(browser, "levels-of-autonomy", async (r, page) => {
      await page.goto("/");
      await settle(page);
      await r.pause(600);
      await r.scrollTo("#explainer", 96);
      await r.pause(500);
      await centreStep(r, 0);
      await r.caption(3400);

      await centreStep(r, 1);
      await r.caption(3200);
      await r.hover(page.locator("section[aria-labelledby=explainer] .sticky").first(), 0.5, 0.45);
      await r.pause(1200);

      await centreStep(r, 2);
      await r.caption(2400);
      for (const i of [3, 4, 5]) {
        await centreStep(r, i);
        await r.pause(1500);
      }

      // client-side navigation keeps the overlay
      await r.click(
        page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Survey map" }),
      );
      await page.waitForURL("**/survey");
      await settle(page);
      await r.caption(1200);
      await r.hover(page.locator("#levels").locator("xpath=../.."), 0.75, 0.5);
      await r.pause(2200);

      const taxonomy = page.locator("section[aria-labelledby=taxonomy]");
      await r.scrollTo("#taxonomy", 84);
      await r.pause(600);
      const count = taxonomy.getByText(/of \d+\s+systems/);
      const before = await count.textContent();
      await r.click(taxonomy.getByRole("button", { name: "Index selection", exact: true }));
      await r.caption(1600);
      await expect(count).not.toHaveText(before ?? "");
      await r.scrollBy(320, 1600);
      await r.scrollTo("#taxonomy", 84);
      await r.click(taxonomy.getByRole("button", { name: "Multi-armed bandit", exact: true }));
      await expect(
        taxonomy.getByRole("button", { name: "Multi-armed bandit", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await r.pause(1600);
      await r.scrollBy(260, 1600);
      await r.pause(1200);

      await r.scrollTo("#taxonomy", 84);
      await r.click(taxonomy.getByRole("button", { name: "Multi-armed bandit", exact: true }));
      await r.click(taxonomy.getByRole("button", { name: "Runs in the arena" }));
      await r.caption(1600);
      await r.scrollBy(300, 1600);
      await r.pause(1000);
      await r.scrollTo("#taxonomy", 84);
      await r.click(taxonomy.getByRole("button", { name: "Clear filters" }));
      await r.type(taxonomy.getByRole("searchbox"), "AutoAdmin", 90);
      await expect(taxonomy.locator("li h3", { hasText: "AutoAdmin" }).first()).toBeVisible();
      await r.pause(1600);
      await r.scrollBy(240, 1400);
      await r.pause(1200);
      await r.scrollTo("#taxonomy", 84);
      await r.click(taxonomy.getByRole("button", { name: "Clear filters" }));
      await r.pause(1600);
    });
  });

  test("2 · index advisor arena on the Louvre database", async ({ browser }) => {
    await record(browser, "louvre-arena", async (r, page) => {
      await page.goto("/arena");
      await settle(page);
      await r.pause(500);
      await r.caption(3000);

      const dataset = page.getByRole("group", { name: "Dataset" });
      await r.click(dataset.locator("label", { hasText: "Louvre" }));
      await expect(dataset.getByRole("radio", { name: "Louvre" })).toBeChecked();
      await r.caption(1200);
      await r.hover(page.getByRole("link", { name: "See its 2020 design" }));
      await r.pause(2200);

      const workload = page.getByRole("group", { name: "Workload" });
      await r.hover(workload.locator("label", { hasText: "Shifting" }));
      await r.caption(400);
      await r.hover(page.getByText("Three phases: box office, then gallery floor"));
      await r.pause(2000);
      await r.click(page.getByText("Advanced settings"));
      const seed = page.getByRole("spinbutton");
      await expect(seed).toHaveValue(String(SHOWCASE_SEED));
      await r.hover(seed);
      await r.pause(2200);
      await r.click(page.getByText("Advanced settings"));

      const advisors = page.getByRole("group", { name: "Advisors" });
      await r.scrollTo(advisors, 240);
      await r.hover(advisors);
      await r.caption(800);
      for (const name of ["DROP heuristic", "DB2 Advisor", "CoPhy (exact BIP)"])
        await r.click(advisors.locator("label", { hasText: name }));
      await r.pause(800);

      await r.click(page.getByRole("button", { name: "Run experiment" }));
      await expect(page.getByText(/^Finished in /)).toBeVisible();
      await r.pause(600);
      await r.caption(1000);
      await r.hover(panelBody(page, "Total workload time"), 0.4, 0.35);
      await r.pause(1800);
      await r.scrollTo(panel(page, "Cumulative workload time"), 120);
      await r.hover(panelBody(page, "Cumulative workload time"), 0.6, 0.55);
      await r.pause(2600);
      await r.scrollTo(panel(page, "Index timeline"), 96);
      await r.pause(2400);

      // the benchmark: same dataset and workload, ten seeded replicates
      await r.scrollTo("main header", 56);
      await r.click(page.getByRole("link", { name: "benchmark", exact: true }));
      await page.waitForURL("**/benchmark?dataset=louvre");
      await settle(page);
      await r.click(
        page.getByRole("group", { name: "Workload" }).locator("label", { hasText: "Shifting" }),
      );
      await r.hover(page.getByText(/Replicate r runs workload seed/));
      await r.caption(1600);
      await r.click(page.getByRole("button", { name: "Run benchmark" }));
      await expect(
        page.getByText(`Finished ${SHOWCASE_REPLICATES} replicates`, { exact: false }),
      ).toBeVisible({
        timeout: 4 * 60_000,
      });
      await r.pause(800);
      await r.scrollTo(panel(page, "Mean cumulative workload time"), 84);
      await r.caption(1400);
      await r.hover(panelBody(page, "Mean cumulative workload time"), 0.5, 0.4);
      await r.pause(2600);
      await r.scrollTo(panel(page, "Paired comparison against AutoAdmin (greedy what-if)"), 84);
      await r.caption(1400);
      await r.hover(page.getByRole("region", { name: "Paired comparisons" }), 0.5, 0.5);
      await r.pause(2200);
      await r.scrollTo(panel(page, "The bandit's regret"), 84);
      await r.pause(3200);
    });
  });

  test("3 · LLM as advisor: BYOK, a mocked proposal, validated and benchmarked", async ({
    browser,
  }) => {
    await record(browser, "llm-advisor", async (r, page, context) => {
      await mockProviders(context);
      await page.goto("/benchmark?dataset=louvre");
      await settle(page);
      await r.pause(600);

      await r.click(page.getByRole("button", { name: /^AI settings/ }));
      const dialog = page.getByRole("dialog", { name: "AI settings" });
      await expect(dialog).toBeVisible();
      await r.caption(3200);
      await r.hover(dialog.getByText("Claude Haiku 4.5"));
      await r.pause(1200);

      await showNotice(page, "Placeholder key · every provider request is intercepted");
      await r.caption(400);
      await r.type(dialog.getByLabel("Anthropic API key"), PLACEHOLDER_KEY, 30);
      await r.pause(800);
      await r.click(dialog.getByRole("button", { name: "Save" }));
      await expect(dialog).toBeHidden();

      const llm = page.locator("#llm");
      await r.scrollTo("#llm-h", 96);
      await r.caption(1200);
      await r.click(llm.getByRole("button", { name: "Ask for a proposal" }));
      await showNotice(page, MOCK_AI_NOTICE);
      await expect(llm.getByText("Valid indexes (8 of 10)")).toBeVisible();
      await r.pause(600);
      await r.scrollTo(llm, 84);
      await r.caption(1400);
      await r.hover(llm.getByText("AI-generated").first());
      await r.pause(1600);
      await r.scrollTo(llm.getByText("Rejected by the validator"), 300);
      await r.hover(llm.getByText("Rejected by the validator"));
      await r.pause(2600);

      const guide = llm.locator("label", { hasText: "audio_guide_hire(language_code, issued_at)" });
      await r.click(guide);
      await expect(guide.getByRole("checkbox")).not.toBeChecked();
      await r.caption(1000);
      const accept = llm.getByRole("button", { name: "Accept 7 (edited)" });
      await r.click(accept);
      await expect(llm.getByText(/Approved: 7 indexes/)).toBeVisible();
      await r.scrollTo("#llm-h", 96);
      await r.hover(llm.getByText(/Approved: 7 indexes/));
      await r.pause(2200);

      // the approved plan joins the benchmark; settings return to the ones the model saw
      await r.scrollTo("main header", 56);
      const advisors = page.getByRole("group", { name: "Advisors" });
      await expect(
        advisors.getByRole("checkbox", { name: "LLM advisor (your key)" }),
      ).toBeChecked();
      await r.hover(advisors.locator("label", { hasText: "LLM advisor" }));
      await r.caption(1400);
      await r.click(page.getByRole("button", { name: "Run benchmark" }));
      await expect(
        page.getByText(`Finished ${SHOWCASE_REPLICATES} replicates`, { exact: false }),
      ).toBeVisible({
        timeout: 4 * 60_000,
      });
      await r.pause(600);
      await r.scrollTo(panel(page, "Mean cumulative workload time"), 260);
      const metric = page.getByLabel("Metric");
      await r.hover(metric);
      await metric.selectOption("buildRun");
      await r.caption(1600);
      await r.scrollTo(panel(page, "Mean cumulative workload time"), 84);
      await r.hover(panelBody(page, "Mean cumulative workload time"), 0.5, 0.4);
      await r.pause(2400);
      await r.scrollTo(panel(page, "Paired comparison against AutoAdmin (greedy what-if)"), 84);
      await r.pause(2600);

      await r.scrollTo(llm, 96);
      await r.click(page.locator("#llm-h ~ p").getByRole("link", { name: "audit log" }));
      await page.waitForURL("**/ai-log");
      await settle(page);
      await r.recaption();
      await showNotice(page, MOCK_AI_NOTICE);
      await expect(page.getByText("mocked-response").first()).toBeVisible();
      await r.caption(1600);
      await r.scrollBy(380, 1800);
      await r.pause(2400);
    });
  });
});

// ---------------------------------------------------------------------------
// the /tour page serves what the tour produced

test.describe("tour page", () => {
  test("videos, captions and screenshots load", async ({ page, request }) => {
    await page.goto("/tour");
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("tour");
    await expect(page.locator("video")).toHaveCount(SHOWCASE_WORKFLOWS.length);
    for (const w of SHOWCASE_WORKFLOWS) {
      const video = page.locator(`#${w.slug} video`);
      await expect(video).toHaveAttribute("poster", `/showcase/${w.slug}-poster.webp`);
      for (const [file, type] of [
        [`${w.slug}.mp4`, "video/mp4"],
        [`${w.slug}-poster.webp`, "image/webp"],
        [`${w.slug}.vtt`, "text/vtt"],
      ] as const) {
        const res = await request.get(`/showcase/${file}`);
        expect(res.status(), file).toBe(200);
        expect(res.headers()["content-type"], file).toContain(type);
      }
      // the video loads once it is scrolled into view
      await video.scrollIntoViewIfNeeded();
      await expect
        .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 })
        .toBeGreaterThanOrEqual(1);
    }
    await page
      .getByRole("button", { name: /Landing page/ })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Landing page" });
    await expect(dialog).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("dialog", { name: "Landing page, dark theme" })).toBeVisible();
    // focus is inside the lightbox now, so the arrow keys move between shots
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("dialog", { name: "Landing page" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
