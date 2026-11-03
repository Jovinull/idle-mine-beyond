import { chromium } from "@playwright/test";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const browser = await chromium.launch(getChromiumLaunchOptions());
const context = await browser.newContext();

try {
  const firstPage = await context.newPage();
  await firstPage.goto("data:text/html,<title>first</title>");
  const firstInitially = await firstPage.evaluate(
    () => document.visibilityState,
  );

  const secondPage = await context.newPage();
  await secondPage.goto("data:text/html,<title>second</title>");
  await secondPage.bringToFront();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const firstInBackground = await firstPage.evaluate(
    () => document.visibilityState,
  );
  const secondInForeground = await secondPage.evaluate(
    () => document.visibilityState,
  );

  await firstPage.bringToFront();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const firstRestored = await firstPage.evaluate(
    () => document.visibilityState,
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        browserVersion: browser.version(),
        firstInitially,
        firstInBackground,
        secondInForeground,
        firstRestored,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  await context.close();
  await browser.close();
}
