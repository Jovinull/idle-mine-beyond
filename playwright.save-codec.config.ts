import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  projects: [{ name: "firefox", use: { ...devices["Desktop Firefox"] } }],
  use: { ...base.use, launchOptions: {} },
});
