import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

export function getChromiumLaunchOptions() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  if (executablePath) return { executablePath };

  if (process.env.CI || existsSync(chromium.executablePath())) return {};

  return { channel: "chrome" };
}
