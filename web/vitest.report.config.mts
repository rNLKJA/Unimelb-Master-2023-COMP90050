import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** `pnpm bench:report`: the long benchmark behind the numbers in docs/, kept out of `pnpm test`. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["scripts/*.report.ts"],
    testTimeout: 900_000,
  },
});
