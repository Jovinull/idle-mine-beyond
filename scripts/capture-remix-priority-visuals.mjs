import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { format } from "prettier";
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
const phaseFixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-phase-differentials.json",
);
const stateFixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-priority-visual-states.json",
);
const outputDirectory = path.join(root, ".research/outputs/priority-visuals");
const visualDirectory = path.join(root, "tests/fixtures/visual");
const fixedClock = 1_704_067_200_000;
const defaultViewport = { width: 1440, height: 900 };
const mode = process.argv[2] ?? "--check";

if (mode !== "--check" && mode !== "--write") {
  throw new Error(
    "Usage: node scripts/capture-remix-priority-visuals.mjs [--check|--write]",
  );
}

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function fixturePath(name, extension) {
  return path.join(visualDirectory, `${name}.${extension}`);
}

function relativeToRoot(filePath) {
  return path.relative(root, filePath).replaceAll("\\", "/");
}

function mimeType(filePath) {
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
    }[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
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

function makeCaptureCases() {
  const cases = [];
  for (const tab of ["money", "gems", "planetcoins"]) {
    for (const theme of ["light", "dark"]) {
      cases.push({
        id: `upgrades-space-${tab}-${theme}-1440x900`,
        family: "upgrades",
        viewport: defaultViewport,
        theme,
        gameTab: "main",
        upgradeTab: tab,
        phaseId: "space",
      });
    }
  }
  for (const theme of ["light", "dark"]) {
    cases.push({
      id: `powers-wisdom-stars-${theme}-1440x900`,
      family: "powers",
      viewport: defaultViewport,
      theme,
      gameTab: "powers",
      phaseId: "wisdom-stars",
      controlledPowersBoundary: true,
    });
  }
  for (const phaseId of ["space", "wisdom-stars", "galaxies"]) {
    for (const theme of ["light", "dark"]) {
      cases.push({
        id: `mining-${phaseId}-${theme}-1440x900`,
        family: "mining",
        viewport: defaultViewport,
        theme,
        gameTab: "main",
        phaseId,
      });
    }
  }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    const suffix = `${viewport.width}x${viewport.height}`;
    for (const gameTab of ["main", "story", "settings"]) {
      for (const theme of ["light", "dark"]) {
        cases.push({
          id: `primary-${gameTab}-${theme}-${suffix}`,
          family: "primary",
          viewport,
          theme,
          gameTab,
        });
      }
    }
  }
  return cases;
}

function difference(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} differs from its pinned capture: ${findFirstDifference(actual, expected)}.`,
    );
  }
}

function findFirstDifference(actual, expected, location = "$") {
  if (Object.is(actual, expected)) return undefined;
  if (typeof actual === "string" && typeof expected === "string") {
    let index = 0;
    while (
      index < actual.length &&
      index < expected.length &&
      actual[index] === expected[index]
    ) {
      index++;
    }
    const start = Math.max(0, index - 32);
    const end = index + 32;
    return `${location}: strings differ at ${index} (expected length ${expected.length}, got ${actual.length}); expected ${JSON.stringify(expected.slice(start, end))}, got ${JSON.stringify(actual.slice(start, end))}`;
  }
  if (actual === null || expected === null) {
    return `${location}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
  }
  if (Array.isArray(actual) || Array.isArray(expected)) {
    if (!Array.isArray(actual) || !Array.isArray(expected)) {
      return `${location}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
    }
    if (actual.length !== expected.length) {
      return `${location}.length: expected ${expected.length}, got ${actual.length}`;
    }
    for (let index = 0; index < actual.length; index++) {
      const result = findFirstDifference(
        actual[index],
        expected[index],
        `${location}[${index}]`,
      );
      if (result) return result;
    }
    return undefined;
  }
  if (typeof actual === "object" && typeof expected === "object") {
    const actualRecord = actual;
    const expectedRecord = expected;
    const keys = new Set([
      ...Object.keys(actualRecord),
      ...Object.keys(expectedRecord),
    ]);
    for (const key of keys) {
      if (!(key in actualRecord) || !(key in expectedRecord)) {
        return `${location}.${key}: expected ${JSON.stringify(expectedRecord[key])}, got ${JSON.stringify(actualRecord[key])}`;
      }
      const result = findFirstDifference(
        actualRecord[key],
        expectedRecord[key],
        `${location}.${key}`,
      );
      if (result) return result;
    }
    return undefined;
  }
  return `${location}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

// Chromium rasterizes text differently on Linux, so Linux keeps its own
// `-linux` screenshots and sidecars next to the Windows baselines.
const platformSuffix = process.platform === "linux" ? "-linux" : "";

/** Writes JSON fixtures the way `pnpm format` leaves them. */
function formatJson(value) {
  return format(JSON.stringify(value, null, 2), { parser: "json" });
}

/** Drops the platform-specific screenshot fields from the shared state list. */
function platformNeutralStates(states) {
  return {
    ...states,
    captures: states.captures.map((capture) =>
      Object.fromEntries(
        Object.entries(capture).filter(
          ([key]) => key !== "fixture" && key !== "screenshotSha256",
        ),
      ),
    ),
  };
}

async function main() {
  if (process.platform !== "win32" && process.platform !== "linux") {
    process.stdout.write(
      "Skipped source screenshot replay: priority visual baselines exist for Windows and Linux only.\n",
    );
    return;
  }

  const [referenceManifest, dependencyManifest, phaseFixture] =
    await Promise.all([
      readFile(manifestPath, "utf8").then(JSON.parse),
      readFile(dependencyManifestPath, "utf8").then(JSON.parse),
      readFile(phaseFixturePath, "utf8").then(JSON.parse),
    ]);
  const reference = referenceManifest.references.find(
    ({ name }) => name === "Idle Mine: Remix",
  );
  if (!reference) throw new Error("Canonical Remix source pin is missing.");
  const sourceRoot = await verifyPinnedCheckout(reference);
  const snapshots = await loadDependencySnapshots(dependencyManifest);
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
      viewport: defaultViewport,
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
    await page.addStyleTag({
      content:
        'img[src$="wisdom.png"] { animation: none !important; transform: none !important; }',
    });
    const freshSave = await page.evaluate(() =>
      window.functions.getSaveString(),
    );
    const phases = new Map(
      phaseFixture.phases.map((phase) => [phase.id, phase]),
    );
    const priorStates =
      mode === "--check"
        ? await readFile(stateFixturePath, "utf8").then(JSON.parse)
        : undefined;
    const powersState = {
      sourceCommit: reference.pinnedCommit,
      phaseSaveId: "wisdom-stars",
      selectedMineObjectLevel: 169,
      highestMineObjectLevel: 170,
      setup:
        "Controlled unlock boundary for the Powers panel; not a natural route.",
      saveString: "",
      sourceState: undefined,
    };
    const generatedMetadata = [];
    await mkdir(outputDirectory, { recursive: true });
    await mkdir(visualDirectory, { recursive: true });

    for (const capture of makeCaptureCases()) {
      const sourceSave = capture.phaseId
        ? phases.get(capture.phaseId)?.saveString
        : freshSave;
      if (!sourceSave) {
        throw new Error(`Missing source save for visual case ${capture.id}.`);
      }
      await page.setViewportSize(capture.viewport);
      const setup = await page.evaluate(
        async ({ captureCase, serializedSave }) => {
          const { game, functions } = window;
          functions.loadGame(serializedSave, true, true);
          await window.app.$nextTick();
          game.messageLog = [];
          game.highlightedUpgrade = null;
          game.settings.upgradeTab = "money";
          if (captureCase.controlledPowersBoundary) {
            game.mineObjectLevel = 169;
            game.highestMineObjectLevel = 170;
            game.currentMineObject = functions.getMineObject(169);
            functions.refreshStoryNotifications();
          }
          functions.setTheme(captureCase.theme);
          if (captureCase.gameTab === "story") {
            functions.changeTab("story");
          } else {
            game.settings.tab = captureCase.gameTab;
          }
          if (captureCase.upgradeTab) {
            const upgradeIndex = {
              money: 0,
              gems: 1,
              planetcoins: 2,
            }[captureCase.upgradeTab];
            const upgradeButton =
              document.querySelectorAll(".upg-tabs button")[upgradeIndex];
            upgradeButton?.click();
          }
          await window.app.$nextTick();
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          const object = game.currentMineObject;
          const state = {
            tab: game.settings.tab,
            upgradeTab: game.settings.upgradeTab,
            theme: game.settings.theme,
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            currentObjectName: object.name,
            money: game.money.toString(),
            gems: game.gems.toString(),
            planetCoins: game.planetCoins.toString(),
            wisdom: game.wisdom.toString(),
            story: {
              page: game.story.page,
              highestUnlocked: game.story.highestUnlocked,
              notifications: game.story.notifications,
            },
          };
          return {
            state,
            controlledSave: captureCase.controlledPowersBoundary
              ? functions.getSaveString()
              : undefined,
          };
        },
        { captureCase: capture, serializedSave: sourceSave },
      );
      if (capture.family === "powers") {
        powersState.saveString = setup.controlledSave;
        powersState.sourceState = setup.state;
      }
      await page.waitForFunction(
        (theme) =>
          document.querySelector("#css_theme")?.getAttribute("href") ===
            `Themes/${theme}.css` &&
          getComputedStyle(document.body).backgroundColor ===
            (theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)"),
        capture.theme,
      );
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(
        capture.viewport.width - 1,
        capture.viewport.height - 1,
      );
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const screenshot = await page.screenshot({ fullPage: false });
      const screenshotSha256 = sha256(screenshot);
      const imagePath = fixturePath(
        `remix-${capture.id}${platformSuffix}`,
        "png",
      );
      const metadataPath = fixturePath(
        `remix-${capture.id}${platformSuffix}`,
        "json",
      );
      const metadata = {
        repository: reference.canonicalUrl,
        sourceCommit: reference.pinnedCommit,
        sourcePaths: ["index.html", "main.css", "Scripts/Define/game.js"],
        browserName: "Chromium",
        browserVersion: browser.version(),
        viewport: capture.viewport,
        deviceScaleFactor: 1,
        browserColorScheme: "light",
        gameTheme: capture.theme,
        locale: "en-US",
        timezoneId: "UTC",
        clockMs: fixedClock,
        phaseSaveId: capture.phaseId ?? null,
        controlledBoundary: capture.controlledPowersBoundary ?? false,
        state: setup.state,
        screenshotSha256,
      };
      const outputImagePath = path.join(outputDirectory, `${capture.id}.png`);
      await writeFile(outputImagePath, screenshot);
      if (mode === "--write") {
        await writeFile(imagePath, screenshot);
        await writeFile(
          metadataPath,
          await formatJson({
            ...metadata,
            capturedOn: new Date().toISOString().slice(0, 10),
            screenshotPath: relativeToRoot(imagePath),
          }),
          "utf8",
        );
      } else {
        const [expectedImage, expectedMetadataText] = await Promise.all([
          readFile(imagePath),
          readFile(metadataPath, "utf8"),
        ]);
        if (sha256(expectedImage) !== screenshotSha256) {
          throw new Error(
            `${capture.id} source screenshot differs from the pinned ${platformSuffix ? "Linux" : "Windows"} baseline. Review the runtime and capture before updating the fixture.`,
          );
        }
        const expectedMetadata = JSON.parse(expectedMetadataText);
        delete expectedMetadata.capturedOn;
        delete expectedMetadata.screenshotPath;
        difference(metadata, expectedMetadata, capture.id);
      }
      generatedMetadata.push({
        id: capture.id,
        fixture: relativeToRoot(imagePath),
        state: setup.state,
        screenshotSha256,
      });
      process.stdout.write(
        `${mode === "--write" ? "Captured" : "Verified"} pinned Remix ${capture.id}: ${screenshotSha256}\n`,
      );
    }

    if (pageErrors.length) {
      throw new Error(`Pinned Remix runtime errors: ${pageErrors.join("; ")}`);
    }
    const generatedStates = {
      sourceCommit: reference.pinnedCommit,
      powers: powersState,
      captures: generatedMetadata,
    };
    // The shared state list records the Windows screenshots; Linux checks
    // that it reached the same source states.
    if (mode === "--write" && !platformSuffix) {
      await writeFile(
        stateFixturePath,
        await formatJson(generatedStates),
        "utf8",
      );
    } else if (mode === "--check" || platformSuffix) {
      const stored =
        priorStates ??
        (await readFile(stateFixturePath, "utf8").then(JSON.parse));
      if (platformSuffix) {
        difference(
          platformNeutralStates(generatedStates),
          platformNeutralStates(stored),
          "Priority visual source states",
        );
      } else {
        difference(generatedStates, stored, "Priority visual source states");
      }
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
