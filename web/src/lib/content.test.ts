import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rewriteHref } from "@/components/content/markdown";
import { getBenchmarkNumbers, getCard, listDecisions } from "@/server/content";

const web = process.cwd();
const docs = path.resolve(web, "..", "docs");
const content = path.join(web, "content");

describe("decision records and cards", () => {
  it.runIf(existsSync(docs))("web/content mirrors docs/ exactly (run pnpm docs:sync)", () => {
    const names = readdirSync(path.join(docs, "decisions")).filter((f) =>
      /^DR-\d{3}-.+\.md$/.test(f),
    );
    expect(readdirSync(path.join(content, "decisions")).sort()).toEqual(names.sort());
    for (const f of names) {
      expect(readFileSync(path.join(content, "decisions", f), "utf8"), f).toBe(
        readFileSync(path.join(docs, "decisions", f), "utf8"),
      );
    }
    for (const f of ["model-card.md", "data-card.md", "benchmark-numbers.json"]) {
      expect(readFileSync(path.join(content, f), "utf8"), f).toBe(
        readFileSync(path.join(docs, f), "utf8"),
      );
    }
  });

  it("every record follows the format, in order, numbered from its file name", async () => {
    const records = await listDecisions();
    expect(records.map((r) => r.id)).toEqual(["DR-001", "DR-002", "DR-003", "DR-004", "DR-005"]);
    const order = [
      "## Context",
      "## Decision",
      "## Options considered",
      "## Why",
      "## What happened",
      "## What I'd change",
    ];
    for (const r of records) {
      expect(r.slug.startsWith(r.id)).toBe(true);
      expect(r.status).toBe("accepted");
      expect(r.decided).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}/);
      expect(r.scope.length).toBeGreaterThan(10);
      const at = order.map((h) => r.body.indexOf(`${h}\n`));
      expect(
        at.every((x) => x >= 0),
        r.id,
      ).toBe(true);
      expect(
        [...at].sort((a, b) => a - b),
        r.id,
      ).toEqual(at);
    }
  });

  it("keeps the house style: no spaced em dashes, no claims of compliance", async () => {
    const texts = [
      ...(await listDecisions()).map((r) => r.body),
      (await getCard("model-card")).body,
      (await getCard("data-card")).body,
    ];
    for (const t of texts) {
      expect(t).not.toContain(" — ");
      expect(t).not.toMatch(/\b(?:is|are|fully) compliant\b/i);
    }
  });

  it("loads the cards and the benchmark numbers the docs quote", async () => {
    expect((await getCard("model-card")).title).toMatch(/^Model card/);
    expect((await getCard("data-card")).title).toMatch(/^Data card/);
    const n = await getBenchmarkNumbers();
    expect(n.settings.replicates).toBe(10);
    expect(Object.keys(n.results)).toContain("louvre/sqlite/static");
  });

  it("links decision records to their pages", () => {
    expect(rewriteHref("DR-002-sqlite-wasm-cost-proxy.md")).toBe(
      "/methods/decisions/DR-002-sqlite-wasm-cost-proxy",
    );
    expect(rewriteHref("https://example.com")).toBe("https://example.com");
  });
});
