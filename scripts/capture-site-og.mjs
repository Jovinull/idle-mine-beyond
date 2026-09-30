import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

// Captures the social preview image (apps/site/static/og.png) from the built
// home page at 1200x630. Run `pnpm site:build` first, then rebuild afterwards
// so the new image is published.

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = path.join(root, "apps/site/static/og.png");
const port = 4176;

const server = spawn(
  process.execPath,
  [path.join(root, "scripts/serve-site.mjs"), "--port", String(port)],
  { stdio: ["ignore", "pipe", "inherit"] },
);
await new Promise((resolve, reject) => {
  server.stdout.once("data", resolve);
  server.once("exit", (code) =>
    reject(new Error(`The preview server exited with code ${code}.`)),
  );
});

const browser = await chromium.launch(getChromiumLaunchOptions());
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    colorScheme: "light",
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page
    .locator(".hero-object canvas[data-state='ready']")
    .waitFor({ state: "attached" });
  await page.evaluate(() => document.fonts.ready);
  // Frame the hero for a 1200x630 card: drop secondary text and controls.
  await page.addStyleTag({
    content: `
      .site-header nav, .theme-toggle, .hero .small, .hero-object .hint { display: none !important; }
      .hero { padding-block: 56px 0 !important; }
      .hero-object { padding-block: 1.25rem 1rem !important; }
    `,
  });
  await page.screenshot({ path: output });
  process.stdout.write(`Wrote ${path.relative(root, output)}\n`);
} finally {
  await browser.close();
  server.kill();
}
