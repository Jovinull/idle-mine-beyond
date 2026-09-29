import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const referenceManifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const dependencyManifestPath = path.join(
  root,
  "docs/knowledge/sources/runtime-dependencies.json",
);
const fixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-reference-corpus.json",
);
const fixedClock = 1_704_067_200_000;
const randomSeed = 0x1d1e;
const postUniverseIds = [
  215,
  216,
  217,
  244,
  1_000,
  10_000,
  1_000_000,
  2_147_483_647,
  Number.MAX_SAFE_INTEGER,
];

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
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

async function verifySource(reference) {
  const checkout = path.resolve(root, reference.researchCheckout);
  const revision = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: checkout,
    windowsHide: true,
  });
  const status = await execFileAsync("git", ["status", "--porcelain"], {
    cwd: checkout,
    windowsHide: true,
  });
  if (
    revision.stdout.trim() !== reference.pinnedCommit ||
    status.stdout.trim()
  ) {
    throw new Error(
      `Canonical checkout must be clean at ${reference.pinnedCommit}; found ${revision.stdout.trim()}${status.stdout.trim() ? " and a dirty worktree" : ""}.`,
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
    const actualHash = sha256(contents);
    if (actualHash !== dependency.sha256) {
      throw new Error(
        `${dependency.name} snapshot hash ${actualHash} does not match the recorded ${dependency.sha256}. Run pnpm research:check and investigate; do not recapture automatically.`,
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

    let requestedPath;
    try {
      requestedPath = decodeURIComponent(
        new URL(request.url ?? "/", "http://reference.local").pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (requestedPath.split("/").includes(".git")) {
      response.writeHead(403).end();
      return;
    }
    if (requestedPath === "/") requestedPath = "/index.html";

    const absolutePath = path.resolve(sourceRoot, `.${requestedPath}`);
    const relativePath = path.relative(sourceRoot, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
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
        reject(new Error("The reference server did not bind a TCP port."));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}/index.html` });
    });
  });
}

async function capture(reference, dependencies, dependencySnapshots) {
  const sourceRoot = await verifySource(reference);
  const { server, url } = await startReadOnlyServer(sourceRoot);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...getChromiumLaunchOptions(),
    });
    const context = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    await context.addInitScript(
      ({ clock, seed }) => {
        const runtime = { clock, seed, randomCalls: 0, animationFrameCalls: 0 };
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => clock,
        });
        let randomState = seed >>> 0;
        Math.random = () => {
          runtime.randomCalls++;
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
        window.requestAnimationFrame = () => {
          runtime.animationFrameCalls++;
          return 0;
        };
        window.__idleMineProbe = runtime;
      },
      { clock: fixedClock, seed: randomSeed },
    );

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const contents = dependencySnapshots.get(route.request().url());
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
    if (pageErrors.length) {
      throw new Error(`Reference page errors: ${pageErrors.join("; ")}`);
    }

    const data = await page.evaluate(
      ({ selectedPostUniverseIds }) => {
        const game = window.game;
        const functions = window.functions;
        const Decimal = window.Decimal;
        const safeNumber = (value) => {
          if (Number.isNaN(value)) return "NaN";
          if (value === Infinity) return "Infinity";
          if (value === -Infinity) return "-Infinity";
          return value;
        };
        const normalizedDecimal = (value) => ({
          decimal: value.toString(),
          mantissa: safeNumber(value.mantissa),
          exponent: safeNumber(value.exponent),
        });
        const normalize = (value) => {
          if (value === null || value === undefined) return null;
          if (typeof value === "number") return safeNumber(value);
          if (typeof value === "string" || typeof value === "boolean") {
            return value;
          }
          if (
            typeof value === "object" &&
            typeof value.mantissa === "number" &&
            typeof value.exponent === "number" &&
            typeof value.toString === "function"
          ) {
            return normalizedDecimal(value);
          }
          if (Array.isArray(value)) return value.map(normalize);
          if (typeof value === "object") {
            return Object.fromEntries(
              Object.entries(value).map(([key, item]) => [
                key,
                normalize(item),
              ]),
            );
          }
          return String(value);
        };
        const snapshotObject = (id) => {
          const object = functions.getMineObject(id);
          return {
            id,
            name: object.name,
            hp: normalizedDecimal(object.hp),
            totalHp: normalizedDecimal(object.totalHp),
            defense: normalizedDecimal(object.def),
            value: normalizedDecimal(object.value),
            colors: [...object.colors],
            skin: object.skin,
            drops: normalize(object.drops),
          };
        };
        const snapshotUpgrade = (upgrade) => ({
          name: upgrade.name,
          description: upgrade.desc,
          resource: upgrade.resource,
          level: upgrade.level,
          maxLevel: normalize(upgrade.getMaxLevel()),
          currentPrice: normalize(upgrade.getPrice(upgrade.level)),
          currentEffect: normalize(upgrade.getEffect(upgrade.level)),
          nextPrice: normalize(upgrade.getPrice(upgrade.level + 1)),
          nextEffect: normalize(upgrade.getEffect(upgrade.level + 1)),
        });
        const snapshotUpgradeFamily = (family) =>
          Object.fromEntries(
            Object.entries(family).map(([key, upgrade]) => [
              key,
              snapshotUpgrade(upgrade),
            ]),
          );
        const decimalKeys = [
          "money",
          "highestMoney",
          "gems",
          "planetCoins",
          "maxPlanetCoins",
          "wisdom",
          "maxWisdom",
        ];
        const objectIds = [
          ...Array.from({ length: 215 }, (_, id) => id),
          ...selectedPostUniverseIds,
        ];
        const uniqueObjectIds = [...new Set(objectIds)].sort((a, b) => a - b);
        const originalFormatter = game.numberFormatter;
        const notationInputs = ["0", "999", "1000", "1e6", "1e12", "1e100"];
        const notationOutputs = [];
        for (const formatter of game.numberFormatters) {
          game.numberFormatter = formatter;
          notationOutputs.push({
            notation: formatter.name,
            values: notationInputs.map((input) => {
              try {
                return {
                  input,
                  output: functions.formatNumber(
                    new Decimal(input),
                    2,
                    new Decimal(1e12),
                    0,
                  ),
                };
              } catch (error) {
                return { input, error: String(error) };
              }
            }),
          });
        }
        game.numberFormatter = originalFormatter;

        const initialState = {
          clock: normalize(game.lastActive),
          timer: normalize(game.timer),
          resources: Object.fromEntries(
            decimalKeys.map((key) => [key, normalizedDecimal(game[key])]),
          ),
          progress: {
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            mineObjectCount: game.mineObjects.length,
            specialObjectCount: game.specialMineObjects.length,
            specialObjectIds: game.specialMineObjects.map(
              (entry) => entry.index,
            ),
          },
          pickaxe: normalize(game.pickaxe),
          pickStatus: game.pickStatus,
          usedGemsLevel: game.usedGemsLevel,
          settings: normalize(game.settings),
          numberFormatters: game.numberFormatters.map(
            (formatter) => formatter.name,
          ),
          selectedNumberFormatter: game.numberFormatter.name,
          upgrades: {
            money: snapshotUpgradeFamily(game.upgrades),
            gems: snapshotUpgradeFamily(game.gemUpgrades),
            planetCoins: snapshotUpgradeFamily(game.planetCoinUpgrades),
            powers: snapshotUpgradeFamily(game.powers.upgrades),
          },
          powers: {
            unlocked: game.powers.unlocked(),
            data: normalize(game.powers.data),
          },
          story: {
            page: game.story.page,
            highestUnlocked: game.story.highestUnlocked,
            notifications: game.story.notifications,
            longGoal1: normalizedDecimal(game.story.longGoal1),
            longGoal2: normalizedDecimal(game.story.longGoal2),
            chapterCount: game.story.chapters.length,
            milestoneCount: Object.keys(game.story.milestones).length,
          },
          messageLog: normalize(game.messageLog),
        };
        const current = game.currentMineObject;
        const rates = {
          pickaxeDamage: normalizedDecimal(game.pickaxe.getDamage()),
          activeDamage: normalizedDecimal(functions.getActiveDamage(current)),
          idleDamage: normalizedDecimal(functions.getIdleDamage(current)),
          idleDps: normalizedDecimal(functions.getIdleDPS()),
          moneyPerClick: normalizedDecimal(functions.getMPC()),
          moneyPerSecond: normalizedDecimal(functions.getMPS()),
          gemsPerSecond: normalizedDecimal(functions.getGPS()),
          planetCoinsPerSecond: normalizedDecimal(functions.getPCPS()),
        };
        return {
          initialState,
          initialRates: rates,
          notationOutputs,
          objects: uniqueObjectIds.map(snapshotObject),
          probeRuntime: normalize(window.__idleMineProbe),
          currentObjectHpAfterCapture: normalizedDecimal(current.hp),
        };
      },
      { selectedPostUniverseIds: postUniverseIds },
    );

    const clockSamples = await page.evaluate(() => ({
      lastActive: window.game.lastActive,
      requestAnimationFrameCalls: window.__idleMineProbe.animationFrameCalls,
      randomCalls: window.__idleMineProbe.randomCalls,
    }));
    if (clockSamples.lastActive !== fixedClock) {
      throw new Error("The controlled reference clock was not applied.");
    }
    if (data.initialState.progress.mineObjectLevel !== 0) {
      throw new Error(
        "Reference state did not initialize at mine object zero.",
      );
    }

    return {
      metadata: {
        capturedOn: new Date().toISOString().slice(0, 10),
        sourceCommit: reference.pinnedCommit,
        sourceUrl: reference.canonicalUrl,
        probeUrl: url,
        browserName: "Chromium",
        browserVersion: browser.version(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        viewport: { width: 1440, height: 900, colorScheme: "light" },
        locale: "en-US",
        timezone: "UTC",
        fixedClock,
        random: { algorithm: "LCG32", seed: randomSeed },
        requestAnimationFrame: "suppressed to capture the pre-tick state",
        dependencies: dependencies.dependencies.map((dependency) => ({
          package: dependency.package,
          version: dependency.version,
          sha256: dependency.sha256,
        })),
        sourcePaths: [
          "index.html",
          "Scripts/Define/game.js",
          "Scripts/Define/functions.js",
          "Scripts/mineobject.js",
          "Scripts/random.js",
          "Scripts/upgrade.js",
          "Scripts/main.js",
        ],
        licenseNotice:
          "MIT; Copyright (c) 2023 veprogames. See docs/knowledge/sources/licenses/idle-mine-remix-MIT.txt.",
      },
      data,
    };
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function main() {
  const mode = process.argv[2] ?? "verify";
  if (mode !== "capture" && mode !== "verify") {
    throw new Error(
      "Use `capture` to create the initial corpus or `verify` to compare it.",
    );
  }
  const references = JSON.parse(await readFile(referenceManifestPath, "utf8"));
  const reference = references.references.find(
    (item) => item.name === "Idle Mine: Remix",
  );
  const dependencies = JSON.parse(
    await readFile(dependencyManifestPath, "utf8"),
  );
  if (dependencies.sourceCommit !== reference.pinnedCommit) {
    throw new Error(
      "Runtime dependency snapshots refer to a different source pin.",
    );
  }
  const snapshots = await loadDependencySnapshots(dependencies);
  const result = await capture(reference, dependencies, snapshots);

  if (mode === "capture") {
    try {
      await readFile(fixturePath);
      throw new Error(
        "The reference corpus already exists. Preserve it and investigate before creating a reviewed replacement.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await writeFile(fixturePath, `${JSON.stringify(result, null, 2)}\n`, {
      flag: "wx",
    });
    process.stdout.write(
      `Captured ${result.data.objects.length} reference objects at ${result.metadata.sourceCommit} into ${path.relative(root, fixturePath)}.\n`,
    );
    return;
  }

  const expected = JSON.parse(await readFile(fixturePath, "utf8"));
  if (expected.metadata.sourceCommit !== reference.pinnedCommit) {
    throw new Error(
      "Fixture source revision differs from the pinned source manifest.",
    );
  }
  if (
    JSON.stringify(expected.metadata.dependencies) !==
    JSON.stringify(result.metadata.dependencies)
  ) {
    throw new Error(
      "Fixture runtime dependencies differ from the frozen snapshots.",
    );
  }
  if (JSON.stringify(expected.data) !== JSON.stringify(result.data)) {
    throw new Error(
      "Reference corpus mismatch. Investigate source, runtime, and probe inputs; do not overwrite the fixture to make verification pass.",
    );
  }
  process.stdout.write(
    `Verified ${expected.data.objects.length} reference objects against ${reference.pinnedCommit}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
