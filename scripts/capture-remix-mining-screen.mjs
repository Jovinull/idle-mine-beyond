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

// Chromium rasterizes text differently per OS. Windows keeps the reviewed
// baselines; Linux (CI) compares against Remix captures made on Linux.
const visualBaselineSuffix =
  { linux: "-linux", win32: "" }[process.platform] ?? null;

if (visualBaselineSuffix === null) {
  throw new Error(
    `No Remix visual baselines are recorded for ${process.platform}.`,
  );
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function baselinePaths(basename) {
  const fixture = `${basename}${visualBaselineSuffix}`;
  return {
    image: path.join(root, `tests/fixtures/visual/${fixture}.png`),
    metadata: path.join(root, `tests/fixtures/visual/${fixture}.json`),
    researchImage: path.join(outputDirectory, `${fixture}.png`),
    researchMetadata: path.join(outputDirectory, `${fixture}.json`),
  };
}

function relativeToRoot(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
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

/**
 * Captures the Mining craft row in the reviewed Gem Waster state: Money and
 * Gem Gem Waster levels 1 and 2, then one increase click to selected level 1.
 */
async function captureCraftSelector(page, browser, reference) {
  await page.evaluate(() => window.functions.setTheme("light"));
  await page.waitForFunction(
    () =>
      document.querySelector("#css_theme")?.getAttribute("href") ===
        "Themes/light.css" &&
      getComputedStyle(document.body).backgroundColor === "rgb(250, 250, 250)",
  );
  const state = await page.evaluate(async () => {
    const game = window.game;
    const functions = window.functions;
    game.gems = new window.Decimal(1000);
    game.upgrades.gemWaster.level = 1;
    game.gemUpgrades.gemWaster.level = 2;
    game.usedGemsLevel = 0;
    game.settings.showMinCraftDamage = false;
    await window.app.$nextTick();
    document
      .querySelectorAll(".craft-pickaxe > button.level-change")[1]
      ?.click();
    await window.app.$nextTick();
    return {
      moneyGemWasterLevel: game.upgrades.gemWaster.level,
      gemUpgradeWasterLevel: game.gemUpgrades.gemWaster.level,
      usedGemsLevel: game.usedGemsLevel,
      displayedGemCost: functions.formatThousands(functions.getUsedGems()),
    };
  });
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  const screenshot = await page
    .locator(".craft-pickaxe")
    .screenshot({ animations: "disabled" });
  const screenshotSha256 = sha256(screenshot);
  const paths = baselinePaths("craft-selector-light-1440x900");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(paths.researchImage, screenshot);

  if (mode === "--write") {
    const templatePath = await readFile(paths.metadata, "utf8")
      .then(() => paths.metadata)
      .catch(() =>
        path.join(
          root,
          "tests/fixtures/visual/craft-selector-light-1440x900.json",
        ),
      );
    const template = JSON.parse(await readFile(templatePath, "utf8"));
    const metadata = {
      ...template,
      capturedOn: new Date().toISOString().slice(0, 10),
      captureMethod:
        "read-only local source checkout served to Playwright by scripts/capture-remix-mining-screen.mjs",
      browser: `Chromium ${browser.version()}`,
      state,
      crop: {
        width: screenshot.readUInt32BE(16),
        height: screenshot.readUInt32BE(20),
      },
      referenceScreenshot: {
        path: path.basename(paths.image),
        sha256: screenshotSha256,
        bytes: screenshot.length,
      },
    };
    if (template.beyondScreenshotSha256 !== screenshotSha256) {
      delete metadata.beyondScreenshotSha256;
    }
    await writeFile(paths.image, screenshot);
    await writeFile(
      paths.metadata,
      `${JSON.stringify(metadata, null, 2)}\n`,
      "utf8",
    );
  } else {
    const [baseline, baselineMetadata] = await Promise.all([
      readFile(paths.image),
      readFile(paths.metadata, "utf8").then(JSON.parse),
    ]);
    const expectedSha256 = baselineMetadata.referenceScreenshot?.sha256;
    if (
      screenshotSha256 !== expectedSha256 ||
      sha256(baseline) !== expectedSha256
    ) {
      throw new Error(
        `Pinned craft selector SHA-256 ${screenshotSha256} differs from the reviewed baseline ${expectedSha256}. Review the runtime and capture before updating the visual fixture.`,
      );
    }
    if (JSON.stringify(state) !== JSON.stringify(baselineMetadata.state)) {
      throw new Error(
        `Pinned craft selector state ${JSON.stringify(state)} differs from the reviewed visual metadata.`,
      );
    }
  }
  process.stdout.write(
    `${mode === "--write" ? "Wrote" : "Verified"} pinned Remix craft selector at ${reference.pinnedCommit} in Chromium ${browser.version()}; SHA-256 ${screenshotSha256}.\n${relativeToRoot(paths.researchImage)}\n`,
  );

  const referenceCorpus = JSON.parse(
    await readFile(
      path.join(root, "tests/fixtures/parity/remix-reference-corpus.json"),
      "utf8",
    ),
  );
  const legacySave = JSON.parse(
    referenceCorpus.data.saveApplicationSemantics.inputJson,
  );
  legacySave.gems = "1000";
  legacySave.lastActive = fixedClock;
  legacySave.settings = {
    ...legacySave.settings,
    theme: "light",
    showMinCraftDamage: false,
  };
  legacySave.upgrades.gemWaster = { level: 1 };
  legacySave.gemUpgrades.gemWaster = { level: 2 };
  await page.evaluate((serialized) => {
    localStorage.setItem(
      "IdleMine",
      btoa(escape(encodeURIComponent(serialized))),
    );
  }, JSON.stringify(legacySave));
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(
    "Boolean(window.game && window.functions && window.app?.$el)",
  );
  await page.waitForFunction("window.imgLoaded === true");
  await page.waitForFunction(
    "document.querySelector('canvas.mine-object')?.width === 256",
  );
  await page.locator(".craft-pickaxe > button.level-change").nth(1).click();
  await page.evaluate(() => document.fonts.ready);
  const panelState = await page.evaluate(() => {
    const game = window.game;
    return {
      tab: game.settings.tab,
      theme: game.settings.theme,
      mineObjectLevel: game.mineObjectLevel,
      currentObjectId: game.currentMineObject.id,
      currentObjectName: game.currentMineObject.name,
      money: game.money.toString(),
      gems: game.gems.toString(),
      moneyGemWasterLevel: game.upgrades.gemWaster.level,
      gemUpgradeWasterLevel: game.gemUpgrades.gemWaster.level,
      usedGemsLevel: game.usedGemsLevel,
      displayedGemCost: window.functions.formatThousands(
        window.functions.getUsedGems(),
      ),
      showMinCraftDamage: game.settings.showMinCraftDamage,
      storyNotifications: game.story.notifications,
    };
  });

  for (const theme of ["light", "dark"]) {
    if (theme === "dark") {
      await page.evaluate(() => window.functions.setTheme("dark"));
      await page.waitForFunction(
        () =>
          document.querySelector("#css_theme")?.getAttribute("href") ===
            "Themes/dark.css" &&
          getComputedStyle(document.body).backgroundColor === "rgb(54, 54, 54)",
      );
    }
    const state = { ...panelState, theme };
    const panelPaths = baselinePaths(`craft-mining-panel-${theme}-1440x900`);
    const panelMetadata = {
      source: {
        name: "Idle Mine: Remix",
        repository: reference.canonicalUrl,
        commit: reference.pinnedCommit,
      },
      sourceCommit: reference.pinnedCommit,
      sourcePaths: [
        "index.html",
        "main.css",
        `Themes/${theme}.css`,
        "Scripts/Define/functions.js",
        "Scripts/Define/game.js",
      ],
      browser: `Chromium ${browser.version()}`,
      playwright: "1.63.0",
      viewport,
      theme,
      state,
      captureMethod:
        "read-only pinned Remix checkout, local reference server, Playwright Chromium",
    };

    // Linux keeps its own `-linux` screenshot; its source state must still
    // match the Windows reference fixture.
    if (process.platform !== "win32") {
      const windowsMetadata = JSON.parse(
        await readFile(
          path.join(
            root,
            `tests/fixtures/visual/craft-mining-panel-${theme}-1440x900.json`,
          ),
          "utf8",
        ),
      );
      if (
        windowsMetadata.sourceCommit !== reference.pinnedCommit ||
        JSON.stringify(windowsMetadata.state) !== JSON.stringify(state) ||
        JSON.stringify(windowsMetadata.viewport) !== JSON.stringify(viewport)
      ) {
        throw new Error(
          `Pinned full craft Mining panel ${theme} state differs from its Windows reference fixture.`,
        );
      }
    }

    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    const panelScreenshot = await page.screenshot({
      animations: "disabled",
      fullPage: false,
    });
    const panelScreenshotSha256 = sha256(panelScreenshot);
    const recordedPanelMetadata = {
      ...panelMetadata,
      screenshotPath: path.basename(panelPaths.image),
      screenshotSha256: panelScreenshotSha256,
    };
    await writeFile(panelPaths.researchImage, panelScreenshot);

    if (mode === "--write") {
      await writeFile(panelPaths.image, panelScreenshot);
      await writeFile(
        panelPaths.metadata,
        `${JSON.stringify(
          {
            ...recordedPanelMetadata,
            capturedOn: new Date().toISOString().slice(0, 10),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } else {
      const [baseline, baselineMetadata] = await Promise.all([
        readFile(panelPaths.image),
        readFile(panelPaths.metadata, "utf8").then(JSON.parse),
      ]);
      if (
        sha256(baseline) !== panelScreenshotSha256 ||
        baselineMetadata.screenshotSha256 !== panelScreenshotSha256 ||
        baselineMetadata.sourceCommit !== reference.pinnedCommit ||
        JSON.stringify(baselineMetadata.state) !== JSON.stringify(state) ||
        JSON.stringify(baselineMetadata.viewport) !== JSON.stringify(viewport)
      ) {
        throw new Error(
          `Pinned full craft Mining panel ${theme} differs from its reviewed source baseline. Review the runtime and capture before updating the visual fixture.`,
        );
      }
    }
    process.stdout.write(
      `${mode === "--write" ? "Wrote" : "Verified"} pinned Remix full craft Mining panel ${theme} at ${reference.pinnedCommit} in Chromium ${browser.version()}; SHA-256 ${panelScreenshotSha256}.\n${relativeToRoot(panelPaths.researchImage)}\n`,
    );
  }
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
      const paths = baselinePaths(`remix-mining-fresh-${theme}-1440x900`);
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

    await captureCraftSelector(page, browser, reference);
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
