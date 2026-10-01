import { defineConfig, devices } from "@playwright/test";
import { getChromiumLaunchOptions } from "./scripts/playwright-browser.mjs";

// Browser tests for the built project site (run `pnpm site:build` first).
export default defineConfig({
  testDir: "./tests/site",
  // Own results folder: other Playwright runs in this checkout clear test-results/.
  outputDir: "./apps/site/test-results",
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: getChromiumLaunchOptions(),
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /responsive\.spec\.ts/,
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
      testMatch: /responsive\.spec\.ts/,
    },
  ],
  webServer: {
    command: "node scripts/serve-site.mjs --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
