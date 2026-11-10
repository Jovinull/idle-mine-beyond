import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  decodeRemixBeyondSave,
  decodeRemixLegacySave,
  encodeRemixLegacySave,
  createRemixLegacySaveExportData,
  restoreRemixBeyondSave,
} from "../../packages/persistence/src/index.js";
import type { RemixMineObjectCatalog } from "../../packages/core/src/index.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

test("matches captured Remix offline loading behavior in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/offline-progression");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      offlineProgressionSemantics: {
        scenarios: {
          name: string;
          input: {
            elapsedSeconds: number;
            omitLastActive?: boolean;
            noOffline: boolean;
            upgrades: { offlineTime: number };
            nowMs: number;
          };
          clockReadCount: number;
          dateNowReads: number[];
          stateAfterLoad: unknown;
          events: unknown[];
          storageWrites: unknown[];
        }[];
      };
    };
  };
  const semantics = corpus.data.offlineProgressionSemantics;
  const observed = await page.evaluate((input) => {
    const probe = (
      window as Window & {
        __idleMineOfflineProbe?: (value: typeof input) => unknown;
      }
    ).__idleMineOfflineProbe;
    if (!probe)
      throw new Error("Offline progression probe did not initialize.");
    return probe(input);
  }, semantics);

  expect(observed).toEqual(
    semantics.scenarios.map((scenario) => {
      const lastActiveMs = scenario.input.omitLastActive
        ? scenario.dateNowReads[0]!
        : scenario.input.nowMs - scenario.input.elapsedSeconds * 1000;
      const elapsedSeconds = (scenario.dateNowReads[1]! - lastActiveMs) / 1000;
      const applied = elapsedSeconds > 300 && !scenario.input.noOffline;
      const processedSeconds = applied
        ? Math.min(
            3600 * (6 + scenario.input.upgrades.offlineTime),
            elapsedSeconds,
          )
        : 0;

      return {
        name: scenario.name,
        elapsedSeconds,
        processedSeconds,
        applied,
        clockReadCount: scenario.clockReadCount,
        dateNowReads: scenario.dateNowReads,
        stateAfterLoad: scenario.stateAfterLoad,
        events: scenario.events,
        storageWrites: scenario.storageWrites,
      };
    }),
  );
});

test("restores capped and backward-clock saves in the pinned Remix and Beyond apps", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);

  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      saveApplicationSemantics: { inputJson: string };
      notationSemantics: { formatterRegistry: { name: string }[] };
      offlineLoadRateCompositionSemantics: {
        scenarios: {
          name: string;
          input: {
            objectId: number;
            pickaxe: { power: string; quality: string };
            miningPower: string;
            exquisityPower: string;
            miningUpgrades: Record<string, Record<string, number>>;
            offlineUpgrades: {
              offlineTime: number;
              offlineGems: number;
              offlinePC: number;
            };
            initialResources: {
              money: string;
              highestMoney: string;
              gems: string;
              planetCoins: string;
              maxPlanetCoins: string;
            };
            elapsedSeconds: number;
          };
          rates: {
            moneyPerSecond: { decimal: string };
            gemsPerSecond: { decimal: string };
            planetCoinsPerSecond: { decimal: string };
          };
          stateAfterLoad: {
            money: { decimal: string };
            gems: { decimal: string };
            planetCoins: { decimal: string };
          };
          events: { message: string }[];
        }[];
      };
    };
  };
  const fixedNowMs = 1_700_000_100_000;
  const visibleMessages = async (target: Page) =>
    target.locator(".messagelog p").evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => ({
        text: paragraph.textContent?.trim() ?? "",
        color: getComputedStyle(paragraph).color,
      })),
    );

  for (const scenario of [
    {
      name: "upgraded seven-hour cap light",
      theme: "light",
      compareMessagePixels: true,
      elapsedSeconds: 7 * 60 * 60 + 73,
      expectsOfflineReward: true,
    },
    {
      name: "upgraded seven-hour cap dark",
      theme: "dark",
      compareMessagePixels: true,
      elapsedSeconds: 7 * 60 * 60 + 73,
      expectsOfflineReward: true,
    },
    {
      name: "backward wall-clock jump",
      theme: "dark",
      compareMessagePixels: false,
      elapsedSeconds: -60,
      expectsOfflineReward: false,
    },
    {
      name: "exact 300-second offline boundary",
      theme: "light",
      compareMessagePixels: false,
      elapsedSeconds: 300,
      expectsOfflineReward: false,
      liveRateScenario:
        reference.data.offlineLoadRateCompositionSemantics.scenarios.find(
          (candidate) =>
            candidate.name === "upgraded-asteroid-live-planet-coin-rate",
        ),
    },
    {
      name: "just over the 300-second offline boundary",
      theme: "light",
      compareMessagePixels: false,
      elapsedSeconds: 301,
      expectsOfflineReward: true,
      liveRateScenario:
        reference.data.offlineLoadRateCompositionSemantics.scenarios.find(
          (candidate) =>
            candidate.name === "upgraded-asteroid-live-planet-coin-rate",
        ),
    },
    {
      name: "source-captured upgraded Asteroid live rates",
      theme: "light",
      compareMessagePixels: false,
      elapsedSeconds: 3601,
      expectsOfflineReward: true,
      liveRateScenario:
        reference.data.offlineLoadRateCompositionSemantics.scenarios.find(
          (candidate) =>
            candidate.name === "upgraded-asteroid-live-planet-coin-rate",
        ),
    },
    {
      name: "maximum 48-hour offline cap with three live resource rates",
      theme: "light",
      compareMessagePixels: false,
      elapsedSeconds: 48 * 60 * 60 + 1,
      expectsOfflineReward: true,
      liveRateScenario:
        reference.data.offlineLoadRateCompositionSemantics.scenarios.find(
          (candidate) =>
            candidate.name === "maximum-offline-time-live-three-resource-rates",
        ),
    },
  ]) {
    const sourceSave = JSON.parse(
      reference.data.saveApplicationSemantics.inputJson,
    ) as {
      lastActive: number;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      money: string;
      highestMoney: string;
      gems: string;
      planetCoins: string;
      maxPlanetCoins: string;
      pickaxe: { name: string; pow: string; quality: string };
      powers: {
        data: { values: string[] };
        upgrades: Record<string, { level: number }>;
      };
      upgrades: Record<string, { level: number }>;
      gemUpgrades: Record<string, { level: number }>;
      settings: {
        tab: string;
        numberFormatterIndex: number;
        theme: string;
      };
      planetCoinUpgrades?: Record<string, { level: number }>;
    };
    expect(sourceSave.settings.numberFormatterIndex).toBe(3);
    expect(reference.data.notationSemantics.formatterRegistry[3]?.name).toBe(
      "Letters",
    );
    sourceSave.lastActive = fixedNowMs - scenario.elapsedSeconds * 1000;
    sourceSave.settings.tab = "main";
    sourceSave.settings.theme = scenario.theme;
    sourceSave.planetCoinUpgrades ??= {};
    sourceSave.planetCoinUpgrades["offlineTime"] = { level: 1 };
    if (scenario.liveRateScenario) {
      const { input } = scenario.liveRateScenario;
      sourceSave.settings.numberFormatterIndex = 0;
      sourceSave.mineObjectLevel = input.objectId;
      sourceSave.highestMineObjectLevel = input.objectId;
      sourceSave.lastActive = fixedNowMs - scenario.elapsedSeconds * 1000;
      sourceSave.pickaxe = {
        ...sourceSave.pickaxe,
        pow: input.pickaxe.power,
        quality: input.pickaxe.quality,
      };
      sourceSave.money = input.initialResources.money;
      sourceSave.highestMoney = input.initialResources.highestMoney;
      sourceSave.gems = input.initialResources.gems;
      sourceSave.planetCoins = input.initialResources.planetCoins;
      sourceSave.maxPlanetCoins = input.initialResources.maxPlanetCoins;
      sourceSave.powers.data.values[0] = input.miningPower;
      sourceSave.powers.data.values[4] = input.exquisityPower;
      for (const [group, levels] of Object.entries(input.miningUpgrades)) {
        const target =
          group === "money"
            ? sourceSave.upgrades
            : group === "gems"
              ? sourceSave.gemUpgrades
              : group === "planetCoins"
                ? sourceSave.planetCoinUpgrades
                : sourceSave.powers.upgrades;
        for (const [upgrade, level] of Object.entries(levels)) {
          target[upgrade] = { level };
        }
      }
      sourceSave.planetCoinUpgrades["offlineTime"] = {
        level: input.offlineUpgrades.offlineTime,
      };
      sourceSave.gemUpgrades["offlineGems"] = {
        level: input.offlineUpgrades.offlineGems,
      };
      sourceSave.planetCoinUpgrades["offlinePC"] = {
        level: input.offlineUpgrades.offlinePC,
      };
    }
    const encodedLegacySave = encodeRemixLegacySave(sourceSave);

    const sourcePage = await page.context().newPage();
    const beyondPage = await page.context().newPage();
    try {
      await Promise.all([
        sourcePage.setViewportSize({ width: 1440, height: 900 }),
        beyondPage.setViewportSize({ width: 1440, height: 900 }),
      ]);
      const oracleUrl = await routePinnedRemixOracle(sourcePage);
      for (const target of [sourcePage, beyondPage]) {
        await target.addInitScript(
          ({ save, nowMs }) => {
            localStorage.clear();
            localStorage.setItem("IdleMine", save);
            Date.now = () => nowMs;
          },
          { save: encodedLegacySave, nowMs: fixedNowMs },
        );
      }

      await Promise.all([sourcePage.goto(oracleUrl), beyondPage.goto("/")]);
      await expect(beyondPage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      const sourceMessageLog = sourcePage.locator(".messagelog");
      const beyondMessageLog = beyondPage.locator(".messagelog");
      if (scenario.expectsOfflineReward) {
        await expect(sourceMessageLog).toContainText(
          "Welcome back! While you were away",
        );
        await expect(beyondMessageLog).toContainText(
          "Welcome back! While you were away",
        );
        await expect(sourceMessageLog).toContainText("Game Saved!");
        await expect(beyondMessageLog).toContainText("Game Saved!");
        if (scenario.liveRateScenario) {
          const { rates, events } = scenario.liveRateScenario;
          const rateValues = [
            rates.moneyPerSecond.decimal,
            rates.gemsPerSecond.decimal,
            rates.planetCoinsPerSecond.decimal,
          ];
          const ratesAreZero = rateValues.every((rate) => rate === "0");
          if (ratesAreZero) {
            expect(rateValues).toEqual(["0", "0", "0"]);
          } else {
            expect(rateValues.every((rate) => rate !== "0")).toBe(true);
          }
          if (
            scenario.elapsedSeconds ===
            scenario.liveRateScenario.input.elapsedSeconds
          ) {
            expect(events[0]?.message).toBe(
              scenario.liveRateScenario.events[0]?.message,
            );
            await expect(sourceMessageLog).toContainText(events[0]!.message);
            await expect(beyondMessageLog).toContainText(events[0]!.message);
          }
        }
      } else {
        await expect(sourceMessageLog).not.toContainText("Welcome back!");
        await expect(beyondMessageLog).not.toContainText("Welcome back!");
      }
      expect(await visibleMessages(beyondPage), scenario.name).toEqual(
        await visibleMessages(sourcePage),
      );

      if (
        scenario.compareMessagePixels &&
        testInfo.project.name === "chromium"
      ) {
        await Promise.all([
          sourcePage.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
          }),
          beyondPage.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
          }),
        ]);
        const [sourceMessagePixels, beyondMessagePixels] = await Promise.all([
          sourceMessageLog.screenshot({
            animations: "disabled",
            caret: "hide",
          }),
          beyondMessageLog.screenshot({
            animations: "disabled",
            caret: "hide",
          }),
        ]);
        const attachmentName = scenario.name.replaceAll(" ", "-");
        await testInfo.attach(`${attachmentName}-remix.png`, {
          body: sourceMessagePixels,
          contentType: "image/png",
        });
        await testInfo.attach(`${attachmentName}-beyond.png`, {
          body: beyondMessagePixels,
          contentType: "image/png",
        });
        const imageHash = (image: Buffer) =>
          createHash("sha256").update(image).digest("hex");
        expect(
          imageHash(beyondMessagePixels),
          `${scenario.name} exact message-log pixels`,
        ).toBe(imageHash(sourceMessagePixels));
      }

      await beyondPage.locator("[data-game-tab='settings']").click();
      const sourceExport = await sourcePage.evaluate(() => {
        const remixWindow = window as Window & {
          app?: {
            settings: { tab: string; exportFieldString: string };
            exportGame: () => void;
          };
        };
        const app = remixWindow.app;
        if (!app) throw new Error("Pinned Remix Vue app was not exposed.");
        app.settings.tab = "settings";
        app.exportGame();
        return app.settings.exportFieldString;
      });
      await beyondPage.locator("[data-settings-export]").click();
      const beyondExportField = beyondPage.locator(
        "[data-settings-save-field]",
      );
      await expect(beyondExportField).toHaveValue(/.+/);
      const beyondExport = await beyondExportField.inputValue();
      const sourceDecoded = decodeRemixLegacySave(sourceExport);
      const beyondDecoded = decodeRemixLegacySave(beyondExport);
      if (sourceDecoded.status !== "success") {
        throw new Error(
          `Pinned Remix did not export a valid ${scenario.name} save.`,
        );
      }
      if (beyondDecoded.status !== "success") {
        throw new Error(`Beyond did not export a valid ${scenario.name} save.`);
      }
      expect(beyondDecoded.value, scenario.name).toEqual(sourceDecoded.value);
      if (scenario.liveRateScenario) {
        const { stateAfterLoad } = scenario.liveRateScenario;
        if (
          scenario.elapsedSeconds ===
          scenario.liveRateScenario.input.elapsedSeconds
        ) {
          if (testInfo.project.name === "chromium") {
            expect(sourceDecoded.value).toMatchObject({
              money: stateAfterLoad.money.decimal,
              gems: stateAfterLoad.gems.decimal,
              planetCoins: stateAfterLoad.planetCoins.decimal,
            });
          }
        } else if (scenario.elapsedSeconds === 300) {
          expect(sourceDecoded.value).toMatchObject({
            money: scenario.liveRateScenario.input.initialResources.money,
            gems: scenario.liveRateScenario.input.initialResources.gems,
            planetCoins:
              scenario.liveRateScenario.input.initialResources.planetCoins,
          });
        } else if (scenario.elapsedSeconds === 301) {
          const loadedResources = sourceDecoded.value as Record<
            string,
            unknown
          >;
          expect(loadedResources["money"]).not.toBe(
            scenario.liveRateScenario.input.initialResources.money,
          );
          expect(loadedResources["gems"]).not.toBe(
            scenario.liveRateScenario.input.initialResources.gems,
          );
        }
        expect(beyondExport).toBe(sourceExport);
      }
    } finally {
      await Promise.all([sourcePage.close(), beyondPage.close()]);
    }
  }
});

test("matches Remix zero-rate offline cold start and save", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      saveApplicationSemantics: { inputJson: string };
      offlineLoadRateCompositionSemantics: {
        scenarios: {
          name: string;
          input: {
            objectId: number;
            pickaxe: { power: string; quality: string };
            miningPower: string;
            exquisityPower: string;
            miningUpgrades: Record<string, Record<string, number>>;
            offlineUpgrades: {
              offlineTime: number;
              offlineGems: number;
              offlinePC: number;
            };
            initialResources: {
              money: string;
              highestMoney: string;
              gems: string;
              planetCoins: string;
              maxPlanetCoins: string;
            };
            elapsedSeconds: number;
          };
          rates: {
            moneyPerSecond: { decimal: string };
            gemsPerSecond: { decimal: string };
            planetCoinsPerSecond: { decimal: string };
          };
          events: { message: string }[];
        }[];
      };
    };
  };
  const scenario =
    reference.data.offlineLoadRateCompositionSemantics.scenarios.find(
      (candidate) => candidate.name === "zero-damage-universe-live-rates",
    );
  if (!scenario) throw new Error("Zero-rate source capture is missing.");
  expect(scenario.rates).toMatchObject({
    moneyPerSecond: { decimal: "0" },
    gemsPerSecond: { decimal: "0" },
    planetCoinsPerSecond: { decimal: "0" },
  });

  const fixedNowMs = 1_700_000_100_000;
  const { input } = scenario;
  const sourceSave = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    lastActive: number;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    money: string;
    highestMoney: string;
    gems: string;
    planetCoins: string;
    maxPlanetCoins: string;
    pickaxe: { name: string; pow: string; quality: string };
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    upgrades: Record<string, { level: number }>;
    gemUpgrades: Record<string, { level: number }>;
    planetCoinUpgrades: Record<string, { level: number }>;
    settings: { tab: string; numberFormatterIndex: number; theme: string };
  };
  sourceSave.lastActive = fixedNowMs - input.elapsedSeconds * 1000;
  sourceSave.mineObjectLevel = input.objectId;
  sourceSave.highestMineObjectLevel = input.objectId;
  sourceSave.money = input.initialResources.money;
  sourceSave.highestMoney = input.initialResources.highestMoney;
  sourceSave.gems = input.initialResources.gems;
  sourceSave.planetCoins = input.initialResources.planetCoins;
  sourceSave.maxPlanetCoins = input.initialResources.maxPlanetCoins;
  sourceSave.pickaxe = {
    ...sourceSave.pickaxe,
    pow: input.pickaxe.power,
    quality: input.pickaxe.quality,
  };
  sourceSave.powers.data.values[0] = input.miningPower;
  sourceSave.powers.data.values[4] = input.exquisityPower;
  for (const [group, levels] of Object.entries(input.miningUpgrades)) {
    const target =
      group === "money"
        ? sourceSave.upgrades
        : group === "gems"
          ? sourceSave.gemUpgrades
          : group === "planetCoins"
            ? sourceSave.planetCoinUpgrades
            : sourceSave.powers.upgrades;
    for (const [upgrade, level] of Object.entries(levels)) {
      target[upgrade] = { level };
    }
  }
  sourceSave.planetCoinUpgrades["offlineTime"] = {
    level: input.offlineUpgrades.offlineTime,
  };
  sourceSave.gemUpgrades["offlineGems"] = {
    level: input.offlineUpgrades.offlineGems,
  };
  sourceSave.planetCoinUpgrades["offlinePC"] = {
    level: input.offlineUpgrades.offlinePC,
  };
  sourceSave.settings.tab = "main";
  sourceSave.settings.numberFormatterIndex = 0;
  sourceSave.settings.theme = "light";
  const encodedLegacySave = encodeRemixLegacySave(sourceSave);
  const sourcePage = await page.context().newPage();
  const beyondPage = await page.context().newPage();
  const visibleMessages = async (target: Page) =>
    target.locator(".messagelog p").evaluateAll((paragraphs) =>
      paragraphs.map((paragraph) => ({
        text: paragraph.textContent?.trim() ?? "",
        color: getComputedStyle(paragraph).color,
      })),
    );

  try {
    await Promise.all([
      sourcePage.setViewportSize({ width: 1440, height: 900 }),
      beyondPage.setViewportSize({ width: 1440, height: 900 }),
    ]);
    const oracleUrl = await routePinnedRemixOracle(sourcePage);
    for (const target of [sourcePage, beyondPage]) {
      await target.addInitScript(
        ({ save, nowMs }) => {
          localStorage.clear();
          localStorage.setItem("IdleMine", save);
          Date.now = () => nowMs;
        },
        { save: encodedLegacySave, nowMs: fixedNowMs },
      );
    }
    await Promise.all([sourcePage.goto(oracleUrl), beyondPage.goto("/")]);
    await expect(beyondPage.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );

    const expectedRewardMessage = scenario.events[0]?.message;
    if (!expectedRewardMessage) {
      throw new Error("Zero-rate source capture has no offline log message.");
    }
    for (const target of [sourcePage, beyondPage]) {
      await expect(target.locator(".messagelog")).toContainText(
        expectedRewardMessage,
      );
      await expect(target.locator(".messagelog")).toContainText("Game Saved!");
    }
    expect(await visibleMessages(beyondPage)).toEqual(
      await visibleMessages(sourcePage),
    );

    const [sourceStored, beyondStored] = await Promise.all([
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
      beyondPage.evaluate(() => localStorage.getItem("IdleMineBeyond")),
    ]);
    expect(sourceStored).not.toBeNull();
    expect(beyondStored).not.toBeNull();
    if (sourceStored === null || beyondStored === null) {
      throw new Error("Zero-rate offline load did not persist both saves.");
    }
    const sourcePersisted = decodeRemixLegacySave(sourceStored);
    const beyondPersisted = decodeRemixBeyondSave(beyondStored);
    if (sourcePersisted.status !== "success") {
      throw new Error("Pinned Remix persisted an invalid zero-rate save.");
    }
    if (beyondPersisted.status !== "valid") {
      throw new Error("Beyond persisted an invalid zero-rate save.");
    }
    expect(sourcePersisted.value).toMatchObject({
      money: input.initialResources.money,
      highestMoney: input.initialResources.highestMoney,
      gems: input.initialResources.gems,
      planetCoins: input.initialResources.planetCoins,
      maxPlanetCoins: input.initialResources.maxPlanetCoins,
      lastActive: fixedNowMs,
    });
    expect(beyondPersisted.save.state.simulation).toMatchObject({
      resources: {
        money: input.initialResources.money,
        highestMoney: input.initialResources.highestMoney,
        gems: input.initialResources.gems,
        planetCoins: input.initialResources.planetCoins,
        maxPlanetCoins: input.initialResources.maxPlanetCoins,
      },
      lastActiveMs: fixedNowMs,
    });

    const sourceExport = await sourcePage.evaluate(() => {
      const app = (
        window as Window & {
          app?: {
            settings: { tab: string; exportFieldString: string };
            exportGame: () => void;
          };
        }
      ).app;
      if (!app) throw new Error("Pinned Remix Vue app was not exposed.");
      app.settings.tab = "settings";
      app.exportGame();
      return app.settings.exportFieldString;
    });
    await beyondPage.locator("[data-game-tab='settings']").click();
    await beyondPage.locator("[data-settings-export]").click();
    const beyondExportField = beyondPage.locator("[data-settings-save-field]");
    await expect(beyondExportField).toHaveValue(/.+/);
    const beyondExport = await beyondExportField.inputValue();
    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    const beyondDecoded = decodeRemixLegacySave(beyondExport);
    if (sourceDecoded.status !== "success") {
      throw new Error("Pinned Remix did not export a valid zero-rate save.");
    }
    if (beyondDecoded.status !== "success") {
      throw new Error("Beyond did not export a valid zero-rate save.");
    }
    expect(beyondDecoded.value).toEqual(sourceDecoded.value);
    expect(beyondExport).toBe(sourceExport);
    expect(sourceDecoded.value).toMatchObject({
      money: input.initialResources.money,
      highestMoney: input.initialResources.highestMoney,
      gems: input.initialResources.gems,
      planetCoins: input.initialResources.planetCoins,
      maxPlanetCoins: input.initialResources.maxPlanetCoins,
      lastActive: fixedNowMs,
    });
  } finally {
    await Promise.all([sourcePage.close(), beyondPage.close()]);
  }
});

test("matches Remix when the wall clock advances between offline-load reads", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      mineObjectCatalog: RemixMineObjectCatalog;
      saveApplicationSemantics: { inputJson: string };
    };
  };
  const fixedNowMs = 1_700_000_100_000;
  const sourceClockValues = [
    fixedNowMs,
    fixedNowMs,
    fixedNowMs,
    fixedNowMs + 301_000,
    fixedNowMs + 302_000,
    fixedNowMs + 303_000,
  ];
  const beyondClockValues = [
    fixedNowMs,
    fixedNowMs,
    fixedNowMs,
    fixedNowMs,
    // Align the effective offline-time read with Remix's +303-second read.
    fixedNowMs + 302_000,
    fixedNowMs + 303_000,
    fixedNowMs + 303_000,
  ];
  const sourceSave = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    lastActive: number;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    pickaxe: { name: string; pow: string; quality: string };
    settings: { tab: string; theme: string };
  };
  sourceSave.lastActive = fixedNowMs;
  sourceSave.mineObjectLevel = 0;
  sourceSave.highestMineObjectLevel = 0;
  sourceSave.pickaxe = {
    ...sourceSave.pickaxe,
    pow: "1",
    quality: "1",
  };
  sourceSave.settings.tab = "main";
  sourceSave.settings.theme = "dark";
  const encodedLegacySave = encodeRemixLegacySave(sourceSave);
  const sourcePage = await page.context().newPage();
  const beyondPage = await page.context().newPage();

  try {
    await Promise.all([
      sourcePage.setViewportSize({ width: 1440, height: 900 }),
      beyondPage.setViewportSize({ width: 1440, height: 900 }),
    ]);
    const oracleUrl = await routePinnedRemixOracle(sourcePage);
    for (const [target, clockValues] of [
      [sourcePage, sourceClockValues],
      [beyondPage, beyondClockValues],
    ] as const) {
      await target.addInitScript(
        ({ save, values }) => {
          localStorage.clear();
          localStorage.setItem("IdleMine", save);
          const reads: number[] = [];
          Date.now = () => {
            const value = values[Math.min(reads.length, values.length - 1)]!;
            reads.push(value);
            return value;
          };
          window.requestAnimationFrame = () => 1;
          window.cancelAnimationFrame = () => {};
          (
            window as Window & { __idleMineClockReads?: number[] }
          ).__idleMineClockReads = reads;
        },
        { save: encodedLegacySave, values: clockValues },
      );
    }

    await Promise.all([sourcePage.goto(oracleUrl), beyondPage.goto("/")]);
    await expect(beyondPage.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    const sourceLog = sourcePage.locator(".messagelog");
    const beyondLog = beyondPage.locator(".messagelog");
    await expect(sourceLog).toContainText("Welcome back!");
    await expect(sourceLog).toContainText("Game Saved!");
    await expect(beyondLog).toContainText("Welcome back!");
    await expect(beyondLog).toContainText("Game Saved!");
    const readCounts = await Promise.all(
      [sourcePage, beyondPage].map((target) =>
        target.evaluate(
          () =>
            (window as Window & { __idleMineClockReads?: number[] })
              .__idleMineClockReads ?? [],
        ),
      ),
    );
    expect(readCounts[0]?.slice(0, sourceClockValues.length)).toEqual(
      sourceClockValues,
    );
    expect(readCounts[1]?.slice(0, beyondClockValues.length)).toEqual(
      beyondClockValues,
    );
    expect(
      readCounts[0]
        ?.slice(sourceClockValues.length)
        .every((value) => value === fixedNowMs + 303_000),
    ).toBe(true);
    expect(
      readCounts[1]
        ?.slice(beyondClockValues.length)
        .every((value) => value === fixedNowMs + 303_000),
    ).toBe(true);
    expect(await sourceLog.locator("p").allTextContents()).toEqual(
      await beyondLog.locator("p").allTextContents(),
    );

    const [sourceStored, beyondStored] = await Promise.all([
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
      beyondPage.evaluate(() => localStorage.getItem("IdleMineBeyond")),
    ]);
    expect(sourceStored).not.toBeNull();
    expect(beyondStored).not.toBeNull();
    if (sourceStored === null || beyondStored === null) {
      throw new Error(
        "Offline loading did not persist both source and Beyond saves.",
      );
    }
    const sourceDecoded = decodeRemixLegacySave(sourceStored);
    const beyondDecoded = decodeRemixBeyondSave(beyondStored);
    expect(sourceDecoded.status).toBe("success");
    expect(beyondDecoded.status).toBe("valid");
    if (
      sourceDecoded.status !== "success" ||
      beyondDecoded.status !== "valid"
    ) {
      throw new Error("Could not decode the persisted offline-load snapshots.");
    }
    const sourceValue = sourceDecoded.value as Record<string, unknown>;
    const beyondState = restoreRemixBeyondSave(
      beyondDecoded.save,
      reference.data.mineObjectCatalog,
    );
    const sourceMessageLog = sourceValue["messageLog"];
    if (!Array.isArray(sourceMessageLog)) {
      throw new Error("The pinned offline save has no message log array.");
    }
    const beyondLegacyValue = createRemixLegacySaveExportData(
      beyondState,
      beyondState.simulation.lastActiveMs ?? fixedNowMs + 303_000,
      sourceValue,
      sourceMessageLog as { message: string; color: string }[],
    );
    const sourceRuntime = await sourcePage.evaluate(() => {
      const remixWindow = window as unknown as {
        game: {
          currentMineObject: {
            def: { toString(): string };
            totalHp: { toString(): string };
            value: { toString(): string };
          };
          pickaxe: { getDamage(): { toString(): string } };
        };
        functions: {
          getIdleDamage(): { toString(): string };
          getMPS(): { toString(): string };
        };
      };
      return {
        mps: remixWindow.functions.getMPS().toString(),
        idleDamage: remixWindow.functions.getIdleDamage().toString(),
        pickaxeDamage: remixWindow.game.pickaxe.getDamage().toString(),
        object: {
          def: remixWindow.game.currentMineObject.def.toString(),
          totalHp: remixWindow.game.currentMineObject.totalHp.toString(),
          value: remixWindow.game.currentMineObject.value.toString(),
        },
      };
    });
    expect(
      beyondLegacyValue,
      JSON.stringify({
        sourceRuntime,
        sourceMoney: sourceValue["money"],
        beyondMoney: beyondLegacyValue.money,
        clockReads: readCounts,
      }),
    ).toEqual(sourceValue);
    expect(sourceValue["lastActive"]).toBe(fixedNowMs + 303_000);
  } finally {
    await Promise.all([sourcePage.close(), beyondPage.close()]);
  }
});

test("applies offline rewards when a legacy save is imported from Settings", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      saveOfflineApplicationSemantics: {
        inputJson: string;
        elapsedSeconds: number;
        stateAfterLoad: {
          money: { decimal: string };
          gems: { decimal: string };
          planetCoins: { decimal: string };
        };
        events: { type: string; message?: string; color?: string }[];
      };
    };
  };
  const capture = reference.data.saveOfflineApplicationSemantics;
  const sourceContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const nowMs = 1_704_067_200_000;

  try {
    const oracleUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [sourcePage, page].map((target) =>
        target.addInitScript((fixedNow) => {
          localStorage.clear();
          Date.now = () => fixedNow;
        }, nowMs),
      ),
    );
    await Promise.all([
      sourcePage.setViewportSize({ width: 1440, height: 900 }),
      page.setViewportSize({ width: 1440, height: 900 }),
      sourcePage.goto(oracleUrl),
      page.goto("/"),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);

    const encodedSave = await sourcePage.evaluate((inputJson) => {
      return btoa(escape(encodeURIComponent(inputJson)));
    }, capture.inputJson);
    const sourceField = sourcePage.locator("article.settings textarea");
    const beyondField = page.locator(
      "article.settings [data-settings-save-field]",
    );
    await Promise.all([
      sourceField.fill(encodedSave),
      beyondField.fill(encodedSave),
    ]);
    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      page
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);
    await Promise.all([
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
      page.locator("[data-game-tab='mining']").click(),
    ]);

    const welcomeEvent = capture.events.find(
      (event) =>
        event.type === "logMessage" &&
        event.message?.startsWith("Welcome back!"),
    );
    if (!welcomeEvent?.message) {
      throw new Error("Pinned offline import message is missing.");
    }
    const expectedMessages = ["Game Saved!", welcomeEvent.message];
    const readMessages = (target: Page) =>
      target
        .locator(".messagelog p")
        .evaluateAll((paragraphs) =>
          paragraphs.map((paragraph) => paragraph.textContent?.trim() ?? ""),
        );
    const [sourceMessages, beyondMessages] = await Promise.all([
      readMessages(sourcePage),
      readMessages(page),
    ]);
    expect(sourceMessages).toEqual(expectedMessages);
    expect(beyondMessages).toEqual(sourceMessages);

    await Promise.all([
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
      page.locator("[data-game-tab='settings']").click(),
    ]);
    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
      page.locator("[data-settings-export]").click(),
    ]);
    const [sourceExport, beyondExport, sourceStorage, beyondPrimary] =
      await Promise.all([
        sourceField.inputValue(),
        beyondField.inputValue(),
        sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
        page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      ]);
    expect(beyondExport).toBe(sourceExport);

    const [sourceDecoded, beyondDecoded, sourceStoredDecoded] = [
      decodeRemixLegacySave(sourceExport),
      decodeRemixLegacySave(beyondExport),
      sourceStorage === null
        ? { status: "invalid" as const }
        : decodeRemixLegacySave(sourceStorage),
    ];
    expect(sourceDecoded.status).toBe("success");
    expect(beyondDecoded.status).toBe("success");
    expect(sourceStoredDecoded.status).toBe("success");
    if (
      sourceDecoded.status !== "success" ||
      beyondDecoded.status !== "success" ||
      sourceStoredDecoded.status !== "success"
    ) {
      throw new Error("The offline Settings import export did not decode.");
    }
    const sourceLegacySave = sourceDecoded.value as {
      money: string;
      highestMoney: string;
      gems: string;
      planetCoins: string;
      maxPlanetCoins: string;
    };
    expect(sourceDecoded.value).toEqual(beyondDecoded.value);
    expect(sourceDecoded.value).toMatchObject({
      gems: capture.stateAfterLoad.gems.decimal,
      planetCoins: capture.stateAfterLoad.planetCoins.decimal,
      maxPlanetCoins: capture.stateAfterLoad.planetCoins.decimal,
      lastActive: nowMs,
      settings: { tab: "settings" },
    });
    if (testInfo.project.name === "chromium") {
      expect(sourceDecoded.value).toMatchObject({
        money: capture.stateAfterLoad.money.decimal,
        highestMoney: capture.stateAfterLoad.money.decimal,
      });
    }
    expect(sourceStoredDecoded.value).toMatchObject({
      money: sourceLegacySave.money,
      highestMoney: sourceLegacySave.highestMoney,
      gems: sourceLegacySave.gems,
      planetCoins: sourceLegacySave.planetCoins,
      maxPlanetCoins: sourceLegacySave.maxPlanetCoins,
      lastActive: nowMs,
      messageLog: [
        {
          message: welcomeEvent.message,
          color: welcomeEvent.color,
        },
      ],
    });
    if (!beyondPrimary) throw new Error("Beyond primary save is missing.");
    const beyondStoredDecoded = decodeRemixBeyondSave(beyondPrimary);
    expect(beyondStoredDecoded.status).toBe("valid");
    if (beyondStoredDecoded.status !== "valid") {
      throw new Error("The persisted Beyond offline import did not decode.");
    }
    expect(beyondStoredDecoded.save.state.simulation).toMatchObject({
      resources: {
        money: sourceLegacySave.money,
        highestMoney: sourceLegacySave.highestMoney,
        gems: sourceLegacySave.gems,
        planetCoins: sourceLegacySave.planetCoins,
        maxPlanetCoins: sourceLegacySave.maxPlanetCoins,
      },
      lastActiveMs: nowMs,
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("imports a save without lastActive using the pinned clock fallback", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: { saveOfflineApplicationSemantics: { inputJson: string } };
  };
  const nowMs = 1_704_067_200_000;
  const importedSave = JSON.parse(
    reference.data.saveOfflineApplicationSemantics.inputJson,
  ) as Record<string, unknown>;
  delete importedSave["lastActive"];
  const sourceContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const oracleUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [sourcePage, page].map((target) =>
        target.addInitScript((fixedNow) => {
          localStorage.clear();
          Date.now = () => fixedNow;
        }, nowMs),
      ),
    );
    await Promise.all([sourcePage.goto(oracleUrl), page.goto("/")]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
    ]);
    const [sourceStorageBefore, beyondStorageBefore] = await Promise.all(
      [sourcePage, page].map((target) =>
        target.evaluate(() =>
          Object.fromEntries(
            Object.keys(localStorage)
              .sort()
              .map((key) => [key, localStorage.getItem(key)]),
          ),
        ),
      ),
    );
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    const encodedImport = await sourcePage.evaluate(
      (save) => btoa(escape(encodeURIComponent(JSON.stringify(save)))),
      importedSave,
    );
    const sourceField = sourcePage.locator("article.settings textarea");
    const beyondField = page.locator("[data-settings-save-field]");
    await Promise.all([
      sourceField.fill(encodedImport),
      beyondField.fill(encodedImport),
    ]);
    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      page
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);
    const [sourceStorageAfter, beyondStorageAfter] = await Promise.all(
      [sourcePage, page].map((target) =>
        target.evaluate(() =>
          Object.fromEntries(
            Object.keys(localStorage)
              .sort()
              .map((key) => [key, localStorage.getItem(key)]),
          ),
        ),
      ),
    );
    expect(sourceStorageAfter).toEqual(sourceStorageBefore);
    expect(beyondStorageAfter).toEqual(beyondStorageBefore);
    const [sourceMessages, beyondMessages] = await Promise.all(
      [sourcePage, page].map((target) =>
        target.locator(".messagelog p").allTextContents(),
      ),
    );
    expect(sourceMessages).not.toContain("Game Saved!");
    expect(
      sourceMessages!.some((message) => message.includes("Welcome back!")),
    ).toBe(false);
    expect(beyondMessages).toEqual(sourceMessages);

    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
      page.locator("[data-settings-export]").click(),
    ]);
    const [sourceExport, beyondExport] = await Promise.all([
      sourceField.inputValue(),
      beyondField.inputValue(),
    ]);
    expect(beyondExport).toBe(sourceExport);
    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    const beyondDecoded = decodeRemixLegacySave(beyondExport);
    expect(sourceDecoded.status).toBe("success");
    expect(beyondDecoded.status).toBe("success");
    if (
      sourceDecoded.status !== "success" ||
      beyondDecoded.status !== "success"
    ) {
      throw new Error("The missing-lastActive import export did not decode.");
    }
    expect(sourceDecoded.value).toEqual(beyondDecoded.value);
    expect(sourceDecoded.value).toMatchObject({ lastActive: nowMs });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("imports from Settings just above 300 seconds and saves like pinned Remix", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      saveOfflineApplicationSemantics: { inputJson: string };
    };
  };
  const nowMs = 1_704_067_200_000;
  const importedSave = JSON.parse(
    reference.data.saveOfflineApplicationSemantics.inputJson,
  ) as {
    lastActive: number;
    settings: { tab: string };
  };
  importedSave.lastActive = nowMs - 300_001;
  importedSave.settings.tab = "settings";

  const sourceContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const oracleUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [sourcePage, page].map((target) =>
        target.addInitScript((fixedNow) => {
          localStorage.clear();
          Date.now = () => fixedNow;
        }, nowMs),
      ),
    );
    await Promise.all([sourcePage.goto(oracleUrl), page.goto("/")]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);

    const encodedImport = await sourcePage.evaluate(
      (save) => btoa(escape(encodeURIComponent(JSON.stringify(save)))),
      importedSave,
    );
    const sourceField = sourcePage.locator("article.settings textarea");
    const beyondField = page.locator("[data-settings-save-field]");
    await Promise.all([
      sourceField.fill(encodedImport),
      beyondField.fill(encodedImport),
    ]);
    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      page.getByRole("button", { name: "Import (from Text Field)" }).click(),
    ]);
    await Promise.all([
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
      page.locator("[data-game-tab='mining']").click(),
    ]);
    const [sourceMessages, beyondMessages] = await Promise.all([
      sourcePage.locator(".messagelog p").allTextContents(),
      page.locator(".messagelog p").allTextContents(),
    ]);
    expect(sourceMessages).toHaveLength(2);
    expect(sourceMessages[0]).toBe("Game Saved!");
    expect(sourceMessages[1]).toContain("Welcome back!");
    expect(beyondMessages).toEqual(sourceMessages);
    await Promise.all([
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
      page.locator("[data-game-tab='settings']").click(),
    ]);
    await Promise.all([
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
      page.locator("[data-settings-export]").click(),
    ]);
    const [sourceExport, beyondExport, sourceStored, beyondPrimary] =
      await Promise.all([
        sourceField.inputValue(),
        beyondField.inputValue(),
        sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
        page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      ]);
    expect(beyondExport).toBe(sourceExport);
    expect(sourceStored).not.toBeNull();
    expect(beyondPrimary).not.toBeNull();

    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    const sourceStoredDecoded = decodeRemixLegacySave(sourceStored ?? "");
    const beyondStoredDecoded = decodeRemixBeyondSave(beyondPrimary ?? "");
    expect(sourceDecoded.status).toBe("success");
    expect(sourceStoredDecoded.status).toBe("success");
    expect(beyondStoredDecoded.status).toBe("valid");
    if (
      sourceDecoded.status !== "success" ||
      sourceStoredDecoded.status !== "success" ||
      beyondStoredDecoded.status !== "valid"
    ) {
      throw new Error("The 300.001-second import save did not decode.");
    }
    expect(sourceDecoded.value).toMatchObject({ lastActive: nowMs });
    expect(sourceStoredDecoded.value).toMatchObject({
      lastActive: nowMs,
      messageLog: [
        {
          message: expect.stringContaining("Welcome back!"),
        },
      ],
    });
    expect(beyondStoredDecoded.save.state.simulation.lastActiveMs).toBe(nowMs);
    expect(beyondStoredDecoded.save.state.simulation.resources).toMatchObject({
      money: (sourceStoredDecoded.value as { money: string }).money,
      gems: (sourceStoredDecoded.value as { gems: string }).gems,
      planetCoins: (sourceStoredDecoded.value as { planetCoins: string })
        .planetCoins,
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

async function verifyLongFrame(page: Page, freezePages: boolean) {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { saveApplicationSemantics: { inputJson: string } } };
  const startNowMs = 1_700_000_000_000;
  const sourceSave = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    lastActive: number;
    mineObjectLevel: number;
    highestMineObjectLevel: number;
    pickaxe: { name: string; pow: string; quality: string };
    powers: { data: { values: string[] }; upgrades: Record<string, unknown> };
    settings: { tab: string; theme: string };
    story: {
      page: number;
      notifications: number;
      highestUnlocked: number;
      scrollY: number;
    };
    upgrades: Record<string, { level: number }>;
  };
  sourceSave.lastActive = startNowMs - 120_000;
  sourceSave.mineObjectLevel = 3;
  sourceSave.highestMineObjectLevel = 3;
  sourceSave.pickaxe = {
    name: "Suspension Probe Pickaxe",
    pow: "100",
    quality: "1",
  };
  sourceSave.powers.data.values = ["1", "1", "1", "1", "1"];
  sourceSave.powers.upgrades = { powerPowerIdle: { level: 1 } };
  sourceSave.settings.tab = "main";
  sourceSave.settings.theme = "light";
  sourceSave.story = {
    ...sourceSave.story,
    page: 0,
    notifications: 0,
    highestUnlocked: 0,
    scrollY: 0,
  };
  sourceSave.upgrades["idlePower"] = { level: 0 };
  sourceSave.upgrades["idleSpeed"] = { level: 0 };
  const encodedLegacySave = encodeRemixLegacySave(sourceSave);

  const sourcePage = await page.context().newPage();
  const initializeClockAndSave = ({
    encoded,
    nowMs,
  }: {
    encoded: string;
    nowMs: number;
  }) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    let currentTime = nowMs;
    Date.now = () => currentTime;
    (
      window as Window & {
        __idleMineSuspensionClock?: { advance: (milliseconds: number) => void };
      }
    ).__idleMineSuspensionClock = {
      advance(milliseconds) {
        currentTime += milliseconds;
      },
    };
  };
  const readRemixFrame = () =>
    sourcePage.evaluate(() => {
      const remixWindow = window as Window & {
        app?: {
          currentMineObject: { name: string; hp: { toString: () => string } };
          getIdleDamage: () => { toString: () => string };
          timer: { autoPickaxe: number; save: number };
        };
      };
      const app = remixWindow.app;
      if (!app) throw new Error("Pinned Remix app state is unavailable.");
      return {
        object: app.currentMineObject.name,
        hp: app.currentMineObject.hp.toString(),
        idleDamage: app.getIdleDamage().toString(),
        autoPickaxeTimer: app.timer.autoPickaxe,
        saveTimer: app.timer.save,
      };
    });

  const sourceCdp = freezePages
    ? await page.context().newCDPSession(sourcePage)
    : undefined;
  const beyondCdp = freezePages
    ? await page.context().newCDPSession(page)
    : undefined;
  let pagesFrozen = false;
  try {
    const oracleUrl = await routePinnedRemixOracle(sourcePage);
    await Promise.all([
      sourcePage.addInitScript(initializeClockAndSave, {
        encoded: encodedLegacySave,
        nowMs: startNowMs,
      }),
      page.addInitScript(initializeClockAndSave, {
        encoded: encodedLegacySave,
        nowMs: startNowMs,
      }),
    ]);
    await Promise.all([sourcePage.goto(oracleUrl), page.goto("/")]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );
    const sourceBefore = await readRemixFrame();
    expect(sourceBefore).toEqual({
      object: "Clay",
      hp: "1400",
      idleDamage: "40",
      autoPickaxeTimer: 0,
      saveTimer: 0,
    });
    const beyondHpBefore = await page
      .locator("[data-mine-object-hp]")
      .innerText();
    await expect(page.locator(".mineobject h2")).toHaveText("Clay");

    if (sourceCdp && beyondCdp) {
      await Promise.all([
        sourceCdp.send("Page.setWebLifecycleState", { state: "frozen" }),
        beyondCdp.send("Page.setWebLifecycleState", { state: "frozen" }),
      ]);
      pagesFrozen = true;
    }
    await Promise.all([
      sourcePage.evaluate((milliseconds) => {
        const clock = (
          window as Window & {
            __idleMineSuspensionClock?: {
              advance: (value: number) => void;
            };
          }
        ).__idleMineSuspensionClock;
        if (!clock) throw new Error("Remix test clock is unavailable.");
        clock.advance(milliseconds);
      }, 120_000),
      page.evaluate((milliseconds) => {
        const clock = (
          window as Window & {
            __idleMineSuspensionClock?: {
              advance: (value: number) => void;
            };
          }
        ).__idleMineSuspensionClock;
        if (!clock) throw new Error("Beyond test clock is unavailable.");
        clock.advance(milliseconds);
      }, 120_000),
    ]);
    if (sourceCdp && beyondCdp) {
      await Promise.all([
        sourceCdp.send("Page.setWebLifecycleState", { state: "active" }),
        beyondCdp.send("Page.setWebLifecycleState", { state: "active" }),
      ]);
      pagesFrozen = false;
    }
    await expect.poll(async () => (await readRemixFrame()).hp).toBe("1360");
    await expect(page.locator("[data-mine-object-hp]")).not.toHaveText(
      beyondHpBefore,
    );
    const sourceAfter = await readRemixFrame();
    expect(sourceAfter.hp).toBe(
      String(Number(sourceBefore.hp) - Number(sourceBefore.idleDamage)),
    );
    expect(sourceAfter.autoPickaxeTimer).toBe(0);
    expect(sourceAfter.saveTimer).toBe(0);
    await expect(sourcePage.locator(".messagelog p").first()).toHaveText(
      "Game Saved!",
    );
    await expect(page.locator(".messagelog p").first()).toHaveText(
      "Game Saved!",
    );
    expect(await sourcePage.locator(".messagelog p").allTextContents()).toEqual(
      await page.locator(".messagelog p").allTextContents(),
    );
    expect(await page.locator("article.main .mineobject").innerText()).toBe(
      await sourcePage.locator("article.main .mineobject").innerText(),
    );

    await page.locator("[data-game-tab='settings']").click();
    const sourceExport = await sourcePage.evaluate(() => {
      const remixWindow = window as Window & {
        app?: {
          settings: { tab: string; exportFieldString: string };
          exportGame: () => void;
        };
      };
      const app = remixWindow.app;
      if (!app) throw new Error("Pinned Remix Vue app was not exposed.");
      app.settings.tab = "settings";
      app.exportGame();
      return app.settings.exportFieldString;
    });
    await page.locator("[data-settings-export]").click();
    const beyondExportField = page.locator("[data-settings-save-field]");
    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    const beyondDecoded = decodeRemixLegacySave(
      await beyondExportField.inputValue(),
    );
    expect(sourceDecoded.status).toBe("success");
    expect(beyondDecoded.status).toBe("success");
    if (
      sourceDecoded.status !== "success" ||
      beyondDecoded.status !== "success"
    ) {
      throw new Error("Could not decode the frozen-resume save comparison.");
    }
    expect(beyondDecoded.value).toEqual(sourceDecoded.value);
    const sourcePowerOfMining = (
      sourceDecoded.value as { powers: { data: { values: string[] } } }
    ).powers.data.values[0];
    const beyondPowerOfMining = (
      beyondDecoded.value as { powers: { data: { values: string[] } } }
    ).powers.data.values[0];
    expect(sourcePowerOfMining).toBe("1.00002");
    expect(beyondPowerOfMining).toBe("1.00002");
    expect((sourceDecoded.value as { lastActive: number }).lastActive).toBe(
      startNowMs + 120_000,
    );
  } finally {
    if (pagesFrozen && sourceCdp && beyondCdp) {
      await Promise.allSettled([
        sourceCdp.send("Page.setWebLifecycleState", { state: "active" }),
        beyondCdp.send("Page.setWebLifecycleState", { state: "active" }),
      ]);
    }
    await Promise.allSettled(
      [sourceCdp?.detach(), beyondCdp?.detach()].filter(
        (session): session is Promise<void> => session !== undefined,
      ),
    );
    await sourcePage.close().catch(() => undefined);
  }
}

test("matches one main-loop tick and autosave after a 120-second Chromium freeze", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "CDP lifecycle freeze is Chromium-only.",
  );
  test.setTimeout(90_000);
  await verifyLongFrame(page, true);
});

test("matches one main-loop tick and autosave after a 120-second frame gap", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await verifyLongFrame(page, false);
});
