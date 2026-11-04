import { chromium } from "@playwright/test";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const headed = process.argv.includes("--headed");
const minimizeWindow = process.argv.includes("--minimize-window");
const minimizedWaitMs = 12_000;

if (minimizeWindow && !headed) {
  throw new Error("--minimize-window requires --headed.");
}

const browser = await chromium.launch({
  ...getChromiumLaunchOptions(),
  headless: !headed,
});
const context = await browser.newContext();

try {
  const firstPage = await context.newPage();

  if (minimizeWindow) {
    await firstPage.addInitScript(() => {
      const probe = {
        visibilityChanges: [],
        intervalSamples: [],
        animationFrameSamples: [],
      };
      window.__idleMineVisibilityProbe = probe;
      document.addEventListener("visibilitychange", () => {
        probe.visibilityChanges.push({
          state: document.visibilityState,
          time: performance.now(),
        });
      });
      setInterval(() => probe.intervalSamples.push(performance.now()), 100);
      const animationFrame = () => {
        probe.animationFrameSamples.push(performance.now());
        requestAnimationFrame(animationFrame);
      };
      requestAnimationFrame(animationFrame);
    });
    await firstPage.goto("data:text/html,<title>visibility probe</title>");

    const cdp = await context.newCDPSession(firstPage);
    let originalBounds;
    let windowId;
    try {
      ({ windowId } = await cdp.send("Browser.getWindowForTarget"));
      ({ bounds: originalBounds } = await cdp.send("Browser.getWindowBounds", {
        windowId,
      }));
      const boundsBefore = originalBounds;

      const snapshot = () =>
        firstPage.evaluate(() => {
          const probe = window.__idleMineVisibilityProbe;
          const maxGap = (samples) => {
            let result = 0;
            for (let index = 1; index < samples.length; index += 1) {
              result = Math.max(result, samples[index] - samples[index - 1]);
            }
            return result;
          };
          return {
            visibility: document.visibilityState,
            focused: document.hasFocus(),
            intervalCount: probe.intervalSamples.length,
            intervalMaxGapMs: maxGap(probe.intervalSamples),
            animationFrameCount: probe.animationFrameSamples.length,
            animationFrameMaxGapMs: maxGap(probe.animationFrameSamples),
            visibilityChanges: [...probe.visibilityChanges],
          };
        });

      await new Promise((resolve) => setTimeout(resolve, 500));
      const visibleBefore = await snapshot();
      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: { windowState: "minimized" },
      });
      const minimizedBounds = await cdp.send("Browser.getWindowBounds", {
        windowId,
      });
      await new Promise((resolve) => setTimeout(resolve, minimizedWaitMs));
      const whileMinimized = await snapshot();

      await cdp.send("Browser.setWindowBounds", {
        windowId,
        bounds: originalBounds,
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const afterRestore = await snapshot();

      process.stdout.write(
        `${JSON.stringify(
          {
            browserVersion: browser.version(),
            mode: "headed-minimized-window",
            minimizedWaitMs,
            boundsBefore,
            minimizedBounds: minimizedBounds.bounds,
            visibleBefore,
            whileMinimized,
            afterRestore,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      if (windowId && originalBounds) {
        await cdp
          .send("Browser.setWindowBounds", {
            windowId,
            bounds: originalBounds,
          })
          .catch(() => undefined);
      }
      await cdp.detach();
    }
  } else {
    await firstPage.goto("data:text/html,<title>first</title>");
    const firstInitially = await firstPage.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));

    const secondPage = await context.newPage();
    await secondPage.goto("data:text/html,<title>second</title>");
    const firstSession = await context.newCDPSession(firstPage);
    const secondSession = await context.newCDPSession(secondPage);
    const firstWindowId = (
      await firstSession.send("Browser.getWindowForTarget")
    ).windowId;
    const secondWindowId = (
      await secondSession.send("Browser.getWindowForTarget")
    ).windowId;
    await secondPage.bringToFront();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const firstInBackground = await firstPage.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));
    const secondInForeground = await secondPage.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));

    await firstPage.bringToFront();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const firstRestored = await firstPage.evaluate(() => ({
      visibility: document.visibilityState,
      focused: document.hasFocus(),
    }));
    await firstSession.detach();
    await secondSession.detach();

    process.stdout.write(
      `${JSON.stringify(
        {
          browserVersion: browser.version(),
          mode: headed ? "headed" : "headless",
          firstWindowId,
          secondWindowId,
          sameBrowserWindow: firstWindowId === secondWindowId,
          firstInitially,
          firstInBackground,
          secondInForeground,
          firstRestored,
        },
        null,
        2,
      )}\n`,
    );
  }
} finally {
  await context.close();
  await browser.close();
}
