import { defineConfig, devices } from "@playwright/test";
import { getChromiumLaunchOptions } from "./scripts/playwright-browser.mjs";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: getChromiumLaunchOptions(),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Start Vite directly. On Linux, `pnpm exec` puts it in a separate process
    // group that Playwright cannot stop, so the run never exits.
    command:
      "node ../../node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 4173 --strictPort",
    cwd: "apps/web",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
