import { defineConfig } from "@playwright/test";
import { SHOWCASE_DEFAULT_BASE_URL } from "./src/lib/showcase";

/**
 * The showcase tour (`pnpm showcase`): an end-to-end pass over the main
 * journeys that also writes the screenshots and workflow recordings to
 * .showcase/ for scripts/showcase-media.mjs to optimise.
 *
 * It drives the installed Google Chrome (channel "chrome"); no browser is
 * downloaded. Point it at another deployment or a local server with BASE_URL,
 * e.g. `BASE_URL=http://localhost:3000 pnpm showcase`.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./.showcase/test-results",
  // recordings are paced for people, so the journeys are slow on purpose
  timeout: 5 * 60_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? SHOWCASE_DEFAULT_BASE_URL,
    channel: "chrome",
    headless: true,
    reducedMotion: "no-preference",
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    locale: "en-AU",
    timezoneId: "Australia/Adelaide",
  },
});
