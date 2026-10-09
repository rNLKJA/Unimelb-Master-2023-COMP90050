// pnpm bench:report [-- --sessions 5]
//
// Runs scripts/bench-report.report.ts once per session, each in a fresh Node
// process (vitest run), so the sessions vary the way separate runs on one
// machine do, then once more to pool them into ../docs/benchmark-numbers.json.
// Raw per-session replicates go to a temporary directory, printed at the end.
// Run `pnpm docs:sync` afterwards, and update any figures the docs quote.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const web = path.resolve(import.meta.dirname, "..");
const at = process.argv.indexOf("--sessions");
const sessions = at > 0 ? Number(process.argv[at + 1]) : 5;
if (!Number.isInteger(sessions) || sessions < 2) {
  console.error("--sessions must be an integer of at least 2");
  process.exit(1);
}
const dir = mkdtempSync(path.join(tmpdir(), "sddb-bench-"));
const vitest = (env) =>
  execFileSync(
    process.execPath,
    [
      path.join(web, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--config",
      "vitest.report.config.mts",
      "scripts/bench-report.report.ts",
    ],
    { cwd: web, stdio: "inherit", env: { ...process.env, BENCH_DIR: dir, ...env } },
  );

for (let k = 1; k <= sessions; k++) {
  console.log(`[bench:report] session ${k} of ${sessions}`);
  vitest({ BENCH_MODE: "session", BENCH_SESSION: String(k) });
}
console.log("[bench:report] pooling the sessions");
vitest({ BENCH_MODE: "aggregate" });
console.log(`[bench:report] wrote ../docs/benchmark-numbers.json (raw sessions in ${dir})`);
