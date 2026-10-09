// Mirror ../docs (the canonical decision records, model card, data card and
// benchmark numbers) into content/, because a Vercel deployment of web/
// cannot read files outside it. Run after editing anything in docs/:
//   pnpm docs:sync
// src/lib/content.test.ts fails while the two copies differ.
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const docs = path.resolve(web, "..", "docs");
const out = path.join(web, "content");

if (!existsSync(docs)) {
  console.log("[docs:sync] ../docs not found; leaving content/ as it is");
  process.exit(0);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "decisions"), { recursive: true });
for (const f of ["model-card.md", "data-card.md", "benchmark-numbers.json"])
  copyFileSync(path.join(docs, f), path.join(out, f));
for (const f of readdirSync(path.join(docs, "decisions")).filter((f) =>
  /^DR-\d{3}-.+\.md$/.test(f),
))
  copyFileSync(path.join(docs, "decisions", f), path.join(out, "decisions", f));
console.log("[docs:sync] mirrored docs/ into web/content/");
