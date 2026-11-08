import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/index.js";
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
      sourceSave.lastActive = fixedNowMs - input.elapsedSeconds * 1000;
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
          expect(rates.moneyPerSecond.decimal).not.toBe("0");
          expect(rates.gemsPerSecond.decimal).not.toBe("0");
          expect(rates.planetCoinsPerSecond.decimal).not.toBe("0");
          expect(events[0]?.message).toContain("Planet Coins.");
          await expect(sourceMessageLog).toContainText(events[0]!.message);
          await expect(beyondMessageLog).toContainText(events[0]!.message);
        }
      } else {
        await expect(sourceMessageLog).not.toContainText("Welcome back!");
        await expect(beyondMessageLog).not.toContainText("Welcome back!");
      }
      expect(await visibleMessages(beyondPage), scenario.name).toEqual(
        await visibleMessages(sourcePage),
      );

      if (scenario.compareMessagePixels) {
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
      await expect(beyondExportField).not.toHaveValue(
        "Exported String will appear here...",
      );
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
        expect(sourceDecoded.value).toMatchObject({
          money: stateAfterLoad.money.decimal,
          gems: stateAfterLoad.gems.decimal,
          planetCoins: stateAfterLoad.planetCoins.decimal,
        });
        expect(beyondExport).toBe(sourceExport);
      }
    } finally {
      await Promise.all([sourcePage.close(), beyondPage.close()]);
    }
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
  ) as { data: { saveApplicationSemantics: { inputJson: string } } };
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
    fixedNowMs + 301_000,
    fixedNowMs + 302_000,
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
    const beyondExportField = beyondPage.locator("[data-settings-save-field]");
    await expect(beyondExportField).not.toHaveValue(
      "Exported String will appear here...",
    );
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
      throw new Error("Could not decode the clock-sequence legacy exports.");
    }
    const sourceValue = sourceDecoded.value as Record<string, unknown>;
    const beyondValue = beyondDecoded.value as Record<string, unknown>;
    expect(beyondValue).toEqual(sourceValue);
    expect(sourceValue["lastActive"]).toBe(fixedNowMs + 303_000);
  } finally {
    await Promise.all([sourcePage.close(), beyondPage.close()]);
  }
});

test("matches one main-loop tick and autosave after a 120-second Chromium freeze", async ({
  page,
}) => {
  test.setTimeout(90_000);
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
  sourceSave.powers.upgrades = {};
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

  const sourceCdp = await page.context().newCDPSession(sourcePage);
  const beyondCdp = await page.context().newCDPSession(page);
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

    await Promise.all([
      sourceCdp.send("Page.setWebLifecycleState", { state: "frozen" }),
      beyondCdp.send("Page.setWebLifecycleState", { state: "frozen" }),
    ]);
    pagesFrozen = true;
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
    await Promise.all([
      sourceCdp.send("Page.setWebLifecycleState", { state: "active" }),
      beyondCdp.send("Page.setWebLifecycleState", { state: "active" }),
    ]);
    pagesFrozen = false;

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
    expect((sourceDecoded.value as { lastActive: number }).lastActive).toBe(
      startNowMs + 120_000,
    );
  } finally {
    if (pagesFrozen) {
      await Promise.allSettled([
        sourceCdp.send("Page.setWebLifecycleState", { state: "active" }),
        beyondCdp.send("Page.setWebLifecycleState", { state: "active" }),
      ]);
    }
    await Promise.allSettled([sourceCdp.detach(), beyondCdp.detach()]);
    await sourcePage.close().catch(() => undefined);
  }
});
