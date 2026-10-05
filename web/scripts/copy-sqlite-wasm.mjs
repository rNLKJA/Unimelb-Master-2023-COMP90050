// Copies the sql.js WebAssembly binary next to the app's static assets so the
// browser Web Worker can fetch it from /vendor/sql-wasm.wasm. The file is
// derived from the installed sql.js package, so it is not committed.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const source = require.resolve("sql.js/dist/sql-wasm.wasm");
const targetDir = join(here, "..", "public", "vendor");

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, "sql-wasm.wasm"));
console.log("copied sql-wasm.wasm -> public/vendor/");
