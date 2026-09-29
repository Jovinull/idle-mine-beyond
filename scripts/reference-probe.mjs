/* global Random, SKIN_LAYER_AMOUNTS, DICTIONARY_ENGLISH, POWER_MINING, Pickaxe, applyUpgrade -- pinned classic-script bindings */

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { format } from "prettier";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const renderJson = (value) =>
  format(JSON.stringify(value, null, 2), { parser: "json" });

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
const previewPath = path.join(
  root,
  ".research/outputs/remix-reference-preview.json",
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
          if (Object.is(value, -0)) return "-0";
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
          if (value instanceof Decimal) {
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
        const captureResult = (operation) => {
          try {
            return normalize(operation());
          } catch (error) {
            return { error: String(error) };
          }
        };
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

        const notationBoundaryInputs = [
          ...new Set([
            "0",
            "-1e-301",
            "1e-301",
            "1e-300",
            "1e-299",
            "0.999",
            "1",
            "9.999",
            "10",
            "999.49",
            "999.5",
            "999.999",
            "1000",
            "1000.001",
            "999999",
            "1000000",
            "999999999",
            "1000000000",
            "999999999999",
            "1e12",
            "1000000000001",
            "1e15",
            "1e18",
            "1e24",
            "1e27",
            "1e30",
            "1e33",
            "1e60",
            "1e100",
            "1e308",
            "1e309",
            "1e10000",
            ...Array.from({ length: 33 }, (_, index) => `1e${(index + 1) * 3}`),
            ...Array.from({ length: 11 }, (_, index) => `1e${10 + index * 9}`),
          ]),
        ];
        const wrapperInputs = [
          "999.49",
          "999.5",
          "999.99",
          "1000",
          "1000.01",
          "999999999999",
          "1e12",
          "1000000000001",
        ];
        const wrapperScenarios = [
          { name: "defaults", args: [] },
          { name: "precision-two", args: [2] },
          { name: "limit-1000", args: [2, new Decimal(1000), 0] },
          { name: "limit-1e12", args: [2, new Decimal(1e12), 0] },
        ];
        const exponentInputs = [
          99999, 100000, 100001, 999999999, 1000000000, 1000000001,
        ];
        const notationSemantics = {
          formatterRegistry: game.numberFormatters.map((formatter) => {
            const methodNames = new Set();
            for (
              let prototype = Object.getPrototypeOf(formatter);
              prototype && prototype !== Object.prototype;
              prototype = Object.getPrototypeOf(prototype)
            ) {
              for (const name of Object.getOwnPropertyNames(prototype)) {
                if (name !== "constructor") methodNames.add(name);
              }
            }
            return {
              name: formatter.name,
              constructorName: formatter.constructor.name,
              ownProperties: Object.keys(formatter).sort(),
              methods: [...methodNames].sort(),
            };
          }),
          directFormatterInputs: notationBoundaryInputs,
          directFormatterOutputs: game.numberFormatters.map((formatter) => {
            game.numberFormatter = formatter;
            return {
              notation: formatter.name,
              values: notationBoundaryInputs.map((input) => ({
                input,
                output: captureResult(() =>
                  formatter.format(new Decimal(input), 2, 0),
                ),
              })),
            };
          }),
          formatNumberInputs: wrapperInputs,
          formatNumberScenarios: game.numberFormatters.map((formatter) => {
            game.numberFormatter = formatter;
            return {
              notation: formatter.name,
              scenarios: wrapperScenarios.map((scenario) => ({
                name: scenario.name,
                values: wrapperInputs.map((input) => ({
                  input,
                  output: captureResult(() =>
                    functions.formatNumber(
                      new Decimal(input),
                      ...scenario.args,
                    ),
                  ),
                })),
              })),
            };
          }),
          formatThousands: game.numberFormatters.map((formatter) => {
            game.numberFormatter = formatter;
            return {
              notation: formatter.name,
              values: ["999999999999", "1e12", "1000000000001"].map(
                (input) => ({
                  input,
                  default: captureResult(() =>
                    functions.formatThousands(new Decimal(input)),
                  ),
                  precisionTwo: captureResult(() =>
                    functions.formatThousands(new Decimal(input), Infinity, 2),
                  ),
                }),
              ),
            };
          }),
          formatPercent: game.numberFormatters.map((formatter) => {
            game.numberFormatter = formatter;
            return {
              notation: formatter.name,
              values: ["0", "0.005", "-0.005", "1e10"].map((input) => ({
                input,
                output: captureResult(() =>
                  functions.formatPercent(new Decimal(input)),
                ),
              })),
            };
          }),
          exponentFormatterInputs: exponentInputs,
          exponentFormatterOutputs: game.numberFormatters
            .filter(
              (formatter) => typeof formatter.formatExponent === "function",
            )
            .map((formatter) => ({
              notation: formatter.name,
              values: exponentInputs.map((input) => ({
                input,
                output: captureResult(() => formatter.formatExponent(input)),
              })),
            })),
        };
        game.numberFormatter = originalFormatter;
        const decimalInputStrings = [
          "0",
          "-0",
          "1",
          "-1",
          "0.1",
          "-0.1",
          "1.2345678901234567",
          "1e-325",
          "1e-324",
          "5e-324",
          "1e-323",
          "1e-301",
          "1e-300",
          "1e-299",
          "1e308",
          "1e309",
          "1e10000",
          "-1e10000",
          "Infinity",
          "-Infinity",
          "NaN",
        ];
        const decimalInputs = decimalInputStrings.map((input) => {
          const value = new Decimal(input);
          return {
            input,
            value: normalizedDecimal(value),
            toNumber: safeNumber(value.toNumber()),
            json: captureResult(() => JSON.stringify(value)),
            wrappedJson: captureResult(() => JSON.stringify({ value })),
            jsonRoundTrip: captureResult(() => {
              const parsed = JSON.parse(JSON.stringify(value));
              return normalizedDecimal(new Decimal(parsed));
            }),
          };
        });
        const arithmeticPairs = [
          ["1e100", "1"],
          ["1e100", "1e100"],
          ["1e100", "-1e100"],
          ["1e-300", "1e300"],
          ["1", "0"],
          ["0", "0"],
          ["Infinity", "Infinity"],
          ["NaN", "1"],
        ];
        const arithmetic = arithmeticPairs.map(([leftInput, rightInput]) => {
          const left = new Decimal(leftInput);
          const right = new Decimal(rightInput);
          return {
            left: leftInput,
            right: rightInput,
            add: captureResult(() => left.add(right)),
            subtract: captureResult(() => left.sub(right)),
            multiply: captureResult(() => left.mul(right)),
            divide: captureResult(() => left.div(right)),
            compare: captureResult(() => left.cmp(right)),
            max: captureResult(() => left.max(right)),
            min: captureResult(() => left.min(right)),
          };
        });
        const roundingInputs = [
          "0.1",
          "0.5",
          "0.9",
          "1.5",
          "-0.1",
          "-0.5",
          "-0.9",
          "-1.5",
          "999.5",
          "-999.5",
          "1e-300",
          "-1e-300",
          "1e100",
        ];
        const rounding = roundingInputs.map((input) => {
          const value = new Decimal(input);
          return {
            input,
            floor: captureResult(() => Decimal.floor(value)),
            ceil: captureResult(() => Decimal.ceil(value)),
            round: captureResult(() => Decimal.round(value)),
            trunc: captureResult(() => Decimal.trunc(value)),
            toFixed0: captureResult(() => value.toFixed(0)),
            toFixed2: captureResult(() => value.toFixed(2)),
          };
        });
        const powers = [
          ["2", "10"],
          ["10", "0.5"],
          ["10", "-1"],
          ["0", "-1"],
          ["-2", "0.5"],
          ["-2", "3"],
          ["1e100", "2"],
        ].map(([baseInput, exponentInput]) => ({
          base: baseInput,
          exponent: exponentInput,
          result: captureResult(() =>
            new Decimal(baseInput).pow(new Decimal(exponentInput)),
          ),
        }));
        const logarithms = [
          "0",
          "-1",
          "0.1",
          "1",
          "1e100",
          "Infinity",
          "NaN",
        ].map((input) => {
          const value = new Decimal(input);
          return {
            input,
            log10: captureResult(() => value.log10()),
            log2: captureResult(() => value.log2()),
            naturalLog: captureResult(() => value.ln()),
            logBase10: captureResult(() => value.log(10)),
          };
        });
        const decimalSemantics = {
          constants: {
            maxValue: normalizedDecimal(Decimal.MAX_VALUE),
            minValue: normalizedDecimal(Decimal.MIN_VALUE),
            numberMaxValue: normalizedDecimal(Decimal.NUMBER_MAX_VALUE),
            numberMinValue: normalizedDecimal(Decimal.NUMBER_MIN_VALUE),
          },
          inputs: decimalInputs,
          arithmetic,
          rounding,
          powers,
          logarithms,
        };

        const randomSemantics = [
          -1,
          0,
          1,
          2,
          71,
          89,
          90,
          114,
          115,
          169,
          214,
          215,
          216,
          1000000,
          Number.MAX_SAFE_INTEGER,
        ].map((seed) => {
          const random = new Random(seed);
          const afterWarmup = {
            generation: random.generation,
            value: random.n,
          };
          const draws = [];
          const integerBounds = [undefined, 2, 6, 10000];
          for (let index = 0; index < 16; index++) {
            if (index % 2 === 0) {
              draws.push({ type: "double", value: random.nextDouble() });
            } else {
              const bound =
                integerBounds[Math.floor(index / 2) % integerBounds.length];
              draws.push(
                bound === undefined
                  ? { type: "integer-default", value: random.nextInt() }
                  : { type: "integer", bound, value: random.nextInt(bound) },
              );
            }
          }
          return {
            seed,
            afterWarmup,
            draws,
            finalState: { generation: random.generation, value: random.n },
          };
        });
        const randomSequenceExhaustion = (() => {
          const random = new Random(0);
          const values = [];
          for (let index = 0; index < 41; index++) {
            const value = random.nextDouble();
            values.push(Number.isNaN(value) ? "NaN" : value);
          }
          return {
            seed: 0,
            warmupDraws: 10,
            sequenceLength: Random.SEQ.length,
            values,
            firstNaNIndex: values.findIndex((value) => value === "NaN"),
          };
        })();

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
        const mineObjectCatalog = {
          base: game.mineObjects.map((_, id) => snapshotObject(id)),
          special: game.specialMineObjects.map(({ index }) =>
            snapshotObject(index),
          ),
          skinLayerAmounts: [...SKIN_LAYER_AMOUNTS],
          dictionaryEnglish: [...DICTIONARY_ENGLISH],
        };
        const formulaSemantics = (() => {
          const upgradeGroups = {
            money: game.upgrades,
            gems: game.gemUpgrades,
            planetCoins: game.planetCoinUpgrades,
            wisdom: game.powers.upgrades,
          };
          const upgradeKeys = {
            money: ["activePower", "idlePower", "idleSpeed", "gemChance"],
            gems: ["idlePower", "gemChance", "gemMultiply"],
            planetCoins: ["activePower", "gemChance", "lastObjGems"],
            wisdom: ["damageBoost", "damageBoostUpgrades"],
          };
          const previousLevels = Object.fromEntries(
            Object.entries(upgradeKeys).map(([group, keys]) => [
              group,
              Object.fromEntries(
                keys.map((key) => [key, upgradeGroups[group][key].level]),
              ),
            ]),
          );
          const previousState = {
            pickaxe: game.pickaxe,
            currentMineObject: game.currentMineObject,
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            miningPower: game.powers.data.values[POWER_MINING],
          };
          const scenarios = [
            {
              name: "initial-mud",
              objectId: 0,
              pickaxe: { power: "20", quality: "1" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "last-damageable-object",
              objectId: 1,
              pickaxe: { power: "20", quality: "1" },
              miningPower: "1",
              upgrades: { planetCoins: { lastObjGems: 3 } },
            },
            {
              name: "upgraded-planet-coin-asteroid",
              objectId: 90,
              pickaxe: { power: "1e43", quality: "1.25" },
              miningPower: "2.5",
              upgrades: {
                money: {
                  activePower: 3,
                  idlePower: 4,
                  idleSpeed: 5,
                  gemChance: 6,
                },
                gems: { idlePower: 2, gemChance: 3, gemMultiply: 4 },
                planetCoins: { activePower: 2, gemChance: 1, lastObjGems: 3 },
                wisdom: { damageBoost: 3, damageBoostUpgrades: 2 },
              },
            },
            {
              name: "zero-damage-universe",
              objectId: 214,
              pickaxe: { power: "1", quality: "0.5" },
              miningPower: "1",
              upgrades: {},
            },
          ];

          try {
            return {
              sourcePaths: [
                "Scripts/Define/functions.js",
                "Scripts/Define/game.js",
                "Scripts/upgrade.js",
                "Scripts/pickaxe.js",
                "Scripts/main.js",
              ],
              scenarios: scenarios.map((scenario) => {
                for (const [group, keys] of Object.entries(upgradeKeys)) {
                  for (const key of keys) {
                    upgradeGroups[group][key].level =
                      scenario.upgrades[group]?.[key] ?? 0;
                  }
                }
                game.pickaxe = new Pickaxe(
                  "Reference formula probe",
                  scenario.pickaxe.power,
                  scenario.pickaxe.quality,
                );
                game.powers.data.values[POWER_MINING] = new Decimal(
                  scenario.miningPower,
                );
                game.mineObjectLevel = scenario.objectId;
                game.highestMineObjectLevel = scenario.objectId;
                game.currentMineObject = functions.getMineObject(
                  scenario.objectId,
                );

                const highestDamageableObjectLevel =
                  functions.getHighestDamageableMineObjectLevel();
                const isHighestDamageableObject =
                  scenario.objectId === highestDamageableObjectLevel;
                const effects = {
                  activePower: normalizedDecimal(
                    applyUpgrade(game.upgrades.activePower),
                  ),
                  idlePower: normalizedDecimal(
                    applyUpgrade(game.upgrades.idlePower),
                  ),
                  idleSpeed: normalizedDecimal(
                    applyUpgrade(game.upgrades.idleSpeed),
                  ),
                  miningPower: normalizedDecimal(
                    game.powers.data.values[POWER_MINING],
                  ),
                  idleDamageBoost: normalizedDecimal(
                    applyUpgrade(game.powers.upgrades.damageBoost),
                  ),
                  damageUpgradeBoost: normalizedDecimal(
                    applyUpgrade(game.powers.upgrades.damageBoostUpgrades),
                  ),
                  planetCoinActivePower: normalizedDecimal(
                    applyUpgrade(game.planetCoinUpgrades.activePower),
                  ),
                  gemChance: normalizedDecimal(
                    applyUpgrade(game.upgrades.gemChance),
                  ),
                  gemMultiplier: normalizedDecimal(
                    applyUpgrade(game.gemUpgrades.gemMultiply),
                  ),
                  lastObjectGemMultiplier: normalizedDecimal(
                    isHighestDamageableObject
                      ? applyUpgrade(game.planetCoinUpgrades.lastObjGems)
                      : new Decimal(1),
                  ),
                };
                const result = {
                  pickaxeDamage: normalizedDecimal(game.pickaxe.getDamage()),
                  activeDamage: normalizedDecimal(functions.getActiveDamage()),
                  idleDamage: normalizedDecimal(functions.getIdleDamage()),
                  idleDps: normalizedDecimal(functions.getIdleDPS()),
                  moneyPerClick: normalizedDecimal(functions.getMPC()),
                  moneyPerSecond: normalizedDecimal(functions.getMPS()),
                  gemsPerSecond: normalizedDecimal(functions.getGPS()),
                  planetCoinsPerSecond: normalizedDecimal(functions.getPCPS()),
                  highestDamageableObjectLevel,
                };
                return {
                  input: scenario,
                  effects,
                  object: snapshotObject(scenario.objectId),
                  result,
                };
              }),
              currentObjectArgumentQuirk: (() => {
                const scenario = scenarios[1];
                for (const [group, keys] of Object.entries(upgradeKeys)) {
                  for (const key of keys) {
                    upgradeGroups[group][key].level =
                      scenario.upgrades[group]?.[key] ?? 0;
                  }
                }
                game.pickaxe = new Pickaxe(
                  "Reference formula probe",
                  scenario.pickaxe.power,
                  scenario.pickaxe.quality,
                );
                game.powers.data.values[POWER_MINING] = new Decimal(
                  scenario.miningPower,
                );
                game.mineObjectLevel = scenario.objectId;
                game.highestMineObjectLevel = scenario.objectId;
                game.currentMineObject = functions.getMineObject(
                  scenario.objectId,
                );
                const target = functions.getMineObject(118);
                return {
                  currentObjectId: scenario.objectId,
                  explicitTargetId: 118,
                  activeDamage: normalizedDecimal(
                    functions.getActiveDamage(target),
                  ),
                  idleDamageAtCurrentObject: normalizedDecimal(
                    functions.getIdleDamage(),
                  ),
                  idleDpsWhenPassedTarget: normalizedDecimal(
                    functions.getIdleDPS(target),
                  ),
                };
              })(),
            };
          } finally {
            game.pickaxe = previousState.pickaxe;
            game.currentMineObject = previousState.currentMineObject;
            game.mineObjectLevel = previousState.mineObjectLevel;
            game.highestMineObjectLevel = previousState.highestMineObjectLevel;
            game.powers.data.values[POWER_MINING] = previousState.miningPower;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        return {
          initialState,
          initialRates: rates,
          notationOutputs,
          notationSemantics,
          decimalSemantics,
          randomSemantics,
          randomSequenceExhaustion,
          mineObjectCatalog,
          formulaSemantics,
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
  if (
    mode !== "capture" &&
    mode !== "extend" &&
    mode !== "update" &&
    mode !== "verify" &&
    mode !== "preview"
  ) {
    throw new Error(
      "Use `capture` for the initial corpus, `extend` to add fields, `update <field>` to replace one reviewed field, `preview` for a disposable capture, or `verify` to compare the fixture.",
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

  if (mode === "preview") {
    await mkdir(path.dirname(previewPath), { recursive: true });
    await writeFile(previewPath, await renderJson(result));
    process.stdout.write(
      `Captured a disposable reference preview at ${path.relative(root, previewPath)}.\n`,
    );
    return;
  }

  if (mode === "capture") {
    try {
      await readFile(fixturePath);
      throw new Error(
        "The reference corpus already exists. Preserve it and investigate before creating a reviewed replacement.",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    await writeFile(fixturePath, await renderJson(result), {
      flag: "wx",
    });
    process.stdout.write(
      `Captured ${result.data.objects.length} reference objects at ${result.metadata.sourceCommit} into ${path.relative(root, fixturePath)}.\n`,
    );
    return;
  }

  if (mode === "extend") {
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

    for (const [key, value] of Object.entries(expected.data)) {
      if (
        !(key in result.data) ||
        JSON.stringify(value) !== JSON.stringify(result.data[key])
      ) {
        throw new Error(
          `Existing fixture field ${key} changed. Preserve it and investigate instead of extending the corpus.`,
        );
      }
    }

    const newFields = Object.fromEntries(
      Object.entries(result.data).filter(([key]) => !(key in expected.data)),
    );
    const addedFieldNames = Object.keys(newFields);
    if (addedFieldNames.length === 0) {
      throw new Error("No new reference fields are available to extend.");
    }

    const extended = {
      ...expected,
      data: { ...expected.data, ...newFields },
    };
    await writeFile(fixturePath, await renderJson(extended));
    process.stdout.write(
      `Extended the reference corpus with: ${addedFieldNames.join(", ")}.\n`,
    );
    return;
  }

  if (mode === "update") {
    const field = process.argv[3];
    if (!field) throw new Error("Name the one fixture field to update.");
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
    if (!(field in expected.data) || !(field in result.data)) {
      throw new Error(
        `Fixture field ${field} does not exist in both captures.`,
      );
    }
    for (const [key, value] of Object.entries(expected.data)) {
      if (
        key !== field &&
        JSON.stringify(value) !== JSON.stringify(result.data[key])
      ) {
        throw new Error(
          `Unselected fixture field ${key} changed. Update exactly one reviewed field at a time.`,
        );
      }
    }
    if (
      JSON.stringify(expected.data[field]) ===
      JSON.stringify(result.data[field])
    ) {
      throw new Error(`Fixture field ${field} already matches the capture.`);
    }

    const updated = {
      ...expected,
      data: { ...expected.data, [field]: result.data[field] },
    };
    await writeFile(fixturePath, await renderJson(updated));
    process.stdout.write(`Updated only reference field ${field}.\n`);
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
  const expectedFields = Object.keys(expected.data);
  const actualFields = Object.keys(result.data);
  if (
    expectedFields.length !== actualFields.length ||
    expectedFields.some((key) => !actualFields.includes(key))
  ) {
    throw new Error(
      "Reference corpus fields differ. Investigate source and probe inputs; do not overwrite the fixture to make verification pass.",
    );
  }
  for (const key of expectedFields) {
    if (
      JSON.stringify(expected.data[key]) !== JSON.stringify(result.data[key])
    ) {
      throw new Error(
        `Reference corpus mismatch in ${key}. Investigate source, runtime, and probe inputs; do not overwrite the fixture to make verification pass.`,
      );
    }
  }
  process.stdout.write(
    `Verified the reference corpus against ${reference.pinnedCommit} (${expected.data.objects.length} objects; ${expected.data.decimalSemantics?.inputs.length ?? 0} Decimal inputs; ${expected.data.notationSemantics?.formatterRegistry.length ?? 0} formatters × ${expected.data.notationSemantics?.directFormatterInputs.length ?? 0} boundary values).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
