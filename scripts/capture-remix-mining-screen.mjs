import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const dependencyManifestPath = path.join(
  root,
  "docs/knowledge/sources/runtime-dependencies.json",
);
const outputDirectory = path.join(root, ".research/outputs/mining-screen");
const viewport = { width: 1440, height: 900 };
const fixedClock = 1_704_067_200_000;
const mode = process.argv[2] ?? "--check";

if (mode !== "--check" && mode !== "--write") {
  throw new Error(
    "Usage: node scripts/capture-remix-mining-screen.mjs [--check|--write]",
  );
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function baselinePaths(theme) {
  const basename = `remix-mining-fresh-${theme}-1440x900`;
  return {
    image: path.join(root, `tests/fixtures/visual/${basename}.png`),
    metadata: path.join(root, `tests/fixtures/visual/${basename}.json`),
    researchImage: path.join(outputDirectory, `${basename}.png`),
    researchMetadata: path.join(outputDirectory, `${basename}.json`),
  };
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[extension] ?? "application/octet-stream"
  );
}

async function verifyPinnedCheckout(reference) {
  const checkout = path.resolve(root, reference.researchCheckout);
  const [revision, status] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: checkout,
      windowsHide: true,
    }),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: checkout,
      windowsHide: true,
    }),
  ]);
  if (
    revision.stdout.trim() !== reference.pinnedCommit ||
    status.stdout.trim()
  ) {
    throw new Error(
      `Pinned Remix must be clean at ${reference.pinnedCommit}; found ${revision.stdout.trim()}${status.stdout.trim() ? " with a dirty worktree" : ""}.`,
    );
  }
  return checkout;
}

async function loadDependencySnapshots(manifest) {
  const snapshots = new Map();
  for (const dependency of manifest.dependencies) {
    const contents = await readFile(
      path.resolve(root, dependency.researchSnapshot),
    );
    if (sha256(contents) !== dependency.sha256) {
      throw new Error(
        `Pinned ${dependency.name} CDN snapshot failed its SHA-256 check.`,
      );
    }
    snapshots.set(dependency.originalRequestUrl, contents);
  }
  return snapshots;
}

function startReadOnlyServer(sourceRoot) {
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(request.url ?? "/", "http://reference.local").pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname.split("/").includes(".git")) {
      response.writeHead(403).end();
      return;
    }

    if (pathname === "/") pathname = "/index.html";
    const absolutePath = path.resolve(sourceRoot, `.${pathname}`);
    const relativePath = path.relative(sourceRoot, absolutePath);
    if (
      relativePath === ".." ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      response.writeHead(403).end();
      return;
    }

    try {
      const contents = await readFile(absolutePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": contents.length,
        "Content-Type": mimeType(absolutePath),
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch {
      response.writeHead(404).end();
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Pinned Remix reference server failed to bind."));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}/index.html` });
    });
  });
}

async function main() {
  const [manifest, dependencies] = await Promise.all([
    readFile(manifestPath, "utf8").then(JSON.parse),
    readFile(dependencyManifestPath, "utf8").then(JSON.parse),
  ]);
  const reference = manifest.references.find(
    ({ name }) => name === "Idle Mine: Remix",
  );
  if (!reference) throw new Error("The pinned Remix source is not registered.");
  if (dependencies.sourceCommit !== reference.pinnedCommit) {
    throw new Error("The CDN snapshot manifest uses a different Remix pin.");
  }

  const [sourceRoot, snapshots] = await Promise.all([
    verifyPinnedCheckout(reference),
    loadDependencySnapshots(dependencies),
  ]);
  const { server, url } = await startReadOnlyServer(sourceRoot);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...getChromiumLaunchOptions(),
    });
    const context = await browser.newContext({
      colorScheme: "light",
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      viewport,
    });
    await context.addInitScript((clock) => {
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => clock,
      });
    }, fixedClock);

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const contents = snapshots.get(route.request().url());
      if (!contents) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.fulfill({
        body: contents,
        contentType: "application/javascript; charset=utf-8",
        status: 200,
      });
    });

    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      "Boolean(window.game && window.functions && window.app?.$el)",
    );
    await page.waitForFunction("window.imgLoaded === true");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(
      "document.querySelector('canvas.mine-object')?.width === 256",
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (selectedTheme) => window.functions.setTheme(selectedTheme),
        theme,
      );
      await page.waitForFunction(
        (selectedTheme) =>
          document.querySelector("#css_theme")?.getAttribute("href") ===
            `Themes/${selectedTheme}.css` &&
          getComputedStyle(document.body).backgroundColor ===
            (selectedTheme === "dark"
              ? "rgb(54, 54, 54)"
              : "rgb(250, 250, 250)"),
        theme,
      );
      const runtime = await page.evaluate(async () => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
        const game = window.game;
        const selectors = [
          "header",
          "main",
          "article.main",
          ".mineobject",
          "canvas.mine-object",
          ".upgradelist-wrapper",
          ".stats",
          ".messagelog",
          ".craft-pickaxe",
          "footer",
        ];
        const measurements = Object.fromEntries(
          selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [selector, null];
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return [
              selector,
              {
                rect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
                display: style.display,
                position: style.position,
                margin: style.margin,
                padding: style.padding,
                font: style.font,
                color: style.color,
                backgroundColor: style.backgroundColor,
                overflow: style.overflow,
              },
            ];
          }),
        );
        return {
          tab: game.settings.tab,
          theme: game.settings.theme,
          mineObjectLevel: game.mineObjectLevel,
          currentObjectName: game.currentMineObject.name,
          money: game.money.toString(),
          gems: game.gems.toString(),
          notificationCount: game.story.notifications,
          measurements,
        };
      });
      if (runtime.tab !== "main" || runtime.mineObjectLevel !== 0) {
        throw new Error(
          `Expected fresh Remix Mining state; received ${runtime.tab} at ${runtime.mineObjectLevel}.`,
        );
      }
      if (pageErrors.length) {
        throw new Error(
          `Pinned Remix runtime errors: ${pageErrors.join("; ")}`,
        );
      }

      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const screenshot = await page.screenshot({ fullPage: false });
      await mkdir(outputDirectory, { recursive: true });
      const paths = baselinePaths(theme);
      await writeFile(paths.researchImage, screenshot);
      const metadata = {
        repository: reference.canonicalUrl,
        sourceCommit: reference.pinnedCommit,
        sourcePaths: ["index.html", "main.css", "Scripts/Define/game.js"],
        browserName: "Chromium",
        browserVersion: browser.version(),
        viewport,
        deviceScaleFactor: 1,
        browserColorScheme: "light",
        gameTheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        clockMs: fixedClock,
        state: runtime,
        screenshotSha256: sha256(screenshot),
      };
      const capturedOn = new Date().toISOString().slice(0, 10);
      if (mode === "--write") {
        await writeFile(paths.image, screenshot);
        await writeFile(
          paths.metadata,
          `${JSON.stringify(
            {
              ...metadata,
              capturedOn,
              screenshotPath: path
                .relative(root, paths.image)
                .replaceAll("\\", "/"),
            },
            null,
            2,
          )}\n`,
          "utf8",
        );
      } else {
        const [baseline, baselineMetadata] = await Promise.all([
          readFile(paths.image),
          readFile(paths.metadata, "utf8").then(JSON.parse),
        ]);
        if (sha256(baseline) !== metadata.screenshotSha256) {
          throw new Error(
            `Pinned ${theme} Mining screen SHA-256 ${metadata.screenshotSha256} differs from the reviewed baseline ${sha256(baseline)}. Review the runtime and capture before updating the visual fixture.`,
          );
        }
        const expectedMetadata = { ...baselineMetadata };
        delete expectedMetadata.capturedOn;
        delete expectedMetadata.screenshotPath;
        if (JSON.stringify(metadata) !== JSON.stringify(expectedMetadata)) {
          throw new Error(
            `Pinned Mining ${theme} state or rendered measurements differ from the reviewed visual metadata.`,
          );
        }
      }
      const researchMetadata = {
        ...metadata,
        capturedOn,
        screenshotPath: path
          .relative(root, paths.researchImage)
          .replaceAll("\\", "/"),
        baselineMode: mode,
      };
      await writeFile(
        paths.researchMetadata,
        `${JSON.stringify(researchMetadata, null, 2)}\n`,
        "utf8",
      );
      process.stdout.write(
        `${mode === "--write" ? "Wrote" : "Verified"} pinned Remix fresh Mining ${theme} screen at ${reference.pinnedCommit} in Chromium ${browser.version()}; SHA-256 ${metadata.screenshotSha256}.\n${path.relative(root, paths.researchImage).replaceAll("\\", "/")}\n`,
      );
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
