import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import {
  constants as zlibConstants,
  createBrotliCompress,
  createBrotliDecompress,
  gunzipSync,
  gzipSync,
} from "node:zlib";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { format } from "prettier";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";
import { compactStoryRouteRecords } from "./story-route-trace.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const dependenciesPath = path.join(
  root,
  "docs/knowledge/sources/runtime-dependencies.json",
);
const markupPath = path.join(
  root,
  "tests/fixtures/parity/remix-story-markup.json",
);
const fixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-story-runtime.json",
);
const phaseDifferentialFixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-phase-differentials.json",
);
const visualGoldenDirectory = path.join(
  root,
  "tests/fixtures/visual/remix-story-mine-objects",
);
const visualGoldenManifestPath = path.join(
  visualGoldenDirectory,
  "manifest.json",
);
const outputDirectory = path.join(root, ".research/outputs/story-runtime");
const storyRouteTraceDirectory = path.join(root, "tests/fixtures/parity");
const storyRouteTraceSinks = new WeakMap();
const fixedClock = 1_704_067_200_000;
const randomSeed = 0x1d1e;
const viewport = { width: 1440, height: 900 };
// The natural Chapter 6 route replays about 3.75 million source checkpoints
// and takes hours, so only `--check-chapter6` recaptures it.
let captureChapter6Route = false;
const compactTraceCompressionOptions = {
  params: {
    [zlibConstants.BROTLI_PARAM_QUALITY]: 9,
    [zlibConstants.BROTLI_PARAM_LGWIN]: 24,
  },
};
const routeTraceCompressionOptions = {
  params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 4 },
};
const endgamePhases = [
  {
    id: "space",
    heading: "Hyperplanets",
    page: 6,
    mineObjectLevel: 124,
    milestone: "hyperSaturn",
    money: "1e80",
    gems: "100",
    planetCoins: "1000",
    wisdom: "0",
    pickaxePower: "1e62",
  },
  {
    id: "wisdom-stars",
    heading: "The Wisdom Era",
    page: 7,
    mineObjectLevel: 169,
    milestone: "reachWisdomEssence",
    money: "1e140",
    gems: "500",
    planetCoins: "1e8",
    wisdom: "10",
    pickaxePower: "1e104",
  },
  {
    id: "galaxies",
    heading: "Cosmic Superstructures",
    page: 8,
    mineObjectLevel: 198,
    milestone: "mineSmallGalaxy",
    money: "1e175",
    gems: "10000",
    planetCoins: "1e14",
    wisdom: "1e8",
    pickaxePower: "1e135",
  },
];
const phaseDifferentialActionCount = 10_000;
const phaseDifferentialSeeds = [
  { id: "seed-7454", rngSeed: 7_454, sequenceSeed: 1_256_245_121 },
  { id: "seed-2026", rngSeed: 2_026, sequenceSeed: 0x5eed0001 },
  { id: "seed-deadbeef", rngSeed: 0xdeadbeef, sequenceSeed: 0x5eed0002 },
];
const phaseDifferentialTraceBatchSize = 100;

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function setLegacySaveTab(saveString, tab) {
  const encodedJson = Buffer.from(saveString, "base64").toString("latin1");
  const json = JSON.parse(decodeURIComponent(decodeURIComponent(encodedJson)));
  json.settings.tab = tab;
  return Buffer.from(
    escape(encodeURIComponent(JSON.stringify(json))),
    "latin1",
  ).toString("base64");
}

function storyRouteTraceFixturePath(file) {
  return path.join(storyRouteTraceDirectory, file);
}

function storyRouteTraceOutputPath(file) {
  return path.join(outputDirectory, file);
}

function describeValue(value) {
  const json = JSON.stringify(value);
  return json && json.length > 160 ? `${json.slice(0, 160)}…` : json;
}

function findFirstDifference(actual, expected, location = "$") {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return undefined;
  if (
    typeof actual !== "object" ||
    typeof expected !== "object" ||
    actual === null ||
    expected === null
  ) {
    return `${location}: expected ${describeValue(expected)}, captured ${describeValue(actual)}`;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const difference = findFirstDifference(
      actual[key],
      expected[key],
      `${location}.${key}`,
    );
    if (difference) return difference;
  }
  return `${location}: key order differs`;
}

async function captureReplayRouteStart(page) {
  return page.evaluate(() => ({
    saveString: window.functions.getSaveString(),
    state: window.__idleMineBeyondProbe.simulationState(),
    random: window.__idleMineBeyondProbe.randomCursor(),
  }));
}

async function captureReplayCheckpoint(page, label) {
  return page.evaluate(
    (checkpointLabel) =>
      window.__idleMineBeyondProbe.checkpoint(checkpointLabel),
    label,
  );
}

async function createStoryRouteTraceSink(page, traceFile) {
  await mkdir(outputDirectory, { recursive: true });
  const filePath = path.join(outputDirectory, traceFile);
  const compressor = createBrotliCompress(routeTraceCompressionOptions);
  const output = createWriteStream(filePath);
  const completed = pipeline(compressor, output);
  let records = 0;
  const rawHash = createHash("sha256");
  let pageState = storyRouteTraceSinks.get(page);
  if (!pageState) {
    pageState = { activeSink: undefined };
    await page.exposeBinding(
      "__idleMineBeyondPushStoryRouteTrace",
      async (_source, batch) => {
        const activeSink = pageState.activeSink;
        if (!activeSink) {
          throw new Error("No Story route trace sink is active.");
        }
        await activeSink.push(batch);
      },
    );
    storyRouteTraceSinks.set(page, pageState);
  }
  if (pageState.activeSink) {
    throw new Error("A Story route trace sink is already active.");
  }

  const sink = {
    async push(batch) {
      const contents = `${batch.map((record) => JSON.stringify(record)).join("\n")}\n`;
      rawHash.update(contents);
      records += batch.length;
      await new Promise((resolve, reject) => {
        compressor.write(contents, (error) =>
          error ? reject(error) : resolve(),
        );
      });
    },
  };
  pageState.activeSink = sink;

  return {
    async close() {
      compressor.end();
      await completed;
      pageState.activeSink = undefined;
      return {
        path: filePath,
        records,
        rawSha256: rawHash.digest("hex"),
      };
    },
  };
}

async function readStoryRouteTraceSummary(filePath) {
  const rawHash = createHash("sha256");
  const lines = createInterface({
    input: createReadStream(filePath).pipe(createBrotliDecompress()),
    crlfDelay: Infinity,
  });
  let records = 0;
  let routeIterations = 0;
  let totalActiveClicks = 0;
  let craftAttempts = 0;
  let farmBreaks = 0;
  const eventCounts = {};
  const upgradePurchases = {};
  let last;
  for await (const line of lines) {
    rawHash.update(`${line}\n`);
    records++;
    const record = JSON.parse(line);
    last = record;
    eventCounts[record.event.type] = (eventCounts[record.event.type] ?? 0) + 1;
    if (record.event.type === "select" && record.event.purpose === "progress") {
      routeIterations++;
    }
    if (record.event.type === "craft") craftAttempts++;
    if (record.event.type === "purchase") {
      upgradePurchases[record.event.key] =
        (upgradePurchases[record.event.key] ?? 0) + 1;
    }
    if (record.event.type === "mine") {
      totalActiveClicks += record.event.clicks;
      if (record.event.purpose === "farm") farmBreaks++;
    }
  }
  if (!last) throw new Error(`Story route trace is empty: ${filePath}`);
  return {
    records,
    routeIterations,
    totalActiveClicks,
    craftAttempts,
    farmBreaks,
    eventCounts,
    upgradePurchases,
    rawSha256: rawHash.digest("hex"),
    last,
  };
}

async function mergeStoryRouteTraces(inputPaths, outputPath) {
  const rawHash = createHash("sha256");
  let records = 0;
  async function* traceLines() {
    for (const inputPath of inputPaths) {
      const lines = createInterface({
        input: createReadStream(inputPath).pipe(createBrotliDecompress()),
        crlfDelay: Infinity,
      });
      for await (const line of lines) {
        const recordLine = `${line}\n`;
        rawHash.update(recordLine);
        records++;
        yield recordLine;
      }
    }
  }
  const temporaryPath = `${outputPath}.tmp`;
  await pipeline(
    Readable.from(traceLines()),
    createBrotliCompress(routeTraceCompressionOptions),
    createWriteStream(temporaryPath),
  );
  await rename(temporaryPath, outputPath);
  return { records, rawSha256: rawHash.digest("hex") };
}

function readStoryRouteTraceRecords(filePath) {
  const lines = createInterface({
    input: createReadStream(filePath).pipe(createBrotliDecompress()),
    crlfDelay: Infinity,
  });
  return (async function* () {
    for await (const line of lines) yield JSON.parse(line);
  })();
}

/** Writes the tracked compact form of a full route trace from `.research/`. */
async function writeCompactStoryRouteTrace(fullPath, outputPath) {
  const sourceHash = createHash("sha256");
  const compactHash = createHash("sha256");
  let records = 0;
  async function* sourceRecords() {
    const lines = createInterface({
      input: createReadStream(fullPath).pipe(createBrotliDecompress()),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      sourceHash.update(`${line}\n`);
      yield JSON.parse(line);
    }
  }
  async function* compactLines() {
    for await (const record of compactStoryRouteRecords(sourceRecords())) {
      const line = `${JSON.stringify(record)}\n`;
      compactHash.update(line);
      records++;
      yield line;
    }
  }
  const temporaryPath = `${outputPath}.tmp`;
  await pipeline(
    Readable.from(compactLines()),
    createBrotliCompress(compactTraceCompressionOptions),
    createWriteStream(temporaryPath),
  );
  await rename(temporaryPath, outputPath);
  return {
    records,
    rawSha256: compactHash.digest("hex"),
    sourceRawSha256: sourceHash.digest("hex"),
  };
}

async function restoreStoryRouteCheckpoint(page, { saveString, checkpoint }) {
  const restored = await page.evaluate(
    ({ saveString: startingSave, checkpoint: target }) => {
      const { game, functions } = window;
      const { state, random } = target;
      functions.loadGame(startingSave, true, true);

      const decimal = (value) => new window.Decimal(value);
      game.mineObjectLevel = state.mineObjectLevel;
      game.highestMineObjectLevel = state.highestMineObjectLevel;
      game.currentMineObject = functions.getMineObject(state.mineObjectLevel);
      game.currentMineObject.hp = decimal(state.currentObject.hp);
      for (const key of Object.keys(state.resources)) {
        game[key] = decimal(state.resources[key]);
      }
      const powerIndex = {
        mining: 0,
        craftsmanship: 1,
        expertise: 2,
        wisdom: 3,
        exquisity: 4,
      };
      for (const [name, index] of Object.entries(powerIndex)) {
        window.Vue.set(
          game.powers.data.values,
          index,
          decimal(state.powers[name]),
        );
      }
      const groups = {
        money: game.upgrades,
        gems: game.gemUpgrades,
        planetCoins: game.planetCoinUpgrades,
        wisdom: game.powers.upgrades,
      };
      for (const [groupName, upgrades] of Object.entries(groups)) {
        for (const [key, level] of Object.entries(state.upgrades[groupName])) {
          upgrades[key].level = level;
        }
      }
      game.pickaxe.name = state.pickaxe.name;
      game.pickaxe.pow = decimal(state.pickaxe.power);
      game.pickaxe.quality = decimal(state.pickaxe.quality);
      game.timer.autoPickaxe = state.autoPickaxeTimer;
      game.timer.save = state.saveTimer;
      game.usedGemsLevel = state.usedGemsLevel;
      game.lastActive = state.lastActiveMs;
      game.story.page = state.story.page;
      game.story.highestUnlocked = state.story.highestUnlocked;
      game.story.notifications = state.story.notifications;
      functions.changeTab("main");
      window.__idleMineBeyondProbe.restoreRandomCursor(random);
      return {
        state: window.__idleMineBeyondProbe.simulationState(),
        random: window.__idleMineBeyondProbe.randomCursor(),
      };
    },
    { saveString, checkpoint },
  );
  if (JSON.stringify(restored.state) !== JSON.stringify(checkpoint.state)) {
    throw new Error(
      `Restored source route checkpoint differs: ${findFirstDifference(restored.state, checkpoint.state)}.`,
    );
  }
  if (JSON.stringify(restored.random) !== JSON.stringify(checkpoint.random)) {
    throw new Error(
      "Restored source route RNG cursor differs from its checkpoint.",
    );
  }
  return restored;
}

async function captureChapter6Continuation(page, captureScreenshots) {
  const expected = JSON.parse(await readFile(fixturePath, "utf8"));
  const millionaire = expected.spookyBoneProgression.millionaireProgression;
  const chapter5 = millionaire.chapter5Progression;
  const partialTracePath = storyRouteTraceOutputPath(
    "story-natural-chapter-6-route.jsonl.br",
  );
  const partial = await readStoryRouteTraceSummary(partialTracePath);
  const chapter5End = await readStoryRouteTraceSummary(
    storyRouteTraceFixturePath(chapter5.trace.file),
  );
  if (
    partial.last.event.type !== "mine" ||
    partial.last.event.purpose !== "farm" ||
    partial.last.checkpoint.random.seed !== randomSeed ||
    partial.last.checkpoint.state.highestMineObjectLevel < 72 ||
    chapter5End.last.event.type !== "storyPage" ||
    chapter5End.last.checkpoint.state.story.page !== 4
  ) {
    throw new Error(
      "The saved Chapter 6 partial trace or Chapter 5 route endpoint is not a valid continuation point.",
    );
  }

  await restoreStoryRouteCheckpoint(page, {
    saveString: chapter5.saveString,
    checkpoint: partial.last.checkpoint,
  });
  const chapter6Progression = await captureNaturalStoryChapterProgression(
    page,
    {
      chapterNumber: 6,
      targetMineObjectLevel: 90,
      storyPage: 5,
      milestoneKey: "breakSpacePortal",
      chapterHeading: "Chapter 6: Gone to Space",
      traceFile: "story-natural-chapter-6-continuation.jsonl.br",
      traceBatchSize: 2048,
      batchUnchangingActiveClicks: true,
      upgradeKeys: [
        "gemWaster",
        "blacksmithSkill",
        "blacksmithBonus",
        "gemChance",
        "blacksmith",
        "activePower",
      ],
      gemUpgradeKeys: ["gemChance", "blacksmith", "blacksmithSkill"],
      gemUpgradeTargets: {
        gemChance: 3,
        blacksmith: 15,
        blacksmithSkill: 10,
      },
      targetCraftGemLevel: null,
      routeIterationsOffset: partial.routeIterations,
      totalActiveClicksOffset: partial.totalActiveClicks,
      craftAttemptsOffset: partial.craftAttempts,
      farmBreaksOffset: partial.farmBreaks,
      maxIterations: 5_000_000,
    },
    captureScreenshots,
  );
  chapter6Progression.replayRouteStart = {
    saveString: setLegacySaveTab(chapter5.saveString, "main"),
    state: chapter5End.last.checkpoint.state,
    random: chapter5End.last.checkpoint.random,
  };
  const completeTrace = await mergeStoryRouteTraces(
    [
      partialTracePath,
      storyRouteTraceOutputPath(
        "story-natural-chapter-6-continuation.jsonl.br",
      ),
    ],
    partialTracePath,
  );
  chapter6Progression.trace = {
    file: "story-natural-chapter-6-route.jsonl.br",
    ...completeTrace,
  };
  return chapter6Progression;
}

async function assertStoryRouteTracesMatch(
  actualPath,
  expectedPath,
  { compactExpected = false } = {},
) {
  const makeLines = (filePath) =>
    createInterface({
      input: createReadStream(filePath).pipe(createBrotliDecompress()),
      crlfDelay: Infinity,
    });
  // A tracked compact trace is compared with the compact form of the capture.
  const actual = compactExpected
    ? (async function* () {
        for await (const record of compactStoryRouteRecords(
          readStoryRouteTraceRecords(actualPath),
        )) {
          yield JSON.stringify(record);
        }
      })()[Symbol.asyncIterator]()
    : makeLines(actualPath)[Symbol.asyncIterator]();
  const expected = makeLines(expectedPath)[Symbol.asyncIterator]();
  let index = 0;
  while (true) {
    const [actualLine, expectedLine] = await Promise.all([
      actual.next(),
      expected.next(),
    ]);
    if (actualLine.done || expectedLine.done) {
      if (actualLine.done !== expectedLine.done) {
        throw new Error(
          `Source route trace ${path.basename(actualPath)} length differs after ${index} checkpoints.`,
        );
      }
      return index;
    }
    index++;
    const actualRecord = JSON.parse(actualLine.value);
    const expectedRecord = JSON.parse(expectedLine.value);
    if (JSON.stringify(actualRecord) !== JSON.stringify(expectedRecord)) {
      throw new Error(
        `Source route trace ${path.basename(actualPath)} differs at checkpoint ${index}: ${findFirstDifference(actualRecord, expectedRecord)}.`,
      );
    }
  }
}

async function captureNaturalStoryChapterProgression(
  page,
  routeConfiguration,
  captureScreenshots,
) {
  await page.evaluate(() => window.functions.changeTab("main"));
  const replayRouteStart = await captureReplayRouteStart(page);
  const traceSink = routeConfiguration.traceFile
    ? await createStoryRouteTraceSink(page, routeConfiguration.traceFile)
    : undefined;
  let replay;
  try {
    replay = await page.evaluate(
      async (route) => {
        const { game, functions } = window;
        const events = [];
        const replayCheckpoints = [];
        const traceBatch = [];
        let routeRecordCount = 0;
        let totalActiveClicks = route.totalActiveClicksOffset ?? 0;
        let craftAttempts = route.craftAttemptsOffset ?? 0;
        let farmBreaks = route.farmBreaksOffset ?? 0;

        const record = async (event) => {
          const checkpoint = window.__idleMineBeyondProbe.checkpoint(
            event.label,
          );
          routeRecordCount++;
          if (route.streamTrace) {
            traceBatch.push({ event, checkpoint });
            if (traceBatch.length >= route.traceBatchSize) {
              await window.__idleMineBeyondPushStoryRouteTrace(
                traceBatch.splice(0),
              );
            }
          } else {
            events.push(event);
            replayCheckpoints.push(checkpoint);
          }
        };
        const select = async (id, purpose) => {
          functions.setMineObjectLevel(id);
          await record({
            type: "select",
            id,
            purpose,
            label: `select-${purpose}-${id}`,
          });
        };
        const buyAffordableUpgrades = async () => {
          for (const key of route.upgradeKeys) {
            const upgrade = game.upgrades[key];
            while (upgrade.buy()) {
              await record({
                type: "purchase",
                key,
                level: upgrade.level,
                label: `purchase-${key}-${upgrade.level}`,
              });
            }
          }
          if (game.gemUpgradesUnlocked()) {
            for (const key of route.gemUpgradeKeys ?? []) {
              const upgrade = game.gemUpgrades[key];
              const targetLevel = route.gemUpgradeTargets?.[key];
              while (
                (targetLevel === undefined || upgrade.level < targetLevel) &&
                upgrade.buy()
              ) {
                await record({
                  type: "gemUpgradePurchase",
                  key,
                  level: upgrade.level,
                  label: `purchase-gem-${key}-${upgrade.level}`,
                });
              }
            }
          }
        };
        const chooseCraftGemLevel = async () => {
          const maximumLevel =
            game.upgrades.gemWaster.level + game.gemUpgrades.gemWaster.level;
          const progressionLevel = Object.entries(
            route.craftGemLevelFromMineObjectLevel ?? {},
          )
            .filter(
              ([minimumLevel]) =>
                game.highestMineObjectLevel >= Number(minimumLevel),
            )
            .sort(([left], [right]) => Number(left) - Number(right))
            .at(-1)?.[1];
          const targetLevel = Math.min(
            progressionLevel ?? route.targetCraftGemLevel ?? maximumLevel,
            maximumLevel,
          );
          while (game.usedGemsLevel !== targetLevel) {
            const direction =
              game.usedGemsLevel < targetLevel ? "increase" : "decrease";
            game.usedGemsLevel += direction === "increase" ? 1 : -1;
            await record({
              type: "craftLevel",
              direction,
              level: game.usedGemsLevel,
              label:
                direction === "increase"
                  ? `craft-gem-level-${game.usedGemsLevel}`
                  : `craft-gem-level-down-${game.usedGemsLevel}`,
            });
          }
        };
        const mineOneBreak = async (id, purpose) => {
          const damage = functions.getActiveDamage();
          if (damage.lte(0)) {
            throw new Error(
              `Natural Chapter ${route.chapterNumber} route cannot damage ${game.currentMineObject.name} (#${id}).`,
            );
          }
          const moneyBefore = game.money;
          let clicks = 0;
          let batchedClicks = false;
          const canBatchClicks =
            route.batchUnchangingActiveClicks &&
            game.powers.upgrades.powerPowerActive.level === 0 &&
            game.powers.data.values[0].eq(1);
          if (canBatchClicks) {
            // In the pinned source, clickMineObject() only damages the object
            // and multiplies Power of Mining by Power Power (Active). With
            // that upgrade at level 0, its effect is exactly 1 and no state
            // changes between hits. Keep the exact source click count in the
            // event while applying the equivalent aggregate damage once.
            const batchClicks = Math.ceil(
              game.currentMineObject.hp.div(damage).toNumber(),
            );
            const batchDamage = damage.mul(batchClicks);
            const previousDamage = damage.mul(batchClicks - 1);
            if (
              Number.isSafeInteger(batchClicks) &&
              batchClicks > 0 &&
              batchClicks <= 10_000_000 &&
              batchDamage.gte(game.currentMineObject.hp) &&
              previousDamage.lt(game.currentMineObject.hp)
            ) {
              clicks = batchClicks;
              batchedClicks = true;
              totalActiveClicks += clicks;
              game.currentMineObject.damage(batchDamage);
              window.Vue.set(
                game.powers.data.values,
                0,
                game.powers.data.values[0].mul(1),
              );
            }
          }
          while (game.money.eq(moneyBefore)) {
            if (batchedClicks) {
              throw new Error(
                `Batched source clicks failed to break object ${id} after ${clicks} hits.`,
              );
            }
            functions.clickMineObject();
            clicks++;
            totalActiveClicks++;
            if (clicks > 10_000_000) {
              throw new Error(
                `Natural route exceeded the click guard at object ${id}.`,
              );
            }
          }
          window.update();
          if (purpose === "farm") farmBreaks++;
          await record({
            type: "mine",
            id,
            purpose,
            clicks,
            label: `${purpose}-break-${id}-${purpose === "farm" ? farmBreaks : game.highestMineObjectLevel}`,
          });
          return clicks;
        };

        let routeIterations = route.routeIterationsOffset ?? 0;
        while (game.highestMineObjectLevel < route.targetMineObjectLevel) {
          routeIterations++;
          if (routeIterations > (route.maxIterations ?? 1000)) {
            throw new Error(
              `Natural Chapter ${route.chapterNumber} route did not reach object ${route.targetMineObjectLevel}: ${JSON.stringify({ highest: game.highestMineObjectLevel, money: game.money.toString(), gems: game.gems.toString(), currentObject: { id: game.mineObjectLevel, name: game.currentMineObject.name, hp: game.currentMineObject.hp.toString(), defense: game.currentMineObject.def.toString() }, pickaxe: { name: game.pickaxe.name, power: game.pickaxe.pow.toString(), quality: game.pickaxe.quality.toString(), damage: game.pickaxe.getDamage().toString() }, activeDamage: functions.getActiveDamage().toString(), usedGemsLevel: game.usedGemsLevel, usedGems: functions.getUsedGems().toString(), upgrades: { blacksmith: game.upgrades.blacksmith.level, blacksmithSkill: game.upgrades.blacksmithSkill.level, blacksmithBonus: game.upgrades.blacksmithBonus.level, activePower: game.upgrades.activePower.level, gemChance: game.upgrades.gemChance.level, gemWaster: game.upgrades.gemWaster.level }, craftAttempts, farmBreaks, totalActiveClicks })}`,
            );
          }

          await buyAffordableUpgrades();
          await chooseCraftGemLevel();
          const targetId = game.highestMineObjectLevel;
          await select(targetId, "progress");
          let activeDamage = functions.getActiveDamage();
          const reservingGemsForUpgrade = (route.gemUpgradeKeys ?? []).some(
            (key) => {
              const targetLevel = route.gemUpgradeTargets?.[key];
              const upgrade = game.gemUpgrades[key];
              return (
                targetLevel !== undefined &&
                upgrade.level < targetLevel &&
                game.gems.lt(upgrade.currentPrice())
              );
            },
          );
          if (
            activeDamage.lte(0) &&
            game.gems.gte(functions.getUsedGems()) &&
            !reservingGemsForUpgrade
          ) {
            const usedGems = functions.getUsedGems();
            functions.craftPick(usedGems);
            craftAttempts++;
            await record({
              type: "craft",
              attempt: craftAttempts,
              label: `craft-${craftAttempts}`,
            });
            activeDamage = functions.getActiveDamage();
          }

          if (activeDamage.gt(0)) {
            await mineOneBreak(targetId, "progress");
            continue;
          }

          const farmId = Math.max(0, game.highestMineObjectLevel - 1);
          await select(farmId, "farm");
          await mineOneBreak(farmId, "farm");
        }

        functions.changeTab("story");
        await record({ type: "storyEntry", label: "story-entry" });
        functions.increaseStoryPage();
        await record({
          type: "storyPage",
          page: game.story.page,
          label: `story-page-${route.chapterNumber}`,
        });
        if (traceBatch.length > 0) {
          await window.__idleMineBeyondPushStoryRouteTrace(
            traceBatch.splice(0),
          );
        }

        return {
          ...(route.streamTrace
            ? {
                trace: {
                  file: route.traceFile,
                  records: routeRecordCount,
                },
              }
            : { events, replayCheckpoints }),
          routeIterations,
          totalActiveClicks,
          craftAttempts,
          farmBreaks,
          storyState: {
            tab: game.settings.tab,
            page: game.story.page,
            highestMineObjectLevel: game.highestMineObjectLevel,
            money: game.money.toString(),
            highestMoney: game.highestMoney.toString(),
            gems: game.gems.toString(),
            highestUnlocked: game.story.highestUnlocked,
            notifications: game.story.notifications,
            maxStoryPage: functions.getMaxStoryPage(),
            visibleMilestones: Object.keys(game.story.milestones).filter(
              (key) => functions.storyDisplayed(key),
            ),
            nextObjective: functions.getNextStoryText(),
            chapterHeading:
              document.querySelector(".chapter-control h3")?.textContent ??
              null,
          },
          saveString: functions.getSaveString(),
        };
      },
      {
        ...routeConfiguration,
        streamTrace: Boolean(traceSink),
        traceBatchSize: routeConfiguration.traceBatchSize ?? 256,
      },
    );
  } catch (error) {
    if (traceSink) await traceSink.close();
    throw error;
  }
  if (traceSink) {
    const traceMetadata = await traceSink.close();
    if (traceMetadata.records !== replay.trace.records) {
      throw new Error(
        `Chapter ${routeConfiguration.chapterNumber} trace writer received ${traceMetadata.records} records, browser reported ${replay.trace.records}.`,
      );
    }
    replay.trace.rawSha256 = traceMetadata.rawSha256;
    replay.trace.file = routeConfiguration.traceFile;
  }
  replay.replayRouteStart = replayRouteStart;

  await page.evaluate(() => window.functions.setTheme("light"));
  await page.waitForTimeout(100);
  const screenshotState = await page.evaluate(async () => {
    await new Promise((resolve) => window.app.$nextTick(resolve));
    await document.fonts.ready;
    const scroller = document.querySelector(".story-milestones");
    if (!scroller) throw new Error("Natural Story chapter view is missing.");
    return {
      tab: window.game.settings.tab,
      theme: window.game.settings.theme,
      page: window.game.story.page,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      highestUnlocked: window.game.story.highestUnlocked,
      notifications: window.game.story.notifications,
      maxStoryPage: window.functions.getMaxStoryPage(),
      visibleMilestones: Object.keys(window.game.story.milestones).filter(
        (key) => window.functions.storyDisplayed(key),
      ),
      nextObjective: window.functions.getNextStoryText(),
      chapterHeading:
        document.querySelector(".chapter-control h3")?.textContent ?? null,
      scrollTop: scroller.scrollTop,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
    };
  });
  if (
    screenshotState.tab !== "story" ||
    screenshotState.theme !== "light" ||
    screenshotState.page !== routeConfiguration.storyPage ||
    screenshotState.highestMineObjectLevel !==
      routeConfiguration.targetMineObjectLevel ||
    screenshotState.maxStoryPage !== routeConfiguration.storyPage ||
    !screenshotState.visibleMilestones.includes(
      routeConfiguration.milestoneKey,
    ) ||
    screenshotState.chapterHeading !== routeConfiguration.chapterHeading ||
    screenshotState.scrollTop !== 0
  ) {
    throw new Error(
      `Pinned natural Chapter ${routeConfiguration.chapterNumber} Story screenshot has unexpected state: ${JSON.stringify(screenshotState)}`,
    );
  }

  const screenshot = `story-natural-chapter-${routeConfiguration.chapterNumber}-light-1440x900.png`;
  if (captureScreenshots) {
    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
  }
  return { ...replay, screenshotState, screenshot };
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
  const status = await execFileAsync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: checkout, windowsHide: true },
  );
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
        `${dependency.name} snapshot hash ${actualHash} does not match the recorded ${dependency.sha256}.`,
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

async function captureFirstMudProgression(page, captureScreenshots) {
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(
    "Boolean(window.game && window.functions && window.app?.$el)",
  );
  await page.waitForFunction("window.imgLoaded === true");
  await page.evaluate(() => document.fonts.ready);
  const firstMudCanvas = page.locator("canvas.mine-object").first();
  for (let hit = 0; hit < 5; hit += 1) await firstMudCanvas.click();
  const miningState = await page.evaluate(() => {
    window.update();
    return {
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      mineObjectLevel: window.game.mineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstMudUnlocked: window.functions.storyUnlocked("firstMud"),
    };
  });
  if (
    miningState.highestMineObjectLevel !== 1 ||
    miningState.mineObjectLevel !== 0 ||
    miningState.currentObjectName !== "Mud" ||
    miningState.currentObjectHp !== "100" ||
    miningState.money !== "2" ||
    miningState.gems !== "5" ||
    miningState.storyHighestUnlocked !== 1 ||
    miningState.storyNotifications !== 2 ||
    !miningState.firstMudUnlocked
  ) {
    throw new Error(
      "Remix first-Mud progression did not reach the expected state: " +
        JSON.stringify(miningState),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    const themeState = await page.evaluate(async (selectedTheme) => {
      const themeLink = document.getElementById("css_theme");
      if (!themeLink)
        throw new Error("Remix theme stylesheet link is missing.");
      const expectedHref = new URL(
        `Themes/${selectedTheme}.css`,
        document.location.href,
      ).href;
      const nextStylesheetLoad =
        themeLink.href === expectedHref
          ? undefined
          : new Promise((resolve, reject) => {
              themeLink.addEventListener("load", resolve, { once: true });
              themeLink.addEventListener(
                "error",
                () =>
                  reject(
                    new Error(`Remix ${selectedTheme} CSS failed to load.`),
                  ),
                { once: true },
              );
            });
      window.functions.setTheme(selectedTheme);
      if (nextStylesheetLoad) await nextStylesheetLoad;
      await new Promise((resolve) =>
        window.__idleMineBeyondNativeAnimationFrame(resolve),
      );
      return {
        href: themeLink.href,
        stylesheetHref: themeLink.sheet?.href ?? null,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    }, theme);
    if (
      !themeState.href.endsWith(`/Themes/${theme}.css`) ||
      themeState.stylesheetHref !== themeState.href ||
      themeState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix ${theme} stylesheet did not apply before the Story capture: ${JSON.stringify(themeState)}.`,
      );
    }
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller)
        throw new Error("First-Mud Story scroller did not render.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        scrollTop: scroller.scrollTop,
        visibleMilestones: ["gameStart", "firstMud"].filter((key) =>
          window.functions.storyDisplayed(key),
        ),
        nextObjective: window.functions.getNextStoryText(),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 0 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 1 ||
      storyState.mineObjectLevel !== 0 ||
      storyState.highestMineObjectLevel !== 1 ||
      storyState.currentObjectName !== "Mud" ||
      storyState.currentObjectHp !== "100" ||
      storyState.money !== "2" ||
      storyState.gems !== "5" ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify(["gameStart", "firstMud"]) ||
      storyState.nextObjective !== "Mine a piece of Paper" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix first-Mud Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-first-mud-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario: "fresh-game-five-active-hits-source-update-story-tab-entry",
    activeCanvasClicks: 5,
    sourceUpdateInvoked: true,
    miningState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-first-mud-visual-metrics.json"),
      JSON.stringify(
        {
          miningState,
          captureNote:
            "Five real mine-canvas clicks break the fresh Mud object; the source update function refreshes Story notifications; entering Story clears notifications before both theme screenshots.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureFirstPaperProgression(page, captureScreenshots) {
  await page.locator("footer > button").first().click();
  await page.locator("button.changemineobj").nth(1).click();
  const miningSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    gems: window.game.gems.toString(),
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  const hitsToBreak = Math.ceil(
    Number(miningSetup.currentObjectTotalHp) / Number(miningSetup.activeDamage),
  );
  if (
    miningSetup.mineObjectLevel !== 1 ||
    miningSetup.highestMineObjectLevel !== 1 ||
    miningSetup.currentObjectName !== "Paper" ||
    miningSetup.currentObjectHp !== "400" ||
    miningSetup.currentObjectTotalHp !== "400" ||
    miningSetup.activeDamage !== "17" ||
    miningSetup.money !== "2" ||
    miningSetup.gems !== "5" ||
    miningSetup.storyHighestUnlocked !== 1 ||
    miningSetup.storyNotifications !== 0 ||
    hitsToBreak !== 24
  ) {
    throw new Error(
      "Remix did not reach the expected first-Paper mining state: " +
        JSON.stringify({ ...miningSetup, hitsToBreak }),
    );
  }

  const paperCanvas = page.locator("canvas.mine-object").first();
  for (let hit = 0; hit < hitsToBreak; hit += 1) await paperCanvas.click();
  const miningState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstPaperUnlocked: window.functions.storyUnlocked("firstPaper"),
    };
  });
  if (
    miningState.mineObjectLevel !== 1 ||
    miningState.highestMineObjectLevel !== 2 ||
    miningState.currentObjectName !== "Paper" ||
    miningState.currentObjectHp !== "400" ||
    miningState.money !== "12" ||
    miningState.gems !== "5" ||
    miningState.storyHighestUnlocked !== 2 ||
    miningState.storyNotifications !== 1 ||
    !miningState.firstPaperUnlocked
  ) {
    throw new Error(
      "Remix first-Paper progression did not reach the expected state: " +
        JSON.stringify(miningState),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller)
        throw new Error("First-Paper Story scroller did not render.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        scrollTop: scroller.scrollTop,
        visibleMilestones: ["gameStart", "firstMud", "firstPaper"].filter(
          (key) => window.functions.storyDisplayed(key),
        ),
        nextObjective: window.functions.getNextStoryText(),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 0 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 2 ||
      storyState.mineObjectLevel !== 1 ||
      storyState.highestMineObjectLevel !== 2 ||
      storyState.currentObjectName !== "Paper" ||
      storyState.currentObjectHp !== "400" ||
      storyState.money !== "12" ||
      storyState.gems !== "5" ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify(["gameStart", "firstMud", "firstPaper"]) ||
      storyState.nextObjective !== "Upgrade Your Blacksmith once" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix first-Paper Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-first-paper-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario:
      "fresh-game-first-mud-story-entry-next-object-24-paper-hits-story-entry",
    mineObjectId: 1,
    activeDamage: "17",
    activeCanvasClicks: 24,
    miningSetup,
    miningState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-first-paper-visual-metrics.json"),
      JSON.stringify(
        {
          miningSetup,
          miningState,
          captureNote:
            "After the captured first-Mud Story entry, select the next mine object (Paper), click its source canvas the pinned 24 times at 17 damage per hit, run the source update to refresh notifications, then enter Story before both theme screenshots.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureFirstBlacksmithProgression(page, captureScreenshots) {
  await page.locator("footer > button").first().click();
  await page.locator("button.changemineobj").nth(1).click();
  const miningSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectDefense: window.game.currentMineObject.def.toString(),
    currentObjectValue: window.game.currentMineObject.value.toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    blacksmithPrice: window.game.upgrades.blacksmith.currentPrice().toString(),
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  const hitsToBreak = Math.ceil(
    Number(miningSetup.currentObjectTotalHp) / Number(miningSetup.activeDamage),
  );
  if (
    miningSetup.mineObjectLevel !== 2 ||
    miningSetup.highestMineObjectLevel !== 2 ||
    miningSetup.currentObjectName !== "Salt" ||
    miningSetup.currentObjectHp !== "700" ||
    miningSetup.currentObjectTotalHp !== "700" ||
    miningSetup.currentObjectDefense !== "15" ||
    miningSetup.currentObjectValue !== "22" ||
    miningSetup.activeDamage !== "5" ||
    miningSetup.money !== "12" ||
    miningSetup.gems !== "5" ||
    miningSetup.blacksmithLevel !== 0 ||
    miningSetup.blacksmithPrice !== "30" ||
    miningSetup.storyHighestUnlocked !== 2 ||
    miningSetup.storyNotifications !== 0 ||
    hitsToBreak !== 140
  ) {
    throw new Error(
      "Remix did not reach the expected first-Salt mining state: " +
        JSON.stringify({ ...miningSetup, hitsToBreak }),
    );
  }

  const saltCanvas = page.locator("canvas.mine-object").first();
  for (let hit = 0; hit < hitsToBreak; hit += 1) await saltCanvas.click();
  const saltMiningState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstSaltUnlocked: window.functions.storyUnlocked("firstSalt"),
      blacksmithUpgradeUnlocked:
        window.functions.storyUnlocked("blacksmithUpgrade"),
      nextObjective: window.functions.getNextStoryText(),
    };
  });
  if (
    saltMiningState.mineObjectLevel !== 2 ||
    saltMiningState.highestMineObjectLevel !== 3 ||
    saltMiningState.currentObjectName !== "Salt" ||
    saltMiningState.currentObjectHp !== "700" ||
    saltMiningState.money !== "34" ||
    saltMiningState.gems !== "5" ||
    saltMiningState.storyHighestUnlocked !== 4 ||
    saltMiningState.storyNotifications !== 1 ||
    !saltMiningState.firstSaltUnlocked ||
    saltMiningState.blacksmithUpgradeUnlocked ||
    saltMiningState.nextObjective !== "Upgrade Your Blacksmith once"
  ) {
    throw new Error(
      "Remix first-Salt progression did not reach the expected state: " +
        JSON.stringify(saltMiningState),
    );
  }

  const blacksmithCard = page
    .locator(".upgradelist .upgrade")
    .filter({ has: page.locator('img[src="Images/upgrades/blacksmith.png"]') });
  if ((await blacksmithCard.count()) !== 1) {
    throw new Error("Remix did not render exactly one Money Blacksmith card.");
  }
  await blacksmithCard.click();
  await page.waitForFunction("window.game.upgrades.blacksmith.level === 1");
  const purchaseState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      blacksmithUpgradeUnlocked:
        window.functions.storyUnlocked("blacksmithUpgrade"),
      firstSaltUnlocked: window.functions.storyUnlocked("firstSalt"),
      nextObjective: window.functions.getNextStoryText(),
    };
  });
  if (
    purchaseState.mineObjectLevel !== 2 ||
    purchaseState.highestMineObjectLevel !== 3 ||
    purchaseState.currentObjectName !== "Salt" ||
    purchaseState.currentObjectHp !== "700" ||
    purchaseState.money !== "4" ||
    purchaseState.gems !== "5" ||
    purchaseState.blacksmithLevel !== 1 ||
    purchaseState.storyHighestUnlocked !== 4 ||
    purchaseState.storyNotifications !== 1 ||
    !purchaseState.blacksmithUpgradeUnlocked ||
    !purchaseState.firstSaltUnlocked ||
    purchaseState.nextObjective !== "Mine a piece of Clay"
  ) {
    throw new Error(
      "Remix Blacksmith purchase did not reach the expected Story state: " +
        JSON.stringify(purchaseState),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller)
        throw new Error("Blacksmith Story scroller did not render.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "gameStart",
          "firstMud",
          "firstPaper",
          "blacksmithUpgrade",
          "firstSalt",
        ].filter((key) => window.functions.storyDisplayed(key)),
        nextObjective: window.functions.getNextStoryText(),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 0 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 4 ||
      storyState.mineObjectLevel !== 2 ||
      storyState.highestMineObjectLevel !== 3 ||
      storyState.currentObjectName !== "Salt" ||
      storyState.currentObjectHp !== "700" ||
      storyState.money !== "4" ||
      storyState.gems !== "5" ||
      storyState.blacksmithLevel !== 1 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify([
          "gameStart",
          "firstMud",
          "firstPaper",
          "blacksmithUpgrade",
          "firstSalt",
        ]) ||
      storyState.nextObjective !== "Mine a piece of Clay" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix Blacksmith Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-first-blacksmith-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario:
      "fresh-game-first-mud-paper-salt-140-hits-blacksmith-purchase-story-entry",
    mineObjectId: 2,
    activeDamage: "5",
    activeCanvasClicks: 140,
    miningSetup,
    saltMiningState,
    purchaseState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-first-blacksmith-visual-metrics.json"),
      JSON.stringify(
        {
          miningSetup,
          saltMiningState,
          purchaseState,
          captureNote:
            "After the captured first-Mud and first-Paper interactions, select Salt, click its source canvas 140 times at 5 damage per hit, run the source update, then buy the affordable 30-Money Blacksmith once. The salt milestone advances the notification high-water past blacksmithUpgrade; the later true Blacksmith condition is visible but adds no new notification. Enter Story before both theme screenshots.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureFirstClayProgression(page, captureScreenshots) {
  await page.locator("footer > button").first().click();
  await page.locator("button.changemineobj").nth(1).click();
  const miningSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectDefense: window.game.currentMineObject.def.toString(),
    pickaxeName: window.game.pickaxe.name,
    pickaxePower: window.game.pickaxe.pow.toString(),
    pickaxeQuality: window.game.pickaxe.quality.toString(),
    pickaxeDamage: window.game.pickaxe.getDamage().toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    usedGems: window.functions.getUsedGems().toString(),
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  if (
    miningSetup.mineObjectLevel !== 3 ||
    miningSetup.highestMineObjectLevel !== 3 ||
    miningSetup.currentObjectName !== "Clay" ||
    miningSetup.currentObjectHp !== "1400" ||
    miningSetup.currentObjectTotalHp !== "1400" ||
    miningSetup.currentObjectDefense !== "35" ||
    miningSetup.pickaxeDamage !== "20" ||
    miningSetup.activeDamage !== "0" ||
    miningSetup.money !== "4" ||
    miningSetup.gems !== "5" ||
    miningSetup.blacksmithLevel !== 1 ||
    miningSetup.usedGems !== "1" ||
    miningSetup.storyHighestUnlocked !== 4 ||
    miningSetup.storyNotifications !== 0
  ) {
    throw new Error(
      "Remix did not reach the expected first-Clay pre-craft state: " +
        JSON.stringify(miningSetup),
    );
  }

  const craftButton = page.locator(".craft-pickaxe > button");
  if ((await craftButton.count()) !== 1) {
    throw new Error("Remix did not render its single-Gem craft control.");
  }
  const craftAttempts = [];
  for (let attempt = 1; attempt <= Number(miningSetup.gems); attempt += 1) {
    const gemsBefore = await page.evaluate(() => window.game.gems.toString());
    await craftButton.click();
    await page.evaluate(
      () => new Promise((resolve) => window.app.$nextTick(resolve)),
    );
    const outcome = await page.evaluate(() => ({
      mineObjectLevel: window.game.mineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      pickaxeName: window.game.pickaxe.name,
      pickaxePower: window.game.pickaxe.pow.toString(),
      pickaxeQuality: window.game.pickaxe.quality.toString(),
      pickaxeDamage: window.game.pickaxe.getDamage().toString(),
      activeDamage: window.functions.getActiveDamage().toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      miningStatsText:
        document.querySelector(".stats")?.innerText.replace(/\r/g, "") ?? null,
      recentMessages: window.game.messageLog
        .slice(0, 3)
        .map(({ message }) => message),
    }));
    if (Number(outcome.gems) !== Number(gemsBefore) - 1) {
      throw new Error(
        `Remix craft attempt ${attempt} did not consume exactly one Gem: ` +
          JSON.stringify({ gemsBefore, outcome }),
      );
    }
    craftAttempts.push({ attempt, gemsBefore, ...outcome });
    if (Number(outcome.activeDamage) > 0) break;
  }
  const craftState = craftAttempts.at(-1);
  if (!craftState)
    throw new Error("Remix produced no first-Clay craft attempt.");
  if (
    craftState.mineObjectLevel !== 3 ||
    craftState.currentObjectName !== "Clay" ||
    craftState.currentObjectHp !== "1400" ||
    Number(craftState.pickaxeDamage) <= Number(miningSetup.pickaxeDamage) ||
    Number(craftState.activeDamage) <= 0 ||
    craftState.money !== "4" ||
    craftState.blacksmithLevel !== 1 ||
    !craftState.recentMessages.some((message) =>
      message.startsWith('Got a new Pickaxe! "'),
    )
  ) {
    throw new Error(
      "Remix first-Clay crafts did not yield a damageable pickaxe: " +
        JSON.stringify({ craftAttempts, craftState }),
    );
  }

  const hitsToBreak = Math.ceil(
    Number(miningSetup.currentObjectTotalHp) / Number(craftState.activeDamage),
  );
  if (!Number.isSafeInteger(hitsToBreak) || hitsToBreak <= 0) {
    throw new Error(
      `Remix first-Clay craft produced an invalid hit count: ${hitsToBreak}.`,
    );
  }
  const clayCanvas = page.locator("canvas.mine-object").first();
  await clayCanvas.click();
  const clayFirstHitState = await page.evaluate(() => ({
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectHpText:
      document.querySelector(".mineobject > div > p")?.textContent?.trim() ??
      null,
    activeDamage: window.functions.getActiveDamage().toString(),
  }));
  if (
    clayFirstHitState.currentObjectName !== "Clay" ||
    Number(clayFirstHitState.currentObjectHp) >= 1400 ||
    clayFirstHitState.currentObjectHpText === null ||
    clayFirstHitState.activeDamage !== craftState.activeDamage
  ) {
    throw new Error(
      "Remix did not apply the captured positive Clay damage on the first hit: " +
        JSON.stringify({ clayFirstHitState, craftState }),
    );
  }
  for (let hit = 1; hit < hitsToBreak; hit += 1) await clayCanvas.click();
  const clayMiningState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstClayUnlocked: window.functions.storyUnlocked("firstClay"),
      firstStoneUnlocked: window.functions.storyUnlocked("firstStone"),
      nextObjective: window.functions.getNextStoryText(),
    };
  });
  if (
    clayMiningState.mineObjectLevel !== 3 ||
    clayMiningState.highestMineObjectLevel !== 4 ||
    clayMiningState.currentObjectName !== "Clay" ||
    clayMiningState.currentObjectHp !== "1400" ||
    clayMiningState.money !== "54" ||
    Number(clayMiningState.gems) < Number(craftState.gems) ||
    clayMiningState.blacksmithLevel !== 1 ||
    clayMiningState.storyHighestUnlocked !== 5 ||
    clayMiningState.storyNotifications !== 1 ||
    !clayMiningState.firstClayUnlocked ||
    clayMiningState.firstStoneUnlocked ||
    clayMiningState.nextObjective !== "Mine a piece of Stone"
  ) {
    throw new Error(
      "Remix first-Clay progression did not reach the expected state: " +
        JSON.stringify({ ...clayMiningState, hitsToBreak }),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller)
        throw new Error("First-Clay Story scroller did not render.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "gameStart",
          "firstMud",
          "firstPaper",
          "blacksmithUpgrade",
          "firstSalt",
          "firstClay",
        ].filter((key) => window.functions.storyDisplayed(key)),
        nextObjective: window.functions.getNextStoryText(),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 0 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 5 ||
      storyState.mineObjectLevel !== 3 ||
      storyState.highestMineObjectLevel !== 4 ||
      storyState.currentObjectName !== "Clay" ||
      storyState.currentObjectHp !== "1400" ||
      storyState.money !== "54" ||
      storyState.blacksmithLevel !== 1 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify([
          "gameStart",
          "firstMud",
          "firstPaper",
          "blacksmithUpgrade",
          "firstSalt",
          "firstClay",
        ]) ||
      storyState.nextObjective !== "Mine a piece of Stone" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix first-Clay Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-first-clay-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario:
      "fresh-game-first-mud-paper-salt-blacksmith-craft-clay-story-entry",
    mineObjectId: 3,
    miningSetup,
    craftAttempts,
    craftState,
    activeDamage: craftState.activeDamage,
    activeCanvasClicks: hitsToBreak,
    clayFirstHitState,
    clayMiningState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-first-clay-visual-metrics.json"),
      JSON.stringify(
        {
          miningSetup,
          craftAttempts,
          craftState,
          activeCanvasClicks: hitsToBreak,
          clayFirstHitState,
          clayMiningState,
          captureNote:
            "After the pinned natural first-Blacksmith route, select Clay and confirm the Toy Pickaxe cannot damage its 35 defense. Use Remix's single-Gem craft control repeatedly with the fixed source RNG until the current pickaxe deals positive damage to Clay; every attempt, including a better replacement that still cannot damage the ore, is recorded. Click Clay until it breaks, invoke the source update loop, and enter Story before capturing both themes.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureFirstStoneProgression(page, captureScreenshots) {
  const replayRouteStart = await captureReplayRouteStart(page);
  await page.locator("footer > button").first().click();
  const clayMiningSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectValue: window.game.currentMineObject.value.toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    blacksmithPrice: window.game.upgrades.blacksmith.currentPrice().toString(),
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  if (
    clayMiningSetup.mineObjectLevel !== 3 ||
    clayMiningSetup.highestMineObjectLevel !== 4 ||
    clayMiningSetup.currentObjectName !== "Clay" ||
    clayMiningSetup.currentObjectHp !== "1400" ||
    clayMiningSetup.currentObjectTotalHp !== "1400" ||
    clayMiningSetup.currentObjectValue !== "50" ||
    clayMiningSetup.activeDamage !== "26.802070465340503" ||
    clayMiningSetup.money !== "54" ||
    clayMiningSetup.gems !== "3" ||
    clayMiningSetup.blacksmithLevel !== 1 ||
    clayMiningSetup.blacksmithPrice !== "111" ||
    clayMiningSetup.storyHighestUnlocked !== 5 ||
    clayMiningSetup.storyNotifications !== 0
  ) {
    throw new Error(
      "Remix did not reach the expected repeated-Clay state for first Stone: " +
        JSON.stringify(clayMiningSetup),
    );
  }

  const clayHitsToBreak = Math.ceil(
    Number(clayMiningSetup.currentObjectTotalHp) /
      Number(clayMiningSetup.activeDamage),
  );
  const clayBreaksNeeded = Math.ceil(
    (Number(clayMiningSetup.blacksmithPrice) - Number(clayMiningSetup.money)) /
      Number(clayMiningSetup.currentObjectValue),
  );
  if (clayHitsToBreak !== 53 || clayBreaksNeeded !== 2) {
    throw new Error(
      "Remix first-Stone funding route changed unexpectedly: " +
        JSON.stringify({ clayHitsToBreak, clayBreaksNeeded }),
    );
  }

  const gemFarm = await page.evaluate(
    ({ activeHitsPerClay, startingMoney, startingGems, targetGems }) => {
      const gemDrops = [];
      const replayCheckpoints = [];
      let breaks = 0;
      for (; breaks < 1_000 && Number(window.game.gems) < targetGems;) {
        const gemsBefore = Number(window.game.gems);
        for (let hit = 0; hit < activeHitsPerClay; hit += 1) {
          window.functions.clickMineObject();
        }
        window.update();
        breaks += 1;
        const gemsAfter = Number(window.game.gems);
        if (gemsAfter > gemsBefore) {
          gemDrops.push({
            breakNumber: breaks,
            gemsBefore: String(gemsBefore),
            gemsAfter: String(gemsAfter),
          });
        }
        replayCheckpoints.push(
          window.__idleMineBeyondProbe.checkpoint(`clay-break-${breaks}`),
        );
      }
      return {
        targetGems,
        breaks,
        activeHitsPerClay,
        activeHits: breaks * activeHitsPerClay,
        startingMoney,
        endingMoney: window.game.money.toString(),
        startingGems,
        endingGems: window.game.gems.toString(),
        gemDrops,
        replayCheckpoints,
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        storyHighestUnlocked: window.game.story.highestUnlocked,
        storyNotifications: window.game.story.notifications,
      };
    },
    {
      activeHitsPerClay: clayHitsToBreak,
      startingMoney: clayMiningSetup.money,
      startingGems: clayMiningSetup.gems,
      targetGems: 6,
    },
  );
  if (
    gemFarm.breaks < clayBreaksNeeded ||
    Number(gemFarm.endingGems) < gemFarm.targetGems ||
    gemFarm.mineObjectLevel !== 3 ||
    gemFarm.highestMineObjectLevel !== 4 ||
    gemFarm.currentObjectName !== "Clay" ||
    gemFarm.currentObjectHp !== "1400" ||
    Number(gemFarm.endingMoney) !==
      Number(clayMiningSetup.money) +
        Number(clayMiningSetup.currentObjectValue) * gemFarm.breaks ||
    gemFarm.storyHighestUnlocked !== 5 ||
    gemFarm.storyNotifications !== 0
  ) {
    throw new Error(
      "Remix Clay Gem farming did not reach the controlled first-Stone setup: " +
        JSON.stringify(gemFarm),
    );
  }

  await page.locator("button.changemineobj").nth(1).click();
  const stoneSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectDefense: window.game.currentMineObject.def.toString(),
    currentObjectValue: window.game.currentMineObject.value.toString(),
    pickaxeName: window.game.pickaxe.name,
    pickaxeDamage: window.game.pickaxe.getDamage().toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    blacksmithPrice: window.game.upgrades.blacksmith.currentPrice().toString(),
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  if (
    stoneSetup.mineObjectLevel !== 4 ||
    stoneSetup.highestMineObjectLevel !== 4 ||
    stoneSetup.currentObjectName !== "Rock" ||
    stoneSetup.currentObjectHp !== "2200" ||
    stoneSetup.currentObjectTotalHp !== "2200" ||
    stoneSetup.currentObjectDefense !== "90" ||
    stoneSetup.currentObjectValue !== "120" ||
    stoneSetup.pickaxeDamage !== "61.80207046534054" ||
    stoneSetup.activeDamage !== "0" ||
    stoneSetup.money !== gemFarm.endingMoney ||
    stoneSetup.gems !== gemFarm.endingGems ||
    stoneSetup.blacksmithLevel !== 1 ||
    stoneSetup.blacksmithPrice !== "111" ||
    stoneSetup.storyHighestUnlocked !== 5 ||
    stoneSetup.storyNotifications !== 0
  ) {
    throw new Error(
      "Remix did not reach the expected first-Stone Rock state: " +
        JSON.stringify(stoneSetup),
    );
  }

  const blacksmithCard = page
    .locator(".upgradelist .upgrade")
    .filter({ has: page.locator('img[src="Images/upgrades/blacksmith.png"]') });
  if ((await blacksmithCard.count()) !== 1) {
    throw new Error(
      "Remix did not render one Blacksmith upgrade card at Rock.",
    );
  }
  await blacksmithCard.click();
  await page.waitForFunction("window.game.upgrades.blacksmith.level === 2");
  const blacksmithPurchaseState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      blacksmithPrice: window.game.upgrades.blacksmith
        .currentPrice()
        .toString(),
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstStoneUnlocked: window.functions.storyUnlocked("firstStone"),
    };
  });
  if (
    blacksmithPurchaseState.mineObjectLevel !== 4 ||
    blacksmithPurchaseState.highestMineObjectLevel !== 4 ||
    blacksmithPurchaseState.currentObjectName !== "Rock" ||
    blacksmithPurchaseState.currentObjectHp !== "2200" ||
    blacksmithPurchaseState.money !==
      String(
        Number(gemFarm.endingMoney) - Number(stoneSetup.blacksmithPrice),
      ) ||
    blacksmithPurchaseState.blacksmithLevel !== 2 ||
    blacksmithPurchaseState.storyHighestUnlocked !== 5 ||
    blacksmithPurchaseState.storyNotifications !== 0 ||
    blacksmithPurchaseState.firstStoneUnlocked
  ) {
    throw new Error(
      "Remix second Blacksmith purchase changed the wrong first-Stone state: " +
        JSON.stringify(blacksmithPurchaseState),
    );
  }
  const replayCheckpoints = [...gemFarm.replayCheckpoints];
  replayCheckpoints.push(
    await captureReplayCheckpoint(page, "blacksmith-level-2"),
  );

  const craftButton = page.locator(".craft-pickaxe > button");
  if ((await craftButton.count()) !== 1) {
    throw new Error(
      "Remix did not render its single-Gem craft control at Rock.",
    );
  }
  const craftAttempts = [];
  const craftReplayCheckpoints = [];
  for (
    let attempt = 1;
    attempt <= Number(blacksmithPurchaseState.gems);
    attempt += 1
  ) {
    const gemsBefore = await page.evaluate(() => window.game.gems.toString());
    await craftButton.click();
    await page.evaluate(
      () => new Promise((resolve) => window.app.$nextTick(resolve)),
    );
    const outcome = await page.evaluate(() => ({
      mineObjectLevel: window.game.mineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      pickaxeName: window.game.pickaxe.name,
      pickaxePower: window.game.pickaxe.pow.toString(),
      pickaxeQuality: window.game.pickaxe.quality.toString(),
      pickaxeDamage: window.game.pickaxe.getDamage().toString(),
      activeDamage: window.functions.getActiveDamage().toString(),
      miningStatsText:
        document.querySelector(".stats")?.innerText.replace(/\r/g, "") ?? null,
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      recentMessages: window.game.messageLog
        .slice(0, 3)
        .map(({ message }) => message),
    }));
    if (Number(outcome.gems) !== Number(gemsBefore) - 1) {
      throw new Error(
        `Remix Rock craft attempt ${attempt} did not consume one Gem: ` +
          JSON.stringify({ gemsBefore, outcome }),
      );
    }
    craftAttempts.push({ attempt, gemsBefore, ...outcome });
    craftReplayCheckpoints.push(
      await captureReplayCheckpoint(page, `rock-craft-${attempt}`),
    );
    if (Number(outcome.activeDamage) > 0) break;
  }
  replayCheckpoints.push(...craftReplayCheckpoints);
  const craftState = craftAttempts.at(-1);
  if (
    !craftState ||
    craftState.mineObjectLevel !== 4 ||
    craftState.currentObjectName !== "Rock" ||
    craftState.currentObjectHp !== "2200" ||
    Number(craftState.activeDamage) <= 0 ||
    craftState.money !== blacksmithPurchaseState.money ||
    craftState.blacksmithLevel !== 2 ||
    !craftState.recentMessages.some((message) =>
      message.startsWith('Got a new Pickaxe! "'),
    )
  ) {
    throw new Error(
      "Remix Blacksmith 2 crafts did not yield a Rock-damaging pickaxe: " +
        JSON.stringify({ craftAttempts, craftState }),
    );
  }

  const hitsToBreak = Math.ceil(
    Number(stoneSetup.currentObjectTotalHp) / Number(craftState.activeDamage),
  );
  if (!Number.isSafeInteger(hitsToBreak) || hitsToBreak <= 0) {
    throw new Error(
      `Remix Rock craft produced an invalid hit count: ${hitsToBreak}.`,
    );
  }
  const rockCanvas = page.locator("canvas.mine-object").first();
  await rockCanvas.click();
  const rockFirstHitState = await page.evaluate(() => ({
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectHpText:
      document.querySelector(".mineobject > div > p")?.textContent?.trim() ??
      null,
    activeDamage: window.functions.getActiveDamage().toString(),
  }));
  replayCheckpoints.push(await captureReplayCheckpoint(page, "rock-first-hit"));
  if (
    rockFirstHitState.currentObjectName !== "Rock" ||
    Number(rockFirstHitState.currentObjectHp) >= 2200 ||
    rockFirstHitState.currentObjectHpText === null ||
    rockFirstHitState.activeDamage !== craftState.activeDamage
  ) {
    throw new Error(
      "Remix did not apply the captured positive Rock damage on the first hit: " +
        JSON.stringify({ rockFirstHitState, craftState }),
    );
  }
  for (let hit = 1; hit < hitsToBreak; hit += 1) await rockCanvas.click();
  const rockMiningState = await page.evaluate(() => {
    window.update();
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      blacksmithLevel: window.game.upgrades.blacksmith.level,
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      firstStoneUnlocked: window.functions.storyUnlocked("firstStone"),
      nextObjective: window.functions.getNextStoryText(),
      maxStoryPage: window.functions.getMaxStoryPage(),
      sourceStoryPage: window.game.story.page,
    };
  });
  replayCheckpoints.push(
    await captureReplayCheckpoint(page, "first-rock-break"),
  );
  if (
    rockMiningState.mineObjectLevel !== 4 ||
    rockMiningState.highestMineObjectLevel !== 5 ||
    rockMiningState.currentObjectName !== "Rock" ||
    rockMiningState.currentObjectHp !== "2200" ||
    rockMiningState.money !==
      String(
        Number(blacksmithPurchaseState.money) +
          Number(stoneSetup.currentObjectValue),
      ) ||
    Number(rockMiningState.gems) < Number(craftState.gems) ||
    rockMiningState.blacksmithLevel !== 2 ||
    rockMiningState.storyHighestUnlocked < 6 ||
    rockMiningState.storyNotifications < 1 ||
    !rockMiningState.firstStoneUnlocked ||
    rockMiningState.maxStoryPage !== 1 ||
    rockMiningState.sourceStoryPage !== 0
  ) {
    throw new Error(
      "Remix first-Stone progression did not reach the expected state: " +
        JSON.stringify({ ...rockMiningState, hitsToBreak }),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  await page.locator(".chapter-control button").nth(1).click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller)
        throw new Error("First-Stone Story scroller did not render.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        maxStoryPage: window.functions.getMaxStoryPage(),
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "firstStone",
          "tenThousand",
          "firstSpookyBone",
        ].filter((key) => window.functions.storyDisplayed(key)),
        nextObjective: window.functions.getNextStoryText(),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        chapterHeading:
          document.querySelector(".chapter-control h3")?.textContent ?? null,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 1 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== rockMiningState.storyHighestUnlocked ||
      storyState.maxStoryPage !== 1 ||
      storyState.mineObjectLevel !== 4 ||
      storyState.highestMineObjectLevel !== 5 ||
      storyState.currentObjectName !== "Rock" ||
      storyState.currentObjectHp !== "2200" ||
      storyState.money !== rockMiningState.money ||
      storyState.blacksmithLevel !== 2 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify([
          "firstStone",
          ...(Number(rockMiningState.money) >= 10_000 ? ["tenThousand"] : []),
        ]) ||
      storyState.nextObjective !== rockMiningState.nextObjective ||
      storyState.chapterHeading !== "Chapter 2: The real Adventure begins!" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix first-Stone Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-first-stone-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario:
      "first-clay-repeat-until-six-gems-blacksmith-level-two-random-craft-first-stone",
    replayRouteStart,
    replayCheckpoints,
    clayMiningSetup,
    clayHitsToBreak,
    clayBreaksNeeded,
    gemFarm,
    stoneSetup,
    blacksmithPurchaseState,
    craftAttempts,
    craftState,
    activeDamage: craftState.activeDamage,
    activeCanvasClicks: hitsToBreak,
    rockFirstHitState,
    rockMiningState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-first-stone-visual-metrics.json"),
      JSON.stringify(
        {
          clayMiningSetup,
          clayHitsToBreak,
          clayBreaksNeeded,
          gemFarm,
          stoneSetup,
          blacksmithPurchaseState,
          craftAttempts,
          craftState,
          activeCanvasClicks: hitsToBreak,
          rockFirstHitState,
          rockMiningState,
          captureNote:
            "Continue from the pinned first-Clay Story state, invoke the canonical active-click function against Clay until the source Gem balance reaches six (recording each random drop), select source object ID 4 (Rock), buy Blacksmith level 2, and use one-Gem crafts with the fixed RNG until Rock takes positive damage. Break Rock, run source update, enter Story, navigate to chapter 2, and capture the firstStone view in both themes.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureTenThousandProgression(
  page,
  captureScreenshots,
  firstStoneProgression,
) {
  const replayRouteStart = await captureReplayRouteStart(page);
  await page.locator("footer > button").first().click();
  const miningSetup = await page.evaluate(() => ({
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectValue: window.game.currentMineObject.value.toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    highestMoney: window.game.highestMoney.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    storyPage: window.game.story.page,
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
    firstStoneUnlocked: window.functions.storyUnlocked("firstStone"),
    tenThousandUnlocked: window.functions.storyUnlocked("tenThousand"),
  }));
  const hitsPerRock = Math.ceil(
    Number(miningSetup.currentObjectTotalHp) / Number(miningSetup.activeDamage),
  );
  const breaksToThreshold = Math.ceil(
    (10_000 - Number(miningSetup.money)) /
      Number(miningSetup.currentObjectValue),
  );
  if (
    miningSetup.mineObjectLevel !== 4 ||
    miningSetup.highestMineObjectLevel !== 5 ||
    miningSetup.currentObjectName !== "Rock" ||
    miningSetup.currentObjectHp !== "2200" ||
    miningSetup.currentObjectTotalHp !== "2200" ||
    miningSetup.currentObjectValue !== "120" ||
    miningSetup.activeDamage !== firstStoneProgression.activeDamage ||
    miningSetup.money !== firstStoneProgression.rockMiningState.money ||
    miningSetup.highestMoney !== firstStoneProgression.rockMiningState.money ||
    miningSetup.gems !== firstStoneProgression.rockMiningState.gems ||
    miningSetup.blacksmithLevel !== 2 ||
    miningSetup.storyPage !== 1 ||
    miningSetup.storyHighestUnlocked !== 6 ||
    miningSetup.storyNotifications !== 0 ||
    !miningSetup.firstStoneUnlocked ||
    miningSetup.tenThousandUnlocked ||
    hitsPerRock !== 257 ||
    breaksToThreshold !== 32
  ) {
    throw new Error(
      "Remix did not reach the expected post-Stone Money objective state: " +
        JSON.stringify({ ...miningSetup, hitsPerRock, breaksToThreshold }),
    );
  }

  const rockFarming = await page.evaluate(
    ({ hitsPerRock, breaksToThreshold, startingMoney, startingGems }) => {
      const breaks = [];
      const gemDrops = [];
      const replayCheckpoints = [];
      for (
        let breakNumber = 1;
        breakNumber <= breaksToThreshold;
        breakNumber += 1
      ) {
        const gemsBefore = Number(window.game.gems);
        for (let hit = 0; hit < hitsPerRock; hit += 1) {
          window.functions.clickMineObject();
        }
        window.update();
        const state = {
          breakNumber,
          currentObjectName: window.game.currentMineObject.name,
          currentObjectHp: window.game.currentMineObject.hp.toString(),
          money: window.game.money.toString(),
          highestMoney: window.game.highestMoney.toString(),
          gems: window.game.gems.toString(),
          storyHighestUnlocked: window.game.story.highestUnlocked,
          storyNotifications: window.game.story.notifications,
          tenThousandUnlocked: window.functions.storyUnlocked("tenThousand"),
          nextObjective: window.functions.getNextStoryText(),
        };
        breaks.push(state);
        replayCheckpoints.push(
          window.__idleMineBeyondProbe.checkpoint(`rock-break-${breakNumber}`),
        );
        if (Number(state.gems) > gemsBefore) {
          gemDrops.push({
            breakNumber,
            gemsBefore: String(gemsBefore),
            gemsAfter: state.gems,
          });
        }
      }
      return {
        hitsPerRock,
        breaksToThreshold,
        activeHits: hitsPerRock * breaksToThreshold,
        startingMoney,
        startingGems,
        endingMoney: window.game.money.toString(),
        highestMoney: window.game.highestMoney.toString(),
        endingGems: window.game.gems.toString(),
        breaks,
        gemDrops,
        replayCheckpoints,
      };
    },
    {
      hitsPerRock,
      breaksToThreshold,
      startingMoney: miningSetup.money,
      startingGems: miningSetup.gems,
    },
  );
  const expectedEndingMoney = String(
    Number(miningSetup.money) +
      Number(miningSetup.currentObjectValue) * breaksToThreshold,
  );
  const finalBreak = rockFarming.breaks.at(-1);
  if (
    rockFarming.breaks.length !== breaksToThreshold ||
    rockFarming.endingMoney !== expectedEndingMoney ||
    rockFarming.highestMoney !== expectedEndingMoney ||
    Number(rockFarming.endingMoney) < 10_000 ||
    !finalBreak?.tenThousandUnlocked ||
    finalBreak.storyHighestUnlocked !== 7 ||
    finalBreak.storyNotifications !== 1 ||
    finalBreak.currentObjectName !== "Rock" ||
    finalBreak.currentObjectHp !== "2200"
  ) {
    throw new Error(
      "Remix Rock farming did not reach the 10,000-Money Story milestone: " +
        JSON.stringify(rockFarming),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller) throw new Error("10,000-Money Story scroller is missing.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        maxStoryPage: window.functions.getMaxStoryPage(),
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "firstStone",
          "tenThousand",
          "firstSpookyBone",
        ].filter((key) => window.functions.storyDisplayed(key)),
        nextObjective: window.functions.getNextStoryText(),
        chapterHeading:
          document.querySelector(".chapter-control h3")?.textContent ?? null,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 1 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 7 ||
      storyState.maxStoryPage !== 1 ||
      storyState.mineObjectLevel !== 4 ||
      storyState.highestMineObjectLevel !== 5 ||
      storyState.currentObjectName !== "Rock" ||
      storyState.currentObjectHp !== "2200" ||
      storyState.money !== rockFarming.endingMoney ||
      storyState.gems !== rockFarming.endingGems ||
      storyState.pickaxeDamage !==
        firstStoneProgression.craftState.pickaxeDamage ||
      storyState.blacksmithLevel !== 2 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify(["firstStone", "tenThousand"]) ||
      storyState.nextObjective !== rockFarming.breaks.at(-1)?.nextObjective ||
      storyState.chapterHeading !== "Chapter 2: The real Adventure begins!" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix 10,000-Money Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-ten-thousand-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario: "first-Stone-plus-32-Rock-breaks-to-reach-10,000-Money",
    replayRouteStart,
    miningSetup,
    hitsPerRock,
    breaksToThreshold,
    rockFarming,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-ten-thousand-visual-metrics.json"),
      JSON.stringify(
        {
          miningSetup,
          hitsPerRock,
          breaksToThreshold,
          rockFarming,
          captureNote:
            "Continue from the pinned first-Stone Rock state with 6,213 Money, a full 2,200-HP Rock, and 8.5882157584418 active damage. Invoke the canonical active-click function 257 times per break for 32 Rock breaks, running source update after each. The final break crosses the highest-Money threshold, unlocks tenThousand, and leaves the next objective to the source runtime. Enter Story and capture page 1 in both themes.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureSpookyBoneProgression(
  page,
  captureScreenshots,
  tenThousandProgression,
) {
  const millionaireProgression = await captureMillionaireProgression(
    page,
    captureScreenshots,
    tenThousandProgression,
  );
  const sourceState = await page.evaluate(() => {
    const game = window.game;
    const functions = window.functions;
    const before = {
      mineObjectLevel: game.mineObjectLevel,
      highestMineObjectLevel: game.highestMineObjectLevel,
      money: game.money.toString(),
      gems: game.gems.toString(),
      storyPage: game.story.page,
      storyHighestUnlocked: game.story.highestUnlocked,
      storyNotifications: game.story.notifications,
      tenThousandUnlocked: functions.storyUnlocked("tenThousand"),
    };
    if (
      before.mineObjectLevel !== 4 ||
      before.highestMineObjectLevel !== 5 ||
      before.money !== "10053" ||
      before.gems !== "7" ||
      before.storyPage !== 1 ||
      before.storyHighestUnlocked !== 7 ||
      before.storyNotifications !== 0 ||
      !before.tenThousandUnlocked
    ) {
      throw new Error(
        "Controlled Spooky Bone probe did not start at the captured 10,000-Money Story state: " +
          JSON.stringify(before),
      );
    }

    // Inject the post-break save fields only; the source selector, notification
    // scan, Story tab transition, objective, and renderer remain unmodified.
    game.highestMineObjectLevel = 13;
    functions.setMineObjectLevel(12);
    functions.refreshStoryNotifications();
    return {
      before,
      mineObjectLevel: game.mineObjectLevel,
      highestMineObjectLevel: game.highestMineObjectLevel,
      currentObjectName: game.currentMineObject.name,
      currentObjectHp: game.currentMineObject.hp.toString(),
      currentObjectTotalHp: game.currentMineObject.totalHp.toString(),
      currentObjectDefense: game.currentMineObject.def.toString(),
      currentObjectValue: game.currentMineObject.value.toString(),
      money: game.money.toString(),
      highestMoney: game.highestMoney.toString(),
      gems: game.gems.toString(),
      storyPage: game.story.page,
      storyHighestUnlocked: game.story.highestUnlocked,
      storyNotifications: game.story.notifications,
      firstSpookyBoneUnlocked: functions.storyUnlocked("firstSpookyBone"),
      firstSpookyBoneDisplayed: functions.storyDisplayed("firstSpookyBone"),
      nextObjective: functions.getNextStoryText(),
    };
  });
  if (
    sourceState.mineObjectLevel !== 12 ||
    sourceState.highestMineObjectLevel !== 13 ||
    sourceState.currentObjectName !== "Spooky Bone" ||
    sourceState.currentObjectHp !== sourceState.currentObjectTotalHp ||
    sourceState.currentObjectDefense !== "5400" ||
    sourceState.storyHighestUnlocked !== 8 ||
    sourceState.storyNotifications !== 1 ||
    !sourceState.firstSpookyBoneUnlocked ||
    !sourceState.firstSpookyBoneDisplayed ||
    sourceState.nextObjective !== "Have 1,000,000 $ on hand"
  ) {
    throw new Error(
      "Pinned Remix did not expose the controlled first-Spooky-Bone boundary: " +
        JSON.stringify(sourceState),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller) throw new Error("Spooky Bone Story scroller is missing.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        maxStoryPage: window.functions.getMaxStoryPage(),
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        highestMoney: window.game.highestMoney.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "firstStone",
          "tenThousand",
          "firstSpookyBone",
        ].filter((key) => window.functions.storyDisplayed(key)),
        firstSpookyBoneUnlocked:
          window.functions.storyUnlocked("firstSpookyBone"),
        nextObjective: window.functions.getNextStoryText(),
        chapterHeading:
          document.querySelector(".chapter-control h3")?.textContent ?? null,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 1 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 8 ||
      storyState.maxStoryPage !== 1 ||
      storyState.mineObjectLevel !== 12 ||
      storyState.highestMineObjectLevel !== 13 ||
      storyState.currentObjectName !== "Spooky Bone" ||
      storyState.money !== sourceState.money ||
      storyState.highestMoney !== sourceState.highestMoney ||
      storyState.gems !== sourceState.gems ||
      storyState.pickaxeDamage !==
        tenThousandProgression.storyStates[0].pickaxeDamage ||
      storyState.blacksmithLevel !== 2 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify(["firstStone", "tenThousand", "firstSpookyBone"]) ||
      storyState.nextObjective !== sourceState.nextObjective ||
      storyState.chapterHeading !== "Chapter 2: The real Adventure begins!" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Pinned Remix Spooky Bone Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-spooky-bone-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  const capture = {
    scenario: "controlled-post-break-Spooky-Bone-object-12-Story-state",
    millionaireProgression,
    stateInjection: {
      highestMineObjectLevel: 13,
      mineObjectLevel: 12,
      sourceFunction: "functions.setMineObjectLevel(12)",
    },
    sourceState,
    storyStates,
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-spooky-bone-visual-metrics.json"),
      JSON.stringify(
        {
          ...capture,
          captureNote:
            "Controlled source state only: starting from the pinned 10,000-Money state, set highestMineObjectLevel to 13 and select mine object 12 through functions.setMineObjectLevel(12), then call refreshStoryNotifications and enter Story. This verifies the post-break firstSpookyBone condition, source notification clearing, objective, and rendering; it does not claim a natural gameplay route to object 12.",
          screenshots: screenshotMetrics,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

async function captureMillionaireProgression(
  page,
  captureScreenshots,
  tenThousandProgression,
) {
  const replayRouteStart = await captureReplayRouteStart(page);
  await page.locator("footer > button").first().click();
  const miningSetup = await page.evaluate(() => ({
    save: window.functions.getSaveString(),
    mineObjectLevel: window.game.mineObjectLevel,
    highestMineObjectLevel: window.game.highestMineObjectLevel,
    currentObjectName: window.game.currentMineObject.name,
    currentObjectHp: window.game.currentMineObject.hp.toString(),
    currentObjectTotalHp: window.game.currentMineObject.totalHp.toString(),
    currentObjectValue: window.game.currentMineObject.value.toString(),
    activeDamage: window.functions.getActiveDamage().toString(),
    money: window.game.money.toString(),
    highestMoney: window.game.highestMoney.toString(),
    gems: window.game.gems.toString(),
    blacksmithLevel: window.game.upgrades.blacksmith.level,
    storyPage: window.game.story.page,
    storyHighestUnlocked: window.game.story.highestUnlocked,
    storyNotifications: window.game.story.notifications,
  }));
  const hitsPerRock = Math.ceil(
    Number(miningSetup.currentObjectTotalHp) / Number(miningSetup.activeDamage),
  );
  const breaksToThreshold = Math.ceil(
    (1_000_000 - Number(miningSetup.money)) /
      Number(miningSetup.currentObjectValue),
  );
  if (
    miningSetup.mineObjectLevel !== 4 ||
    miningSetup.highestMineObjectLevel !== 5 ||
    miningSetup.currentObjectName !== "Rock" ||
    miningSetup.currentObjectHp !== "2200" ||
    miningSetup.currentObjectTotalHp !== "2200" ||
    miningSetup.currentObjectValue !== "120" ||
    miningSetup.money !== "10053" ||
    miningSetup.highestMoney !== "10053" ||
    miningSetup.gems !== tenThousandProgression.rockFarming.endingGems ||
    miningSetup.blacksmithLevel !== 2 ||
    miningSetup.storyPage !== 1 ||
    miningSetup.storyHighestUnlocked !== 7 ||
    miningSetup.storyNotifications !== 0 ||
    hitsPerRock !== 257 ||
    breaksToThreshold !== 8250
  ) {
    throw new Error(
      "Remix did not reach the expected 10,000-Money state before the natural millionaire route: " +
        JSON.stringify({
          ...miningSetup,
          save: undefined,
          hitsPerRock,
          breaksToThreshold,
        }),
    );
  }

  const rockFarming = await page.evaluate(
    ({ hitsPerRock, breaksToThreshold }) => {
      const firstGemDropBreaks = [];
      const replayCheckpoints = [];
      let totalGemDrops = 0;
      let lastGemDropBreaks = [];
      let lastBreak = null;
      for (
        let breakNumber = 1;
        breakNumber <= breaksToThreshold;
        breakNumber += 1
      ) {
        const gemsBefore = window.game.gems.toString();
        for (let hit = 0; hit < hitsPerRock; hit += 1) {
          window.functions.clickMineObject();
        }
        window.update();
        lastBreak = {
          breakNumber,
          money: window.game.money.toString(),
          highestMoney: window.game.highestMoney.toString(),
          gems: window.game.gems.toString(),
          currentObjectName: window.game.currentMineObject.name,
          currentObjectHp: window.game.currentMineObject.hp.toString(),
          storyHighestUnlocked: window.game.story.highestUnlocked,
          storyNotifications: window.game.story.notifications,
          firstSpookyBoneUnlocked:
            window.functions.storyUnlocked("firstSpookyBone"),
          millionaireUnlocked: window.functions.storyUnlocked("millionaire"),
          nextObjective: window.functions.getNextStoryText(),
        };
        if (Number(lastBreak.gems) > Number(gemsBefore)) {
          totalGemDrops += 1;
          if (firstGemDropBreaks.length < 5) {
            firstGemDropBreaks.push(breakNumber);
          }
          lastGemDropBreaks = [...lastGemDropBreaks, breakNumber].slice(-5);
        }
        if (
          breakNumber === 1 ||
          breakNumber % 250 === 0 ||
          Number(lastBreak.gems) > Number(gemsBefore) ||
          breakNumber === breaksToThreshold
        ) {
          replayCheckpoints.push(
            window.__idleMineBeyondProbe.checkpoint(
              `rock-break-${breakNumber}`,
            ),
          );
        }
      }
      return {
        hitsPerRock,
        breaksToThreshold,
        activeHits: hitsPerRock * breaksToThreshold,
        startingMoney: "10053",
        endingMoney: window.game.money.toString(),
        highestMoney: window.game.highestMoney.toString(),
        startingGems: "7",
        endingGems: window.game.gems.toString(),
        totalGemDrops,
        firstGemDropBreaks,
        lastGemDropBreaks,
        replayCheckpoints,
        finalBreak: lastBreak,
      };
    },
    { hitsPerRock, breaksToThreshold },
  );
  if (
    rockFarming.endingMoney !== "1000053.0000000001" ||
    rockFarming.highestMoney !== "1000053.0000000001" ||
    rockFarming.endingGems !== "182" ||
    rockFarming.totalGemDrops !== 175 ||
    rockFarming.finalBreak?.breakNumber !== 8250 ||
    rockFarming.finalBreak?.currentObjectName !== "Rock" ||
    rockFarming.finalBreak?.currentObjectHp !== "2200" ||
    rockFarming.finalBreak?.storyHighestUnlocked !== 9 ||
    rockFarming.finalBreak?.storyNotifications !== 1 ||
    rockFarming.finalBreak?.firstSpookyBoneUnlocked !== false ||
    rockFarming.finalBreak?.millionaireUnlocked !== true ||
    rockFarming.finalBreak?.nextObjective !==
      "Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)"
  ) {
    throw new Error(
      "Natural Remix Rock farming did not reach the expected millionaire Story boundary: " +
        JSON.stringify(rockFarming),
    );
  }

  const nextObjectProbe = await page.evaluate(() => {
    const millionaireState = {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      money: window.game.money.toString(),
      gems: window.game.gems.toString(),
      powerMining: window.game.powers.data.values[0].toString(),
      pickaxeDamage: window.game.pickaxe.getDamage().toString(),
      activeDamage: window.functions.getActiveDamage().toString(),
    };
    window.functions.nextMineObjectLevel();
    const nextSelectableObject = {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      name: window.game.currentMineObject.name,
      hp: window.game.currentMineObject.hp.toString(),
      defense: window.game.currentMineObject.def.toString(),
      value: window.game.currentMineObject.value.toString(),
      activeDamage: window.functions.getActiveDamage().toString(),
      idleDamage: window.functions.getIdleDamage().toString(),
    };
    window.functions.prevMineObjectLevel();
    return {
      millionaireState,
      nextSelectableObject,
      restoredMineObjectLevel: window.game.mineObjectLevel,
      restoredObjectName: window.game.currentMineObject.name,
    };
  });
  if (
    nextObjectProbe.millionaireState.mineObjectLevel !== 4 ||
    nextObjectProbe.millionaireState.highestMineObjectLevel !== 5 ||
    nextObjectProbe.millionaireState.money !== "1000053.0000000001" ||
    nextObjectProbe.millionaireState.gems !== "182" ||
    nextObjectProbe.millionaireState.powerMining !== "1" ||
    nextObjectProbe.millionaireState.pickaxeDamage !== "98.58821575844182" ||
    nextObjectProbe.nextSelectableObject.mineObjectLevel !== 5 ||
    nextObjectProbe.nextSelectableObject.highestMineObjectLevel !== 5 ||
    nextObjectProbe.nextSelectableObject.name !== "Coal" ||
    nextObjectProbe.nextSelectableObject.hp !== "4000" ||
    nextObjectProbe.nextSelectableObject.defense !== "200" ||
    nextObjectProbe.nextSelectableObject.value !== "275" ||
    nextObjectProbe.nextSelectableObject.activeDamage !== "0" ||
    nextObjectProbe.nextSelectableObject.idleDamage !== "0" ||
    nextObjectProbe.restoredMineObjectLevel !== 4 ||
    nextObjectProbe.restoredObjectName !== "Rock"
  ) {
    throw new Error(
      "The natural millionaire state reached a different next-mine-object boundary: " +
        JSON.stringify(nextObjectProbe),
    );
  }

  await page.locator("button.story-tab").click();
  await page.waitForTimeout(60);
  const storyStates = [];
  const screenshotMetrics = [];
  const millionaireScrolledScreenshots = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const storyState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller) throw new Error("Millionaire Story scroller is missing.");
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        maxStoryPage: window.functions.getMaxStoryPage(),
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        highestMoney: window.game.highestMoney.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "firstStone",
          "tenThousand",
          "firstSpookyBone",
          "millionaire",
        ].filter((key) => window.functions.storyDisplayed(key)),
        firstSpookyBoneUnlocked:
          window.functions.storyUnlocked("firstSpookyBone"),
        millionaireUnlocked: window.functions.storyUnlocked("millionaire"),
        nextObjective: window.functions.getNextStoryText(),
        chapterHeading:
          document.querySelector(".chapter-control h3")?.textContent ?? null,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      storyState.tab !== "story" ||
      storyState.theme !== theme ||
      storyState.page !== 1 ||
      storyState.notifications !== 0 ||
      storyState.highestUnlocked !== 9 ||
      storyState.maxStoryPage !== 1 ||
      storyState.mineObjectLevel !== 4 ||
      storyState.highestMineObjectLevel !== 5 ||
      storyState.currentObjectName !== "Rock" ||
      storyState.money !== "1000053.0000000001" ||
      storyState.highestMoney !== "1000053.0000000001" ||
      storyState.gems !== rockFarming.endingGems ||
      storyState.blacksmithLevel !== 2 ||
      storyState.scrollTop !== 0 ||
      JSON.stringify(storyState.visibleMilestones) !==
        JSON.stringify(["firstStone", "tenThousand", "millionaire"]) ||
      storyState.firstSpookyBoneUnlocked ||
      !storyState.millionaireUnlocked ||
      storyState.nextObjective !== rockFarming.finalBreak.nextObjective ||
      storyState.chapterHeading !== "Chapter 2: The real Adventure begins!" ||
      storyState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Remix millionaire Story screenshot reached the wrong state: ${JSON.stringify(storyState)}.`,
      );
    }
    storyStates.push(storyState);
    if (!captureScreenshots) continue;

    await page.evaluate(async () => {
      await new Promise((resolve) => window.app.$nextTick(resolve));
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });
    await page.mouse.move(viewport.width - 1, viewport.height - 1);
    const screenshot = `story-millionaire-${theme}-1440x900.png`;
    await page.screenshot({
      path: path.join(outputDirectory, screenshot),
      fullPage: false,
    });
    screenshotMetrics.push({ ...storyState, screenshot });
  }

  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const scrollState = await page.evaluate(() => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller) throw new Error("Millionaire Story scroller is missing.");
      const target = [...scroller.children].find((child) =>
        child.textContent?.includes(
          "There are multiple ways to earn a million",
        ),
      );
      if (!target) {
        throw new Error(
          "The unlocked millionaire Story block is missing from the source DOM.",
        );
      }
      const priorScrollTop = scroller.scrollTop;
      scroller.scrollTop = 0;
      const beforeScrollTop = scroller.scrollTop;
      const targetTop =
        target.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        beforeScrollTop;
      const initialScrollerBounds = scroller.getBoundingClientRect();
      const initialTargetBounds = target.getBoundingClientRect();
      const targetFullyVisibleAtInitial =
        initialTargetBounds.top >= initialScrollerBounds.top &&
        initialTargetBounds.bottom <= initialScrollerBounds.bottom;
      const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;
      scroller.scrollTop = maxScrollTop;
      const scrollerBounds = scroller.getBoundingClientRect();
      const targetBounds = target.getBoundingClientRect();
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        highestUnlocked: window.game.story.highestUnlocked,
        notifications: window.game.story.notifications,
        priorScrollTop,
        beforeScrollTop,
        targetFullyVisibleAtInitial,
        targetContentTop: targetTop,
        targetHeight: targetBounds.height,
        scrollTop: scroller.scrollTop,
        clientHeight: scroller.clientHeight,
        scrollHeight: scroller.scrollHeight,
        maxScrollTop,
        targetViewportTop: targetBounds.top - scrollerBounds.top,
        targetViewportBottom: targetBounds.bottom - scrollerBounds.top,
        targetFullyVisible:
          targetBounds.top >= scrollerBounds.top &&
          targetBounds.bottom <= scrollerBounds.bottom,
        targetText: target.textContent?.trim() ?? "",
      };
    });
    if (
      scrollState.tab !== "story" ||
      scrollState.theme !== theme ||
      scrollState.page !== 1 ||
      scrollState.highestUnlocked !== 9 ||
      scrollState.notifications !== 0 ||
      scrollState.beforeScrollTop !== 0 ||
      scrollState.targetFullyVisibleAtInitial ||
      scrollState.maxScrollTop <= 0 ||
      scrollState.scrollTop !== scrollState.maxScrollTop ||
      !scrollState.targetFullyVisible ||
      !scrollState.targetText.includes("you've just reached")
    ) {
      throw new Error(
        `Remix millionaire Story scroll reached the wrong state: ${JSON.stringify(scrollState)}.`,
      );
    }
    const screenshot = `story-millionaire-scrolled-${theme}-1440x900.png`;
    if (captureScreenshots) {
      await page.evaluate(async () => {
        await new Promise((resolve) => window.app.$nextTick(resolve));
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(outputDirectory, screenshot),
        fullPage: false,
      });
    }
    millionaireScrolledScreenshots.push({ ...scrollState, screenshot });
  }

  await page.locator(".story-milestones").evaluate((scroller) => {
    scroller.scrollTop = 0;
  });

  const sourceInteractionRouteStart = await captureReplayRouteStart(page);
  const sourceInteractionProgression = await page.evaluate(() => {
    const { game, functions } = window;
    const replayCheckpoints = [];
    functions.changeTab("main");
    functions.nextMineObjectLevel();
    replayCheckpoints.push(
      window.__idleMineBeyondProbe.checkpoint("select-coal"),
    );

    const startingState = {
      mineObjectLevel: game.mineObjectLevel,
      highestMineObjectLevel: game.highestMineObjectLevel,
      currentObjectName: game.currentMineObject.name,
      money: game.money.toString(),
      gems: game.gems.toString(),
      pickaxeDamage: game.pickaxe.getDamage().toString(),
      blacksmithLevel: game.upgrades.blacksmith.level,
      activePowerLevel: game.upgrades.activePower.level,
    };
    if (
      startingState.mineObjectLevel !== 5 ||
      startingState.highestMineObjectLevel !== 5 ||
      startingState.currentObjectName !== "Coal"
    ) {
      throw new Error(
        `Source-interaction route did not start at selectable Coal: ${JSON.stringify(startingState)}`,
      );
    }

    let blacksmithPurchases = 0;
    while (game.upgrades.blacksmith.buy()) {
      blacksmithPurchases++;
      replayCheckpoints.push(
        window.__idleMineBeyondProbe.checkpoint(
          `blacksmith-level-${game.upgrades.blacksmith.level}`,
        ),
      );
    }
    let activePowerPurchases = 0;
    while (game.upgrades.activePower.buy()) {
      activePowerPurchases++;
      replayCheckpoints.push(
        window.__idleMineBeyondProbe.checkpoint(
          `active-power-level-${game.upgrades.activePower.level}`,
        ),
      );
    }
    const moneyAfterPurchases = game.money.toString();

    const targetObjects = Array.from({ length: 8 }, (_, index) => {
      const object = functions.getMineObject(index + 5);
      return {
        id: index + 5,
        name: object.name,
        hp: object.totalHp.toString(),
        defense: object.def.toString(),
        value: object.value.toString(),
      };
    });
    const spookyBone = functions.getMineObject(12);
    const crafting = {
      startingGems: game.gems.toString(),
      usedGemsPerCraft: functions.getUsedGems().toString(),
      attempts: 0,
      improvedPickaxes: 0,
      targetSpookyBoneDamage: "100",
    };
    let lastPickaxeDamage = game.pickaxe.getDamage().toString();
    while (
      game.gems.gte(functions.getUsedGems()) &&
      functions.getActiveDamage(spookyBone).lt(100) &&
      crafting.attempts < 500
    ) {
      functions.craftPick(functions.getUsedGems());
      crafting.attempts++;
      replayCheckpoints.push(
        window.__idleMineBeyondProbe.checkpoint(
          `pickaxe-craft-${crafting.attempts}`,
        ),
      );
      const currentPickaxeDamage = game.pickaxe.getDamage().toString();
      if (currentPickaxeDamage !== lastPickaxeDamage) {
        crafting.improvedPickaxes++;
        lastPickaxeDamage = currentPickaxeDamage;
      }
    }
    Object.assign(crafting, {
      remainingGems: game.gems.toString(),
      pickaxeName: game.pickaxe.name,
      pickaxePower: game.pickaxe.pow.toString(),
      pickaxeQuality: game.pickaxe.quality.toString(),
      pickaxeDamage: game.pickaxe.getDamage().toString(),
      activeDamageOnSpookyBone: functions
        .getActiveDamage(spookyBone)
        .toString(),
      targetReached: functions.getActiveDamage(spookyBone).gte(100),
    });

    const minedObjects = [];
    for (const object of targetObjects) {
      if (game.highestMineObjectLevel < object.id) break;
      functions.setMineObjectLevel(object.id);
      replayCheckpoints.push(
        window.__idleMineBeyondProbe.checkpoint(`select-object-${object.id}`),
      );
      const activeDamage = functions.getActiveDamage().toString();
      if (functions.getActiveDamage().lte(0)) {
        minedObjects.push({
          ...object,
          activeDamage,
          breakClicks: 0,
          reached: false,
        });
        break;
      }

      let breakClicks = 0;
      while (
        game.highestMineObjectLevel < object.id + 1 &&
        breakClicks < 100_000
      ) {
        functions.clickMineObject();
        breakClicks++;
      }
      const reached = game.highestMineObjectLevel >= object.id + 1;
      if (reached) window.update();
      if (reached) {
        replayCheckpoints.push(
          window.__idleMineBeyondProbe.checkpoint(
            `mine-object-${object.id}-break`,
          ),
        );
      }
      minedObjects.push({
        ...object,
        activeDamage,
        breakClicks,
        reached,
        highestMineObjectLevel: game.highestMineObjectLevel,
        moneyAfterBreak: game.money.toString(),
        gemsAfterBreak: game.gems.toString(),
        firstSpookyBoneUnlocked: functions.storyUnlocked("firstSpookyBone"),
      });
      if (!reached) break;
    }

    const notificationsBeforeStoryEntry = game.story.notifications;
    functions.changeTab("story");
    replayCheckpoints.push(
      window.__idleMineBeyondProbe.checkpoint("story-entry"),
    );
    const storyEntry = {
      tab: game.settings.tab,
      page: game.story.page,
      notificationsBeforeEntry: notificationsBeforeStoryEntry,
      notificationsAfterEntry: game.story.notifications,
      highestUnlocked: game.story.highestUnlocked,
      maxStoryPage: functions.getMaxStoryPage(),
      visibleMilestones: Object.keys(game.story.milestones).filter((key) =>
        functions.storyDisplayed(key),
      ),
      firstSpookyBoneUnlocked: functions.storyUnlocked("firstSpookyBone"),
      nextObjective: functions.getNextStoryText(),
    };

    return {
      scenario:
        "millionaire-save-with-source-upgrades-single-gem-crafting-and-active-mining",
      replayCheckpoints,
      startingState,
      upgradePurchases: {
        blacksmithPurchases,
        blacksmithStartLevel: startingState.blacksmithLevel,
        blacksmithLevel: game.upgrades.blacksmith.level,
        activePowerPurchases,
        activePowerStartLevel: startingState.activePowerLevel,
        activePowerLevel: game.upgrades.activePower.level,
        moneyAfterPurchases,
      },
      crafting,
      targetObjects,
      minedObjects,
      storyEntry,
      endingState: {
        mineObjectLevel: game.mineObjectLevel,
        highestMineObjectLevel: game.highestMineObjectLevel,
        currentObjectName: game.currentMineObject.name,
        money: game.money.toString(),
        gems: game.gems.toString(),
        firstSpookyBoneUnlocked: functions.storyUnlocked("firstSpookyBone"),
      },
    };
  });
  sourceInteractionProgression.replayRouteStart = sourceInteractionRouteStart;
  const sourceInteractionScreenshots = [];
  for (const theme of ["light", "dark"]) {
    await page.evaluate((selectedTheme) => {
      window.functions.setTheme(selectedTheme);
    }, theme);
    await page.waitForTimeout(100);
    const screenshotState = await page.evaluate(async () => {
      const scroller = document.querySelector(".story-milestones");
      if (!scroller) throw new Error("Natural Spooky Bone Story is missing.");
      await new Promise((resolve) => window.app.$nextTick(resolve));
      await document.fonts.ready;
      return {
        tab: window.game.settings.tab,
        theme: window.game.settings.theme,
        page: window.game.story.page,
        notifications: window.game.story.notifications,
        highestUnlocked: window.game.story.highestUnlocked,
        maxStoryPage: window.functions.getMaxStoryPage(),
        mineObjectLevel: window.game.mineObjectLevel,
        highestMineObjectLevel: window.game.highestMineObjectLevel,
        currentObjectName: window.game.currentMineObject.name,
        currentObjectHp: window.game.currentMineObject.hp.toString(),
        money: window.game.money.toString(),
        highestMoney: window.game.highestMoney.toString(),
        gems: window.game.gems.toString(),
        pickaxeName: window.game.pickaxe.name,
        pickaxePower: window.game.pickaxe.pow.toString(),
        pickaxeQuality: window.game.pickaxe.quality.toString(),
        pickaxeDamage: window.game.pickaxe.getDamage().toString(),
        blacksmithLevel: window.game.upgrades.blacksmith.level,
        scrollTop: scroller.scrollTop,
        visibleMilestones: [
          "firstStone",
          "tenThousand",
          "firstSpookyBone",
          "millionaire",
        ].filter((key) => window.functions.storyDisplayed(key)),
        firstSpookyBoneUnlocked:
          window.functions.storyUnlocked("firstSpookyBone"),
        nextObjective: window.functions.getNextStoryText(),
        chapterHeading:
          document.querySelector(".chapter-control h3")?.textContent ?? null,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    const expectedBodyColor =
      theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
    if (
      screenshotState.tab !== "story" ||
      screenshotState.theme !== theme ||
      screenshotState.page !== 1 ||
      screenshotState.notifications !== 0 ||
      screenshotState.highestUnlocked !== 9 ||
      screenshotState.maxStoryPage !== 1 ||
      screenshotState.mineObjectLevel !== 12 ||
      screenshotState.highestMineObjectLevel !== 13 ||
      screenshotState.currentObjectName !== "Spooky Bone" ||
      screenshotState.currentObjectHp !== "92000" ||
      screenshotState.money !== "37105.410590093" ||
      screenshotState.highestMoney !== "1000053.0000000001" ||
      screenshotState.gems !== "181" ||
      screenshotState.pickaxeName !== 'Normal Pick "Igico"' ||
      screenshotState.blacksmithLevel !== 47 ||
      screenshotState.scrollTop !== 0 ||
      !screenshotState.firstSpookyBoneUnlocked ||
      screenshotState.nextObjective !== "Reach Emerald" ||
      screenshotState.bodyBackground !== expectedBodyColor
    ) {
      throw new Error(
        `Pinned natural Spooky Bone Story screenshot has unexpected state: ${JSON.stringify(screenshotState)}`,
      );
    }
    const screenshot = `story-natural-spooky-bone-${theme}-1440x900.png`;
    if (captureScreenshots) {
      await page.evaluate(async () => {
        await new Promise((resolve) => window.app.$nextTick(resolve));
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(outputDirectory, screenshot),
        fullPage: false,
      });
    }
    sourceInteractionScreenshots.push({ ...screenshotState, screenshot });
  }
  sourceInteractionProgression.storyScreenshots = sourceInteractionScreenshots;

  const chapter3Progression = await captureNaturalStoryChapterProgression(
    page,
    {
      chapterNumber: 3,
      targetMineObjectLevel: 27,
      storyPage: 2,
      milestoneKey: "unrealStones",
      chapterHeading: "Chapter 3: Mysterious Materials",
      batchUnchangingActiveClicks: true,
      upgradeKeys: ["blacksmith", "activePower"],
      targetCraftGemLevel: 0,
    },
    captureScreenshots,
  );
  const chapter4Progression = await captureNaturalStoryChapterProgression(
    page,
    {
      chapterNumber: 4,
      targetMineObjectLevel: 55,
      storyPage: 3,
      milestoneKey: "infinitum",
      chapterHeading: "Chapter 4: It's NOT over",
      batchUnchangingActiveClicks: true,
      upgradeKeys: [
        "gemWaster",
        "blacksmithSkill",
        "blacksmithBonus",
        "gemChance",
        "blacksmith",
        "activePower",
      ],
      targetCraftGemLevel: null,
    },
    captureScreenshots,
  );
  const chapter5Progression = await captureNaturalStoryChapterProgression(
    page,
    {
      chapterNumber: 5,
      targetMineObjectLevel: 71,
      storyPage: 4,
      milestoneKey: "reachPortal",
      chapterHeading: "Chapter 5: New Dimensions",
      traceFile: "story-natural-chapter-5-route.jsonl.br",
      batchUnchangingActiveClicks: true,
      upgradeKeys: [
        "gemWaster",
        "blacksmithSkill",
        "blacksmithBonus",
        "gemChance",
        "blacksmith",
        "activePower",
      ],
      gemUpgradeKeys: ["blacksmith"],
      gemUpgradeTargets: { blacksmith: 3 },
      targetCraftGemLevel: null,
      maxIterations: 30_000,
    },
    captureScreenshots,
  );
  const chapter6Progression = !captureChapter6Route
    ? undefined
    : await captureNaturalStoryChapterProgression(
        page,
        {
          chapterNumber: 6,
          targetMineObjectLevel: 90,
          storyPage: 5,
          milestoneKey: "breakSpacePortal",
          chapterHeading: "Chapter 6: Gone to Space",
          traceFile: "story-natural-chapter-6-route.jsonl.br",
          batchUnchangingActiveClicks: true,
          upgradeKeys: [
            "gemWaster",
            "blacksmithSkill",
            "blacksmithBonus",
            "gemChance",
            "blacksmith",
            "activePower",
          ],
          gemUpgradeKeys: ["gemChance", "blacksmith", "blacksmithSkill"],
          gemUpgradeTargets: {
            gemChance: 3,
            blacksmith: 15,
            blacksmithSkill: 10,
          },
          targetCraftGemLevel: null,
          maxIterations: 5_000_000,
        },
        captureScreenshots,
      );

  const restoredState = await page.evaluate((save) => {
    window.functions.loadGame(save, true, true);
    window.functions.changeTab("main");
    return {
      mineObjectLevel: window.game.mineObjectLevel,
      highestMineObjectLevel: window.game.highestMineObjectLevel,
      currentObjectName: window.game.currentMineObject.name,
      currentObjectHp: window.game.currentMineObject.hp.toString(),
      money: window.game.money.toString(),
      highestMoney: window.game.highestMoney.toString(),
      gems: window.game.gems.toString(),
      storyPage: window.game.story.page,
      storyHighestUnlocked: window.game.story.highestUnlocked,
      storyNotifications: window.game.story.notifications,
      tab: window.game.settings.tab,
    };
  }, miningSetup.save);
  if (
    restoredState.mineObjectLevel !== 4 ||
    restoredState.highestMineObjectLevel !== 5 ||
    restoredState.currentObjectName !== "Rock" ||
    restoredState.currentObjectHp !== "2200" ||
    restoredState.money !== "10053" ||
    restoredState.highestMoney !== "10053" ||
    restoredState.gems !== miningSetup.gems ||
    restoredState.storyPage !== 1 ||
    restoredState.storyHighestUnlocked !== 7 ||
    restoredState.storyNotifications !== 0 ||
    restoredState.tab !== "main"
  ) {
    throw new Error(
      "Remix did not restore its saved 10,000-Money state after the independent natural millionaire route: " +
        JSON.stringify(restoredState),
    );
  }

  const capture = {
    scenario: "10,000-Money-Rock-plus-8,250-natural-breaks-to-1,000,000-Money",
    replayRouteStart,
    miningSetup: { ...miningSetup, save: undefined },
    hitsPerRock,
    breaksToThreshold,
    rockFarming,
    nextObjectProbe,
    sourceInteractionProgression,
    chapter3Progression,
    chapter4Progression,
    chapter5Progression,
    storyStates,
    millionaireScrolledScreenshots,
    restoredState,
    ...(chapter6Progression ? { chapter6Progression } : {}),
  };
  if (captureScreenshots) {
    await writeFile(
      path.join(outputDirectory, "story-millionaire-visual-metrics.json"),
      JSON.stringify(
        {
          ...capture,
          captureNote:
            "Natural source route: start from the verified 10,000-Money Rock state, call functions.clickMineObject 257 times per break for 8,250 Rock breaks, and run the actual source update after each break. This raises money/highestMoney from 10,053 to 1,000,053 without changing the mine-object level. At the initial scrollTop of zero the millionaire block is below the Story viewport; the capture then scrolls the pinned source Story scroller to its natural maximum and records the exact metrics for a second screenshot where the complete millionaire block is visible. The ordered Story scan unlocks millionaire while firstSpookyBone remains locked and the next objective remains the earlier Spooky Bone requirement. The saved 10,000-Money state is restored afterward for the separate controlled Spooky Bone boundary capture.",
          screenshots: screenshotMetrics,
          scrolledScreenshots: millionaireScrolledScreenshots,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }
  return capture;
}

function createPhaseDifferentialActions(phase, sequenceSeed) {
  let state = sequenceSeed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const idleDeltas = [0.1, 0.125, 0.15, 0.2];
  const purchases = [
    { group: "money", key: "activePower" },
    { group: "money", key: "gemChance" },
    { group: "gems", key: "blacksmith" },
    { group: "gems", key: "gemMultiply" },
    { group: "planetCoins", key: "activePower" },
    { group: "planetCoins", key: "gemChance" },
    { group: "wisdom", key: "powerPowerActive" },
    { group: "wisdom", key: "damageBoost" },
  ];
  const actions = [];
  for (let index = 0; index < phaseDifferentialActionCount; index++) {
    const roll = next();
    if (roll < 0.78) {
      actions.push({ type: "activeClick" });
    } else if (roll < 0.86) {
      actions.push({
        type: "idleFrame",
        deltaSeconds: idleDeltas[Math.floor(next() * idleDeltas.length)],
      });
    } else if (roll < 0.92) {
      actions.push({
        type: "select",
        level: phase.mineObjectLevel - 4 + Math.floor(next() * 5),
      });
    } else if (roll < 0.975) {
      actions.push({
        type: "purchase",
        ...purchases[Math.floor(next() * purchases.length)],
      });
    } else {
      actions.push({ type: "craftPickaxe", shiftHeld: false });
    }
  }
  return actions;
}

async function captureEndgamePhaseDifferentials(page, browserVersion) {
  const freshSave = await page.evaluate(() => window.functions.getSaveString());
  const captured = [];
  for (const phase of endgamePhases) {
    const startingState = await page.evaluate(
      ({ phaseSpec, saveString, clock, seed }) => {
        const { game, functions } = window;
        const decimal = (value) => new window.Decimal(value);
        functions.loadGame(saveString, true, true);
        window.__idleMineBeyondProbe.restoreRandomCursor({
          seed,
          draws: 0,
          state: seed,
        });
        game.highestMineObjectLevel = phaseSpec.mineObjectLevel;
        game.money = decimal(phaseSpec.money);
        game.highestMoney = decimal(phaseSpec.money);
        game.gems = decimal(phaseSpec.gems);
        game.planetCoins = decimal(phaseSpec.planetCoins);
        game.maxPlanetCoins = decimal(phaseSpec.planetCoins);
        game.wisdom = decimal(phaseSpec.wisdom);
        game.maxWisdom = decimal(phaseSpec.wisdom);
        game.pickaxe.name = "Phase Probe Pick";
        game.pickaxe.pow = decimal(phaseSpec.pickaxePower);
        game.pickaxe.quality = decimal("1");
        game.timer.autoPickaxe = 0;
        game.timer.save = 0;
        game.usedGemsLevel = 0;
        game.story.page = phaseSpec.page;
        game.story.highestUnlocked = 0;
        game.story.notifications = 0;
        functions.setMineObjectLevel(phaseSpec.mineObjectLevel);
        functions.refreshStoryNotifications();
        game.story.page = phaseSpec.page;
        functions.saveGame();
        const state = window.__idleMineBeyondProbe.simulationState();
        const random = window.__idleMineBeyondProbe.randomCursor();
        const persistedSaveString = localStorage.getItem("IdleMine");
        const chapterHeading = game.story.chapters[phaseSpec.page];
        const storyBoundaryUnlocked = functions.storyUnlocked(
          phaseSpec.milestone,
        );
        if (chapterHeading !== phaseSpec.heading || !storyBoundaryUnlocked) {
          throw new Error(
            `${phaseSpec.id} phase save does not satisfy its pinned Story boundary.`,
          );
        }
        if (state.currentObject.id !== phaseSpec.mineObjectLevel) {
          throw new Error(`${phaseSpec.id} save selected the wrong object.`);
        }
        if (!persistedSaveString) {
          throw new Error(`${phaseSpec.id} source saveGame() wrote no save.`);
        }
        return {
          saveString: persistedSaveString,
          state,
          random,
          chapterHeading,
          storyBoundaryUnlocked,
          nextObjective: functions.getNextStoryText(),
          clock,
        };
      },
      {
        phaseSpec: phase,
        saveString: freshSave,
        clock: fixedClock,
        seed: randomSeed,
      },
    );
    const traces = [];
    for (const seedCase of phaseDifferentialSeeds) {
      const reset = await page.evaluate(
        ({ saveString, seed, clock, timers }) => {
          const { game, functions } = window;
          window.__idleMineBeyondProbe.setClock(clock);
          window.deltaTimeNew = clock;
          window.deltaTimeOld = clock;
          functions.loadGame(saveString, true, true);
          game.timer.autoPickaxe = timers.autoPickaxeTimer;
          game.timer.save = timers.saveTimer;
          window.__idleMineBeyondProbe.restoreRandomCursor({
            seed,
            draws: 0,
            state: seed,
          });
          return {
            state: window.__idleMineBeyondProbe.simulationState(),
            random: window.__idleMineBeyondProbe.randomCursor(),
          };
        },
        {
          saveString: startingState.saveString,
          seed: seedCase.rngSeed,
          clock: fixedClock,
          timers: {
            autoPickaxeTimer: startingState.state.autoPickaxeTimer,
            saveTimer: startingState.state.saveTimer,
          },
        },
      );
      if (JSON.stringify(reset.state) !== JSON.stringify(startingState.state)) {
        throw new Error(
          `${phase.id} source save did not restore before ${seedCase.id}: ${findFirstDifference(startingState.state, reset.state)}.`,
        );
      }
      if (
        reset.random.seed !== seedCase.rngSeed ||
        reset.random.draws !== 0 ||
        reset.random.state !== seedCase.rngSeed
      ) {
        throw new Error(
          `${phase.id} did not start ${seedCase.id} at its seed.`,
        );
      }

      const actions = createPhaseDifferentialActions(
        phase,
        seedCase.sequenceSeed,
      );
      const traceName = `remix-phase-${phase.id}-${seedCase.id}.jsonl.br`;
      const tracePath = path.join(outputDirectory, traceName);
      await mkdir(outputDirectory, { recursive: true });
      const compressor = createBrotliCompress(routeTraceCompressionOptions);
      const output = createWriteStream(tracePath);
      const finished = pipeline(compressor, output);
      const rawHash = createHash("sha256");
      let records = 0;
      for (
        let offset = 0;
        offset < actions.length;
        offset += phaseDifferentialTraceBatchSize
      ) {
        const batch = actions.slice(
          offset,
          offset + phaseDifferentialTraceBatchSize,
        );
        const recordsBatch = await page.evaluate(
          ({ sourceActions, startIndex }) => {
            const { game, functions } = window;
            const upgradeGroups = {
              money: game.upgrades,
              gems: game.gemUpgrades,
              planetCoins: game.planetCoinUpgrades,
              wisdom: game.powers.upgrades,
            };
            return sourceActions.map((event, index) => {
              switch (event.type) {
                case "activeClick":
                  functions.clickMineObject();
                  break;
                case "idleFrame":
                  window.__idleMineBeyondProbe.advanceClock(
                    event.deltaSeconds * 1000,
                  );
                  window.update();
                  break;
                case "select":
                  functions.setMineObjectLevel(event.level);
                  break;
                case "purchase":
                  upgradeGroups[event.group][event.key].buy();
                  break;
                case "craftPickaxe":
                  functions.craftPick(1);
                  break;
              }
              return {
                event,
                checkpoint: window.__idleMineBeyondProbe.checkpoint(
                  `phase-action-${startIndex + index + 1}`,
                ),
              };
            });
          },
          { sourceActions: batch, startIndex: offset },
        );
        const contents = `${recordsBatch.map((record) => JSON.stringify(record)).join("\n")}\n`;
        rawHash.update(contents);
        await new Promise((resolve, reject) => {
          compressor.write(contents, (error) =>
            error ? reject(error) : resolve(),
          );
        });
        records += recordsBatch.length;
      }
      compressor.end();
      await finished;
      traces.push({
        id: seedCase.id,
        rngSeed: seedCase.rngSeed,
        sequenceSeed: seedCase.sequenceSeed,
        trace: {
          file: traceName,
          records,
          rawSha256: rawHash.digest("hex"),
        },
      });
    }
    captured.push({
      id: phase.id,
      heading: startingState.chapterHeading,
      storyPage: phase.page,
      mineObjectLevel: phase.mineObjectLevel,
      milestone: phase.milestone,
      milestoneUnlocked: startingState.storyBoundaryUnlocked,
      setup: {
        money: phase.money,
        gems: phase.gems,
        planetCoins: phase.planetCoins,
        wisdom: phase.wisdom,
        pickaxePower: phase.pickaxePower,
      },
      nextObjective: startingState.nextObjective,
      saveString: startingState.saveString,
      start: {
        state: startingState.state,
        random: startingState.random,
      },
      traces,
    });
  }

  return {
    source: {
      repository: "https://github.com/Jovinull/idle-mine-remix",
      commit: "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
      browser: { name: "Playwright Chromium", version: browserVersion },
      capturedOn: new Date().toISOString().slice(0, 10),
      captureKind: "controlled Remix runtime phase-start save",
      actionCountPerTrace: phaseDifferentialActionCount,
      rngSeeds: phaseDifferentialSeeds.map(({ rngSeed }) => rngSeed),
      sequenceSeeds: phaseDifferentialSeeds.map(
        ({ sequenceSeed }) => sequenceSeed,
      ),
      traceNote:
        "Each captured Remix phase-start save is restored independently for every RNG seed. Every trace contains a long reproducible action sequence generated from its separate sequence seed; the complete normalized simulation state and RNG cursor are recorded after every action. Controlled resource/pickaxe setup is test fixture construction, not natural progression.",
    },
    phases: captured,
  };
}

async function captureStory(
  reference,
  snapshots,
  markup,
  writeScreenshots,
  includePixelData = false,
  resumeChapter6 = false,
  phaseDifferentialsOnly = false,
  firstMudOnly = false,
) {
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
      viewport,
    });
    await context.addInitScript(
      ({ clock, seed }) => {
        // Keep one native paint callback available for dynamic stylesheet swaps.
        const nativeRequestAnimationFrame =
          window.requestAnimationFrame.bind(window);
        Object.defineProperty(window, "__idleMineBeyondNativeAnimationFrame", {
          configurable: false,
          value: nativeRequestAnimationFrame,
        });
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => clockNow,
        });
        let clockNow = clock;
        let randomSeed = seed >>> 0;
        let randomState = randomSeed;
        let randomDrawCount = 0;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          randomDrawCount++;
          return randomState / 0x1_0000_0000;
        };
        Object.defineProperty(window, "__idleMineBeyondProbe", {
          configurable: false,
          value: {
            randomCursor: () => ({
              seed: randomSeed,
              draws: randomDrawCount,
              state: randomState,
            }),
            restoreRandomCursor: (cursor) => {
              randomSeed = cursor.seed >>> 0;
              randomState = cursor.state >>> 0;
              randomDrawCount = cursor.draws;
            },
            setClock: (timestamp) => {
              clockNow = timestamp;
            },
            advanceClock: (deltaMs) => {
              clockNow += deltaMs;
            },
            simulationState: () => {
              const { game } = window;
              const levels = (group) =>
                Object.fromEntries(
                  Object.entries(group).map(([key, upgrade]) => [
                    key,
                    upgrade.level,
                  ]),
                );
              const decimal = (value) => value.toString();
              const currentObject = game.currentMineObject;
              return {
                mineObjectLevel: game.mineObjectLevel,
                highestMineObjectLevel: game.highestMineObjectLevel,
                currentObject: {
                  id: game.mineObjectLevel,
                  name: currentObject.name,
                  hp: decimal(currentObject.hp),
                  totalHp: decimal(currentObject.totalHp),
                  defense: decimal(currentObject.def),
                  value: decimal(currentObject.value),
                  colors: [...currentObject.colors],
                  skin: currentObject.skin,
                  drops: Object.fromEntries(
                    Object.entries(currentObject.drops).map(([key, drop]) => [
                      key,
                      { chance: drop.chance, amount: decimal(drop.amount) },
                    ]),
                  ),
                },
                resources: {
                  money: decimal(game.money),
                  highestMoney: decimal(game.highestMoney),
                  gems: decimal(game.gems),
                  planetCoins: decimal(game.planetCoins),
                  maxPlanetCoins: decimal(game.maxPlanetCoins),
                  wisdom: decimal(game.wisdom),
                  maxWisdom: decimal(game.maxWisdom),
                },
                powers: {
                  mining: decimal(game.powers.data.values[0]),
                  craftsmanship: decimal(game.powers.data.values[1]),
                  expertise: decimal(game.powers.data.values[2]),
                  wisdom: decimal(game.powers.data.values[3]),
                  exquisity: decimal(game.powers.data.values[4]),
                },
                upgrades: {
                  money: levels(game.upgrades),
                  gems: levels(game.gemUpgrades),
                  planetCoins: levels(game.planetCoinUpgrades),
                  wisdom: levels(game.powers.upgrades),
                },
                pickaxe: {
                  name: game.pickaxe.name,
                  power: decimal(game.pickaxe.pow),
                  quality: decimal(game.pickaxe.quality),
                },
                autoPickaxeTimer: game.timer.autoPickaxe,
                saveTimer: game.timer.save,
                powersUnlocked: game.powers.unlocked(),
                usedGemsLevel: game.usedGemsLevel,
                lastActiveMs: game.lastActive,
                story: {
                  page: game.story.page,
                  highestUnlocked: game.story.highestUnlocked,
                  notifications: game.story.notifications,
                },
              };
            },
            checkpoint: (label) => ({
              label,
              state: window.__idleMineBeyondProbe.simulationState(),
              random: window.__idleMineBeyondProbe.randomCursor(),
            }),
          },
        });
        window.requestAnimationFrame = () => 0;
      },
      { clock: fixedClock, seed: randomSeed },
    );

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
    if (pageErrors.length) {
      throw new Error(`Reference page errors: ${pageErrors.join("; ")}`);
    }
    if (resumeChapter6) {
      return await captureChapter6Continuation(page, writeScreenshots);
    }
    if (phaseDifferentialsOnly) {
      return await captureEndgamePhaseDifferentials(page, browser.version());
    }
    if (firstMudOnly) {
      return await captureFirstMudProgression(page, false);
    }

    const sourceCapture = await page.evaluate(
      async ({ sourceBlocks, requestedViewport, includePixelData }) => {
        const game = window.game;
        const functions = window.functions;
        const app = window.app;
        const Decimal = window.Decimal;
        const chapters = [...game.story.chapters];
        const nextTick = () => new Promise((resolve) => app.$nextTick(resolve));
        const readComputed = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            properties: {
              alignItems: style.alignItems,
              backgroundColor: style.backgroundColor,
              border: style.border,
              borderBottom: style.borderBottom,
              borderTop: style.borderTop,
              boxSizing: style.boxSizing,
              color: style.color,
              display: style.display,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontStyle: style.fontStyle,
              height: style.height,
              left: style.left,
              margin: style.margin,
              marginLeft: style.marginLeft,
              outline: style.outline,
              overflowY: style.overflowY,
              overscrollBehaviorY: style.overscrollBehaviorY,
              padding: style.padding,
              paddingBottom: style.paddingBottom,
              paddingLeft: style.paddingLeft,
              paddingRight: style.paddingRight,
              paddingTop: style.paddingTop,
              position: style.position,
              right: style.right,
              textAlign: style.textAlign,
              top: style.top,
              bottom: style.bottom,
              transform: style.transform,
              width: style.width,
              zIndex: style.zIndex,
            },
            rect: {
              height: Math.round(rect.height * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
              x: Math.round(rect.x * 100) / 100,
              y: Math.round(rect.y * 100) / 100,
            },
          };
        };
        const readRenderedState = async (name) => {
          const article = document.querySelector("article.story");
          if (!article) throw new Error("The Story article did not render.");
          const scroller = article.querySelector(".story-milestones");
          if (!scroller)
            throw new Error("The Story milestone scroller is missing.");
          const sourceVisibleBlocks = sourceBlocks.filter(
            (block) =>
              block.conditionalAncestors.length === 0 &&
              functions.storyDisplayed(block.key),
          );
          const renderedElements = [...scroller.children];
          if (renderedElements.length !== sourceVisibleBlocks.length) {
            throw new Error(
              `Rendered ${renderedElements.length} root Story blocks, expected ${sourceVisibleBlocks.length}.`,
            );
          }
          const objective = article.querySelector(".objective");
          const quotes = [...article.querySelectorAll(".story-quote span")];
          return {
            name,
            page: game.story.page,
            chapterHeading:
              article.querySelector(".chapter-control h3")?.innerText ?? null,
            nextObjective: functions.getNextStoryText(),
            objectiveText: objective?.innerText ?? null,
            objectiveHtml: objective?.innerHTML ?? null,
            visibleBlocks: await Promise.all(
              renderedElements.map(async (element, index) => {
                const sourceBlock = sourceVisibleBlocks[index];
                if (!sourceBlock) {
                  throw new Error("Story source block metadata is missing.");
                }
                const expectedLevels =
                  sourceBlock.embeddedMineObjectAttributes.map((attributes) => {
                    const match = attributes.match(/:level="(\d+)"/);
                    if (!match) {
                      throw new Error(
                        `Could not read mine-object preview level from ${attributes}.`,
                      );
                    }
                    return Number(match[1]);
                  });
                const canvases = [
                  ...element.querySelectorAll("canvas.mine-object"),
                ];
                if (canvases.length !== expectedLevels.length) {
                  throw new Error(
                    `Story block ${sourceBlock.key} rendered ${canvases.length} mine-object previews, expected ${expectedLevels.length}.`,
                  );
                }
                const mineObjectPreviews = await Promise.all(
                  canvases.map(async (canvas, previewIndex) => {
                    const context = canvas.getContext("2d", {
                      willReadFrequently: true,
                    });
                    if (!context) {
                      throw new Error("Mine-object canvas has no 2D context.");
                    }
                    const pixels = context.getImageData(
                      0,
                      0,
                      canvas.width,
                      canvas.height,
                    ).data;
                    const digest = await crypto.subtle.digest(
                      "SHA-256",
                      pixels,
                    );
                    const pixelSha256 = [...new Uint8Array(digest)]
                      .map((byte) => byte.toString(16).padStart(2, "0"))
                      .join("");
                    return {
                      level: expectedLevels[previewIndex],
                      className: canvas.className,
                      width: canvas.width,
                      height: canvas.height,
                      pixelSha256,
                      pixelRgbaBase64: (() => {
                        if (!includePixelData) return undefined;
                        const rgba = new Uint8Array(
                          pixels.buffer,
                          pixels.byteOffset,
                          pixels.byteLength,
                        );
                        let binary = "";
                        for (
                          let offset = 0;
                          offset < rgba.length;
                          offset += 8192
                        ) {
                          binary += String.fromCharCode(
                            ...rgba.subarray(offset, offset + 8192),
                          );
                        }
                        return btoa(binary);
                      })(),
                    };
                  }),
                );
                return {
                  sourceOrder: sourceBlock.sourceOrder,
                  key: sourceBlock.key,
                  occurrence: sourceBlock.occurrence,
                  innerText: element.innerText,
                  outerHtml: element.outerHTML,
                  imageSources: [...element.querySelectorAll("img")].map(
                    (image) => image.getAttribute("src"),
                  ),
                  mineObjectPreviews,
                };
              }),
            ),
            quoteText: quotes.map((quote) => quote.innerText),
            computed: {
              article: readComputed("article.story"),
              scroller: readComputed(".story-milestones"),
              objective: readComputed("article.story .objective"),
              milestone: readComputed(".story-milestones > div"),
              chapterControl: readComputed(".chapter-control"),
              chapterHeading: readComputed(".chapter-control h3"),
              chapterPreviousButton: readComputed(
                ".chapter-control button:first-of-type",
              ),
              chapterNextButton: readComputed(
                ".chapter-control button:last-of-type",
              ),
              chapterNextImage: readComputed(
                ".chapter-control button:last-of-type img",
              ),
              quote: readComputed(".story-quote"),
              quoteText: readComputed(".story-quote span"),
              mineObjectCanvas: readComputed(
                ".story-milestones canvas.mine-object",
              ),
            },
            viewport: requestedViewport,
          };
        };

        game.settings.tab = "story";
        game.story.page = 0;
        await nextTick();
        const freshGame = await readRenderedState("fresh-game-page-0");

        game.highestMineObjectLevel = 215;
        game.highestMoney = new Decimal("5e13");
        game.maxPlanetCoins = new Decimal("1");
        game.upgrades.blacksmith.level = 1;
        game.upgrades.gemWaster.level = 1;
        const wisdomUpgrades = Object.values(game.powers.upgrades);
        if (!wisdomUpgrades[0]) {
          throw new Error(
            "The reference game has no Wisdom upgrade for Story setup.",
          );
        }
        for (const upgrade of wisdomUpgrades) upgrade.level = 0;
        wisdomUpgrades[0].level = 1;

        const lockedKeys = Object.keys(game.story.milestones).filter(
          (key) => !functions.storyUnlocked(key),
        );
        if (lockedKeys.length) {
          throw new Error(
            `Story setup left milestones locked: ${lockedKeys.join(", ")}`,
          );
        }

        const allUnlocked = [];
        for (let page = 0; page < chapters.length; page++) {
          game.story.page = page;
          await nextTick();
          await new Promise((resolve) => setTimeout(resolve, 100));
          allUnlocked.push(
            await readRenderedState(`all-unlocked-page-${page}`),
          );
        }
        game.story.page = 0;
        await nextTick();
        const scrollContainer = document.querySelector(".story-milestones");
        if (!scrollContainer) {
          throw new Error("Story scroll container was not rendered.");
        }
        scrollContainer.scrollTop = 100;
        const beforeScrollTop = scrollContainer.scrollTop;
        functions.increaseStoryPage();
        await nextTick();
        const afterContainer = document.querySelector(".story-milestones");
        if (!afterContainer) {
          throw new Error(
            "Story scroll container disappeared after navigation.",
          );
        }
        const storyNavigationScroll = {
          pageAfterNavigation: game.story.page,
          beforeScrollTop,
          afterScrollTop: afterContainer.scrollTop,
          containerReused: afterContainer === scrollContainer,
        };
        return {
          chapters,
          freshGame,
          allUnlocked,
          storyNavigationScroll,
        };
      },
      {
        sourceBlocks: markup.blocks,
        requestedViewport: viewport,
        includePixelData,
      },
    );

    if (pageErrors.length) {
      throw new Error(`Reference page errors: ${pageErrors.join("; ")}`);
    }
    if (writeScreenshots) {
      await mkdir(outputDirectory, { recursive: true });
      for (const pageIndex of [8, 0]) {
        await page.evaluate(async (pageNumber) => {
          window.game.story.page = pageNumber;
          await new Promise((resolve) => window.app.$nextTick(resolve));
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        }, pageIndex);
        await page.waitForTimeout(40);
        await page.screenshot({
          path: path.join(
            outputDirectory,
            `all-unlocked-page-${pageIndex}.png`,
          ),
          fullPage: true,
        });
      }
      await page.evaluate(async () => {
        window.game.story.page = 8;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const lightPageEightScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller?.scrollTop ?? null;
      });
      if (lightPageEightScroll !== 249) {
        throw new Error(
          `Light Story page 8 screenshot requires 249px scroll; received ${lightPageEightScroll}.`,
        );
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-8-light-1440x900.png",
        ),
        fullPage: false,
      });
      await page.evaluate(() => window.functions.setTheme("dark"));
      await page.waitForTimeout(100);
      const themeProbe = await page.evaluate(() => ({
        href: document.querySelector("#css_theme")?.getAttribute("href"),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        gameTheme: window.game.settings.theme,
      }));
      if (
        themeProbe.href !== "Themes/dark.css" ||
        themeProbe.bodyBackground !== "rgb(54, 54, 54)" ||
        themeProbe.gameTheme !== "dark"
      ) {
        throw new Error(
          `Remix dark theme failed to load for the Story screenshot: ${JSON.stringify(themeProbe)}.`,
        );
      }
      await page.evaluate(async () => {
        window.game.story.page = 0;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const storyScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller
          ? {
              page: window.game.story.page,
              tab: window.game.settings.tab,
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
              scrollTop: scroller.scrollTop,
            }
          : null;
      });
      if (storyScroll?.scrollTop !== 249) {
        throw new Error(
          `Dark Story screenshot requires 249px scroll; received ${JSON.stringify(storyScroll)}.`,
        );
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-0-dark-1440x900.png",
        ),
        fullPage: false,
      });
      await page.evaluate(async () => {
        window.game.story.page = 8;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const darkPageEightScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller?.scrollTop ?? null;
      });
      if (darkPageEightScroll !== 249) {
        throw new Error(
          `Dark Story page 8 screenshot requires 249px scroll; received ${darkPageEightScroll}.`,
        );
      }
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-8-dark-1440x900.png",
        ),
        fullPage: false,
      });
      const visualCaptureMetrics = [];
      for (const theme of ["light", "dark"]) {
        await page.evaluate(async (selectedTheme) => {
          window.functions.setTheme(selectedTheme);
          await new Promise((resolve) => window.app.$nextTick(resolve));
        }, theme);
        await page.waitForTimeout(100);
        const themeState = await page.evaluate(() => ({
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          gameTheme: window.game.settings.theme,
        }));
        const expectedBackground =
          theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
        if (
          themeState.gameTheme !== theme ||
          themeState.bodyBackground !== expectedBackground
        ) {
          throw new Error(
            "Remix " +
              theme +
              " theme failed before Story screenshots: " +
              JSON.stringify(themeState),
          );
        }
        for (let pageIndex = 0; pageIndex < 9; pageIndex += 1) {
          const scrollState = await page.evaluate(async (pageNumber) => {
            window.game.story.page = pageNumber;
            await new Promise((resolve) => window.app.$nextTick(resolve));
            await new Promise((resolve) => setTimeout(resolve, 40));
            const scroller = document.querySelector(".story-milestones");
            if (!scroller) throw new Error("Story scroller was not rendered.");
            scroller.scrollTop = 249;
            for (const animation of document.getAnimations()) {
              animation.pause();
              animation.currentTime = 0;
            }
            return {
              page: window.game.story.page,
              scrollTop: scroller.scrollTop,
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
            };
          }, pageIndex);
          if (scrollState.page !== pageIndex) {
            throw new Error(
              "Story page selection failed: " + JSON.stringify(scrollState),
            );
          }
          await page.mouse.move(viewport.width - 1, viewport.height - 1);
          await page.waitForTimeout(40);
          const fileName =
            "story-all-unlocked-page-" +
            pageIndex +
            "-" +
            theme +
            "-1440x900.png";
          await page.screenshot({
            path: path.join(outputDirectory, fileName),
            fullPage: false,
          });
          visualCaptureMetrics.push({
            page: pageIndex,
            theme,
            scrollTop: scrollState.scrollTop,
            clientHeight: scrollState.clientHeight,
            scrollHeight: scrollState.scrollHeight,
            screenshot: fileName,
          });
        }
      }
      await writeFile(
        path.join(outputDirectory, "story-fullscreen-metrics.json"),
        JSON.stringify(visualCaptureMetrics, null, 2) + "\n",
        "utf8",
      );
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(
        "Boolean(window.game && window.functions && window.app?.$el)",
      );
      await page.waitForFunction("window.imgLoaded === true");
      await page.evaluate(() => document.fonts.ready);
      const freshStoryVisualMetrics = [];
      await page.locator("button.story-tab").click();
      await page.waitForTimeout(60);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((selectedTheme) => {
          window.game.story.page = 0;
          window.functions.setTheme(selectedTheme);
        }, theme);
        await page.waitForTimeout(100);
        const freshStoryState = await page.evaluate(() => {
          const scroller = document.querySelector(".story-milestones");
          if (!scroller)
            throw new Error("Fresh Story scroller was not rendered.");
          return {
            tab: window.game.settings.tab,
            theme: window.game.settings.theme,
            page: window.game.story.page,
            notifications: window.game.story.notifications,
            highestUnlocked: window.game.story.highestUnlocked,
            mineObjectLevel: window.game.mineObjectLevel,
            money: window.game.money.toString(),
            gems: window.game.gems.toString(),
            scrollTop: scroller.scrollTop,
            bodyBackground: getComputedStyle(document.body).backgroundColor,
          };
        });
        const expectedBodyColor =
          theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
        if (
          freshStoryState.tab !== "story" ||
          freshStoryState.theme !== theme ||
          freshStoryState.page !== 0 ||
          freshStoryState.notifications !== 0 ||
          freshStoryState.mineObjectLevel !== 0 ||
          freshStoryState.money !== "0" ||
          freshStoryState.gems !== "5" ||
          freshStoryState.scrollTop !== 0 ||
          freshStoryState.bodyBackground !== expectedBodyColor
        ) {
          throw new Error(
            "Remix fresh Story screenshot reached the wrong state: " +
              JSON.stringify(freshStoryState),
          );
        }
        await page.evaluate(async () => {
          await new Promise((resolve) => window.app.$nextTick(resolve));
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        });
        await page.mouse.move(viewport.width - 1, viewport.height - 1);
        await page.screenshot({
          path: path.join(
            outputDirectory,
            "story-fresh-" + theme + "-1440x900.png",
          ),
          fullPage: false,
        });
        freshStoryVisualMetrics.push({
          ...freshStoryState,
          screenshot: "story-fresh-" + theme + "-1440x900.png",
        });
      }
      await writeFile(
        path.join(outputDirectory, "story-fresh-visual-metrics.json"),
        JSON.stringify(freshStoryVisualMetrics, null, 2) + "\n",
        "utf8",
      );
      for (const theme of ["light", "dark"]) {
        await page.evaluate((selectedTheme) => {
          window.game.settings.tab = "settings";
          window.game.story.notifications = 1;
          window.functions.setTheme(selectedTheme);
        }, theme);
        await page.waitForTimeout(100);
        const expectedBodyColor =
          theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
        const settingsTheme = await page.evaluate(() => ({
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          gameTheme: window.game.settings.theme,
          tab: window.game.settings.tab,
          storyNotifications: window.game.story.notifications,
        }));
        if (
          settingsTheme.bodyBackground !== expectedBodyColor ||
          settingsTheme.gameTheme !== theme ||
          settingsTheme.tab !== "settings" ||
          settingsTheme.storyNotifications !== 1
        ) {
          throw new Error(
            `Remix ${theme} Settings screenshot reached the wrong source state: ${JSON.stringify(settingsTheme)}.`,
          );
        }
        await page.evaluate(async () => {
          await new Promise((resolve) => window.app.$nextTick(resolve));
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        });
        await page.mouse.move(viewport.width - 1, viewport.height - 1);
        await page.screenshot({
          path: path.join(
            outputDirectory,
            `settings-fresh-${theme}-1440x900.png`,
          ),
          fullPage: false,
        });
      }
    }
    const firstMudProgression = await captureFirstMudProgression(
      page,
      writeScreenshots,
    );
    const firstPaperProgression = await captureFirstPaperProgression(
      page,
      writeScreenshots,
    );
    const firstBlacksmithProgression = await captureFirstBlacksmithProgression(
      page,
      writeScreenshots,
    );
    const firstClayProgression = await captureFirstClayProgression(
      page,
      writeScreenshots,
    );
    const firstStoneProgression = await captureFirstStoneProgression(
      page,
      writeScreenshots,
    );
    const tenThousandProgression = await captureTenThousandProgression(
      page,
      writeScreenshots,
      firstStoneProgression,
    );
    const spookyBoneProgression = await captureSpookyBoneProgression(
      page,
      writeScreenshots,
      tenThousandProgression,
    );
    return {
      source: {
        repository: reference.canonicalUrl,
        commit: reference.pinnedCommit,
        license: reference.licenseDetected,
        copyrightNotice: reference.copyrightNotice,
        sourcePaths: [
          "index.html",
          "main.css",
          "Themes/dark.css",
          "Scripts/Define/functions.js",
          "Scripts/Define/game.js",
          "Scripts/main.js",
          "Scripts/mineobject.js",
          "Scripts/pickaxe.js",
          "Scripts/upgrade.js",
          "Scripts/Components/mine-object.js",
          "Scripts/Components/upgrade.js",
        ],
        captureMethod:
          "Read-only local server of the pinned clean checkout; Playwright Chromium; SHA-verified CDN snapshots.",
        browser: { name: "Chromium", version: browser.version() },
        playwrightVersion: JSON.parse(
          await readFile(path.join(root, "package.json"), "utf8"),
        ).devDependencies["@playwright/test"],
        colorScheme: "light",
        locale: "en-US",
        timezone: "UTC",
        randomSeed,
        scenarios: {
          freshGame:
            "New browser context without a saved game in localStorage.",
          allUnlocked: {
            highestMineObjectLevel: 215,
            highestMoney: "5e13",
            maxPlanetCoins: "1",
            moneyUpgradeLevels: { blacksmith: 1, gemWaster: 1 },
            wisdomUpgradeLevels: { firstUpgrade: 1, remaining: 0 },
          },
        },
        viewport,
      },
      ...sourceCapture,
      firstMudProgression,
      firstPaperProgression,
      firstBlacksmithProgression,
      firstClayProgression,
      firstStoneProgression,
      tenThousandProgression,
      spookyBoneProgression,
    };
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function materializeChapter6VisualFixture() {
  const runtime = JSON.parse(await readFile(fixturePath, "utf8"));
  const route =
    runtime.spookyBoneProgression.millionaireProgression.chapter6Progression;
  if (!route?.trace || !route.screenshot || route.screenshotState?.page !== 5) {
    throw new Error(
      "The Chapter 6 runtime route and screenshot must be captured before writing its visual fixture.",
    );
  }
  const screenshotName = "story-natural-chapter-6-light-1440x900.png";
  const outputScreenshotPath = path.join(outputDirectory, screenshotName);
  const fixtureScreenshotPath = path.join(
    root,
    "tests/fixtures/visual",
    screenshotName,
  );
  const sourceBytes = await readFile(outputScreenshotPath);
  await copyFile(outputScreenshotPath, fixtureScreenshotPath);
  const traceSummary = await readStoryRouteTraceSummary(
    storyRouteTraceFixturePath(route.trace.file),
  );
  if (
    traceSummary.records !== route.trace.records ||
    traceSummary.last.event.type !== "storyPage" ||
    traceSummary.last.checkpoint.state.story.page !== 5
  ) {
    throw new Error(
      "The Chapter 6 visual fixture does not match its route trace.",
    );
  }
  const finalState = traceSummary.last.checkpoint.state;
  const priorSidecar = JSON.parse(
    await readFile(
      path.join(
        root,
        "tests/fixtures/visual/story-natural-chapter-5-light-1440x900.json",
      ),
      "utf8",
    ),
  );
  const sidecar = {
    ...priorSidecar,
    scenario: "natural-chapter-5-to-chapter-6-first-eligibility-route",
    route: {
      seed: route.replayRouteStart.random.seed,
      startingDraws: route.replayRouteStart.random.draws,
      endingDraws: traceSummary.last.checkpoint.random.draws,
      checkpoints: traceSummary.records,
      routeIterations: route.routeIterations,
      activeClicks: route.totalActiveClicks,
      craftAttempts: route.craftAttempts,
      farmBreaks: route.farmBreaks,
      upgradePurchases: traceSummary.upgradePurchases,
      eventCounts: traceSummary.eventCounts,
      checkpointTrace: {
        file: route.trace.file,
        rawSha256: route.trace.rawSha256,
      },
    },
    state: {
      ...route.screenshotState,
      mineObjectLevel: finalState.mineObjectLevel,
      highestMoney: finalState.resources.highestMoney,
      currentObjectName: finalState.currentObject.name,
      currentObjectHp: finalState.currentObject.hp,
      pickaxeName: finalState.pickaxe.name,
      pickaxePower: finalState.pickaxe.power,
      pickaxeQuality: finalState.pickaxe.quality,
      blacksmithLevel: finalState.upgrades.money.blacksmith,
      blacksmithSkillLevel: finalState.upgrades.money.blacksmithSkill,
      blacksmithBonusLevel: finalState.upgrades.money.blacksmithBonus,
      activePowerLevel: finalState.upgrades.money.activePower,
      gemChanceLevel: finalState.upgrades.money.gemChance,
      gemWasterLevel: finalState.upgrades.money.gemWaster,
      gemBlacksmithLevel: finalState.upgrades.gems.blacksmith,
      usedGemsLevel: finalState.usedGemsLevel,
    },
    screenshotPath: `tests/fixtures/visual/${screenshotName}`,
    screenshotSha256: sha256(sourceBytes),
    captureNote:
      "Natural source-seeded route from the captured Chapter 5 endpoint to first Chapter 6 eligibility. The complete event and full-state checkpoint trace preserves the source save, ordered actions, and RNG cursor at each route checkpoint; Beyond replays that route in parity tests. This selected 1440x900 light capture is Windows-only.",
  };
  await writeFile(
    path.join(
      root,
      "tests/fixtures/visual/story-natural-chapter-6-light-1440x900.json",
    ),
    await format(JSON.stringify(sidecar), { parser: "json" }),
    "utf8",
  );
  route.replayRouteStart.saveString = setLegacySaveTab(
    route.replayRouteStart.saveString,
    "main",
  );
  await writeFile(
    fixturePath,
    await format(JSON.stringify(runtime), { parser: "json" }),
    "utf8",
  );
}

async function main() {
  const mode = process.argv[2];
  if (
    ![
      "--write",
      "--check",
      "--write-pixel-goldens",
      "--check-pixel-goldens",
      "--check-chapter6",
      "--resume-chapter6",
      "--write-chapter6-visual",
      "--merge-chapter6-continuation",
      "--write-phase-differentials",
      "--check-phase-differentials",
      "--check-first-mud",
    ].includes(mode)
  ) {
    throw new Error(
      "Use --check/--write for the full Story runtime, --check-first-mud for the focused first-Mud state, or --check-pixel-goldens/--write-pixel-goldens for source Canvas baselines.",
    );
  }
  captureChapter6Route = mode === "--check-chapter6";
  const launchOptions = getChromiumLaunchOptions();
  if (
    ((mode.startsWith("--write") && mode !== "--write-chapter6-visual") ||
      mode === "--resume-chapter6") &&
    (launchOptions.executablePath || launchOptions.channel)
  ) {
    throw new Error(
      "Capture Story runtime evidence with Playwright's pinned Chromium, not an installed Chrome or PLAYWRIGHT_CHROMIUM_EXECUTABLE. Run `pnpm exec playwright install chromium` first.",
    );
  }
  const references = JSON.parse(await readFile(manifestPath, "utf8"));
  const dependencies = JSON.parse(await readFile(dependenciesPath, "utf8"));
  const markup = JSON.parse(await readFile(markupPath, "utf8"));
  const reference = references.references.find(
    ({ name }) => name === "Idle Mine: Remix",
  );
  if (!reference)
    throw new Error("Idle Mine: Remix is absent from the source manifest.");
  if (mode === "--merge-chapter6-continuation") {
    const routePath = storyRouteTraceOutputPath(
      "story-natural-chapter-6-route.jsonl.br",
    );
    const continuationPath = storyRouteTraceOutputPath(
      "story-natural-chapter-6-continuation.jsonl.br",
    );
    const continuation = await readStoryRouteTraceSummary(continuationPath);
    if (continuation.last.event.type !== "mine") {
      throw new Error(
        "The Chapter 6 continuation trace does not end at a resumable mine checkpoint.",
      );
    }
    const merged = await mergeStoryRouteTraces(
      [routePath, continuationPath],
      routePath,
    );
    process.stdout.write(
      `Merged ${continuation.records} resumable Chapter 6 checkpoints into the route prefix (${merged.records} total).\n`,
    );
    return;
  }
  if (reference.pinnedCommit !== markup.source.commit) {
    throw new Error(
      "Story markup fixture and source manifest use different commits.",
    );
  }
  if (mode === "--write-chapter6-visual") {
    await materializeChapter6VisualFixture();
    process.stdout.write(
      "Wrote the Chapter 6 Windows visual fixture from the captured pinned-source screenshot.\n",
    );
    return;
  }
  const snapshots = await loadDependencySnapshots(dependencies);
  const captured = await captureStory(
    reference,
    snapshots,
    markup,
    mode === "--write" || mode === "--resume-chapter6",
    mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens",
    mode === "--resume-chapter6",
    mode === "--write-phase-differentials" ||
      mode === "--check-phase-differentials",
    mode === "--check-first-mud",
  );

  if (mode === "--check-first-mud") {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    if (
      JSON.stringify(captured) !== JSON.stringify(expected.firstMudProgression)
    ) {
      throw new Error(
        `First-Mud runtime fixture differs: ${findFirstDifference(captured, expected.firstMudProgression)}.`,
      );
    }
    process.stdout.write(
      "Verified the pinned Remix first-Mud mining and Story state in both themes.\n",
    );
    return;
  }

  if (
    mode === "--write-phase-differentials" ||
    mode === "--check-phase-differentials"
  ) {
    const expected = JSON.parse(
      await readFile(phaseDifferentialFixturePath, "utf8").catch(() => "{}"),
    );
    if (mode === "--check-phase-differentials") {
      if (captured.source.commit !== reference.pinnedCommit) {
        throw new Error(
          "Phase differential capture used a different Remix pin.",
        );
      }
      if (
        captured.source.browser.version !== expected.source?.browser?.version
      ) {
        throw new Error(
          `Phase differential corpus expects Chromium ${expected.source?.browser?.version}; this run used ${captured.source.browser.version}.`,
        );
      }
      if (captured.phases.length !== expected.phases?.length) {
        throw new Error("Phase differential fixture phase count differs.");
      }
      for (let index = 0; index < captured.phases.length; index++) {
        const actual = captured.phases[index];
        const stored = expected.phases[index];
        const actualStable = {
          ...actual,
          traces: undefined,
        };
        const storedStable = {
          ...stored,
          traces: undefined,
        };
        if (JSON.stringify(actualStable) !== JSON.stringify(storedStable)) {
          throw new Error(
            `Phase differential ${actual.id} save differs: ${findFirstDifference(actualStable, storedStable)}.`,
          );
        }
        if (actual.traces.length !== stored.traces?.length) {
          throw new Error(`${actual.id} has a different number of RNG traces.`);
        }
        for (
          let traceIndex = 0;
          traceIndex < actual.traces.length;
          traceIndex++
        ) {
          const actualRun = actual.traces[traceIndex];
          const storedRun = stored.traces[traceIndex];
          if (
            actualRun.id !== storedRun.id ||
            actualRun.rngSeed !== storedRun.rngSeed ||
            actualRun.sequenceSeed !== storedRun.sequenceSeed
          ) {
            throw new Error(`${actual.id} RNG trace seed metadata differs.`);
          }
          const records = await assertStoryRouteTracesMatch(
            storyRouteTraceOutputPath(actualRun.trace.file),
            storyRouteTraceFixturePath(storedRun.trace.file),
          );
          if (
            records !== storedRun.trace.records ||
            actualRun.trace.rawSha256 !== storedRun.trace.rawSha256
          ) {
            throw new Error(
              `Phase differential ${actual.id}/${actualRun.id} trace metadata differs.`,
            );
          }
        }
      }
      process.stdout.write(
        `Verified ${captured.phases.length} pinned Remix phase starts, ${captured.source.rngSeeds.length} RNG seeds, and ${captured.source.actionCountPerTrace} actions per trace.\n`,
      );
      return;
    }

    for (const phase of captured.phases) {
      for (const run of phase.traces) {
        await copyFile(
          storyRouteTraceOutputPath(run.trace.file),
          storyRouteTraceFixturePath(run.trace.file),
        );
      }
    }
    await writeFile(
      phaseDifferentialFixturePath,
      await format(JSON.stringify(captured), { parser: "json" }),
      "utf8",
    );
    process.stdout.write(
      `Captured ${captured.phases.length} controlled pinned Remix phase-start saves across ${captured.source.rngSeeds.length} RNG seeds with ${captured.source.actionCountPerTrace} actions per trace.\n`,
    );
    return;
  }

  if (mode === "--resume-chapter6") {
    const expected = JSON.parse(await readFile(fixturePath, "utf8"));
    captured.trace = {
      file: captured.trace.file,
      ...(await writeCompactStoryRouteTrace(
        storyRouteTraceOutputPath(captured.trace.file),
        storyRouteTraceFixturePath(captured.trace.file),
      )),
    };
    expected.spookyBoneProgression.millionaireProgression.chapter6Progression =
      captured;
    await writeFile(
      fixturePath,
      await format(JSON.stringify(expected), { parser: "json" }),
      "utf8",
    );
    process.stdout.write(
      `Completed the natural Chapter 6 route with ${captured.trace.records} streamed Remix checkpoints from the pinned source.\n`,
    );
    return;
  }

  const expected = JSON.parse(await readFile(fixturePath, "utf8"));
  captured.source.capturedOn = expected.source.capturedOn;
  if (
    mode !== "--write" &&
    captured.source.browser.version !== expected.source.browser.version
  ) {
    throw new Error(
      `Story runtime was captured with Chromium ${expected.source.browser.version}, but this run used ${captured.source.browser.version}. Run \`pnpm exec playwright install chromium\` so checks use Playwright's pinned browser.`,
    );
  }
  const pixelBaselines = new Map();
  if (mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens") {
    for (const storyPage of captured.allUnlocked) {
      for (const block of storyPage.visibleBlocks) {
        for (const preview of block.mineObjectPreviews) {
          if (!preview.pixelRgbaBase64) continue;
          const rgba = Buffer.from(preview.pixelRgbaBase64, "base64");
          if (sha256(rgba) !== preview.pixelSha256) {
            throw new Error(
              `Raw Canvas pixels for level ${preview.level} do not match their captured SHA-256.`,
            );
          }
          const existing = pixelBaselines.get(preview.level);
          if (existing && sha256(existing.rgba) !== sha256(rgba)) {
            throw new Error(
              `Pinned Story canvas level ${preview.level} produced different PNGs on separate pages.`,
            );
          }
          pixelBaselines.set(preview.level, {
            width: preview.width,
            height: preview.height,
            pixelSha256: preview.pixelSha256,
            rgba,
          });
          delete preview.pixelRgbaBase64;
        }
      }
    }
  }
  const storedChapter6 =
    expected.spookyBoneProgression?.millionaireProgression?.chapter6Progression;
  if (mode === "--write") {
    const route =
      captured.spookyBoneProgression.millionaireProgression.chapter5Progression;
    await copyFile(
      storyRouteTraceOutputPath(route.trace.file),
      storyRouteTraceFixturePath(route.trace.file),
    );
    if (storedChapter6) {
      captured.spookyBoneProgression.millionaireProgression.chapter6Progression =
        storedChapter6;
    }
    captured.source.capturedOn =
      expected.source?.capturedOn ?? new Date().toISOString().slice(0, 10);
    await writeFile(
      fixturePath,
      await format(JSON.stringify(captured), { parser: "json" }),
      "utf8",
    );
    process.stdout.write(
      `Captured fresh Story state, first-Mud, first-Paper, first-Blacksmith, first-Clay, first-Stone, 10,000-Money, natural millionaire, controlled Spooky Bone, natural Chapter 3–5 routes, and ${captured.allUnlocked.length} unlocked pages from ${reference.pinnedCommit}. Chapter 5's ${captured.spookyBoneProgression.millionaireProgression.chapter5Progression.trace.records} full checkpoints are in the streamed Brotli trace. Screenshots are in ignored .research/outputs/story-runtime/.\n`,
    );
    return;
  }

  const routeTracePairs = [
    {
      label: "Chapter 5",
      expected:
        expected.spookyBoneProgression.millionaireProgression
          .chapter5Progression,
      actual:
        captured.spookyBoneProgression.millionaireProgression
          .chapter5Progression,
    },
    ...(captureChapter6Route
      ? [
          {
            label: "Chapter 6",
            expected: storedChapter6,
            actual:
              captured.spookyBoneProgression.millionaireProgression
                .chapter6Progression,
          },
        ]
      : []),
  ];
  for (const {
    label,
    expected: expectedRoute,
    actual: actualRoute,
  } of routeTracePairs) {
    const trace = expectedRoute?.trace;
    if (!trace) {
      throw new Error(
        `The Story runtime fixture does not contain the streamed ${label} route trace. Recapture it with \`pnpm reference:story-runtime:capture\`.`,
      );
    }
    if (trace.file !== path.basename(storyRouteTraceFixturePath(trace.file))) {
      throw new Error(`${label} route trace points to an unexpected file.`);
    }
    const traceRecords = await assertStoryRouteTracesMatch(
      storyRouteTraceOutputPath(trace.file),
      storyRouteTraceFixturePath(trace.file),
      { compactExpected: trace.sourceRawSha256 !== undefined },
    );
    if (
      traceRecords !== trace.records ||
      actualRoute.trace.records !== trace.records ||
      actualRoute.trace.rawSha256 !== (trace.sourceRawSha256 ?? trace.rawSha256)
    ) {
      throw new Error(
        `${label} route trace metadata differs: checked ${traceRecords} records, expected ${trace.records}.`,
      );
    }
  }

  // The Chapter 6 route is checked through its trace above, and only on request.
  const withoutChapter6 = (runtime) => {
    const copy = structuredClone(runtime);
    delete copy.spookyBoneProgression?.millionaireProgression
      ?.chapter6Progression;
    return copy;
  };
  const capturedStable = withoutChapter6(captured);
  const expectedStable = withoutChapter6(expected);
  if (JSON.stringify(capturedStable) !== JSON.stringify(expectedStable)) {
    throw new Error(
      `Story runtime differs from tests/fixtures/parity/remix-story-runtime.json at ${findFirstDifference(capturedStable, expectedStable)}. Review the reference state before recapturing.`,
    );
  }
  if (mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens") {
    const expectedPixels = new Map();
    for (const storyPage of expected.allUnlocked) {
      for (const block of storyPage.visibleBlocks) {
        for (const preview of block.mineObjectPreviews) {
          expectedPixels.set(preview.level, preview);
        }
      }
    }
    // gzip headers record the host OS, so checks reuse a saved baseline whose
    // decompressed pixels match instead of comparing freshly compressed bytes.
    for (const [level, image] of pixelBaselines) {
      image.compressed = gzipSync(image.rgba);
      if (mode !== "--check-pixel-goldens") continue;
      const saved = await readFile(
        path.join(visualGoldenDirectory, `level-${level}.rgba.gz`),
      ).catch(() => undefined);
      if (saved && gunzipSync(saved).equals(image.rgba)) {
        image.compressed = saved;
      }
    }
    const previews = [...pixelBaselines.entries()]
      .sort(([left], [right]) => left - right)
      .map(([level, image]) => {
        const runtime = expectedPixels.get(level);
        if (!runtime || runtime.pixelSha256 !== image.pixelSha256) {
          throw new Error(
            `Canvas baseline for level ${level} does not match the pinned Story runtime fixture.`,
          );
        }
        return {
          level,
          width: image.width,
          height: image.height,
          pixelSha256: image.pixelSha256,
          rgbaSha256: sha256(image.rgba),
          compressedSha256: sha256(image.compressed),
          file: `level-${level}.rgba.gz`,
        };
      });
    const visualManifest = {
      source: {
        repository: captured.source.repository,
        commit: captured.source.commit,
        capturedOn: captured.source.capturedOn,
        license: captured.source.license,
        copyrightNotice: captured.source.copyrightNotice,
        sourcePaths: captured.source.sourcePaths,
        captureMethod: captured.source.captureMethod,
        browser: captured.source.browser,
        playwrightVersion: captured.source.playwrightVersion,
      },
      viewport: captured.source.viewport,
      previews,
    };
    if (mode === "--write-pixel-goldens") {
      await mkdir(visualGoldenDirectory, { recursive: true });
      for (const preview of previews) {
        const image = pixelBaselines.get(preview.level);
        await writeFile(
          path.join(visualGoldenDirectory, preview.file),
          image.compressed,
        );
      }
      await writeFile(
        visualGoldenManifestPath,
        await format(JSON.stringify(visualManifest), { parser: "json" }),
        "utf8",
      );
    } else {
      const savedManifest = JSON.parse(
        await readFile(visualGoldenManifestPath, "utf8"),
      );
      if (JSON.stringify(visualManifest) !== JSON.stringify(savedManifest)) {
        throw new Error(
          "Pinned source Canvas baselines differ from tests/fixtures/visual/remix-story-mine-objects/manifest.json.",
        );
      }
      for (const preview of savedManifest.previews) {
        const image = await readFile(
          path.join(visualGoldenDirectory, preview.file),
        );
        if (sha256(image) !== preview.compressedSha256) {
          throw new Error(
            `Canvas PNG baseline ${preview.file} does not match its recorded SHA-256.`,
          );
        }
      }
    }
    process.stdout.write(
      `${mode === "--write-pixel-goldens" ? "Captured" : "Verified"} ${previews.length} Story mine-object Canvas goldens from ${reference.pinnedCommit}.\n`,
    );
    return;
  }
  process.stdout.write(
    `Verified fresh Story state, first-Mud, first-Paper, first-Blacksmith, first-Clay, first-Stone, 10,000-Money, natural millionaire, controlled Spooky Bone milestone boundary, and ${captured.allUnlocked.length} unlocked pages against ${reference.pinnedCommit}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
