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
const referenceCorpusPath = path.join(
  root,
  "tests/fixtures/parity/remix-reference-corpus.json",
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
const dropOnly = mode.endsWith("-drop-only");
const shopGateOnly = mode.endsWith("-shop-gate-only");
const writeMode = mode.startsWith("--write");

if (
  ![
    "--check",
    "--write",
    "--check-drop-only",
    "--write-drop-only",
    "--check-shop-gate-only",
    "--write-shop-gate-only",
  ].includes(mode)
) {
  throw new Error(
    "Usage: node scripts/capture-remix-priority-visuals.mjs [--check|--write|--check-drop-only|--write-drop-only|--check-shop-gate-only|--write-shop-gate-only]",
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
  for (const mineObjectLevel of [89, 90]) {
    for (const theme of ["light", "dark"]) {
      cases.push({
        id: `planetcoin-shop-gate-${mineObjectLevel}-${theme}-1440x900`,
        family: "shop-gate",
        viewport: defaultViewport,
        theme,
        gameTab: "main",
        mineObjectLevel,
        highestMineObjectLevel: mineObjectLevel,
        controlledBoundary: true,
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
  for (const [dropCaseName, dropId, afterDropTab] of [
    ["planet-coin-drop-roll-follows-gem-roll", "planet-coins", undefined],
    ["wisdom-drop-scales-with-power-wisdom", "wisdom", "powers"],
  ]) {
    for (const theme of ["light", "dark"]) {
      cases.push({
        id: `mine-drop-${dropId}-${theme}-1440x900`,
        family: "drops",
        viewport: defaultViewport,
        theme,
        gameTab: "main",
        dropCaseName,
        afterDropTab,
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

function compareCaptureIds(left, right) {
  const gateCapture = /^planetcoin-shop-gate-(\d+)-(light|dark)-/.exec(left.id);
  const otherGateCapture = /^planetcoin-shop-gate-(\d+)-(light|dark)-/.exec(
    right.id,
  );
  if (gateCapture && otherGateCapture) {
    const levelDifference =
      Number(gateCapture[1]) - Number(otherGateCapture[1]);
    if (levelDifference !== 0) return levelDifference;
    return gateCapture[2] === otherGateCapture[2]
      ? 0
      : gateCapture[2] === "light"
        ? -1
        : 1;
  }
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

async function captureStableScreenshot(page, captureId) {
  let previous;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const screenshot = await page.screenshot({ fullPage: false });
    if (previous?.equals(screenshot)) return screenshot;
    previous = screenshot;
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  }
  throw new Error(
    `${captureId} did not produce two consecutive identical screenshots.`,
  );
}

async function main() {
  if (process.platform !== "win32" && process.platform !== "linux") {
    process.stdout.write(
      "Skipped source screenshot replay: priority visual baselines exist for Windows and Linux only.\n",
    );
    return;
  }

  const [referenceManifest, dependencyManifest, phaseFixture, referenceCorpus] =
    await Promise.all([
      readFile(manifestPath, "utf8").then(JSON.parse),
      readFile(dependencyManifestPath, "utf8").then(JSON.parse),
      readFile(phaseFixturePath, "utf8").then(JSON.parse),
      readFile(referenceCorpusPath, "utf8").then(JSON.parse),
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
    const pageErrors = [];
    const routeCdnSnapshot = async (route) => {
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
    };
    let context = await browser.newContext({
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
    let page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://cdn.jsdelivr.net/**", routeCdnSnapshot);
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
      !dropOnly && !shopGateOnly && mode === "--check"
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
    let isolatedShopGateContext = false;

    // Shop-gate captures stay Windows-only: on Linux the pinned Remix renders
    // the level-90 gate in one of two states that differ by one pixel.
    const captureCases = makeCaptureCases().filter((capture) => {
      if (dropOnly) return capture.family === "drops";
      if (shopGateOnly) {
        return capture.family === "shop-gate" && process.platform === "win32";
      }
      if (capture.family === "shop-gate") return process.platform === "win32";
      return true;
    });
    for (const capture of captureCases) {
      if (
        capture.family === "shop-gate" &&
        !shopGateOnly &&
        !isolatedShopGateContext
      ) {
        await context.close();
        context = await browser.newContext({
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
        page = await context.newPage();
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.route("https://cdn.jsdelivr.net/**", routeCdnSnapshot);
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
        isolatedShopGateContext = true;
      }
      const sourceSave = capture.phaseId
        ? phases.get(capture.phaseId)?.saveString
        : freshSave;
      if (!sourceSave) {
        throw new Error(`Missing source save for visual case ${capture.id}.`);
      }
      await page.setViewportSize(capture.viewport);
      let dropSaveData;
      let dropRandomValues;
      let shopGateSaveData;
      if (capture.family === "drops") {
        const sourceCase = referenceCorpus.data.miningHitSemantics.cases.find(
          ({ name }) => name === capture.dropCaseName,
        );
        if (!sourceCase) {
          throw new Error(
            `Pinned drop case ${capture.dropCaseName} is missing.`,
          );
        }
        dropSaveData = JSON.parse(
          referenceCorpus.data.saveApplicationSemantics.inputJson,
        );
        dropSaveData.mineObjectLevel = sourceCase.input.objectId;
        dropSaveData.highestMineObjectLevel = sourceCase.input.objectId;
        dropSaveData.money = sourceCase.input.resources.money;
        dropSaveData.highestMoney = sourceCase.input.resources.highestMoney;
        dropSaveData.gems = sourceCase.input.resources.gems;
        dropSaveData.planetCoins = sourceCase.input.resources.planetCoins;
        dropSaveData.maxPlanetCoins = sourceCase.input.resources.maxPlanetCoins;
        dropSaveData.wisdom = sourceCase.input.resources.wisdom;
        dropSaveData.maxWisdom = sourceCase.input.resources.maxWisdom;
        dropSaveData.powers.data.values = [...sourceCase.input.powers];
        dropSaveData.pickaxe.pow = sourceCase.input.pickaxe.power;
        dropSaveData.pickaxe.quality = sourceCase.input.pickaxe.quality;
        dropSaveData.lastActive = fixedClock;
        dropSaveData.settings.theme = capture.theme;
        dropSaveData.settings.tab = "main";
        dropSaveData.settings.showMineObjLevel = true;
        dropRandomValues = sourceCase.input.randomValues;
      }
      if (capture.family === "shop-gate") {
        shopGateSaveData = JSON.parse(
          referenceCorpus.data.saveApplicationSemantics.inputJson,
        );
        shopGateSaveData.mineObjectLevel = capture.mineObjectLevel;
        shopGateSaveData.highestMineObjectLevel =
          capture.highestMineObjectLevel;
        shopGateSaveData.lastActive = fixedClock;
        shopGateSaveData.settings.theme = capture.theme;
        shopGateSaveData.settings.tab = "main";
        shopGateSaveData.settings.upgradeTab = "money";
      }
      const setup = await page.evaluate(
        async ({ captureCase, serializedSave }) => {
          const { game, functions } = window;
          const nativeRandom =
            window.__idleMineCaptureNativeRandom ?? Math.random;
          window.__idleMineCaptureNativeRandom = nativeRandom;
          Math.random = nativeRandom;
          const controlledSaveData =
            captureCase.dropSaveData ?? captureCase.shopGateSaveData;
          const sourceSave = controlledSaveData
            ? btoa(
                escape(encodeURIComponent(JSON.stringify(controlledSaveData))),
              )
            : serializedSave;
          functions.loadGame(sourceSave, true, true);
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
          let randomDraws;
          if (captureCase.family === "drops") {
            await window.app.$nextTick();
            // Remix refreshes Story notifications on each main-loop frame.
            // Wait for the loaded Mining view to reach the same visible,
            // initialized state used by the Beyond browser interaction.
            await new Promise((resolve) => requestAnimationFrame(resolve));
            await window.app.$nextTick();
            randomDraws = 0;
            Object.defineProperty(window, "__idleMineDropDrawCount", {
              configurable: true,
              value: () => randomDraws,
            });
            Math.random = () => {
              const value = captureCase.dropRandomValues[randomDraws];
              if (value === undefined) {
                throw new Error("The pinned source drop RNG was exhausted.");
              }
              randomDraws += 1;
              return value;
            };
            const mineCanvas = document.querySelector(".mineobject canvas");
            if (!(mineCanvas instanceof HTMLCanvasElement)) {
              throw new Error("Pinned Remix Mining Canvas is missing.");
            }
            mineCanvas.click();
            await window.app.$nextTick();
            if (captureCase.afterDropTab) {
              game.settings.tab = captureCase.afterDropTab;
            }
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
            ...(captureCase.family === "shop-gate"
              ? {
                  planetCoinTabVisible:
                    document.querySelector(".upg-tabs button:nth-child(3)") !==
                    null,
                }
              : {}),
            ...(captureCase.family === "drops" ? { randomDraws } : {}),
          };
          return {
            state,
            controlledSave: captureCase.controlledPowersBoundary
              ? functions.getSaveString()
              : undefined,
          };
        },
        {
          captureCase: {
            ...capture,
            dropSaveData,
            dropRandomValues,
            shopGateSaveData,
            afterDropTab: capture.afterDropTab,
          },
          serializedSave: sourceSave,
        },
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
      if (capture.family === "shop-gate") {
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const layout = await page.evaluate(() =>
          ["header", ".upg-tabs", ".upgradelist", ".upgradelist .upgrade"].map(
            (selector) => {
              const element = document.querySelector(selector);
              if (!(element instanceof HTMLElement)) {
                throw new Error(`Pinned Remix layout is missing ${selector}.`);
              }
              const rect = element.getBoundingClientRect();
              return {
                selector,
                width: rect.width,
                height: rect.height,
                transform: getComputedStyle(element).transform,
              };
            },
          ),
        );
        if (layout.some(({ width, height }) => width <= 0 || height <= 0)) {
          throw new Error(`${capture.id} source layout did not settle.`);
        }
      }
      // The 90-object gate changes header/tab layout after a legacy save loads.
      // Require a settled source paint before comparing its exact PNG hash.
      const screenshot =
        capture.family === "shop-gate"
          ? await captureStableScreenshot(page, capture.id)
          : await page.screenshot({ fullPage: false });
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
        sourcePaths:
          capture.family === "drops"
            ? [
                "index.html",
                "main.css",
                "Scripts/Define/functions.js",
                "Scripts/mineobject.js",
                "Scripts/Components/mine-object.js",
                "Scripts/Components/powers-table.js",
              ]
            : capture.family === "shop-gate"
              ? ["index.html", "main.css"]
              : ["index.html", "main.css", "Scripts/Define/game.js"],
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
        controlledBoundary:
          capture.controlledPowersBoundary ??
          capture.controlledBoundary ??
          false,
        ...(capture.family === "shop-gate"
          ? { mineLevelBoundary: capture.mineObjectLevel }
          : {}),
        ...(capture.family === "drops"
          ? { dropCaseName: capture.dropCaseName }
          : {}),
        state: setup.state,
        screenshotSha256,
      };
      const outputImagePath = path.join(outputDirectory, `${capture.id}.png`);
      await writeFile(outputImagePath, screenshot);
      if (writeMode) {
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
      if (capture.family !== "drops") {
        generatedMetadata.push({
          id: capture.id,
          fixture: relativeToRoot(imagePath),
          state: setup.state,
          screenshotSha256,
        });
      }
      process.stdout.write(
        `${writeMode ? "Captured" : "Verified"} pinned Remix ${capture.id}: ${screenshotSha256}\n`,
      );
    }

    if (pageErrors.length) {
      throw new Error(`Pinned Remix runtime errors: ${pageErrors.join("; ")}`);
    }
    const generatedStates = {
      sourceCommit: reference.pinnedCommit,
      powers: powersState,
      // Keep the shared state fixture order independent from capture execution
      // order, which may group cases for efficient oracle setup. Gate views
      // retain their source-capture order: light then dark at each boundary.
      captures: [...generatedMetadata].sort(compareCaptureIds),
    };
    // The shared state list records the Windows screenshots; Linux checks
    // that it reached the same source states.
    if (shopGateOnly) {
      const stored = await readFile(stateFixturePath, "utf8").then(JSON.parse);
      const gateIds = new Set(generatedMetadata.map(({ id }) => id));
      if (writeMode && !platformSuffix) {
        const mergedCaptures = stored.captures.filter(
          ({ id }) => !gateIds.has(id),
        );
        const insertionIndex = mergedCaptures.findIndex(({ id }) =>
          id.startsWith("powers-"),
        );
        mergedCaptures.splice(
          insertionIndex < 0 ? mergedCaptures.length : insertionIndex,
          0,
          ...generatedMetadata,
        );
        await writeFile(
          stateFixturePath,
          await formatJson({ ...stored, captures: mergedCaptures }),
          "utf8",
        );
      } else if (!writeMode) {
        const expected = {
          captures: stored.captures.filter(({ id }) => gateIds.has(id)),
        };
        const actual = { captures: generatedMetadata };
        difference(
          platformSuffix ? platformNeutralStates(actual) : actual,
          platformSuffix ? platformNeutralStates(expected) : expected,
          "Planet Coin shop gate source states",
        );
      }
    } else if (!dropOnly && writeMode && !platformSuffix) {
      await writeFile(
        stateFixturePath,
        await formatJson(generatedStates),
        "utf8",
      );
    } else if (!dropOnly && (mode === "--check" || platformSuffix)) {
      const stored =
        priorStates ??
        (await readFile(stateFixturePath, "utf8").then(JSON.parse));
      if (platformSuffix) {
        const generatedIds = new Set(generatedMetadata.map(({ id }) => id));
        const platformStored = {
          ...stored,
          captures: stored.captures.filter(({ id }) => generatedIds.has(id)),
        };
        difference(
          platformNeutralStates(generatedStates),
          platformNeutralStates(platformStored),
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
