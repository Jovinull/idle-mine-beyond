import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // The project site imports the game's renderer modules through $game.
      $game: fileURLToPath(new URL("./apps/web/src/lib", import.meta.url)),
      "break_infinity.js/break_infinity": fileURLToPath(
        new URL(
          "./packages/formatting/src/ad-notations-decimal-bridge.ts",
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: [
            "tests/unit/**/*.test.ts",
            "packages/**/*.test.ts",
            "apps/site/src/**/*.test.ts",
          ],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "parity",
          include: ["tests/parity/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
