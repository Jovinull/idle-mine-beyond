/* global Random, SKIN_LAYER_AMOUNTS, DICTIONARY_ENGLISH, POWER_MINING, POWER_EXQUISITY, POWER_WISDOM, Pickaxe, Vue, applyUpgrade -- pinned classic-script bindings */

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
      async ({ selectedPostUniverseIds, fixedClock }) => {
        const game = window.game;
        const functions = window.functions;
        const app = window.app;
        const Decimal = window.Decimal;
        const freshLegacySave = (() => {
          const json = JSON.stringify(game);
          return {
            object: JSON.parse(json),
            encoded: functions.getSaveString(),
            json,
          };
        })();
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
          minimumCraftDamage: normalizedDecimal(functions.getMinCraftDamage()),
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
        const powersTableSemantics = (() => {
          const previousHighestMineObjectLevel = game.highestMineObjectLevel;
          const previousPowerValues = [...game.powers.data.values];
          const previousPowerResetKeepLevel =
            game.powers.upgrades.powerResetKeep.level;
          const componentMethods =
            Vue.component("powers-table").options.methods;
          const makeValues = (values) =>
            values.map((value) => new Decimal(value));
          const getEffect = (values, index) => {
            const context = { pow: { values } };
            return componentMethods.getPrestigeEffect.call(context, index);
          };
          const snapshotRows = (values) =>
            values.map((current, index) => {
              const next = values[index + 1];
              if (next === undefined) {
                return {
                  index,
                  name: game.powers.data.names[index],
                  current: normalizedDecimal(current),
                  next: null,
                  prestigeEffect: null,
                  cell: null,
                };
              }
              const effect = getEffect(values, index);
              const isVisible =
                current.gte(1e3) || (index < values.length - 1 && next.gt(1));
              return {
                index,
                name: game.powers.data.names[index],
                current: normalizedDecimal(current),
                next: normalizedDecimal(next),
                prestigeEffect: normalizedDecimal(effect),
                cell: {
                  visible: isVisible,
                  disabled: isVisible && next.gte(effect),
                  text: isVisible
                    ? `Prestige: x${functions.formatNumber(effect, 2, 1e9, 2)}`
                    : `Req. x${functions.formatNumber(1e3)}`,
                },
              };
            });
          const scenarios = [
            {
              name: "fresh-power-table",
              powerResetKeepLevel: 0,
              values: ["1", "1", "1", "1", "1"],
            },
            {
              name: "active-power-prestige-effect",
              powerResetKeepLevel: 4,
              values: ["1e6", "1", "1", "1", "1"],
            },
            {
              name: "craftsmanship-prestige-effect",
              powerResetKeepLevel: 4,
              values: ["1", "1e6", "1", "1", "1"],
            },
            {
              name: "expertise-prestige-effect",
              powerResetKeepLevel: 4,
              values: ["1", "1", "1e6", "1", "1"],
            },
            {
              name: "wisdom-prestige-effect-is-logarithmic",
              powerResetKeepLevel: 4,
              values: ["1", "1", "1", "1e6", "1"],
            },
            {
              name: "button-shows-from-next-power-above-one",
              powerResetKeepLevel: 0,
              values: ["100", "2", "1", "1", "1"],
            },
            {
              name: "button-is-disabled-when-next-power-meets-effect",
              powerResetKeepLevel: 0,
              values: ["1e6", "40", "1", "1", "1"],
            },
          ].map((scenario) => {
            game.powers.upgrades.powerResetKeep.level =
              scenario.powerResetKeepLevel;
            const rows = snapshotRows(makeValues(scenario.values));
            return {
              name: scenario.name,
              input: {
                powerResetKeepLevel: scenario.powerResetKeepLevel,
                values: scenario.values,
              },
              rows,
            };
          });
          const prestiges = [
            {
              name: "active-power-retains-source-exponent",
              index: 0,
              powerResetKeepLevel: 4,
              values: ["1e6", "1", "1", "1", "1"],
            },
            {
              name: "craftsmanship-power-advances-expertise",
              index: 1,
              powerResetKeepLevel: 4,
              values: ["1", "1e6", "1", "1", "1"],
            },
            {
              name: "expertise-power-advances-wisdom",
              index: 2,
              powerResetKeepLevel: 4,
              values: ["1", "1", "1e6", "1", "1"],
            },
            {
              name: "wisdom-prestige-uses-logarithmic-target",
              index: 3,
              powerResetKeepLevel: 4,
              values: ["1", "1", "1", "1e6", "1"],
            },
            {
              name: "already-met-next-power-is-unchanged",
              index: 0,
              powerResetKeepLevel: 4,
              values: ["1e6", "40", "1", "1", "1"],
            },
          ].map((scenario) => {
            game.powers.upgrades.powerResetKeep.level =
              scenario.powerResetKeepLevel;
            const values = makeValues(scenario.values);
            const before = values.map(normalizedDecimal);
            const context = { pow: { values } };
            context.getPrestigeEffect = (index) =>
              componentMethods.getPrestigeEffect.call(context, index);
            componentMethods.prestigePower.call(context, scenario.index);
            return {
              name: scenario.name,
              input: {
                index: scenario.index,
                powerResetKeepLevel: scenario.powerResetKeepLevel,
                values: scenario.values,
              },
              before,
              after: values.map(normalizedDecimal),
            };
          });

          const unlock = [169, 170, 171].map((level) => {
            game.highestMineObjectLevel = level;
            return {
              highestMineObjectLevel: level,
              unlocked: game.powers.unlocked(),
            };
          });

          game.highestMineObjectLevel = previousHighestMineObjectLevel;
          game.powers.data.values = previousPowerValues;
          game.powers.upgrades.powerResetKeep.level =
            previousPowerResetKeepLevel;

          return {
            names: [...game.powers.data.names],
            icons: [...game.powers.data.icons],
            unlock,
            scenarios,
            prestiges,
          };
        })();
        const storySemantics = (() => {
          const milestoneEntries = Object.entries(game.story.milestones);
          const wisdomUpgradeEntries = Object.entries(game.powers.upgrades);
          const originalState = {
            highestMineObjectLevel: game.highestMineObjectLevel,
            highestMoney: game.highestMoney,
            maxPlanetCoins: game.maxPlanetCoins,
            page: game.story.page,
            highestUnlocked: game.story.highestUnlocked,
            notifications: game.story.notifications,
            blacksmithLevel: game.upgrades.blacksmith.level,
            gemWasterLevel: game.upgrades.gemWaster.level,
            wisdomUpgradeLevels: wisdomUpgradeEntries.map(
              ([, upgrade]) => upgrade.level,
            ),
          };
          const scenarioInputs = [
            {
              name: "fresh-state-refreshes-game-start",
              highestMineObjectLevel: 0,
              highestMoney: "0",
              maxPlanetCoins: "0",
              blacksmithLevel: 0,
              gemWasterLevel: 0,
              boughtWisdomUpgrades: 0,
              page: 0,
              highestUnlocked: -1,
              notifications: 0,
            },
            {
              name: "independent-early-milestones-skip-unsatisfied-gap",
              highestMineObjectLevel: 1,
              highestMoney: "0",
              maxPlanetCoins: "0",
              blacksmithLevel: 1,
              gemWasterLevel: 0,
              boughtWisdomUpgrades: 0,
              page: 0,
              highestUnlocked: -1,
              notifications: 0,
            },
            {
              name: "independent-resource-milestones-skip-progression-gap",
              highestMineObjectLevel: 0,
              highestMoney: "1000000",
              maxPlanetCoins: "1",
              blacksmithLevel: 0,
              gemWasterLevel: 0,
              boughtWisdomUpgrades: 0,
              page: 0,
              highestUnlocked: -1,
              notifications: 0,
            },
            {
              name: "saved-high-water-only-scans-later-indices",
              highestMineObjectLevel: 0,
              highestMoney: "1000000",
              maxPlanetCoins: "0",
              blacksmithLevel: 0,
              gemWasterLevel: 0,
              boughtWisdomUpgrades: 0,
              page: 0,
              highestUnlocked: 7,
              notifications: 5,
            },
            {
              name: "later-visible-condition-is-skipped-by-saved-high-water",
              highestMineObjectLevel: 1,
              highestMoney: "0",
              maxPlanetCoins: "0",
              blacksmithLevel: 0,
              gemWasterLevel: 0,
              boughtWisdomUpgrades: 0,
              page: 0,
              highestUnlocked: 28,
              notifications: 4,
            },
            {
              name: "all-current-milestone-requirements-satisfied",
              highestMineObjectLevel: 215,
              highestMoney: "50000000000000",
              maxPlanetCoins: "1",
              blacksmithLevel: 1,
              gemWasterLevel: 1,
              boughtWisdomUpgrades: 1,
              page: 8,
              highestUnlocked: -1,
              notifications: 0,
            },
          ];

          const setStoryInputs = (input) => {
            game.highestMineObjectLevel = input.highestMineObjectLevel;
            game.highestMoney = new Decimal(input.highestMoney);
            game.maxPlanetCoins = new Decimal(input.maxPlanetCoins);
            game.upgrades.blacksmith.level = input.blacksmithLevel;
            game.upgrades.gemWaster.level = input.gemWasterLevel;
            for (const [, upgrade] of wisdomUpgradeEntries) {
              upgrade.level = 0;
            }
            if (wisdomUpgradeEntries[0]) {
              wisdomUpgradeEntries[0][1].level = input.boughtWisdomUpgrades;
            }
          };
          const boundaryInputsFor = (condition) => {
            const match = condition.match(
              /^game\.highestMineObjectLevel >= (\d+)$/,
            );
            if (match) {
              const level = Number(match[1]);
              return [
                { name: "below", highestMineObjectLevel: level - 1 },
                { name: "equal", highestMineObjectLevel: level },
                { name: "above", highestMineObjectLevel: level + 1 },
              ];
            }
            const moneyMatch = condition.match(
              /^game\.highestMoney\.gte\(([^)]+)\)$/,
            );
            if (moneyMatch) {
              const amount = Number(moneyMatch[1]);
              return [
                { name: "below", highestMoney: String(amount - 1) },
                { name: "equal", highestMoney: String(amount) },
                { name: "above", highestMoney: String(amount + 1) },
              ];
            }
            if (condition === "game.maxPlanetCoins.gt(0)") {
              return [
                { name: "equal", maxPlanetCoins: "0" },
                { name: "above", maxPlanetCoins: "1" },
              ];
            }
            if (
              condition === "game.upgrades.blacksmith.level > 0" ||
              condition === "game.upgrades.gemWaster.level >= 1"
            ) {
              return [
                {
                  name: "zero",
                  blacksmithLevel: 0,
                  gemWasterLevel: 0,
                },
                {
                  name: "one",
                  blacksmithLevel: 1,
                  gemWasterLevel: 1,
                },
              ];
            }
            if (
              condition ===
              "functions.getBoughtUpgrades(game.powers.upgrades) >= 1"
            ) {
              return [
                { name: "zero", boughtWisdomUpgrades: 0 },
                { name: "one", boughtWisdomUpgrades: 1 },
              ];
            }
            if (condition === "true") return [{ name: "always" }];
            throw new Error(`No story boundary probe for: ${condition}`);
          };
          try {
            const conditionBoundaries = [
              ...new Set(milestoneEntries.map(([, [condition]]) => condition)),
            ].map((condition) => {
              const key = milestoneEntries.find(
                ([, [candidate]]) => candidate === condition,
              )?.[0];
              if (!key) throw new Error(`No milestone found for ${condition}`);

              return {
                condition,
                key,
                samples: boundaryInputsFor(condition).map((boundary) => {
                  const input = {
                    highestMineObjectLevel: 0,
                    highestMoney: "0",
                    maxPlanetCoins: "0",
                    blacksmithLevel: 0,
                    gemWasterLevel: 0,
                    boughtWisdomUpgrades: 0,
                    ...boundary,
                  };
                  setStoryInputs(input);
                  return {
                    name: boundary.name,
                    input,
                    unlocked: functions.storyUnlocked(key),
                  };
                }),
              };
            });
            const objectiveSamples = (() => {
              const originalLevel = game.highestMineObjectLevel;
              const originalFormatter = game.numberFormatter;
              const functionObjectives = milestoneEntries.filter(
                ([, [, objective]]) => typeof objective === "function",
              );
              const objectiveForKey = (key) => game.story.milestones[key]?.[1];
              try {
                const mineLevels = [0, 12, 214, 215].map(
                  (highestMineObjectLevel) => {
                    game.highestMineObjectLevel = highestMineObjectLevel;
                    return {
                      highestMineObjectLevel,
                      values: functionObjectives.map(([key]) => ({
                        key,
                        output: captureResult(() => objectiveForKey(key)()),
                      })),
                    };
                  },
                );
                const notationFormats = game.numberFormatters.map(
                  (formatter) => {
                    game.numberFormatter = formatter;
                    return {
                      notation: formatter.name,
                      values: ["millionaire", "fiftyTrillion"].map((key) => ({
                        key,
                        output: captureResult(() => objectiveForKey(key)()),
                      })),
                    };
                  },
                );
                return {
                  functionObjectiveCount: functionObjectives.length,
                  mineLevels,
                  notationFormats,
                };
              } finally {
                game.highestMineObjectLevel = originalLevel;
                game.numberFormatter = originalFormatter;
              }
            })();

            const inspectScenario = (scenario) => {
              setStoryInputs(scenario);
              game.story.highestUnlocked = scenario.highestUnlocked;
              game.story.notifications = scenario.notifications;

              const conditionResults = milestoneEntries.map(([key]) => ({
                key,
                unlocked: functions.storyUnlocked(key),
              }));
              const visibleMilestonesByPage = Object.fromEntries(
                game.story.chapters.map((_, page) => {
                  game.story.page = page;
                  return [
                    page,
                    milestoneEntries
                      .filter(([key]) => functions.storyDisplayed(key))
                      .map(([key]) => key),
                  ];
                }),
              );
              game.story.page = originalState.page;
              game.story.page = scenario.page;
              functions.increaseStoryPage();
              const afterIncrease = game.story.page;
              game.story.page = scenario.page;
              functions.decreaseStoryPage();
              const afterDecrease = game.story.page;
              game.story.page = originalState.page;
              const result = {
                name: scenario.name,
                input: { ...scenario },
                conditionResults,
                maxPage: functions.getMaxStoryPage(),
                pageNavigation: {
                  page: scenario.page,
                  afterIncrease,
                  afterDecrease,
                },
                visibleMilestonesByPage,
                nextObjective: functions.getNextStoryText(),
                before: {
                  highestUnlocked: game.story.highestUnlocked,
                  notifications: game.story.notifications,
                },
              };
              functions.refreshStoryNotifications();
              result.after = {
                highestUnlocked: game.story.highestUnlocked,
                notifications: game.story.notifications,
              };
              return result;
            };
            const notificationSequence = (() => {
              const savedStory = {
                page: game.story.page,
                highestUnlocked: game.story.highestUnlocked,
                notifications: game.story.notifications,
              };
              const captureStage = (name, input) => {
                setStoryInputs(input);
                game.story.page = input.page;
                const before = {
                  highestUnlocked: game.story.highestUnlocked,
                  notifications: game.story.notifications,
                };
                const firstMudUnlocked = functions.storyUnlocked("firstMud");
                const firstMudDisplayed = functions.storyDisplayed("firstMud");
                functions.refreshStoryNotifications();
                return {
                  name,
                  input,
                  before,
                  firstMudUnlocked,
                  firstMudDisplayed,
                  after: {
                    highestUnlocked: game.story.highestUnlocked,
                    notifications: game.story.notifications,
                  },
                };
              };
              try {
                game.story.highestUnlocked = -1;
                game.story.notifications = 0;
                const first = captureStage(
                  "planet-coin-unlocks-ahead-of-first-mud",
                  {
                    highestMineObjectLevel: 0,
                    highestMoney: "0",
                    maxPlanetCoins: "1",
                    blacksmithLevel: 0,
                    gemWasterLevel: 0,
                    boughtWisdomUpgrades: 0,
                    page: 0,
                  },
                );
                const second = captureStage(
                  "first-mud-becomes-visible-after-high-water-passes-it",
                  {
                    highestMineObjectLevel: 1,
                    highestMoney: "0",
                    maxPlanetCoins: "1",
                    blacksmithLevel: 0,
                    gemWasterLevel: 0,
                    boughtWisdomUpgrades: 0,
                    page: 0,
                  },
                );
                return [first, second];
              } finally {
                game.story.page = savedStory.page;
                game.story.highestUnlocked = savedStory.highestUnlocked;
                game.story.notifications = savedStory.notifications;
                game.highestMineObjectLevel =
                  originalState.highestMineObjectLevel;
                game.highestMoney = originalState.highestMoney;
                game.maxPlanetCoins = originalState.maxPlanetCoins;
                game.upgrades.blacksmith.level = originalState.blacksmithLevel;
                game.upgrades.gemWaster.level = originalState.gemWasterLevel;
                wisdomUpgradeEntries.forEach(([, upgrade], index) => {
                  upgrade.level = originalState.wisdomUpgradeLevels[index];
                });
              }
            })();

            game.highestMineObjectLevel = originalState.highestMineObjectLevel;
            game.highestMoney = originalState.highestMoney;
            game.maxPlanetCoins = originalState.maxPlanetCoins;
            game.upgrades.blacksmith.level = originalState.blacksmithLevel;
            game.upgrades.gemWaster.level = originalState.gemWasterLevel;
            wisdomUpgradeEntries.forEach(([, upgrade], index) => {
              upgrade.level = originalState.wisdomUpgradeLevels[index];
            });

            return {
              sourcePaths: [
                "Scripts/Define/game.js",
                "Scripts/Define/functions.js",
                "index.html",
              ],
              chapters: [...game.story.chapters],
              milestones: milestoneEntries.map(
                ([key, [condition, objective, page]], index) => ({
                  index,
                  key,
                  condition,
                  objective:
                    typeof objective === "function"
                      ? {
                          kind: "function",
                          source: objective.toString(),
                          initialOutput: captureResult(() => objective()),
                        }
                      : { kind: "literal", value: objective },
                  page,
                }),
              ),
              conditionBoundaries,
              objectiveSamples,
              initial: {
                page: originalState.page,
                highestUnlocked: originalState.highestUnlocked,
                notifications: originalState.notifications,
                nextObjective: functions.getNextStoryText(),
                maxPage: functions.getMaxStoryPage(),
                visibleMilestones: milestoneEntries
                  .filter(([key]) => functions.storyDisplayed(key))
                  .map(([key]) => key),
              },
              notificationScenarios: scenarioInputs.map(inspectScenario),
              notificationSequence,
            };
          } finally {
            game.highestMineObjectLevel = originalState.highestMineObjectLevel;
            game.highestMoney = originalState.highestMoney;
            game.maxPlanetCoins = originalState.maxPlanetCoins;
            game.story.page = originalState.page;
            game.story.highestUnlocked = originalState.highestUnlocked;
            game.story.notifications = originalState.notifications;
            game.upgrades.blacksmith.level = originalState.blacksmithLevel;
            game.upgrades.gemWaster.level = originalState.gemWasterLevel;
            wisdomUpgradeEntries.forEach(([, upgrade], index) => {
              upgrade.level = originalState.wisdomUpgradeLevels[index];
            });
          }
        })();
        const payUSDebtSemantics = (() => {
          const originalMoney = game.money;
          const originalAlert = window.alert;
          const originalLogMessage = functions.logMessage;
          const scenarios = [
            { name: "below-cost", money: "21999999999999" },
            { name: "exact-cost", money: "22000000000000" },
            { name: "above-cost", money: "22000000000001" },
            { name: "very-large-balance", money: "1e300" },
          ];
          try {
            return {
              sourcePaths: ["Scripts/Define/functions.js", "index.html"],
              cost: "22000000000000",
              buttonLabel: captureResult(() =>
                functions.formatThousands(22e12, 1e100),
              ),
              scenarios: scenarios.map((scenario) => {
                const events = [];
                game.money = new Decimal(scenario.money);
                const moneyBefore = normalizedDecimal(game.money);
                window.alert = (message) =>
                  events.push({ type: "alert", message: String(message) });
                functions.logMessage = (message, color) =>
                  events.push({
                    type: "logMessage",
                    message: String(message),
                    color: normalize(color),
                  });
                functions.payUSDebt();
                return {
                  name: scenario.name,
                  money: scenario.money,
                  moneyBefore,
                  events,
                  moneyAfter: normalizedDecimal(game.money),
                };
              }),
            };
          } finally {
            game.money = originalMoney;
            window.alert = originalAlert;
            functions.logMessage = originalLogMessage;
          }
        })();
        const storyTabSemantics = (() => {
          const scenarios = [
            {
              name: "leaving-story-saves-scroll-and-refreshes-settings-select",
              input: {
                currentTab: "story",
                targetTab: "settings",
                scrollTop: 765,
                savedScrollY: 12,
                notifications: 3,
              },
            },
            {
              name: "entering-story-clears-notifications-and-restores-scroll",
              input: {
                currentTab: "settings",
                targetTab: "story",
                scrollTop: 14,
                savedScrollY: 765,
                notifications: 3,
              },
            },
            {
              name: "reselecting-story-saves-current-scroll-and-clears-notifications",
              input: {
                currentTab: "story",
                targetTab: "story",
                scrollTop: 321,
                savedScrollY: 4,
                notifications: 7,
              },
            },
            {
              name: "leaving-other-tab-keeps-saved-story-scroll",
              input: {
                currentTab: "mine",
                targetTab: "upgrades",
                scrollTop: 42,
                savedScrollY: 765,
                notifications: 2,
              },
            },
          ];
          const originalTab = game.settings.tab;
          const originalScrollY = game.story.scrollY;
          const originalNotifications = game.story.notifications;
          const originalScrollRef = app.$refs.storymilestones;
          const originalNumberFormatRef = app.$refs.numberformatselect;
          const originalSetTimeout = window.setTimeout;
          try {
            return {
              sourcePaths: ["Scripts/Define/functions.js"],
              scenarios: scenarios.map(({ name, input }) => {
                const timers = [];
                const effects = [];
                let activeTimerIndex = -1;
                let scrollTop = input.scrollTop;
                let selectedIndex = -1;
                const storyScrollRef = {};
                Object.defineProperty(storyScrollRef, "scrollTop", {
                  configurable: true,
                  get: () => scrollTop,
                  set: (value) => {
                    scrollTop = value;
                    if (activeTimerIndex >= 0) {
                      effects.push({
                        timerIndex: activeTimerIndex,
                        type: "restore-story-scroll",
                        scrollY: value,
                      });
                    }
                  },
                });
                const numberFormatRef = {};
                Object.defineProperty(numberFormatRef, "selectedIndex", {
                  configurable: true,
                  get: () => selectedIndex,
                  set: (value) => {
                    selectedIndex = value;
                    if (activeTimerIndex >= 0) {
                      effects.push({
                        timerIndex: activeTimerIndex,
                        type: "refresh-number-select",
                        selectedIndex: value,
                      });
                    }
                  },
                });
                app.$refs.storymilestones = storyScrollRef;
                app.$refs.numberformatselect = numberFormatRef;
                game.settings.tab = input.currentTab;
                game.story.scrollY = input.savedScrollY;
                game.story.notifications = input.notifications;
                window.setTimeout = (callback, delayMs) => {
                  timers.push({ callback, delayMs });
                  return timers.length;
                };

                functions.changeTab(input.targetTab);
                const afterTransition = {
                  tab: game.settings.tab,
                  scrollY: game.story.scrollY,
                  notifications: game.story.notifications,
                  scrollTop: storyScrollRef.scrollTop,
                  numberFormatSelectedIndex: numberFormatRef.selectedIndex,
                };
                timers.forEach(({ callback }, timerIndex) => {
                  activeTimerIndex = timerIndex;
                  callback();
                });
                activeTimerIndex = -1;

                return {
                  name,
                  input: {
                    ...input,
                    selectedNumberFormatterIndex:
                      game.numberFormatters.findIndex(
                        (formatter) => formatter === game.numberFormatter,
                      ),
                  },
                  afterTransition: {
                    ...afterTransition,
                    scheduledEffects: timers.map(({ delayMs }, timerIndex) => {
                      const effect = effects.find(
                        (item) => item.timerIndex === timerIndex,
                      );
                      return {
                        delayMs,
                        ...(effect
                          ? {
                              type: effect.type,
                              ...(effect.type === "restore-story-scroll"
                                ? { scrollY: effect.scrollY }
                                : { selectedIndex: effect.selectedIndex }),
                            }
                          : {}),
                      };
                    }),
                  },
                  afterTimers: {
                    tab: game.settings.tab,
                    scrollY: game.story.scrollY,
                    notifications: game.story.notifications,
                    scrollTop: storyScrollRef.scrollTop,
                    numberFormatSelectedIndex: numberFormatRef.selectedIndex,
                  },
                };
              }),
            };
          } finally {
            game.settings.tab = originalTab;
            game.story.scrollY = originalScrollY;
            game.story.notifications = originalNotifications;
            app.$refs.storymilestones = originalScrollRef;
            app.$refs.numberformatselect = originalNumberFormatRef;
            window.setTimeout = originalSetTimeout;
          }
        })();
        const offlineProgressionSemantics = (() => {
          const nowMs = Date.now();
          const scenarios = [
            {
              name: "exactly-five-minutes-does-not-earn-offline-rewards",
              elapsedSeconds: 300,
              noOffline: false,
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 1, offlineGems: 2, offlinePC: 3 },
            },
            {
              name: "missing-last-active-falls-back-to-current-clock",
              elapsedSeconds: 0,
              omitLastActive: true,
              noOffline: false,
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 1, offlineGems: 2, offlinePC: 3 },
            },
            {
              name: "just-over-five-minutes-applies-resource-upgrades",
              elapsedSeconds: 300.001,
              noOffline: false,
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 1, offlineGems: 2, offlinePC: 3 },
            },
            {
              name: "exact-default-six-hour-cap",
              elapsedSeconds: 21600,
              noOffline: false,
              rates: { money: "1", gems: "10", planetCoins: "10" },
              upgrades: { offlineTime: 0, offlineGems: 1, offlinePC: 1 },
            },
            {
              name: "one-second-over-default-cap-is-clamped",
              elapsedSeconds: 21601,
              noOffline: false,
              rates: { money: "1", gems: "10", planetCoins: "10" },
              upgrades: { offlineTime: 0, offlineGems: 1, offlinePC: 1 },
            },
            {
              name: "offline-time-upgrade-adds-hours-to-cap",
              elapsedSeconds: 28801,
              noOffline: false,
              rates: { money: "1", gems: "10", planetCoins: "10" },
              upgrades: { offlineTime: 2, offlineGems: 1, offlinePC: 1 },
            },
            {
              name: "explicit-nooffline-flag-suppresses-rewards-and-save",
              elapsedSeconds: 3600,
              noOffline: true,
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 1, offlineGems: 2, offlinePC: 3 },
            },
            {
              name: "negative-elapsed-time-does-not-earn-rewards",
              elapsedSeconds: -120,
              noOffline: false,
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 1, offlineGems: 2, offlinePC: 3 },
            },
            {
              name: "zero-rates-still-log-and-save-after-threshold",
              elapsedSeconds: 600,
              noOffline: false,
              rates: { money: "0", gems: "0", planetCoins: "0" },
              upgrades: { offlineTime: 0, offlineGems: 0, offlinePC: 0 },
            },
            {
              name: "clock-advances-between-calculation-and-save",
              elapsedSeconds: 600,
              noOffline: false,
              clockAdvancesMs: [0, 100, 200, 300],
              rates: { money: "2", gems: "100", planetCoins: "100" },
              upgrades: { offlineTime: 0, offlineGems: 2, offlinePC: 2 },
            },
          ];
          const originalMethods = {
            getMPS: functions.getMPS,
            getGPS: functions.getGPS,
            getPCPS: functions.getPCPS,
            logMessage: functions.logMessage,
            setItem: window.Storage.prototype.setItem,
            dateNow: Date.now,
          };
          const state = {
            money: "100",
            highestMoney: "50",
            gems: "7",
            planetCoins: "13",
            maxPlanetCoins: "10",
          };
          const snapshotDecimal = (value) =>
            normalizedDecimal(new Decimal(value));
          try {
            return {
              sourcePaths: [
                "Scripts/Define/functions.js",
                "Scripts/Define/game.js",
                "Scripts/upgrade.js",
              ],
              thresholdSeconds: 300,
              defaultOfflineHours: 6,
              moneyMultiplier: 0.5,
              scenarios: scenarios.map((scenario) => {
                functions.loadGame(window.initialGame, false, true);
                functions.getMPS = () => new Decimal(scenario.rates.money);
                functions.getGPS = () => new Decimal(scenario.rates.gems);
                functions.getPCPS = () =>
                  new Decimal(scenario.rates.planetCoins);
                const events = [];
                const storageWrites = [];
                functions.logMessage = (message, color) => {
                  events.push({
                    type: "logMessage",
                    message: String(message),
                    color: normalize(color),
                  });
                };
                window.Storage.prototype.setItem = function (key, value) {
                  const decoded = JSON.parse(
                    unescape(decodeURIComponent(atob(String(value)))),
                  );
                  storageWrites.push({
                    key: String(key),
                    save: {
                      lastActive: decoded.lastActive,
                      money: snapshotDecimal(decoded.money),
                      highestMoney: snapshotDecimal(decoded.highestMoney),
                      gems: snapshotDecimal(decoded.gems),
                      planetCoins: snapshotDecimal(decoded.planetCoins),
                      maxPlanetCoins: snapshotDecimal(decoded.maxPlanetCoins),
                    },
                  });
                };
                const inputSave = {
                  ...state,
                  wisdom: "0",
                  maxWisdom: "0",
                  mineObjectLevel: 0,
                  highestMineObjectLevel: 0,
                  story: {
                    page: 0,
                    notifications: 0,
                    highestUnlocked: -1,
                    scrollY: 0,
                  },
                  lastActive: scenario.omitLastActive
                    ? undefined
                    : nowMs - scenario.elapsedSeconds * 1000,
                  settings: { numberFormatterIndex: 0, theme: "light" },
                  upgrades: {},
                  gemUpgrades: {
                    offlineGems: { level: scenario.upgrades.offlineGems },
                  },
                  planetCoinUpgrades: {
                    offlineTime: { level: scenario.upgrades.offlineTime },
                    offlinePC: { level: scenario.upgrades.offlinePC },
                  },
                };
                const clockAdvancesMs = scenario.clockAdvancesMs ?? [0, 0, 0];
                let clockReadCount = 0;
                const dateNowReads = [];
                Date.now = () => {
                  const offset =
                    clockAdvancesMs[
                      Math.min(clockReadCount, clockAdvancesMs.length - 1)
                    ] ?? 0;
                  clockReadCount++;
                  const value = nowMs + offset;
                  dateNowReads.push(value);
                  return value;
                };
                try {
                  functions.loadGame(
                    JSON.stringify(inputSave),
                    false,
                    scenario.noOffline,
                  );
                } finally {
                  Date.now = originalMethods.dateNow;
                }
                return {
                  name: scenario.name,
                  input: {
                    ...scenario,
                    initialState: state,
                    nowMs,
                    clockAdvancesMs,
                  },
                  clockReadCount,
                  dateNowReads,
                  stateAfterLoad: {
                    money: normalizedDecimal(game.money),
                    highestMoney: normalizedDecimal(game.highestMoney),
                    gems: normalizedDecimal(game.gems),
                    planetCoins: normalizedDecimal(game.planetCoins),
                    maxPlanetCoins: normalizedDecimal(game.maxPlanetCoins),
                    lastActive: game.lastActive,
                  },
                  events,
                  storageWrites,
                };
              }),
            };
          } finally {
            functions.getMPS = originalMethods.getMPS;
            functions.getGPS = originalMethods.getGPS;
            functions.getPCPS = originalMethods.getPCPS;
            functions.logMessage = originalMethods.logMessage;
            window.Storage.prototype.setItem = originalMethods.setItem;
            Date.now = originalMethods.dateNow;
            functions.loadGame(window.initialGame, false, true);
          }
        })();
        let saveApplicationSemantics;
        let saveOfflineApplicationSemantics;
        let saveExportSemantics;
        const saveSemantics = (() => {
          const originalTab = game.settings.tab;
          const originalFormatter = game.numberFormatter;
          const originalStringify = JSON.stringify;
          let serialized = "";
          let saveString;
          try {
            JSON.stringify = function (value, replacer, space) {
              const output = originalStringify.call(
                this,
                value,
                replacer,
                space,
              );
              if (value === game) serialized = output;
              return output;
            };
            saveString = functions.getSaveString();
          } finally {
            JSON.stringify = originalStringify;
          }
          const decoded = unescape(decodeURIComponent(atob(saveString)));
          const saveObject = JSON.parse(decoded);
          const serializableShape = (value) => {
            if (value === null) return { type: "null" };
            if (Array.isArray(value)) {
              const shapes = new Map();
              for (const item of value) {
                const shape = serializableShape(item);
                const key = JSON.stringify(shape);
                const existing = shapes.get(key);
                if (existing) existing.count += 1;
                else shapes.set(key, { count: 1, shape });
              }
              return {
                type: "array",
                length: value.length,
                elementShapes: [...shapes.values()],
              };
            }
            if (typeof value === "object") {
              return {
                type: "object",
                fields: Object.fromEntries(
                  Object.keys(value).map((key) => [
                    key,
                    serializableShape(value[key]),
                  ]),
                ),
              };
            }
            return { type: typeof value };
          };
          const decimalFields = [
            "money",
            "highestMoney",
            "gems",
            "planetCoins",
            "maxPlanetCoins",
            "wisdom",
            "maxWisdom",
          ];
          const powerUpgradeKey = Object.keys(game.powers.upgrades)[0];
          try {
            functions.loadGame(window.initialGame, false, true);
            game.settings.tab = "settings";
            game.settings.theme = "dark";
            game.upgrades.idleSpeed.level = 7;
            game.gemUpgrades.offlineGems.level = 8;
            game.planetCoinUpgrades.offlinePC.level = 9;
            game.powers.upgrades[powerUpgradeKey].level = 6;
            game.powers.data.values[0] = new Decimal(9);
            game.pickaxe.name = "Probe Pickaxe";
            game.pickaxe.pow = new Decimal(123);
            game.pickaxe.quality = new Decimal(4);
            const minimalLegacySave = {
              story: {},
            };
            const minimalLegacyJson = JSON.stringify(minimalLegacySave);
            const minimalLegacyEncoded = btoa(
              escape(encodeURIComponent(minimalLegacyJson)),
            );
            functions.loadGame(minimalLegacyEncoded, undefined, true);

            const missingOptionalGroups = {
              inputKeys: Object.keys(minimalLegacySave),
              inputJson: minimalLegacyJson,
              encoded: minimalLegacyEncoded,
              resources: {
                money: normalizedDecimal(game.money),
                highestMoney: normalizedDecimal(game.highestMoney),
                gems: normalizedDecimal(game.gems),
                planetCoins: normalizedDecimal(game.planetCoins),
                wisdom: normalizedDecimal(game.wisdom),
              },
              story: {
                page: game.story.page,
                notifications: game.story.notifications,
                highestUnlocked: game.story.highestUnlocked,
                scrollY: game.story.scrollY,
              },
              settings: {
                tab: game.settings.tab,
                theme: game.settings.theme,
              },
              upgradeLevels: {
                moneyIdleSpeed: game.upgrades.idleSpeed.level,
                gemOfflineGems: game.gemUpgrades.offlineGems.level,
                planetOfflinePC: game.planetCoinUpgrades.offlinePC.level,
              },
              power: {
                upgradeKey: powerUpgradeKey,
                upgradeLevel: game.powers.upgrades[powerUpgradeKey].level,
                firstValue: normalizedDecimal(game.powers.data.values[0]),
              },
              pickaxe: {
                name: game.pickaxe.name,
                power: normalizedDecimal(game.pickaxe.pow),
                quality: normalizedDecimal(game.pickaxe.quality),
              },
            };

            let firstDifference = -1;
            const compareLength = Math.min(serialized.length, decoded.length);
            for (let index = 0; index < compareLength; index++) {
              if (serialized[index] !== decoded[index]) {
                firstDifference = index;
                break;
              }
            }
            if (firstDifference < 0 && serialized.length !== decoded.length) {
              firstDifference = compareLength;
            }

            functions.loadGame(window.initialGame, false, true);
            const unicodePickaxeName = "Probe — Å Ω →";
            game.pickaxe.name = unicodePickaxeName;
            const unicodeSaveString = functions.getSaveString();
            functions.loadGame(unicodeSaveString, undefined, true);
            const unicodePickaxeRoundTrip = {
              sourceName: unicodePickaxeName,
              importedName: game.pickaxe.name,
              preserved: game.pickaxe.name === unicodePickaxeName,
            };

            const encodeProbeSave = (value) =>
              btoa(escape(encodeURIComponent(JSON.stringify(value))));
            functions.loadGame(window.initialGame, false, true);
            game.settings.tab = "settings";
            const fieldApplicationInput = {
              money: "123.5",
              highestMoney: "987.25",
              gems: "23",
              planetCoins: "17",
              maxPlanetCoins: "19",
              wisdom: "101",
              maxWisdom: "205",
              mineObjectLevel: 3,
              highestMineObjectLevel: 8,
              lastActive: 1700000000000,
              story: {
                page: 2,
                notifications: 4,
                highestUnlocked: 17,
                scrollY: 123,
              },
              settings: {
                tab: "story",
                numberFormatterIndex: 3,
                theme: "dark",
                showMineObjLevel: true,
                showMinCraftDamage: true,
              },
              upgrades: { idleSpeed: { level: 4 } },
              gemUpgrades: { offlineGems: { level: 5 } },
              planetCoinUpgrades: { offlinePC: { level: 6 } },
              powers: {
                data: { values: ["2", "3", "4", "5", "6"] },
                upgrades: { powerPowerActive: { level: 7 } },
              },
              pickaxe: { name: "Probe Pickaxe", pow: "123", quality: "4" },
            };
            functions.loadGame(
              encodeProbeSave(fieldApplicationInput),
              undefined,
              true,
            );
            const controlledFullSaveJson = JSON.stringify(game);
            const controlledFullSaveEncoded = functions.getSaveString();
            const captureExportVariant = (name, configure) => {
              functions.loadGame(window.initialGame, false, true);
              game.timer = { autoPickaxe: 0, save: 0 };
              game.usedGemsLevel = 0;
              game.pickStatus = "";
              game.messageLog = [];
              game.settings.tab = "settings";
              game.settings.upgradeTab = "money";
              const inputJson = configure();
              const json = JSON.stringify(game);
              return {
                name,
                object: JSON.parse(json),
                encoded: functions.getSaveString(),
                json,
                ...(typeof inputJson === "string" ? { inputJson } : {}),
              };
            };
            const allUpgradeLevels = (upgrades, firstLevel) =>
              Object.fromEntries(
                Object.keys(upgrades).map((key, index) => [
                  key,
                  { level: firstLevel + index },
                ]),
              );
            const captureLoadedVariant = (name, configure) =>
              captureExportVariant(name, () => {
                game.settings.tab = "powers";
                game.settings.upgradeTab = "planetcoins";
                const input = JSON.parse(JSON.stringify(game));
                configure(input);
                const inputJson = JSON.stringify(input);
                functions.loadGame(encodeProbeSave(input), undefined, true);
                return inputJson;
              });
            const setSerializedUpgradeLevels = (upgrades, firstLevel) => {
              Object.keys(upgrades).forEach((key, index) => {
                upgrades[key].level = firstLevel + index;
              });
            };
            const saveExportVariants = [
              captureExportVariant("generated-wisdom-drop-215", () => {
                game.mineObjectLevel = 215;
                game.highestMineObjectLevel = 215;
                game.currentMineObject = functions.getMineObject(215);
              }),
              captureExportVariant("generated-planet-coin-drop-216", () => {
                game.mineObjectLevel = 216;
                game.highestMineObjectLevel = 216;
                game.currentMineObject = functions.getMineObject(216);
              }),
              captureExportVariant("generated-first-after-base-72", () => {
                game.mineObjectLevel = 72;
                game.highestMineObjectLevel = 72;
                game.currentMineObject = functions.getMineObject(72);
              }),
              captureExportVariant("generated-first-after-anchor-125", () => {
                game.mineObjectLevel = 125;
                game.highestMineObjectLevel = 125;
                game.currentMineObject = functions.getMineObject(125);
              }),
              captureExportVariant("generated-late-universe-244", () => {
                game.mineObjectLevel = 244;
                game.highestMineObjectLevel = 244;
                game.currentMineObject = functions.getMineObject(244);
              }),
              captureExportVariant("message-log-cap", () => {
                for (let index = 1; index <= 7; index++) {
                  functions.logMessage(
                    `Export probe ${index}`,
                    index % 2 === 0 ? "#222222" : "#111111",
                  );
                }
              }),
              captureLoadedVariant("settings-and-notation-only", (input) => {
                input.settings.theme = "dark";
                input.settings.numberFormatterIndex = 12;
                input.settings.showMineObjLevel = true;
                input.settings.showMinCraftDamage = true;
              }),
              captureLoadedVariant("money-upgrades-only", (input) => {
                setSerializedUpgradeLevels(input.upgrades, 2);
              }),
              captureLoadedVariant("gem-upgrades-only", (input) => {
                setSerializedUpgradeLevels(input.gemUpgrades, 3);
              }),
              captureLoadedVariant("planet-coin-upgrades-only", (input) => {
                setSerializedUpgradeLevels(input.planetCoinUpgrades, 4);
              }),
              captureLoadedVariant("wisdom-upgrades-only", (input) => {
                setSerializedUpgradeLevels(input.powers.upgrades, 5);
              }),
              captureExportVariant("varied-settings-and-all-upgrades", () => {
                game.settings.tab = "powers";
                game.settings.upgradeTab = "planetcoins";
                const input = {
                  money: "314159.265",
                  highestMoney: "271828.18",
                  gems: "12345",
                  planetCoins: "6789",
                  maxPlanetCoins: "7890",
                  wisdom: "9876",
                  maxWisdom: "10987",
                  mineObjectLevel: 0,
                  highestMineObjectLevel: 0,
                  lastActive: 1700000000000,
                  story: {
                    page: 8,
                    notifications: 3,
                    highestUnlocked: 60,
                    scrollY: 777,
                  },
                  settings: {
                    tab: "story",
                    upgradeTab: "money",
                    numberFormatterIndex: 39,
                    theme: "dark",
                    showMineObjLevel: true,
                    showMinCraftDamage: true,
                  },
                  upgrades: allUpgradeLevels(game.upgrades, 2),
                  gemUpgrades: allUpgradeLevels(game.gemUpgrades, 3),
                  planetCoinUpgrades: allUpgradeLevels(
                    game.planetCoinUpgrades,
                    4,
                  ),
                  powers: {
                    data: { values: ["11", "13", "17", "19", "23"] },
                    upgrades: allUpgradeLevels(game.powers.upgrades, 5),
                  },
                  pickaxe: {
                    name: "Deep export probe",
                    pow: "456",
                    quality: "7.5",
                  },
                };
                const inputJson = JSON.stringify(input);
                functions.loadGame(encodeProbeSave(input), undefined, true);
                return inputJson;
              }),
            ];
            saveExportSemantics = {
              sourcePaths: [
                "Scripts/Define/functions.js",
                "Scripts/Define/game.js",
                "Scripts/mineobject.js",
                "Scripts/upgrade.js",
              ],
              fresh: freshLegacySave,
              controlled: {
                object: JSON.parse(controlledFullSaveJson),
                encoded: controlledFullSaveEncoded,
                json: controlledFullSaveJson,
              },
              variants: saveExportVariants,
            };
            game.settings.tab = "settings";
            game.settings.upgradeTab = "money";
            functions.loadGame(
              encodeProbeSave(fieldApplicationInput),
              undefined,
              true,
            );
            const fieldApplication = {
              inputJson: JSON.stringify(fieldApplicationInput),
              resources: {
                money: normalizedDecimal(game.money),
                highestMoney: normalizedDecimal(game.highestMoney),
                gems: normalizedDecimal(game.gems),
                planetCoins: normalizedDecimal(game.planetCoins),
                maxPlanetCoins: normalizedDecimal(game.maxPlanetCoins),
                wisdom: normalizedDecimal(game.wisdom),
                maxWisdom: normalizedDecimal(game.maxWisdom),
              },
              mineObjectLevel: game.mineObjectLevel,
              highestMineObjectLevel: game.highestMineObjectLevel,
              currentObject: {
                name: game.currentMineObject.name,
                hp: normalizedDecimal(game.currentMineObject.hp),
                totalHp: normalizedDecimal(game.currentMineObject.totalHp),
                defense: normalizedDecimal(game.currentMineObject.def),
              },
              lastActive: game.lastActive,
              story: {
                page: game.story.page,
                notifications: game.story.notifications,
                highestUnlocked: game.story.highestUnlocked,
                scrollY: game.story.scrollY,
              },
              settings: {
                tab: game.settings.tab,
                formatterIndex: game.settings.numberFormatterIndex,
                formatterName: game.numberFormatter.name,
                theme: game.settings.theme,
                showMineObjLevel: game.settings.showMineObjLevel,
                showMinCraftDamage: game.settings.showMinCraftDamage,
              },
              upgradeLevels: {
                moneyIdleSpeed: game.upgrades.idleSpeed.level,
                gemOfflineGems: game.gemUpgrades.offlineGems.level,
                planetOfflinePC: game.planetCoinUpgrades.offlinePC.level,
                wisdomPowerPowerActive:
                  game.powers.upgrades.powerPowerActive.level,
              },
              powers: game.powers.data.values.map(normalizedDecimal),
              pickaxe: {
                name: game.pickaxe.name,
                power: normalizedDecimal(game.pickaxe.pow),
                quality: normalizedDecimal(game.pickaxe.quality),
              },
            };
            saveApplicationSemantics = fieldApplication;

            const offlineInput = {
              objectId: 90,
              pickaxe: { power: "1e43", quality: "1.25" },
              miningPower: "2.5",
              exquisityPower: "2.5",
              miningUpgrades: {
                money: {
                  activePower: 3,
                  idlePower: 4,
                  idleSpeed: 5,
                  gemChance: 6,
                },
                gems: { idlePower: 2, gemChance: 3, gemMultiply: 4 },
                planetCoins: {
                  activePower: 2,
                  gemChance: 1,
                  gemMultiply: 2,
                  lastObjGems: 3,
                },
                wisdom: {
                  powerPowerActive: 1,
                  powerPowerIdle: 2,
                  damageBoost: 3,
                  damageBoostUpgrades: 2,
                  gemBoostSimple: 2,
                  powerPowerPower: 3,
                  powerResetKeep: 4,
                },
              },
              offlineUpgrades: {
                offlineTime: 0,
                offlineGems: 15,
                offlinePC: 10,
              },
              initialResources: {
                money: "100",
                highestMoney: "125",
                gems: "10",
                planetCoins: "5",
                maxPlanetCoins: "6",
              },
              elapsedSeconds: 3601,
              nowMs: fixedClock,
              clockAdvancesMs: [0, 0, 100, 200],
            };
            functions.loadGame(window.initialGame, false, true);
            game.settings.tab = "settings";
            const toLegacyUpgradeGroup = (levels) =>
              Object.fromEntries(
                Object.entries(levels).map(([key, level]) => [key, { level }]),
              );
            const offlineSaveInput = {
              money: offlineInput.initialResources.money,
              highestMoney: offlineInput.initialResources.highestMoney,
              gems: offlineInput.initialResources.gems,
              planetCoins: offlineInput.initialResources.planetCoins,
              maxPlanetCoins: offlineInput.initialResources.maxPlanetCoins,
              wisdom: "101",
              maxWisdom: "205",
              mineObjectLevel: offlineInput.objectId,
              highestMineObjectLevel: offlineInput.objectId,
              lastActive:
                offlineInput.nowMs - offlineInput.elapsedSeconds * 1000,
              story: {
                page: 2,
                notifications: 4,
                highestUnlocked: 17,
                scrollY: 123,
              },
              settings: {
                tab: "story",
                numberFormatterIndex: 3,
                theme: "dark",
                showMineObjLevel: true,
                showMinCraftDamage: true,
              },
              upgrades: toLegacyUpgradeGroup(offlineInput.miningUpgrades.money),
              gemUpgrades: toLegacyUpgradeGroup({
                ...offlineInput.miningUpgrades.gems,
                offlineGems: offlineInput.offlineUpgrades.offlineGems,
              }),
              planetCoinUpgrades: toLegacyUpgradeGroup({
                ...offlineInput.miningUpgrades.planetCoins,
                offlineTime: offlineInput.offlineUpgrades.offlineTime,
                offlinePC: offlineInput.offlineUpgrades.offlinePC,
              }),
              powers: {
                data: {
                  values: [
                    offlineInput.miningPower,
                    "1",
                    "1",
                    "1",
                    offlineInput.exquisityPower,
                  ],
                },
                upgrades: toLegacyUpgradeGroup(
                  offlineInput.miningUpgrades.wisdom,
                ),
              },
              pickaxe: {
                name: "Reference offline-rate probe",
                pow: offlineInput.pickaxe.power,
                quality: offlineInput.pickaxe.quality,
              },
            };

            const offlineEvents = [];
            const offlineStorageWrites = [];
            const originalOfflineMethods = {
              setTheme: functions.setTheme,
              logMessage: functions.logMessage,
              setItem: window.Storage.prototype.setItem,
              dateNow: Date.now,
            };
            const clockAdvancesMs = [0, 0, 100, 200];
            let clockReadCount = 0;
            const dateNowReads = [];
            try {
              functions.setTheme = (theme) => {
                offlineEvents.push({ type: "setTheme", theme });
                originalOfflineMethods.setTheme(theme);
              };
              functions.logMessage = (message, color) => {
                offlineEvents.push({
                  type: "logMessage",
                  message: String(message),
                  color: normalize(color),
                });
              };
              window.Storage.prototype.setItem = function (key, value) {
                const decodedSave = JSON.parse(
                  unescape(decodeURIComponent(atob(String(value)))),
                );
                const saveSnapshot = {
                  lastActive: decodedSave.lastActive,
                  money: normalizedDecimal(new Decimal(decodedSave.money)),
                  highestMoney: normalizedDecimal(
                    new Decimal(decodedSave.highestMoney),
                  ),
                  gems: normalizedDecimal(new Decimal(decodedSave.gems)),
                  planetCoins: normalizedDecimal(
                    new Decimal(decodedSave.planetCoins),
                  ),
                  maxPlanetCoins: normalizedDecimal(
                    new Decimal(decodedSave.maxPlanetCoins),
                  ),
                  mineObjectLevel: decodedSave.mineObjectLevel,
                  highestMineObjectLevel: decodedSave.highestMineObjectLevel,
                  pickaxe: {
                    name: decodedSave.pickaxe.name,
                    power: normalizedDecimal(
                      new Decimal(decodedSave.pickaxe.pow),
                    ),
                    quality: normalizedDecimal(
                      new Decimal(decodedSave.pickaxe.quality),
                    ),
                  },
                  settings: {
                    tab: decodedSave.settings.tab,
                    numberFormatterIndex:
                      decodedSave.settings.numberFormatterIndex,
                    theme: decodedSave.settings.theme,
                    showMineObjLevel: decodedSave.settings.showMineObjLevel,
                    showMinCraftDamage: decodedSave.settings.showMinCraftDamage,
                  },
                };
                offlineEvents.push({
                  type: "storageWrite",
                  key: String(key),
                });
                offlineStorageWrites.push({
                  key: String(key),
                  save: saveSnapshot,
                });
              };
              Date.now = () => {
                const offset =
                  clockAdvancesMs[
                    Math.min(clockReadCount, clockAdvancesMs.length - 1)
                  ] ?? 0;
                clockReadCount += 1;
                const value = offlineInput.nowMs + offset;
                dateNowReads.push(value);
                return value;
              };

              functions.loadGame(
                encodeProbeSave(offlineSaveInput),
                undefined,
                false,
              );
            } finally {
              functions.setTheme = originalOfflineMethods.setTheme;
              functions.logMessage = originalOfflineMethods.logMessage;
              window.Storage.prototype.setItem = originalOfflineMethods.setItem;
              Date.now = originalOfflineMethods.dateNow;
            }

            saveOfflineApplicationSemantics = {
              inputJson: JSON.stringify(offlineSaveInput),
              elapsedSeconds:
                (dateNowReads[1] - offlineSaveInput.lastActive) / 1000,
              processedSeconds: Math.min(
                offlineInput.elapsedSeconds,
                3600 * (6 + offlineInput.offlineUpgrades.offlineTime),
              ),
              clockReadCount,
              dateNowReads,
              rates: {
                moneyPerSecond: normalizedDecimal(functions.getMPS()),
                gemsPerSecond: normalizedDecimal(functions.getGPS()),
                planetCoinsPerSecond: normalizedDecimal(functions.getPCPS()),
              },
              stateAfterLoad: {
                money: normalizedDecimal(game.money),
                highestMoney: normalizedDecimal(game.highestMoney),
                gems: normalizedDecimal(game.gems),
                planetCoins: normalizedDecimal(game.planetCoins),
                maxPlanetCoins: normalizedDecimal(game.maxPlanetCoins),
                lastActive: game.lastActive,
                mineObjectLevel: game.mineObjectLevel,
                highestMineObjectLevel: game.highestMineObjectLevel,
                story: {
                  page: game.story.page,
                  notifications: game.story.notifications,
                  highestUnlocked: game.story.highestUnlocked,
                  scrollY: game.story.scrollY,
                },
                settings: {
                  tab: game.settings.tab,
                  numberFormatterIndex: game.settings.numberFormatterIndex,
                  theme: game.settings.theme,
                  showMineObjLevel: game.settings.showMineObjLevel,
                  showMinCraftDamage: game.settings.showMinCraftDamage,
                },
                pickaxe: {
                  name: game.pickaxe.name,
                  power: normalizedDecimal(game.pickaxe.pow),
                  quality: normalizedDecimal(game.pickaxe.quality),
                },
              },
              events: offlineEvents,
              storageWrites: offlineStorageWrites,
            };

            const codecVectors = [
              {
                name: "ascii-json",
                value: { money: "123", story: { page: 3 } },
              },
              {
                name: "unicode-json",
                value: {
                  pickaxe: { name: "Probe \u2014 \u00c5 \u03a9 \u2192" },
                },
              },
            ].map(({ name, value }) => {
              const json = JSON.stringify(value);
              const encoded = encodeProbeSave(value);
              return {
                name,
                json,
                encoded,
                decodedJson: unescape(decodeURIComponent(atob(encoded))),
              };
            });

            functions.loadGame(window.initialGame, false, true);
            game.settings.tab = "settings";
            game.upgrades.idleSpeed.level = 7;
            game.gemUpgrades.offlineGems.level = 8;
            game.planetCoinUpgrades.offlinePC.level = 9;
            game.powers.upgrades[powerUpgradeKey].level = 6;
            game.powers.data.values[0] = new Decimal(9);
            game.pickaxe.name = "Probe Pickaxe";
            game.pickaxe.pow = new Decimal(123);
            game.pickaxe.quality = new Decimal(4);
            const partialWithEmptyGroups = {
              story: {},
              settings: { tab: "story", theme: "dark" },
              upgrades: {},
              gemUpgrades: {},
              planetCoinUpgrades: {},
              powers: { data: { values: [] } },
              pickaxe: {},
            };
            const partialWithEmptyGroupsJson = JSON.stringify(
              partialWithEmptyGroups,
            );
            const partialWithEmptyGroupsEncoded = encodeProbeSave(
              partialWithEmptyGroups,
            );
            functions.loadGame(partialWithEmptyGroupsEncoded, undefined, true);
            const emptyPresentGroups = {
              inputGroups: Object.keys(partialWithEmptyGroups),
              inputJson: partialWithEmptyGroupsJson,
              encoded: partialWithEmptyGroupsEncoded,
              savedTab: partialWithEmptyGroups.settings.tab,
              tabAfterLoad: game.settings.tab,
              settings: {
                formatterIndex: game.settings.numberFormatterIndex,
                formatterName: game.numberFormatter.name,
                theme: game.settings.theme,
              },
              upgradeLevels: {
                moneyIdleSpeed: game.upgrades.idleSpeed.level,
                gemOfflineGems: game.gemUpgrades.offlineGems.level,
                planetOfflinePC: game.planetCoinUpgrades.offlinePC.level,
              },
              power: {
                upgradeLevel: game.powers.upgrades[powerUpgradeKey].level,
                firstValue: normalizedDecimal(game.powers.data.values[0]),
              },
              pickaxe: {
                name: game.pickaxe.name,
                power: normalizedDecimal(game.pickaxe.pow),
                quality: normalizedDecimal(game.pickaxe.quality),
              },
            };

            const originalAlert = window.alert;
            const loadErrorScenarios = [
              { name: "empty-base64", encoded: "" },
              { name: "invalid-base64", encoded: "%%%" },
              {
                name: "invalid-uri-escape",
                encoded: btoa("%ZZ"),
              },
              { name: "valid-base64-invalid-json", encoded: btoa("not-json") },
              {
                name: "missing-story-after-resource-fields",
                encoded: encodeProbeSave({ money: "123", mineObjectLevel: 0 }),
              },
            ];
            let loadErrors;
            try {
              loadErrors = loadErrorScenarios.map((scenario) => {
                functions.loadGame(window.initialGame, false, true);
                game.money = new Decimal(77);
                const alerts = [];
                window.alert = (message) => alerts.push(String(message));
                let thrownErrorName = null;
                try {
                  functions.loadGame(scenario.encoded, undefined, true);
                } catch (error) {
                  thrownErrorName = error.name;
                }
                return {
                  name: scenario.name,
                  encoded: scenario.encoded,
                  alertCount: alerts.length,
                  alertHasDecodeErrorPrefix: alerts.some((message) =>
                    message.startsWith("Error loading Game: "),
                  ),
                  thrownErrorName,
                  money: normalizedDecimal(game.money),
                  mineObjectLevel: game.mineObjectLevel,
                };
              });
            } finally {
              window.alert = originalAlert;
              functions.loadGame(window.initialGame, false, true);
            }

            const variantJson = JSON.stringify({
              money: "5",
              story: { page: 3 },
            });
            const variantEncoded = encodeProbeSave({
              money: "5",
              story: { page: 3 },
            });
            const base64Variants = [
              {
                name: "ascii-whitespace",
                encoded: `${variantEncoded.slice(0, 4)} \n${variantEncoded.slice(4)}`,
              },
              {
                name: "unpadded-base64",
                encoded: variantEncoded.replace(/=+$/, ""),
              },
            ].map((variant) => {
              functions.loadGame(window.initialGame, false, true);
              game.money = new Decimal(77);
              let alertCount = 0;
              window.alert = () => {
                alertCount += 1;
              };
              let thrownErrorName = null;
              try {
                functions.loadGame(variant.encoded, undefined, true);
              } catch (error) {
                thrownErrorName = error.name;
              }
              return {
                name: variant.name,
                encoded: variant.encoded,
                expectedJson: variantJson,
                alertCount,
                thrownErrorName,
                money: normalizedDecimal(game.money),
                storyPage: game.story.page,
              };
            });
            window.alert = originalAlert;
            functions.loadGame(window.initialGame, false, true);

            return {
              sourcePaths: [
                "Scripts/Define/functions.js",
                "Scripts/Define/game.js",
                "index.html",
              ],
              storageKey: "IdleMine",
              encoding: {
                encodeOrder: [
                  "JSON.stringify(game)",
                  "encodeURIComponent",
                  "escape",
                  "btoa",
                ],
                decodeOrder: [
                  "atob",
                  "decodeURIComponent",
                  "unescape",
                  "JSON.parse",
                ],
                jsonLength: serialized.length,
                decodedJsonLength: decoded.length,
                base64Length: saveString.length,
                decodedMatchesJson: decoded === serialized,
                firstDifference:
                  firstDifference < 0
                    ? null
                    : {
                        index: firstDifference,
                        serializedCodeUnit:
                          serialized.charCodeAt(firstDifference) ?? null,
                        decodedCodeUnit:
                          decoded.charCodeAt(firstDifference) ?? null,
                      },
                base64AlphabetOnly: /^[A-Za-z0-9+/]*={0,2}$/.test(saveString),
              },
              currentShape: {
                versionFieldPresent: Object.hasOwn(saveObject, "version"),
                topLevelKeys: Object.keys(saveObject),
                serializableShape: serializableShape(saveObject),
                decimalFields: Object.fromEntries(
                  decimalFields.map((key) => [
                    key,
                    {
                      type: typeof saveObject[key],
                      value: saveObject[key],
                    },
                  ]),
                ),
                collectionLengths: {
                  numberFormatters: saveObject.numberFormatters.length,
                  mineObjects: saveObject.mineObjects.length,
                  specialMineObjects: saveObject.specialMineObjects.length,
                  powersValues: saveObject.powers.data.values.length,
                  messageLog: saveObject.messageLog.length,
                },
                nestedKeys: {
                  settings: Object.keys(saveObject.settings),
                  story: Object.keys(saveObject.story),
                  upgrades: Object.keys(saveObject.upgrades),
                  gemUpgrades: Object.keys(saveObject.gemUpgrades),
                  planetCoinUpgrades: Object.keys(
                    saveObject.planetCoinUpgrades,
                  ),
                  powers: Object.keys(saveObject.powers),
                  powersData: Object.keys(saveObject.powers.data),
                  pickaxe: Object.keys(saveObject.pickaxe),
                },
                omittedUpgradeFunctions: {
                  price: !Object.hasOwn(
                    saveObject.upgrades.blacksmith,
                    "getPrice",
                  ),
                  effect: !Object.hasOwn(
                    saveObject.upgrades.blacksmith,
                    "getEffect",
                  ),
                },
              },
              missingOptionalGroups,
              emptyPresentGroups,
              codecVectors,
              base64Variants,
              loadErrors,
              unicodePickaxeRoundTrip,
            };
          } finally {
            functions.loadGame(window.initialGame, false, true);
            game.settings.tab = originalTab;
            game.numberFormatter = originalFormatter;
          }
        })();
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
            planetCoins: [
              "activePower",
              "gemChance",
              "gemMultiply",
              "lastObjGems",
            ],
            wisdom: [
              "powerPowerActive",
              "powerPowerIdle",
              "damageBoost",
              "gemBoostSimple",
              "damageBoostUpgrades",
              "powerPowerPower",
              "powerResetKeep",
            ],
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
            exquisityPower: game.powers.data.values[POWER_EXQUISITY],
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
              exquisityPower: "2.5",
              upgrades: {
                money: {
                  activePower: 3,
                  idlePower: 4,
                  idleSpeed: 5,
                  gemChance: 6,
                },
                gems: { idlePower: 2, gemChance: 3, gemMultiply: 4 },
                planetCoins: {
                  activePower: 2,
                  gemChance: 1,
                  gemMultiply: 2,
                  lastObjGems: 3,
                },
                wisdom: {
                  powerPowerActive: 1,
                  powerPowerIdle: 2,
                  damageBoost: 3,
                  damageBoostUpgrades: 2,
                  gemBoostSimple: 2,
                  powerPowerPower: 3,
                  powerResetKeep: 4,
                },
              },
            },
            {
              name: "zero-damage-universe",
              objectId: 214,
              pickaxe: { power: "1", quality: "0.5" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "active-damage-defense-boundary",
              objectId: 4,
              pickaxe: { power: "90", quality: "1" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "idle-damage-below-defense",
              objectId: 4,
              pickaxe: { power: "119.8", quality: "1" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "idle-damage-defense-boundary",
              objectId: 4,
              pickaxe: { power: "120", quality: "1" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "idle-damage-above-defense",
              objectId: 4,
              pickaxe: { power: "120.2", quality: "1" },
              miningPower: "1",
              upgrades: {},
            },
            {
              name: "number-hit-count-overflow",
              objectId: 0,
              pickaxe: { power: "1e-308", quality: "1" },
              miningPower: "1",
              upgrades: { money: { idlePower: 1 } },
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
                game.powers.data.values[POWER_EXQUISITY] = new Decimal(
                  scenario.exquisityPower ?? "1",
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
                  input: {
                    ...scenario,
                    exquisityPower:
                      game.powers.data.values[POWER_EXQUISITY].toString(),
                  },
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
                game.powers.data.values[POWER_EXQUISITY] = new Decimal(
                  scenario.exquisityPower ?? "1",
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
            game.powers.data.values[POWER_EXQUISITY] =
              previousState.exquisityPower;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        const offlineLoadRateCompositionSemantics = (() => {
          const definitions = [
            {
              name: "initial-mud-live-money-rate",
              formulaScenario: "initial-mud",
              elapsedSeconds: 3601,
              offlineUpgrades: { offlineTime: 0, offlineGems: 0, offlinePC: 0 },
            },
            {
              name: "last-damageable-object-live-gem-rate",
              formulaScenario: "last-damageable-object",
              elapsedSeconds: 3601,
              offlineUpgrades: {
                offlineTime: 0,
                offlineGems: 15,
                offlinePC: 0,
              },
            },
            {
              name: "upgraded-asteroid-live-planet-coin-rate",
              formulaScenario: "upgraded-planet-coin-asteroid",
              elapsedSeconds: 3601,
              offlineUpgrades: {
                offlineTime: 0,
                offlineGems: 15,
                offlinePC: 10,
              },
            },
            {
              name: "zero-damage-universe-live-rates",
              formulaScenario: "zero-damage-universe",
              elapsedSeconds: 3601,
              offlineUpgrades: {
                offlineTime: 0,
                offlineGems: 15,
                offlinePC: 10,
              },
            },
          ];
          const formulaInputs = new Map(
            formulaSemantics.scenarios.map((scenario) => [
              scenario.input.name,
              scenario.input,
            ]),
          );
          functions.loadGame(window.initialGame, false, true);
          const baseSave = JSON.parse(
            unescape(decodeURIComponent(atob(functions.getSaveString()))),
          );
          const initialResources = {
            money: "100",
            highestMoney: "125",
            gems: "10",
            planetCoins: "5",
            maxPlanetCoins: "6",
          };
          const sourceUpgrades = {
            money: "upgrades",
            gems: "gemUpgrades",
            planetCoins: "planetCoinUpgrades",
            wisdom: "powers.upgrades",
          };
          const original = {
            logMessage: functions.logMessage,
            setItem: window.Storage.prototype.setItem,
            dateNow: Date.now,
          };
          try {
            return {
              sourcePaths: [
                "Scripts/Define/functions.js",
                "Scripts/Define/game.js",
                "Scripts/upgrade.js",
                "Scripts/pickaxe.js",
              ],
              scenarios: definitions.map((definition) => {
                const formulaInput = formulaInputs.get(
                  definition.formulaScenario,
                );
                if (!formulaInput) {
                  throw new Error(
                    `Missing formula scenario ${definition.formulaScenario}.`,
                  );
                }
                const save = JSON.parse(JSON.stringify(baseSave));
                Object.assign(save, initialResources, {
                  mineObjectLevel: formulaInput.objectId,
                  highestMineObjectLevel: formulaInput.objectId,
                  lastActive: fixedClock - definition.elapsedSeconds * 1000,
                });
                save.pickaxe = {
                  name: "Reference offline-rate probe",
                  pow: formulaInput.pickaxe.power,
                  quality: formulaInput.pickaxe.quality,
                };
                save.powers.data.values[POWER_MINING] =
                  formulaInput.miningPower;
                save.powers.data.values[POWER_EXQUISITY] =
                  formulaInput.exquisityPower ?? "1";
                for (const [group, levels] of Object.entries(
                  formulaInput.upgrades,
                )) {
                  const path = sourceUpgrades[group];
                  const target = path
                    .split(".")
                    .reduce((value, key) => value[key], save);
                  for (const [key, level] of Object.entries(levels)) {
                    target[key].level = level;
                  }
                }
                save.gemUpgrades.offlineGems.level =
                  definition.offlineUpgrades.offlineGems;
                save.planetCoinUpgrades.offlineTime.level =
                  definition.offlineUpgrades.offlineTime;
                save.planetCoinUpgrades.offlinePC.level =
                  definition.offlineUpgrades.offlinePC;

                const events = [];
                const storageWrites = [];
                functions.logMessage = (message, color) =>
                  events.push({
                    type: "logMessage",
                    message: String(message),
                    color: normalize(color),
                  });
                window.Storage.prototype.setItem = function (key, value) {
                  const decoded = JSON.parse(
                    unescape(decodeURIComponent(atob(String(value)))),
                  );
                  storageWrites.push({
                    key: String(key),
                    save: {
                      lastActive: decoded.lastActive,
                      money: normalizedDecimal(new Decimal(decoded.money)),
                      highestMoney: normalizedDecimal(
                        new Decimal(decoded.highestMoney),
                      ),
                      gems: normalizedDecimal(new Decimal(decoded.gems)),
                      planetCoins: normalizedDecimal(
                        new Decimal(decoded.planetCoins),
                      ),
                      maxPlanetCoins: normalizedDecimal(
                        new Decimal(decoded.maxPlanetCoins),
                      ),
                    },
                  });
                };

                const clockAdvancesMs = [0, 0, 100, 200];
                let clockReadCount = 0;
                const dateNowReads = [];
                Date.now = () => {
                  const offset =
                    clockAdvancesMs[
                      Math.min(clockReadCount, clockAdvancesMs.length - 1)
                    ] ?? 0;
                  clockReadCount++;
                  const value = fixedClock + offset;
                  dateNowReads.push(value);
                  return value;
                };
                try {
                  functions.loadGame(JSON.stringify(save), false, false);
                } finally {
                  Date.now = original.dateNow;
                }

                return {
                  name: definition.name,
                  input: {
                    formulaScenario: definition.formulaScenario,
                    objectId: formulaInput.objectId,
                    pickaxe: formulaInput.pickaxe,
                    miningPower: formulaInput.miningPower,
                    exquisityPower: formulaInput.exquisityPower ?? "1",
                    miningUpgrades: formulaInput.upgrades,
                    offlineUpgrades: definition.offlineUpgrades,
                    initialResources,
                    elapsedSeconds: definition.elapsedSeconds,
                    nowMs: fixedClock,
                    clockAdvancesMs,
                  },
                  clockReadCount,
                  dateNowReads,
                  highestDamageableObjectLevel:
                    functions.getHighestDamageableMineObjectLevel(),
                  rates: {
                    moneyPerSecond: normalizedDecimal(functions.getMPS()),
                    gemsPerSecond: normalizedDecimal(functions.getGPS()),
                    planetCoinsPerSecond: normalizedDecimal(
                      functions.getPCPS(),
                    ),
                  },
                  stateAfterLoad: {
                    money: normalizedDecimal(game.money),
                    highestMoney: normalizedDecimal(game.highestMoney),
                    gems: normalizedDecimal(game.gems),
                    planetCoins: normalizedDecimal(game.planetCoins),
                    maxPlanetCoins: normalizedDecimal(game.maxPlanetCoins),
                    lastActive: game.lastActive,
                  },
                  events,
                  storageWrites,
                };
              }),
            };
          } finally {
            functions.logMessage = original.logMessage;
            window.Storage.prototype.setItem = original.setItem;
            Date.now = original.dateNow;
            functions.loadGame(window.initialGame, false, true);
          }
        })();
        const miningHitSemantics = (() => {
          const upgradeGroups = {
            money: game.upgrades,
            gems: game.gemUpgrades,
            planetCoins: game.planetCoinUpgrades,
            wisdom: game.powers.upgrades,
          };
          const previousLevels = Object.fromEntries(
            Object.entries(upgradeGroups).map(([group, upgrades]) => [
              group,
              Object.fromEntries(
                Object.entries(upgrades).map(([key, upgrade]) => [
                  key,
                  upgrade.level,
                ]),
              ),
            ]),
          );
          const previous = {
            currentMineObject: game.currentMineObject,
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            pickaxe: game.pickaxe,
            powers: game.powers.data.values,
            money: game.money,
            highestMoney: game.highestMoney,
            gems: game.gems,
            planetCoins: game.planetCoins,
            maxPlanetCoins: game.maxPlanetCoins,
            wisdom: game.wisdom,
            maxWisdom: game.maxWisdom,
            timer: { ...game.timer },
            deltaTimeOld: window.deltaTimeOld,
            random: Math.random,
            saveGame: functions.saveGame,
            refreshStoryNotifications: functions.refreshStoryNotifications,
          };
          const frameEvents = [];
          functions.saveGame = () => frameEvents.push("save");
          functions.refreshStoryNotifications = () =>
            frameEvents.push("refreshStoryNotifications");
          const resourceKeys = [
            "money",
            "highestMoney",
            "gems",
            "planetCoins",
            "maxPlanetCoins",
            "wisdom",
            "maxWisdom",
          ];
          const scenarios = [
            {
              name: "active-click-single-nonbreaking-hit",
              action: "activeClick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {
                wisdom: { powerPowerActive: 20, powerPowerPower: 3 },
              },
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [],
            },
            {
              name: "idle-timer-equal-to-threshold-does-not-hit",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 1000,
              randomValues: [],
            },
            {
              name: "idle-timer-over-threshold-processes-one-hit",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: { wisdom: { powerPowerIdle: 10, powerPowerPower: 4 } },
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 2500,
              randomValues: [],
            },
            {
              name: "active-overkill-break-resets-object-and-pays-money",
              action: "activeClick",
              objectId: 0,
              currentHp: "5",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.9],
            },
            {
              name: "gem-roll-equality-does-not-award-gems",
              action: "activeClick",
              objectId: 0,
              currentHp: "5",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.02],
            },
            {
              name: "last-damageable-object-break-drops-rounded-gems",
              action: "activeClick",
              objectId: 2,
              currentHp: "3",
              highestMineObjectLevel: 2,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1.3"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5.4",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {
                gems: { gemMultiply: 1 },
                planetCoins: { lastObjGems: 3 },
              },
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0],
            },
            {
              name: "planet-coin-drop-roll-follows-gem-roll",
              action: "activeClick",
              objectId: 90,
              currentHp: "1",
              highestMineObjectLevel: 90,
              pickaxe: { power: "1e50", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "4",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.9, 0],
            },
            {
              name: "planet-coin-drop-failure-still-follows-gem-roll",
              action: "activeClick",
              objectId: 90,
              currentHp: "1",
              highestMineObjectLevel: 90,
              pickaxe: { power: "1e50", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "4",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.9, 1],
            },
            {
              name: "wisdom-drop-scales-with-power-wisdom",
              action: "activeClick",
              objectId: 169,
              currentHp: "1",
              highestMineObjectLevel: 169,
              pickaxe: { power: "1e110", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "4",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.9, 0],
            },
            {
              name: "wisdom-drop-failure-preserves-current-and-maximum",
              action: "activeClick",
              objectId: 169,
              currentHp: "1",
              highestMineObjectLevel: 169,
              pickaxe: { power: "1e110", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "6",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "4",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              elapsedMilliseconds: 0,
              randomValues: [0.9, 1],
            },
            {
              name: "frame-save-equal-to-sixty-seconds-is-not-due",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              saveTimer: 0,
              elapsedMilliseconds: 60000,
              randomValues: [],
            },
            {
              name: "frame-save-over-sixty-seconds-emits-save-before-story-refresh",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              saveTimer: 0,
              elapsedMilliseconds: 60001,
              randomValues: [],
            },
            {
              name: "frame-save-long-delta-emits-only-one-save",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              saveTimer: 0,
              elapsedMilliseconds: 120001,
              randomValues: [],
            },
            {
              name: "frame-clock-reversal-decreases-unsaved-timers",
              action: "idleTick",
              objectId: 0,
              currentHp: "100",
              highestMineObjectLevel: 0,
              pickaxe: { power: "20", quality: "1" },
              powers: ["2", "1", "1", "3", "1"],
              resources: {
                money: "7",
                highestMoney: "10",
                gems: "5",
                planetCoins: "4",
                maxPlanetCoins: "8",
                wisdom: "2",
                maxWisdom: "3",
              },
              upgrades: {},
              autoPickaxeTimer: 0,
              saveTimer: 10,
              elapsedMilliseconds: -5000,
              randomValues: [],
            },
          ];

          try {
            return {
              sourcePaths: [
                "Scripts/main.js",
                "Scripts/Define/functions.js",
                "Scripts/mineobject.js",
              ],
              randomSource: "Math.random",
              cases: scenarios.map((scenario) => {
                frameEvents.length = 0;
                for (const upgrades of Object.values(upgradeGroups)) {
                  for (const upgrade of Object.values(upgrades)) {
                    upgrade.level = 0;
                  }
                }
                for (const [group, levels] of Object.entries(
                  scenario.upgrades,
                )) {
                  for (const [key, level] of Object.entries(levels)) {
                    upgradeGroups[group][key].level = level;
                  }
                }

                game.mineObjectLevel = scenario.objectId;
                game.highestMineObjectLevel = scenario.highestMineObjectLevel;
                game.currentMineObject = functions.getMineObject(
                  scenario.objectId,
                );
                game.currentMineObject.hp = new Decimal(scenario.currentHp);
                game.pickaxe = new Pickaxe(
                  "Probe Pickaxe",
                  scenario.pickaxe.power,
                  scenario.pickaxe.quality,
                );
                game.powers.data.values = scenario.powers.map(
                  (value) => new Decimal(value),
                );
                for (const key of resourceKeys) {
                  game[key] = new Decimal(scenario.resources[key]);
                }
                game.timer.autoPickaxe = scenario.autoPickaxeTimer;
                game.timer.save = scenario.saveTimer ?? 0;

                const hitObject = game.currentMineObject;
                const startingHp = new Decimal(hitObject.hp);
                const hitDamage =
                  scenario.action === "activeClick"
                    ? functions.getActiveDamage()
                    : functions.getIdleDamage();
                const effects = {
                  gemChance: normalizedDecimal(
                    applyUpgrade(game.upgrades.gemChance),
                  ),
                  gemMultiplier: normalizedDecimal(
                    applyUpgrade(game.gemUpgrades.gemMultiply),
                  ),
                  lastObjectGemMultiplier: normalizedDecimal(
                    applyUpgrade(game.planetCoinUpgrades.lastObjGems),
                  ),
                  powerWisdom: normalizedDecimal(
                    game.powers.data.values[POWER_WISDOM],
                  ),
                  miningPowerGainMultiplier: normalizedDecimal(
                    applyUpgrade(
                      scenario.action === "activeClick"
                        ? game.powers.upgrades.powerPowerActive
                        : game.powers.upgrades.powerPowerIdle,
                    ),
                  ),
                };
                const highestDamageableMineObjectLevel =
                  functions.getHighestDamageableMineObjectLevel();
                let randomCalls = 0;
                Math.random = () => {
                  const value = scenario.randomValues[randomCalls];
                  if (value === undefined) {
                    throw new Error(
                      `Mining case ${scenario.name} consumed an uncaptured RNG draw.`,
                    );
                  }
                  randomCalls++;
                  return value;
                };

                if (scenario.action === "activeClick") {
                  functions.clickMineObject();
                } else {
                  const frameCalls = window.__idleMineProbe.animationFrameCalls;
                  window.deltaTimeOld =
                    Date.now() - scenario.elapsedMilliseconds;
                  window.update();
                  window.__idleMineProbe.animationFrameCalls = frameCalls;
                }

                const hitOccurred =
                  hitObject !== game.currentMineObject ||
                  !hitObject.hp.eq(startingHp);
                return {
                  name: scenario.name,
                  input: {
                    action: scenario.action,
                    objectId: scenario.objectId,
                    currentHp: scenario.currentHp,
                    highestMineObjectLevel: scenario.highestMineObjectLevel,
                    pickaxe: scenario.pickaxe,
                    powers: scenario.powers,
                    resources: scenario.resources,
                    upgrades: scenario.upgrades,
                    autoPickaxeTimer: scenario.autoPickaxeTimer,
                    saveTimer: scenario.saveTimer ?? 0,
                    elapsedMilliseconds: scenario.elapsedMilliseconds,
                    randomValues: scenario.randomValues,
                  },
                  effects,
                  highestDamageableMineObjectLevel,
                  result: {
                    hitOccurred,
                    hitDamage: normalizedDecimal(hitDamage),
                    damagedObjectHp: normalizedDecimal(hitObject.hp),
                    currentObjectHp: normalizedDecimal(
                      game.currentMineObject.hp,
                    ),
                    currentObjectWasReplaced:
                      game.currentMineObject !== hitObject,
                    resources: Object.fromEntries(
                      resourceKeys.map((key) => [
                        key,
                        normalizedDecimal(game[key]),
                      ]),
                    ),
                    highestMineObjectLevel: game.highestMineObjectLevel,
                    miningPower: normalizedDecimal(
                      game.powers.data.values[POWER_MINING],
                    ),
                    autoPickaxeTimer: game.timer.autoPickaxe,
                    saveTimer: game.timer.save,
                    randomCalls,
                    frameEvents: [...frameEvents],
                  },
                };
              }),
            };
          } finally {
            Math.random = previous.random;
            game.currentMineObject = previous.currentMineObject;
            game.mineObjectLevel = previous.mineObjectLevel;
            game.highestMineObjectLevel = previous.highestMineObjectLevel;
            game.pickaxe = previous.pickaxe;
            game.powers.data.values = previous.powers;
            game.money = previous.money;
            game.highestMoney = previous.highestMoney;
            game.gems = previous.gems;
            game.planetCoins = previous.planetCoins;
            game.maxPlanetCoins = previous.maxPlanetCoins;
            game.wisdom = previous.wisdom;
            game.maxWisdom = previous.maxWisdom;
            game.timer.autoPickaxe = previous.timer.autoPickaxe;
            game.timer.save = previous.timer.save;
            window.deltaTimeOld = previous.deltaTimeOld;
            functions.saveGame = previous.saveGame;
            functions.refreshStoryNotifications =
              previous.refreshStoryNotifications;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        const simulationFrameSemantics = (() => {
          const upgradeGroups = {
            money: game.upgrades,
            gems: game.gemUpgrades,
            planetCoins: game.planetCoinUpgrades,
            wisdom: game.powers.upgrades,
          };
          const previousLevels = Object.fromEntries(
            Object.entries(upgradeGroups).map(([group, upgrades]) => [
              group,
              Object.fromEntries(
                Object.entries(upgrades).map(([key, upgrade]) => [
                  key,
                  upgrade.level,
                ]),
              ),
            ]),
          );
          const resourceKeys = [
            "money",
            "highestMoney",
            "gems",
            "planetCoins",
            "maxPlanetCoins",
            "wisdom",
            "maxWisdom",
          ];
          const previous = {
            currentMineObject: game.currentMineObject,
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            pickaxe: game.pickaxe,
            powers: [...game.powers.data.values],
            resources: Object.fromEntries(
              resourceKeys.map((key) => [key, game[key]]),
            ),
            story: {
              page: game.story.page,
              highestUnlocked: game.story.highestUnlocked,
              notifications: game.story.notifications,
            },
            timer: { ...game.timer },
            deltaTimeNew: window.deltaTimeNew,
            deltaTimeOld: window.deltaTimeOld,
            dateNow: Object.getOwnPropertyDescriptor(Date, "now"),
            random: Math.random,
            saveGame: functions.saveGame,
            refreshStoryNotifications: functions.refreshStoryNotifications,
          };
          const scenarios = [
            {
              name: "idle-break-saves-before-story-notification-refresh",
              action: "idleFrame",
              currentHp: "1",
              elapsedMilliseconds: 2000,
              autoPickaxeTimer: 0,
              saveTimer: 60,
              story: { page: 0, highestUnlocked: -1, notifications: 0 },
              randomValues: [0.99],
            },
            {
              name: "equal-idle-threshold-refreshes-game-start-without-saving",
              action: "idleFrame",
              currentHp: "100",
              elapsedMilliseconds: 1000,
              autoPickaxeTimer: 0,
              saveTimer: 0,
              story: { page: 0, highestUnlocked: -1, notifications: 0 },
              randomValues: [],
            },
            {
              name: "active-click-does-not-refresh-story-notifications",
              action: "activeClick",
              currentHp: "100",
              elapsedMilliseconds: 0,
              autoPickaxeTimer: 0,
              saveTimer: 0,
              story: { page: 0, highestUnlocked: -1, notifications: 0 },
              randomValues: [],
            },
          ];
          const snapshot = () => ({
            mineObjectLevel: game.mineObjectLevel,
            highestMineObjectLevel: game.highestMineObjectLevel,
            currentObjectHp: normalizedDecimal(game.currentMineObject.hp),
            resources: Object.fromEntries(
              resourceKeys.map((key) => [key, normalizedDecimal(game[key])]),
            ),
            miningPower: normalizedDecimal(
              game.powers.data.values[POWER_MINING],
            ),
            timer: { ...game.timer },
            story: {
              page: game.story.page,
              highestUnlocked: game.story.highestUnlocked,
              notifications: game.story.notifications,
            },
          });
          const frameEvents = [];
          let savedSnapshot = null;
          const animationFrameCalls =
            window.__idleMineProbe.animationFrameCalls;

          try {
            functions.saveGame = () => {
              frameEvents.push("save");
              savedSnapshot = snapshot();
            };
            const originalRefresh = previous.refreshStoryNotifications;
            functions.refreshStoryNotifications = () => {
              frameEvents.push("refreshStoryNotifications");
              originalRefresh();
            };

            return {
              sourcePaths: [
                "Scripts/main.js",
                "Scripts/Define/game.js",
                "Scripts/Define/functions.js",
                "Scripts/mineobject.js",
              ],
              randomSource: "Math.random",
              cases: scenarios.map((scenario) => {
                for (const upgrades of Object.values(upgradeGroups)) {
                  for (const upgrade of Object.values(upgrades)) {
                    upgrade.level = 0;
                  }
                }
                game.mineObjectLevel = 0;
                game.highestMineObjectLevel = 0;
                game.currentMineObject = functions.getMineObject(0);
                game.currentMineObject.hp = new Decimal(scenario.currentHp);
                game.pickaxe = new Pickaxe("Toy Pickaxe", 20, 1);
                game.powers.data.values = Array.from(
                  { length: 5 },
                  () => new Decimal(1),
                );
                game.money = new Decimal(0);
                game.highestMoney = new Decimal(0);
                game.gems = new Decimal(5);
                game.planetCoins = new Decimal(0);
                game.maxPlanetCoins = new Decimal(0);
                game.wisdom = new Decimal(0);
                game.maxWisdom = new Decimal(0);
                game.story.page = scenario.story.page;
                game.story.highestUnlocked = scenario.story.highestUnlocked;
                game.story.notifications = scenario.story.notifications;
                game.timer.autoPickaxe = scenario.autoPickaxeTimer;
                game.timer.save = scenario.saveTimer;
                window.deltaTimeOld = fixedClock;
                frameEvents.length = 0;
                savedSnapshot = null;

                let randomCalls = 0;
                Math.random = () => {
                  const value = scenario.randomValues[randomCalls];
                  if (value === undefined) {
                    throw new Error(
                      `Simulation frame ${scenario.name} exhausted its RNG fixture.`,
                    );
                  }
                  randomCalls++;
                  return value;
                };
                Object.defineProperty(Date, "now", {
                  configurable: true,
                  value: () => fixedClock + scenario.elapsedMilliseconds,
                });

                const hitObject = game.currentMineObject;
                const startingHp = new Decimal(hitObject.hp);
                const hitDamage = normalizedDecimal(
                  scenario.action === "activeClick"
                    ? functions.getActiveDamage()
                    : functions.getIdleDamage(),
                );
                if (scenario.action === "activeClick") {
                  functions.clickMineObject();
                } else {
                  window.update();
                  window.__idleMineProbe.animationFrameCalls =
                    animationFrameCalls;
                }
                const hitOccurred =
                  hitObject !== game.currentMineObject ||
                  !hitObject.hp.eq(startingHp);

                return {
                  name: scenario.name,
                  input: {
                    action: scenario.action,
                    currentHp: scenario.currentHp,
                    elapsedMilliseconds: scenario.elapsedMilliseconds,
                    autoPickaxeTimer: scenario.autoPickaxeTimer,
                    saveTimer: scenario.saveTimer,
                    story: scenario.story,
                    randomValues: scenario.randomValues,
                  },
                  result: {
                    hitOccurred,
                    hitDamage,
                    damagedObjectHp: normalizedDecimal(hitObject.hp),
                    currentObjectHp: normalizedDecimal(
                      game.currentMineObject.hp,
                    ),
                    currentObjectWasReplaced:
                      game.currentMineObject !== hitObject,
                    resources: Object.fromEntries(
                      resourceKeys.map((key) => [
                        key,
                        normalizedDecimal(game[key]),
                      ]),
                    ),
                    highestMineObjectLevel: game.highestMineObjectLevel,
                    miningPower: normalizedDecimal(
                      game.powers.data.values[POWER_MINING],
                    ),
                    autoPickaxeTimer: game.timer.autoPickaxe,
                    saveTimer: game.timer.save,
                    story: {
                      page: game.story.page,
                      highestUnlocked: game.story.highestUnlocked,
                      notifications: game.story.notifications,
                    },
                    randomCalls,
                    frameEvents: [...frameEvents],
                    savedSnapshot,
                  },
                };
              }),
            };
          } finally {
            Math.random = previous.random;
            Object.defineProperty(Date, "now", previous.dateNow);
            game.currentMineObject = previous.currentMineObject;
            game.mineObjectLevel = previous.mineObjectLevel;
            game.highestMineObjectLevel = previous.highestMineObjectLevel;
            game.pickaxe = previous.pickaxe;
            game.powers.data.values = previous.powers;
            for (const [key, value] of Object.entries(previous.resources)) {
              game[key] = value;
            }
            Object.assign(game.story, previous.story);
            game.timer.autoPickaxe = previous.timer.autoPickaxe;
            game.timer.save = previous.timer.save;
            window.deltaTimeNew = previous.deltaTimeNew;
            window.deltaTimeOld = previous.deltaTimeOld;
            window.__idleMineProbe.animationFrameCalls = animationFrameCalls;
            functions.saveGame = previous.saveGame;
            functions.refreshStoryNotifications =
              previous.refreshStoryNotifications;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        const upgradeSemantics = (() => {
          const upgradeGroups = {
            money: game.upgrades,
            gems: game.gemUpgrades,
            planetCoins: game.planetCoinUpgrades,
            wisdom: game.powers.upgrades,
          };
          const previousLevels = Object.fromEntries(
            Object.entries(upgradeGroups).map(([group, upgrades]) => [
              group,
              Object.fromEntries(
                Object.entries(upgrades).map(([key, upgrade]) => [
                  key,
                  upgrade.level,
                ]),
              ),
            ]),
          );
          const previousHighestObjectLevel = game.highestMineObjectLevel;
          const previousPowers = [...game.powers.data.values];
          const previousResources = {
            money: game.money,
            gems: game.gems,
            planetCoins: game.planetCoins,
            wisdom: game.wisdom,
          };
          const extraLevels = {
            "money.idleSpeed": [49, 50, 51],
            "gems.blacksmith": [24, 25, 26],
            "gems.gemChance": [29, 30, 31],
            "gems.gemMultiply": [
              249, 250, 251, 999, 1000, 1001, 2499, 2500, 2501, 9999, 10000,
              10001,
            ],
            "wisdom.powerPowerActive": [49, 50, 51],
            "wisdom.powerPowerIdle": [49, 50, 51],
            "wisdom.powerPowerPower": [9, 10, 11],
          };

          try {
            game.highestMineObjectLevel = 171;
            game.powers.data.values = previousPowers.map(() => new Decimal(1));
            for (const upgrades of Object.values(upgradeGroups)) {
              for (const upgrade of Object.values(upgrades)) {
                upgrade.level = 0;
              }
            }

            const blacksmithBonus = upgradeGroups.money.blacksmithBonus;
            const originalRandom = Math.random;
            const blacksmithBonusSamples = [
              {
                name: "zero-level-consumes-chance-draw",
                level: 0,
                values: [0.1],
              },
              {
                name: "chance-threshold-is-exclusive",
                level: 10,
                values: [0.25],
              },
              {
                name: "chance-passes-low-roll",
                level: 10,
                values: [0.1, 0.19],
              },
              {
                name: "chance-passes-high-roll",
                level: 10,
                values: [0.2499, 0.9999],
              },
              {
                name: "level-one-can-still-be-a-dud",
                level: 1,
                values: [0.1, 0.99],
              },
            ].map((sample) => {
              let randomCalls = 0;
              blacksmithBonus.level = sample.level;
              Math.random = () => {
                if (randomCalls >= sample.values.length) {
                  throw new Error(
                    "Blacksmith bonus consumed an uncaptured RNG draw.",
                  );
                }
                return sample.values[randomCalls++];
              };
              try {
                const effect = blacksmithBonus.getEffect(sample.level);
                return {
                  name: sample.name,
                  level: sample.level,
                  controlledRandomValues: sample.values,
                  randomCalls,
                  effect: normalizedDecimal(effect),
                };
              } finally {
                Math.random = originalRandom;
              }
            });

            const effectInteractions = [
              {
                name: "blacksmith-effects-use-gem-upgrades-and-powers",
                highestMineObjectLevel: 171,
                levels: {
                  money: { blacksmith: 7, blacksmithSkill: 4 },
                  gems: { blacksmith: 26, blacksmithSkill: 12 },
                },
                powers: { craftsmanship: "2.5", expertise: "3.25" },
                effects: [
                  { group: "money", key: "blacksmith", level: 7 },
                  { group: "money", key: "blacksmithSkill", level: 4 },
                ],
              },
              {
                name: "money-effects-use-gem-and-planet-coin-upgrades",
                highestMineObjectLevel: 171,
                levels: {
                  money: { gemChance: 8, idlePower: 6 },
                  gems: { gemChance: 36, idlePower: 12 },
                  planetCoins: { gemChance: 13 },
                },
                powers: {},
                effects: [
                  { group: "money", key: "gemChance", level: 8 },
                  { group: "money", key: "idlePower", level: 6 },
                ],
              },
              {
                name: "gem-multiplication-uses-upgrades-and-exquisity",
                highestMineObjectLevel: 171,
                levels: {
                  gems: { gemMultiply: 15 },
                  planetCoins: { gemMultiply: 7 },
                  wisdom: { gemBoostSimple: 4 },
                },
                powers: { exquisity: "3.25" },
                effects: [{ group: "gems", key: "gemMultiply", level: 15 }],
              },
              {
                name: "wisdom-power-effects-use-power-power-power",
                highestMineObjectLevel: 171,
                levels: {
                  wisdom: {
                    powerPowerActive: 11,
                    powerPowerIdle: 8,
                    powerPowerPower: 14,
                  },
                },
                powers: {},
                effects: [
                  { group: "wisdom", key: "powerPowerActive", level: 11 },
                  { group: "wisdom", key: "powerPowerIdle", level: 8 },
                ],
              },
              {
                name: "wisdom-damage-effects-use-all-levels-and-highest-mine-level",
                highestMineObjectLevel: 188,
                levels: {
                  wisdom: {
                    powerPowerActive: 1,
                    powerPowerIdle: 2,
                    damageBoost: 3,
                    gemBoostSimple: 5,
                    damageBoostUpgrades: 4,
                    powerPowerPower: 6,
                    powerResetKeep: 7,
                  },
                },
                powers: {},
                effects: [
                  { group: "wisdom", key: "damageBoost", level: 3 },
                  { group: "wisdom", key: "damageBoostUpgrades", level: 4 },
                ],
              },
            ].map((sample) => {
              game.highestMineObjectLevel = sample.highestMineObjectLevel;
              game.powers.data.values = previousPowers.map(
                () => new Decimal(1),
              );
              // `main.js` assigns Craftsmanship, Expertise, and Exquisity to 1, 2, and 4.
              for (const [index, power] of [
                [1, sample.powers.craftsmanship],
                [2, sample.powers.expertise],
                [4, sample.powers.exquisity],
              ]) {
                if (power !== undefined) {
                  game.powers.data.values[index] = new Decimal(power);
                }
              }
              for (const upgrades of Object.values(upgradeGroups)) {
                for (const upgrade of Object.values(upgrades)) {
                  upgrade.level = 0;
                }
              }
              for (const [group, levels] of Object.entries(sample.levels)) {
                for (const [key, level] of Object.entries(levels)) {
                  upgradeGroups[group][key].level = level;
                }
              }
              const effects = sample.effects.map(({ group, key, level }) => {
                const upgrade = upgradeGroups[group][key];
                upgrade.level = level;
                return {
                  group,
                  key,
                  level,
                  effect: normalizedDecimal(upgrade.getEffect(level)),
                };
              });
              return {
                name: sample.name,
                highestMineObjectLevel: sample.highestMineObjectLevel,
                controlledLevels: sample.levels,
                otherUpgradeLevels: 0,
                controlledPowers: sample.powers,
                otherPowers: "1",
                effects,
              };
            });

            game.highestMineObjectLevel = 171;
            game.powers.data.values = previousPowers.map(() => new Decimal(1));

            const purchaseDefinitions = [
              {
                name: "buy-exact-affordability",
                group: "money",
                key: "activePower",
                level: 0,
                balance: "1000",
                operation: { method: "buy" },
              },
              {
                name: "buy-below-exact-affordability",
                group: "money",
                key: "activePower",
                level: 0,
                balance: "999.99",
                operation: { method: "buy" },
              },
              {
                name: "buy-uses-gem-resource",
                group: "gems",
                key: "offlineGems",
                level: 0,
                balance: "4444",
                operation: { method: "buy" },
              },
              {
                name: "buy-uses-planet-coin-resource",
                group: "planetCoins",
                key: "activePower",
                level: 0,
                balance: "100",
                operation: { method: "buy" },
              },
              {
                name: "buy-uses-wisdom-resource",
                group: "wisdom",
                key: "gemBoostSimple",
                level: 0,
                balance: "1e10",
                operation: { method: "buy" },
              },
              {
                name: "rounded-buy-can-leave-negative-resource",
                group: "planetCoins",
                key: "activePower",
                level: 0,
                balance: "99.6",
                operation: { method: "buy", round: true },
              },
              {
                name: "buy-is-blocked-at-cap",
                group: "money",
                key: "idleSpeed",
                level: 60,
                balance: "currentPrice",
                operation: { method: "buy" },
              },
              {
                name: "buyN-without-alignment-stops-on-affordability",
                group: "money",
                key: "activePower",
                level: 2,
                balance: "28000",
                operation: { method: "buyN", count: 5, align: false },
              },
              {
                name: "buyN-with-alignment-stops-at-next-multiple",
                group: "money",
                key: "activePower",
                level: 3,
                balance: "2000000",
                operation: { method: "buyN", count: 10, align: true },
              },
              {
                name: "buyN-stops-at-level-cap",
                group: "money",
                key: "idleSpeed",
                level: 58,
                balance: "1e100",
                operation: { method: "buyN", count: 10, align: false },
              },
              {
                name: "buy10-from-zero-aligns-through-level-ten",
                group: "money",
                key: "activePower",
                level: 0,
                balance: "1023000",
                operation: { method: "buy10" },
              },
              {
                name: "buy10-aligns-current-level",
                group: "money",
                key: "activePower",
                level: 9,
                balance: "currentPrice",
                operation: { method: "buy10" },
              },
              {
                name: "buy100-aligns-current-level",
                group: "money",
                key: "activePower",
                level: 99,
                balance: "currentPrice",
                operation: { method: "buy100" },
              },
              {
                name: "buy100-from-zero-aligns-through-level-one-hundred",
                group: "money",
                key: "activePower",
                level: 0,
                balance: "2e33",
                operation: { method: "buy100" },
              },
            ];
            const purchaseSemantics = purchaseDefinitions.map((sample) => {
              for (const upgrades of Object.values(upgradeGroups)) {
                for (const upgrade of Object.values(upgrades)) {
                  upgrade.level = 0;
                }
              }
              game.money = new Decimal(0);
              game.gems = new Decimal(0);
              game.planetCoins = new Decimal(0);
              game.wisdom = new Decimal(0);

              const upgrade = upgradeGroups[sample.group][sample.key];
              upgrade.level = sample.level;
              const resourceKey = {
                money: "money",
                gems: "gems",
                planetCoins: "planetCoins",
                wisdom: "wisdom",
              }[sample.group];
              const balance =
                sample.balance === "currentPrice"
                  ? upgrade.currentPrice()
                  : new Decimal(sample.balance);
              game[resourceKey] = balance;
              const startResources = {
                money: normalizedDecimal(game.money),
                gems: normalizedDecimal(game.gems),
                planetCoins: normalizedDecimal(game.planetCoins),
                wisdom: normalizedDecimal(game.wisdom),
              };
              const currentPrice = normalizedDecimal(upgrade.currentPrice());
              const maximum = upgrade.getMaxLevel();
              let operationResult = null;
              switch (sample.operation.method) {
                case "buy":
                  operationResult =
                    sample.operation.round === undefined
                      ? upgrade.buy()
                      : upgrade.buy(sample.operation.round);
                  break;
                case "buyN":
                  upgrade.buyN(
                    sample.operation.count,
                    sample.operation.align,
                    sample.operation.round,
                  );
                  break;
                case "buy10":
                  upgrade.buy10(sample.operation.round);
                  break;
                case "buy100":
                  upgrade.buy100(sample.operation.round);
                  break;
                default:
                  throw new Error(
                    `Unknown controlled purchase operation: ${sample.operation.method}`,
                  );
              }
              return {
                name: sample.name,
                group: sample.group,
                key: sample.key,
                resourceId: upgrade.resource,
                startingLevel: sample.level,
                startingResources: startResources,
                currentPrice,
                maxLevel: maximum === Infinity ? "Infinity" : maximum,
                operation: sample.operation,
                operationResult,
                endingLevel: upgrade.level,
                purchases: upgrade.level - sample.level,
                endingResources: {
                  money: normalizedDecimal(game.money),
                  gems: normalizedDecimal(game.gems),
                  planetCoins: normalizedDecimal(game.planetCoins),
                  wisdom: normalizedDecimal(game.wisdom),
                },
              };
            });

            return {
              sourcePaths: [
                "Scripts/Define/game.js",
                "Scripts/upgrade.js",
                "Scripts/utils.js",
                "Scripts/main.js",
              ],
              controlledState: {
                highestMineObjectLevel: 171,
                powerValues: ["1", "1", "1", "1", "1"],
                otherUpgradeLevels: 0,
                stochasticEffectExcluded: ["money.blacksmithBonus"],
              },
              groups: Object.fromEntries(
                Object.entries(upgradeGroups).map(([group, upgrades]) => [
                  group,
                  Object.fromEntries(
                    Object.entries(upgrades).map(([key, upgrade]) => {
                      const maxLevel = upgrade.getMaxLevel();
                      const samples = new Set([0, 1, 2, 3]);
                      if (Number.isFinite(maxLevel)) {
                        samples.add(maxLevel - 1);
                        samples.add(maxLevel);
                        samples.add(maxLevel + 1);
                      } else {
                        for (const level of [5, 10, 25, 50, 100]) {
                          samples.add(level);
                        }
                      }
                      for (const level of extraLevels[group + "." + key] ??
                        []) {
                        samples.add(level);
                      }
                      const stochasticEffect =
                        group === "money" && key === "blacksmithBonus";
                      const values = [...samples]
                        .filter((level) => level >= 0)
                        .sort((a, b) => a - b)
                        .map((level) => {
                          for (const groupUpgrades of Object.values(
                            upgradeGroups,
                          )) {
                            for (const otherUpgrade of Object.values(
                              groupUpgrades,
                            )) {
                              otherUpgrade.level = 0;
                            }
                          }
                          upgrade.level = level;
                          return {
                            level,
                            price: normalizedDecimal(upgrade.getPrice(level)),
                            effect: stochasticEffect
                              ? null
                              : normalizedDecimal(upgrade.getEffect(level)),
                            levelDisplay: upgrade.getLevelDisplay(),
                            effectDisplay: upgrade.getEffectDisplay(),
                            priceDisplay: upgrade.getPriceDisplay(),
                          };
                        });
                      return [
                        key,
                        {
                          name: upgrade.name,
                          description: upgrade.desc,
                          image: upgrade.img,
                          resource: upgrade.resource,
                          maxLevel:
                            maxLevel === Infinity ? "Infinity" : maxLevel,
                          stochasticEffect,
                          samples: values,
                        },
                      ];
                    }),
                  ),
                ]),
              ),
              stochasticEffects: {
                blacksmithBonus: {
                  sourcePath: "Scripts/Define/game.js",
                  randomSource: "Math.random",
                  samples: blacksmithBonusSamples,
                },
              },
              effectInteractions,
              purchaseSemantics,
            };
          } finally {
            game.highestMineObjectLevel = previousHighestObjectLevel;
            game.powers.data.values = previousPowers;
            game.money = previousResources.money;
            game.gems = previousResources.gems;
            game.planetCoins = previousResources.planetCoins;
            game.wisdom = previousResources.wisdom;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        const pickaxeCraftingSemantics = await (async () => {
          const upgradeGroups = {
            money: game.upgrades,
            gems: game.gemUpgrades,
            planetCoins: game.planetCoinUpgrades,
            wisdom: game.powers.upgrades,
          };
          const previousLevels = Object.fromEntries(
            Object.entries(upgradeGroups).map(([group, upgrades]) => [
              group,
              Object.fromEntries(
                Object.entries(upgrades).map(([key, upgrade]) => [
                  key,
                  upgrade.level,
                ]),
              ),
            ]),
          );
          const previousHighestMineObjectLevel = game.highestMineObjectLevel;
          const previousUsedGemsLevel = game.usedGemsLevel;
          const previousPowers = [...game.powers.data.values];
          const previousGems = game.gems;
          const previousPickaxe = game.pickaxe;
          const previousMessageLog = game.messageLog;
          const previousSaveGame = functions.saveGame;
          const previousLogMessage = functions.logMessage;
          const previousKeyPressed = functions.keyPressed;
          const originalRandom = Math.random;
          const resetUpgradeLevels = () => {
            for (const upgrades of Object.values(upgradeGroups)) {
              for (const upgrade of Object.values(upgrades)) {
                upgrade.level = 0;
              }
            }
          };
          const setState = (scenario) => {
            resetUpgradeLevels();
            game.highestMineObjectLevel = scenario.highestMineObjectLevel;
            game.usedGemsLevel = scenario.usedGemsLevel ?? 0;
            game.powers.data.values = scenario.powers.map(
              (value) => new Decimal(value),
            );
            for (const [group, levels] of Object.entries(
              scenario.upgradeLevels,
            )) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          };
          const controlScenarios = [
            {
              name: "gem-waster-not-owned",
              usedGemsLevel: 0,
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: { gems: { gemWaster: 2 } },
            },
            {
              name: "minimum-selected-level",
              usedGemsLevel: 0,
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {
                money: { gemWaster: 1 },
                gems: { gemWaster: 2 },
              },
            },
            {
              name: "interior-selected-level",
              usedGemsLevel: 1,
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {
                money: { gemWaster: 1 },
                gems: { gemWaster: 2 },
              },
            },
            {
              name: "maximum-selected-level",
              usedGemsLevel: 3,
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {
                money: { gemWaster: 1 },
                gems: { gemWaster: 2 },
              },
            },
          ];
          const craftControls = [];
          for (const scenario of controlScenarios) {
            setState(scenario);
            app.$forceUpdate();
            await Vue.nextTick();
            const buttons = Array.from(
              document.querySelectorAll(".craft-pickaxe > button.level-change"),
            );
            const gemText = document.querySelector(
              ".craft-pickaxe > button:not(.level-change) .inline-resource",
            );
            craftControls.push({
              name: scenario.name,
              input: {
                usedGemsLevel: game.usedGemsLevel,
                moneyGemWasterLevel: game.upgrades.gemWaster.level,
                gemUpgradeWasterLevel: game.gemUpgrades.gemWaster.level,
              },
              displayedGemCost: gemText?.textContent?.trim() ?? null,
              gemCost: normalizedDecimal(functions.getUsedGems()),
              buttons: buttons.map((button) => ({
                disabled: button.disabled,
                image: button.querySelector("img")?.getAttribute("src") ?? null,
              })),
            });
          }
          setState(controlScenarios[2]);
          app.$forceUpdate();
          await Vue.nextTick();
          const controlTransitions = [];
          for (const direction of ["increase", "decrease", "decrease"]) {
            const index = direction === "decrease" ? 0 : 1;
            const levelButtons = document.querySelectorAll(
              ".craft-pickaxe > button.level-change",
            );
            levelButtons[index]?.click();
            await Vue.nextTick();
            controlTransitions.push({
              direction,
              usedGemsLevel: game.usedGemsLevel,
              gemCost: normalizedDecimal(functions.getUsedGems()),
            });
          }
          const randomCases = [
            {
              name: "baseline-object-name",
              gems: "1",
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {},
              randomValues: [
                0.8, 0.9, 0.5, 0.2, 0.75, 0.2, 0.2, 0.5, 0.5, 0.75,
              ],
            },
            {
              name: "generated-word-name",
              gems: "5",
              highestMineObjectLevel: 0,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {},
              randomValues: [
                0.2, 0.9, 0.7, 0.8, 0.6, 0.9, 0.4, 0.1, 0.2, 0.321, 0.75,
              ],
            },
            {
              name: "expertise-bonus-and-quality-streak",
              gems: "25",
              highestMineObjectLevel: 25,
              powers: ["1", "2.5", "3.25", "1", "1"],
              upgradeLevels: {
                money: {
                  blacksmith: 7,
                  blacksmithSkill: 4,
                  blacksmithBonus: 10,
                },
                gems: { blacksmith: 8, blacksmithSkill: 5 },
              },
              randomValues: [
                0.4, 0.1, 0.75, 0.65, 0.55, 0.2, 0.3, 0.8, 0.25, 0.7, 0.5, 0.5,
                0.1,
              ],
            },
            {
              name: "quality-roll-capped-at-fifteen",
              gems: "100",
              highestMineObjectLevel: 60,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {},
              randomValues: [
                0.7,
                0.8,
                0.1,
                0.9,
                ...Array(15).fill(0.1),
                0.6,
                0.4,
                0.1,
                0.1,
                0.5,
                0.5,
              ],
            },
            {
              name: "post-universe-generated-object-name",
              gems: "1e6",
              highestMineObjectLevel: 215,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {},
              randomValues: [0.3, 0.8, 0.4, 0.4, 0.7, 0.6, 0.4, 0.8, 0.8, 0.9],
            },
          ];
          const distributionScenarios = [
            {
              name: "baseline-one-gem",
              gems: "1",
              highestMineObjectLevel: 25,
              powers: ["1", "1", "1", "1", "1"],
              upgradeLevels: {},
            },
            {
              name: "upgraded-twenty-five-gem",
              gems: "25",
              highestMineObjectLevel: 25,
              powers: ["1", "2.5", "3.25", "1", "1"],
              upgradeLevels: {
                money: {
                  blacksmith: 7,
                  blacksmithSkill: 4,
                  blacksmithBonus: 10,
                },
                gems: { blacksmith: 8, blacksmithSkill: 5 },
              },
            },
          ];
          const distributionSeeds = [0x1d1e, 0xc0ffee, 0x5eed1234];
          const distributionSampleCount = 512;
          const summarizeValues = (values) => {
            const sorted = [...values].sort((left, right) => left - right);
            const roundSummary = (value) => Number(value.toPrecision(10));
            const quantile = (probability) =>
              roundSummary(
                sorted[Math.floor((sorted.length - 1) * probability)],
              );
            return {
              min: roundSummary(sorted[0]),
              p10: quantile(0.1),
              p50: quantile(0.5),
              p90: quantile(0.9),
              max: roundSummary(sorted[sorted.length - 1]),
              mean: roundSummary(
                values.reduce((sum, value) => sum + value, 0) / values.length,
              ),
            };
          };

          try {
            const crafts = randomCases.map((scenario) => {
              setState(scenario);
              let randomCalls = 0;
              Math.random = () => {
                const value = scenario.randomValues[randomCalls];
                if (value === undefined) {
                  throw new Error(
                    `Pickaxe craft ${scenario.name} consumed an uncaptured RNG draw.`,
                  );
                }
                randomCalls++;
                return value;
              };
              try {
                const pickaxe = Pickaxe.craft(
                  new Decimal(scenario.gems),
                  false,
                );
                return {
                  name: scenario.name,
                  input: scenario,
                  randomCalls,
                  result: {
                    name: pickaxe.name,
                    power: normalizedDecimal(pickaxe.pow),
                    quality: normalizedDecimal(pickaxe.quality),
                    damage: normalizedDecimal(pickaxe.getDamage()),
                  },
                };
              } finally {
                Math.random = originalRandom;
              }
            });

            const deterministic = {
              gems: "25",
              highestMineObjectLevel: 25,
              powers: ["1", "2.5", "3.25", "1", "1"],
              upgradeLevels: {
                money: { blacksmith: 7, blacksmithSkill: 4 },
                gems: { blacksmith: 8, blacksmithSkill: 5 },
              },
            };
            setState(deterministic);
            let randomCalls = 0;
            Math.random = () => {
              randomCalls++;
              throw new Error("Average pickaxe craft unexpectedly used RNG.");
            };
            const minimum = Pickaxe.craft(
              new Decimal(deterministic.gems),
              true,
              0,
            );
            const average = Pickaxe.craft(
              new Decimal(deterministic.gems),
              true,
            );
            const distributions = distributionScenarios.map((scenario) => {
              setState(scenario);
              const seedResults = distributionSeeds.map((seed) => {
                let randomState = seed >>> 0;
                let randomCalls = 0;
                let sampleRandomValues = [];
                const randomDrawCounts = {};
                const qualityStreakCounts = Array(16).fill(0);
                const nameForms = { word: 0, object: 0 };
                const samples = { power: [], quality: [], damage: [] };
                const nextRandom = () => {
                  randomState =
                    (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
                  randomCalls++;
                  const value = randomState / 0x1_0000_0000;
                  sampleRandomValues.push(value);
                  return value;
                };
                Math.random = nextRandom;
                try {
                  for (
                    let sample = 0;
                    sample < distributionSampleCount;
                    sample++
                  ) {
                    const drawsBefore = randomCalls;
                    sampleRandomValues = [];
                    const pickaxe = Pickaxe.craft(
                      new Decimal(scenario.gems),
                      false,
                    );
                    const consumed = randomCalls - drawsBefore;
                    const bonusLevel =
                      scenario.upgradeLevels.money?.blacksmithBonus ?? 0;
                    const bonusRollCount =
                      bonusLevel > 0 && sampleRandomValues[1] < 0.25 ? 1 : 0;
                    const firstQualityRoll = 4 + bonusRollCount;
                    let qualityStreak = 0;
                    for (
                      let roll = 0;
                      roll < 15 &&
                      sampleRandomValues[firstQualityRoll + roll] < 0.5;
                      roll++
                    ) {
                      qualityStreak++;
                    }
                    randomDrawCounts[consumed] =
                      (randomDrawCounts[consumed] ?? 0) + 1;
                    qualityStreakCounts[qualityStreak]++;
                    nameForms[pickaxe.name.includes('"') ? "word" : "object"]++;
                    samples.power.push(pickaxe.pow.toNumber());
                    samples.quality.push(pickaxe.quality.toNumber());
                    samples.damage.push(pickaxe.getDamage().toNumber());
                  }
                  return {
                    seed,
                    sampleCount: distributionSampleCount,
                    randomCalls,
                    randomDrawCounts,
                    qualityStreakCounts,
                    nameForms,
                    values: Object.fromEntries(
                      Object.entries(samples).map(([key, values]) => [
                        key,
                        summarizeValues(values),
                      ]),
                    ),
                  };
                } finally {
                  Math.random = originalRandom;
                }
              });
              return { name: scenario.name, input: scenario, seedResults };
            });
            const baselineRandomValues = randomCases[0].randomValues;
            const attemptScenarios = [
              {
                name: "better-craft-replaces-and-saves",
                gems: "1",
                usedGemsLevel: 0,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: {},
                shiftHeld: false,
                randomValues: [...baselineRandomValues],
              },
              {
                name: "equal-damage-is-a-dud",
                gems: "1",
                usedGemsLevel: 0,
                equippedPickaxe: {
                  name: "Already Equipped",
                  power: "31.5",
                  quality: "0.9900000000000001",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: {},
                shiftHeld: false,
                randomValues: [...baselineRandomValues],
              },
              {
                name: "insufficient-gems-consumes-no-rng",
                gems: "0.5",
                usedGemsLevel: 0,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: {},
                shiftHeld: false,
                randomValues: [],
              },
              {
                name: "bulk-success-dud-then-insufficient",
                gems: "2",
                usedGemsLevel: 0,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: { planetCoins: { bulkCraft: 2 } },
                shiftHeld: true,
                randomValues: [
                  ...baselineRandomValues,
                  ...baselineRandomValues,
                ],
              },
              {
                name: "fractional-gem-balance-rounds-after-spend",
                gems: "2.6",
                usedGemsLevel: 0,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: {},
                shiftHeld: false,
                randomValues: [...baselineRandomValues],
              },
              {
                name: "selected-gem-level-controls-craft-cost",
                gems: "3",
                usedGemsLevel: 1,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: { money: { gemWaster: 1 } },
                shiftHeld: false,
                randomValues: [...baselineRandomValues],
              },
              {
                name: "bulk-replacements-save-each-intermediate-state",
                gems: "6",
                usedGemsLevel: 1,
                equippedPickaxe: {
                  name: "Toy Pickaxe",
                  power: "20",
                  quality: "1",
                },
                highestMineObjectLevel: 0,
                powers: ["1", "1", "1", "1", "1"],
                upgradeLevels: {
                  money: { gemWaster: 1 },
                  planetCoins: { bulkCraft: 1 },
                },
                shiftHeld: true,
                randomValues: [
                  ...baselineRandomValues,
                  0.9,
                  0.9,
                  0.99,
                  0.99,
                  0.6,
                  0.5,
                  0.5,
                  0.5,
                  0.5,
                  0.5,
                ],
              },
            ];
            const attempts = attemptScenarios.map((scenario) => {
              setState(scenario);
              game.gems = new Decimal(scenario.gems);
              game.pickaxe = new Pickaxe(
                scenario.equippedPickaxe.name,
                scenario.equippedPickaxe.power,
                scenario.equippedPickaxe.quality,
              );
              game.messageLog = [];
              let saveCalls = 0;
              const eventOrder = [];
              const saveSnapshots = [];
              functions.saveGame = () => {
                saveCalls++;
                eventOrder.push("save");
                saveSnapshots.push({
                  gems: normalizedDecimal(game.gems),
                  pickaxe: {
                    name: game.pickaxe.name,
                    power: normalizedDecimal(game.pickaxe.pow),
                    quality: normalizedDecimal(game.pickaxe.quality),
                  },
                });
              };
              functions.logMessage = (message, color) => {
                eventOrder.push(`log:${message}`);
                previousLogMessage(message, color);
              };
              functions.keyPressed = (key) =>
                key === "Shift" && scenario.shiftHeld;

              let randomCalls = 0;
              Math.random = () => {
                const value = scenario.randomValues[randomCalls];
                if (value === undefined) {
                  throw new Error(
                    `Pickaxe transaction ${scenario.name} consumed an uncaptured RNG draw.`,
                  );
                }
                randomCalls++;
                return value;
              };
              try {
                const craftGems = functions.getUsedGems();
                functions.craftPick(craftGems);
                return {
                  name: scenario.name,
                  input: {
                    ...scenario,
                    usedGemsLevel: scenario.usedGemsLevel ?? 0,
                    craftGems: normalizedDecimal(craftGems),
                  },
                  randomCalls,
                  saveCalls,
                  saveSnapshots,
                  eventOrder,
                  messageLog: normalize(game.messageLog),
                  result: {
                    gems: normalizedDecimal(game.gems),
                    pickaxe: {
                      name: game.pickaxe.name,
                      power: normalizedDecimal(game.pickaxe.pow),
                      quality: normalizedDecimal(game.pickaxe.quality),
                      damage: normalizedDecimal(game.pickaxe.getDamage()),
                    },
                  },
                };
              } finally {
                Math.random = originalRandom;
                functions.saveGame = previousSaveGame;
                functions.logMessage = previousLogMessage;
                functions.keyPressed = previousKeyPressed;
              }
            });
            return {
              sourcePaths: [
                "Scripts/pickaxe.js",
                "Scripts/utils.js",
                "Scripts/Define/game.js",
                "Scripts/Define/functions.js",
                "Scripts/mineobject.js",
                "index.html",
                "main.css",
              ],
              randomSource: "Math.random",
              craftControls: {
                controlSourcePaths: [
                  "index.html",
                  "Scripts/Define/functions.js",
                  "Scripts/Define/game.js",
                ],
                controls: craftControls,
                transitions: controlTransitions,
              },
              crafts,
              distributions: {
                sourcePaths: [
                  "Scripts/pickaxe.js",
                  "Scripts/utils.js",
                  "Scripts/Define/functions.js",
                ],
                rng: "32-bit LCG (1664525, 1013904223, modulo 2^32)",
                sampleCountPerSeed: distributionSampleCount,
                seedResults: distributionSeeds,
                scenarios: distributions,
              },
              deterministic: {
                input: deterministic,
                randomCalls,
                minimum: {
                  name: minimum.name,
                  power: normalizedDecimal(minimum.pow),
                  quality: normalizedDecimal(minimum.quality),
                  damage: normalizedDecimal(minimum.getDamage()),
                },
                average: {
                  name: average.name,
                  power: normalizedDecimal(average.pow),
                  quality: normalizedDecimal(average.quality),
                  damage: normalizedDecimal(average.getDamage()),
                },
              },
              attempts,
            };
          } finally {
            Math.random = originalRandom;
            game.highestMineObjectLevel = previousHighestMineObjectLevel;
            game.usedGemsLevel = previousUsedGemsLevel;
            game.powers.data.values = previousPowers;
            game.gems = previousGems;
            game.pickaxe = previousPickaxe;
            game.messageLog = previousMessageLog;
            functions.saveGame = previousSaveGame;
            functions.logMessage = previousLogMessage;
            functions.keyPressed = previousKeyPressed;
            for (const [group, levels] of Object.entries(previousLevels)) {
              for (const [key, level] of Object.entries(levels)) {
                upgradeGroups[group][key].level = level;
              }
            }
          }
        })();
        const hardResetSemantics = (() => {
          const previousConfirm = window.confirm;
          const previousStorage = Array.from(
            { length: localStorage.length },
            (_, index) => {
              const key = localStorage.key(index);
              return key === null ? null : [key, localStorage.getItem(key)];
            },
          ).filter((entry) => entry !== null);
          const controlledSave = JSON.parse(window.initialGame);
          Object.assign(controlledSave, {
            money: "12345",
            highestMoney: "54321",
            gems: "99",
            planetCoins: "6",
            maxPlanetCoins: "9",
            wisdom: "44",
            maxWisdom: "50",
            mineObjectLevel: 80,
            highestMineObjectLevel: 90,
            lastActive: fixedClock - 10_000,
          });
          controlledSave.story = {
            ...controlledSave.story,
            page: 7,
            notifications: 4,
            highestUnlocked: 49,
            scrollY: 234,
          };
          controlledSave.settings = {
            ...controlledSave.settings,
            theme: "dark",
            showMineObjLevel: true,
            showMinCraftDamage: true,
          };
          controlledSave.upgrades.blacksmith.level = 4;
          controlledSave.gemUpgrades.gemChance.level = 3;
          controlledSave.planetCoinUpgrades.offlineTime.level = 2;
          controlledSave.powers.data.values = ["64", "32", "16", "8", "4"];
          controlledSave.powers.upgrades.powerResetKeep.level = 2;
          controlledSave.pickaxe.name = "Reset Probe Pickaxe";
          controlledSave.pickaxe.pow = "100";
          controlledSave.pickaxe.quality = "3";

          const storageSnapshot = () =>
            Array.from({ length: localStorage.length }, (_, index) => {
              const key = localStorage.key(index);
              return key === null ? null : [key, localStorage.getItem(key)];
            }).filter((entry) => entry !== null);
          const stateSnapshot = () => ({
            resources: {
              money: normalizedDecimal(game.money),
              highestMoney: normalizedDecimal(game.highestMoney),
              gems: normalizedDecimal(game.gems),
              planetCoins: normalizedDecimal(game.planetCoins),
              maxPlanetCoins: normalizedDecimal(game.maxPlanetCoins),
              wisdom: normalizedDecimal(game.wisdom),
              maxWisdom: normalizedDecimal(game.maxWisdom),
            },
            mineObject: {
              current: game.mineObjectLevel,
              highest: game.highestMineObjectLevel,
              name: game.currentMineObject.name,
            },
            story: {
              page: game.story.page,
              notifications: game.story.notifications,
              highestUnlocked: game.story.highestUnlocked,
              scrollY: game.story.scrollY,
            },
            settings: {
              tab: game.settings.tab,
              upgradeTab: game.settings.upgradeTab,
              exportFieldString: game.settings.exportFieldString,
              theme: game.settings.theme,
              numberFormatterIndex: game.settings.numberFormatterIndex,
              showMineObjLevel: game.settings.showMineObjLevel,
              showMinCraftDamage: game.settings.showMinCraftDamage,
            },
            upgradeLevels: {
              blacksmith: game.upgrades.blacksmith.level,
              gemChance: game.gemUpgrades.gemChance.level,
              offlineTime: game.planetCoinUpgrades.offlineTime.level,
              powerResetKeep: game.powers.upgrades.powerResetKeep.level,
            },
            powers: game.powers.data.values.map(normalizedDecimal),
            pickaxe: {
              name: game.pickaxe.name,
              power: normalizedDecimal(game.pickaxe.pow),
              quality: normalizedDecimal(game.pickaxe.quality),
              damage: normalizedDecimal(game.pickaxe.getDamage()),
            },
            usedGemsLevel: game.usedGemsLevel,
            pickStatus: game.pickStatus,
            messageLog: normalize(game.messageLog),
            lastActive: game.lastActive,
            timer: { ...game.timer },
          });
          const runScenario = (name, confirmationAnswers) => {
            functions.loadGame(JSON.stringify(controlledSave), false, true);
            game.settings.tab = "settings";
            game.settings.upgradeTab = "planetcoins";
            game.settings.exportFieldString = "old export text";
            game.messageLog = [{ message: "unsaved reset probe" }];
            game.usedGemsLevel = 12;
            game.pickStatus = "old pick status";
            game.timer.autoPickaxe = 0.25;
            game.timer.save = 41;
            localStorage.clear();
            localStorage.setItem("IdleMine", "existing-save");
            localStorage.setItem("unrelated-origin-data", "existing-data");
            const before = stateSnapshot();
            const storageBefore = storageSnapshot();
            const confirmationPrompts = [];
            window.confirm = (message) => {
              confirmationPrompts.push(message);
              return (
                confirmationAnswers[confirmationPrompts.length - 1] ?? false
              );
            };
            functions.hardReset();
            return {
              name,
              input: { confirmationAnswers },
              confirmationPrompts,
              before,
              after: stateSnapshot(),
              storageBefore,
              storageAfter: storageSnapshot(),
            };
          };

          const cancelled = [
            runScenario("cancel-first-confirmation", [false]),
            runScenario("cancel-second-confirmation", [true, false]),
            runScenario("cancel-third-confirmation", [true, true, false]),
          ];
          const confirmed = runScenario("confirm-all-prompts", [
            true,
            true,
            true,
          ]);
          window.confirm = previousConfirm;
          localStorage.clear();
          for (const [key, value] of previousStorage) {
            if (value !== null) localStorage.setItem(key, value);
          }
          return {
            sourcePaths: [
              "index.html",
              "Scripts/Define/functions.js",
              "Scripts/Define/game.js",
            ],
            controlledSave: {
              money: controlledSave.money,
              gems: controlledSave.gems,
              planetCoins: controlledSave.planetCoins,
              wisdom: controlledSave.wisdom,
              mineObjectLevel: controlledSave.mineObjectLevel,
              highestMineObjectLevel: controlledSave.highestMineObjectLevel,
              story: controlledSave.story,
              settings: controlledSave.settings,
              upgradeLevels: {
                blacksmith: controlledSave.upgrades.blacksmith.level,
                gemChance: controlledSave.gemUpgrades.gemChance.level,
                offlineTime:
                  controlledSave.planetCoinUpgrades.offlineTime.level,
                powerResetKeep:
                  controlledSave.powers.upgrades.powerResetKeep.level,
              },
              powerValues: controlledSave.powers.data.values,
              pickaxe: controlledSave.pickaxe,
            },
            cancelled,
            confirmed,
          };
        })();
        return {
          initialState,
          powersTableSemantics,
          hardResetSemantics,
          initialRates: rates,
          notationOutputs,
          notationSemantics,
          decimalSemantics,
          randomSemantics,
          randomSequenceExhaustion,
          mineObjectCatalog,
          formulaSemantics,
          offlineLoadRateCompositionSemantics,
          miningHitSemantics,
          simulationFrameSemantics,
          payUSDebtSemantics,
          offlineProgressionSemantics,
          saveSemantics,
          saveExportSemantics,
          saveApplicationSemantics,
          saveOfflineApplicationSemantics,
          storyTabSemantics,
          storySemantics,
          upgradeSemantics,
          pickaxeCraftingSemantics,
          objects: uniqueObjectIds.map(snapshotObject),
          probeRuntime: normalize(window.__idleMineProbe),
          currentObjectHpAfterCapture: normalizedDecimal(current.hp),
        };
      },
      { selectedPostUniverseIds: postUniverseIds, fixedClock },
    );

    for (const name of ["fresh", "controlled"]) {
      const snapshot = data.saveExportSemantics[name];
      const objectJson = JSON.stringify(snapshot.object);
      if (objectJson !== snapshot.json) {
        throw new Error(`${name} full save object changed during capture.`);
      }
      snapshot.jsonUtf8Bytes = Buffer.byteLength(snapshot.json, "utf8");
      snapshot.jsonSha256 = sha256(snapshot.json);
      snapshot.saveStringAsciiBytes = snapshot.encoded.length;
      snapshot.saveStringSha256 = sha256(snapshot.encoded);
      delete snapshot.encoded;
      delete snapshot.json;
    }
    for (const snapshot of data.saveExportSemantics.variants) {
      const objectJson = JSON.stringify(snapshot.object);
      if (objectJson !== snapshot.json) {
        throw new Error(
          `${snapshot.name} full save object changed during capture.`,
        );
      }
      snapshot.changedFields = Object.keys(
        data.saveExportSemantics.fresh.object,
      ).filter(
        (key) =>
          JSON.stringify(snapshot.object[key]) !==
          JSON.stringify(data.saveExportSemantics.fresh.object[key]),
      );
      snapshot.mineObjectLevel = snapshot.object.mineObjectLevel;
      snapshot.highestMineObjectLevel = snapshot.object.highestMineObjectLevel;
      snapshot.lastActive = snapshot.object.lastActive;
      snapshot.currentMineObject = snapshot.object.currentMineObject;
      snapshot.messageLog = snapshot.object.messageLog;
      snapshot.settings = snapshot.object.settings;
      snapshot.jsonUtf8Bytes = Buffer.byteLength(snapshot.json, "utf8");
      snapshot.jsonSha256 = sha256(snapshot.json);
      snapshot.saveStringAsciiBytes = snapshot.encoded.length;
      snapshot.saveStringSha256 = sha256(snapshot.encoded);
      delete snapshot.object;
      delete snapshot.encoded;
      delete snapshot.json;
    }

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
          "index.html",
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
  const capturedUpgrades = Object.values(
    expected.data.upgradeSemantics?.groups ?? {},
  ).flatMap((group) => Object.values(group));
  const upgradeSampleCount = capturedUpgrades.reduce(
    (sum, upgrade) => sum + upgrade.samples.length,
    0,
  );
  const stochasticSampleCount = Object.values(
    expected.data.upgradeSemantics?.stochasticEffects ?? {},
  ).reduce((sum, effect) => sum + (effect.samples?.length ?? 0), 0);
  const effectInteractions =
    expected.data.upgradeSemantics?.effectInteractions ?? [];
  const interactionEffectCount = effectInteractions.reduce(
    (sum, interaction) => sum + interaction.effects.length,
    0,
  );
  const purchaseCaseCount =
    expected.data.upgradeSemantics?.purchaseSemantics?.length ?? 0;
  const miningCases = expected.data.miningHitSemantics?.cases ?? [];
  const miningHitCaseCount = miningCases.filter(
    (scenario) => !scenario.name.startsWith("frame-"),
  ).length;
  const updateFrameCaseCount = miningCases.length - miningHitCaseCount;
  const simulationFrameCaseCount =
    expected.data.simulationFrameSemantics?.cases?.length ?? 0;
  const storySemantics = expected.data.storySemantics;
  const storyBoundarySampleCount = storySemantics.conditionBoundaries.reduce(
    (total, boundary) => total + boundary.samples.length,
    0,
  );
  const storyMineLevelObjectiveCount =
    storySemantics.objectiveSamples.mineLevels.reduce(
      (total, sample) => total + sample.values.length,
      0,
    );
  const storyNotationObjectiveCount =
    storySemantics.objectiveSamples.notationFormats.reduce(
      (total, sample) => total + sample.values.length,
      0,
    );
  const payUSDebtCaseCount =
    expected.data.payUSDebtSemantics?.scenarios.length ?? 0;
  const storyTabCaseCount =
    expected.data.storyTabSemantics?.scenarios.length ?? 0;
  const offlineScenarioCount =
    expected.data.offlineProgressionSemantics?.scenarios.length ?? 0;
  const offlineRateCompositionScenarioCount =
    expected.data.offlineLoadRateCompositionSemantics?.scenarios.length ?? 0;
  const saveCodecVectorCount =
    expected.data.saveSemantics?.codecVectors.length ?? 0;
  const saveLoadErrorCount =
    expected.data.saveSemantics?.loadErrors.length ?? 0;
  const saveApplicationCount = expected.data.saveApplicationSemantics ? 1 : 0;
  const saveOfflineApplicationCount = expected.data
    .saveOfflineApplicationSemantics
    ? 1
    : 0;
  const saveExportVariantCount =
    expected.data.saveExportSemantics?.variants?.length ?? 0;
  process.stdout.write(
    `Verified the reference corpus against ${reference.pinnedCommit} (${expected.data.objects.length} objects; ${expected.data.decimalSemantics?.inputs.length ?? 0} Decimal inputs; ${expected.data.notationSemantics?.formatterRegistry.length ?? 0} formatters and ${expected.data.notationSemantics?.directFormatterInputs.length ?? 0} boundary values; ${capturedUpgrades.length} upgrades / ${upgradeSampleCount} price-effect level samples / ${effectInteractions.length} interaction scenarios with ${interactionEffectCount} effects / ${stochasticSampleCount} stochastic RNG cases / ${purchaseCaseCount} purchase cases / ${miningHitCaseCount} mining-hit cases / ${updateFrameCaseCount} update-frame cases / ${simulationFrameCaseCount} composed simulation-frame cases / ${storySemantics.chapters.length} story chapters / ${storySemantics.milestones.length} milestones / ${storyBoundarySampleCount} condition-boundary samples / ${storySemantics.notificationScenarios.length} notification scenarios / ${storySemantics.notificationSequence.length} sequenced notification stages / ${storyMineLevelObjectiveCount} mine-level objective outputs / ${storyNotationObjectiveCount} notation-dependent objective outputs / ${payUSDebtCaseCount} debt-interaction cases / ${storyTabCaseCount} story-tab cases / ${offlineScenarioCount} offline-progression cases / ${offlineRateCompositionScenarioCount} live-rate offline-load cases / ${saveCodecVectorCount} save codec vectors / ${saveLoadErrorCount} load error branches / ${saveApplicationCount} complete save-application captures / ${saveOfflineApplicationCount} composed save/offline-load captures / ${saveExportVariantCount} full-save export variants).\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
