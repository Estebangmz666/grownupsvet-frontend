import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: [
        "src/**/*.{ts,tsx}",
        "apps/*/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.{ts,tsx}",
      ],
      exclude: ["**/*.test.*", "**/test-support/**"],
      reporter: ["text-summary", "json-summary", "html"],
    },
  },
  resolve: {
    alias: {
      "@application": fileURLToPath(new URL("./src", import.meta.url)),
      "@administrativo": fileURLToPath(
        new URL("./apps/administrativo/src", import.meta.url),
      ),
      "@api-client": fileURLToPath(
        new URL("./packages/api-client/src", import.meta.url),
      ),
    },
  },
});
