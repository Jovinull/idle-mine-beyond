import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decodeRemixBeyondSave } from "../../packages/persistence/src/remix-beyond-save.js";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type SaveFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    saveOfflineApplicationSemantics: {
      inputJson: string;
      elapsedSeconds: number;
      events: { type: string; message?: string; color?: string }[];
    };
    pickaxeCraftingSemantics: {
      attempts: {
        input: {
          name: string;
          gems: string;
          usedGemsLevel: number;
          highestMineObjectLevel: number;
          equippedPickaxe: { name: string; power: string; quality: string };
          randomValues: number[];
          shiftHeld?: boolean;
          upgradeLevels?: {
            money?: Record<string, number>;
            planetCoins?: Record<string, number>;
          };
          craftGems?: { decimal: string };
        };
        randomCalls: number;
        saveCalls: number;
        messageLog: { message: string }[];
        saveSnapshots: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        }[];
        result: {
          gems: { decimal: string };
          pickaxe: {
            name: string;
            power: { decimal: string };
            quality: { decimal: string };
          };
        };
      }[];
    };
    upgradeSemantics: {
      purchaseSemantics: Array<{
        name: string;
        group: string;
        key: string;
        startingLevel: number;
        startingResources: Record<string, { decimal: string }>;
        currentPrice: { decimal: string };
        operation?: { method: string };
        endingLevel?: number;
        endingResources?: Record<string, { decimal: string }>;
      }>;
    };
  };
};

type LegacySave = {
  money: string;
  gems: string;
  planetCoins: string;
  wisdom: string;
  highestMoney: string;
  maxPlanetCoins: string;
  maxWisdom: string;
  highestMineObjectLevel: number;
  mineObjectLevel: number;
  lastActive: number;
  usedGemsLevel: number;
  settings: {
    theme: string;
    tab: string;
    upgradeTab?: string;
    numberFormatterIndex?: number;
  };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
};

type ObservableLegacySave = {
  money: string;
  gems: string;
  planetCoins?: string;
  wisdom?: string;
  settings: { theme?: string; numberFormatterIndex?: number };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades?: Record<string, { level: number }>;
  powers?: { upgrades: Record<string, { level: number }> };
  pickaxe: { name: string; pow: string; quality: string };
};

type ObservableBeyondState = {
  resources: {
    money: string;
    gems: string;
    planetCoins?: string;
    wisdom?: string;
  };
  upgrades: {
    money: Record<string, number>;
    gems: Record<string, number>;
    planetCoins?: Record<string, number>;
    wisdom?: Record<string, number>;
  };
};

type ObservableBeyondSave = {
  simulation: ObservableBeyondState;
  settings: { theme: string; numberFormatterIndex: number };
};

const fixedTime = 1_700_000_000_000;

const initializeSharedStorage = ({
  encoded,
  now,
}: {
  encoded: string;
  now: number;
}) => {
  if (localStorage.getItem("IdleMine") === null) {
    localStorage.setItem("IdleMine", encoded);
  }
  Date.now = () => now;
};

const initializeSharedAutosaveClock = ({
  encoded,
  now,
}: {
  encoded: string;
  now: number;
}) => {
  if (localStorage.getItem("IdleMine") === null) {
    localStorage.setItem("IdleMine", encoded);
  }
  let currentTime = now;
  Object.defineProperty(window, "__crossTabAutosaveNow", {
    configurable: false,
    get: () => currentTime,
    set: (next: number) => {
      currentTime = next;
    },
  });
  Date.now = () => currentTime;
};

function readSaveState(encoded: string): ObservableLegacySave {
  const decoded = decodeRemixLegacySave(encoded);
  if (decoded.status !== "success") {
    throw new Error(
      `Expected a valid source-compatible save, got ${decoded.status}.`,
    );
  }
  return JSON.parse(decoded.json) as ObservableLegacySave;
}

test("a stale offline Settings import overwrites a newer purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const offlineCapture = fixture.data.saveOfflineApplicationSemantics;
  const importedSave = JSON.parse(offlineCapture.inputJson) as LegacySave;
  importedSave.lastActive = fixedTime - offlineCapture.elapsedSeconds * 1000;
  importedSave.settings.tab = "settings";

  const initialSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  initialSave.lastActive = fixedTime;
  initialSave.money = "1000";
  initialSave.highestMoney = "1000";
  initialSave.settings.tab = "main";
  initialSave.settings.theme = "light";

  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourceFreshPage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const encodeWithPinnedBrowser = (save: LegacySave) =>
      sourceFreshPage.evaluate((value) => {
        return btoa(escape(encodeURIComponent(JSON.stringify(value))));
      }, save);
    const [encodedOfflineSave, encodedInitialSave] = await Promise.all([
      encodeWithPinnedBrowser(importedSave),
      encodeWithPinnedBrowser(initialSave),
    ]);
    await Promise.all(
      [page, beyondStalePage, sourceFreshPage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourceFreshPage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(
        page.locator(
          '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
        ),
      ).toBeVisible(),
      expect(
        beyondStalePage.locator(
          '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
        ),
      ).toBeVisible(),
      ...[sourceFreshPage, sourceStalePage].map((target) =>
        target.waitForFunction(() =>
          Boolean((window as Window & { game?: unknown }).game),
        ),
      ),
    ]);

    const freshBeyondBlacksmith = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const freshSourceBlacksmith = sourceBlacksmithCard(sourceFreshPage);
    await Promise.all([
      freshBeyondBlacksmith.click(),
      freshSourceBlacksmith.click(),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourceFreshPage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourceFreshPage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [newerBeyondState, newerSourceSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourceFreshPage),
    ]);
    expect(newerBeyondState.upgrades.money["blacksmith"]).toBe(1);
    expect(newerBeyondState.resources.money).toBe("970");
    expect(readSaveState(newerSourceSave)).toMatchObject({
      money: "970",
      upgrades: { blacksmith: { level: 1 } },
    });

    const sourceStaleField = sourceStalePage.locator(
      "article.settings textarea",
    );
    const beyondStaleField = beyondStalePage.locator(
      "article.settings [data-settings-save-field]",
    );
    await Promise.all([
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
      beyondStalePage.locator("[data-game-tab='settings']").click(),
    ]);
    await Promise.all([
      sourceStaleField.fill(encodedOfflineSave),
      beyondStaleField.fill(encodedOfflineSave),
    ]);
    await Promise.all([
      sourceStalePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      beyondStalePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);
    await Promise.all([
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Mining" })
        .click(),
      beyondStalePage.locator("[data-game-tab='mining']").click(),
    ]);
    await expect(
      sourceStalePage.locator(".messagelog p").filter({
        hasText: "Welcome back!",
      }),
    ).toHaveCount(1);
    await expect(
      beyondStalePage.locator(".messagelog p").filter({
        hasText: "Welcome back!",
      }),
    ).toHaveCount(1);

    const [sourceMessages, beyondMessages] = await Promise.all([
      sourceStalePage.locator(".messagelog p").allTextContents(),
      beyondStalePage.locator(".messagelog p").allTextContents(),
    ]);
    expect(beyondMessages).toEqual(sourceMessages);
    for (const event of offlineCapture.events) {
      if (event.type === "logMessage" && event.message) {
        expect(sourceMessages).toContain(event.message);
      }
    }

    await Promise.all([
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
      beyondStalePage.locator("[data-game-tab='settings']").click(),
    ]);
    await Promise.all([
      sourceStalePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
      beyondStalePage.locator("[data-settings-export]").click(),
    ]);
    const [sourceExport, beyondExport, sourceStored, beyondStored] =
      await Promise.all([
        sourceStaleField.inputValue(),
        beyondStaleField.inputValue(),
        readLegacySlot(sourceStalePage),
        beyondStalePage.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      ]);
    expect(beyondExport).toBe(sourceExport);
    expect(sourceStored).toBe(
      await sourceStalePage.evaluate(() => localStorage.getItem("IdleMine")),
    );
    const staleSourceState = readSaveState(sourceStored);
    expect(staleSourceState.money).not.toBe("970");
    expect(staleSourceState.upgrades["blacksmith"]?.level).toBe(0);
    if (!beyondStored) throw new Error("Beyond stale import did not persist.");
    expect(await readBeyondState(beyondStalePage)).toMatchObject({
      resources: {
        money: staleSourceState.money,
        gems: staleSourceState.gems,
        planetCoins: staleSourceState.planetCoins,
      },
      upgrades: { money: { blacksmith: 0 } },
    });
    expect(
      await readBeyondState(beyondStalePage, "IdleMineBeyondBackup"),
    ).toEqual(newerBeyondState);
    expect(readSaveState(sourceStored)).toMatchObject({
      lastActive: fixedTime,
      settings: { theme: importedSave.settings.theme },
    });
    expect(decodeRemixLegacySave(sourceExport)).toMatchObject({
      status: "success",
      value: { lastActive: fixedTime },
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

async function readLegacySlot(page: Page): Promise<string> {
  const value = await page.evaluate(() => localStorage.getItem("IdleMine"));
  if (value === null) throw new Error("The legacy save slot is empty.");
  return value;
}

async function readBeyondState(
  page: Page,
  key = "IdleMineBeyond",
): Promise<ObservableBeyondState> {
  const serialized = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  if (serialized === null)
    throw new Error(`The Beyond save slot ${key} is empty.`);
  const decoded = decodeRemixBeyondSave(serialized);
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid Beyond v1 save, got ${decoded.status}.`);
  }
  return decoded.save.state.simulation;
}

async function readBeyondSave(
  page: Page,
  key = "IdleMineBeyond",
): Promise<ObservableBeyondSave> {
  const serialized = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  if (serialized === null)
    throw new Error(`The Beyond save slot ${key} is empty.`);
  const decoded = decodeRemixBeyondSave(serialized);
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid Beyond v1 save, got ${decoded.status}.`);
  }
  return {
    simulation: decoded.save.state.simulation,
    settings: {
      theme: decoded.save.state.settings.theme,
      numberFormatterIndex: decoded.save.state.settings.numberFormatterIndex,
    },
  };
}

function sourceBlacksmithCard(page: Page) {
  return page
    .locator(".upgradelist .upgrade")
    .filter({ has: page.locator('img[src$="blacksmith.png"]') })
    .first();
}

function sourceActivePowerCard(page: Page) {
  return page
    .locator(".upgradelist .upgrade")
    .filter({ has: page.locator('img[src$="activepower.png"]') })
    .first();
}

function sourceOfflineGemsCard(page: Page) {
  return page
    .locator(".upgradelist .upgrade")
    .filter({ has: page.locator('img[src$="gemoffline.png"]') })
    .first();
}

async function installCraftRandomSequence(
  page: Page,
  values: number[],
  buttonSelector = "[data-craft-pickaxe]",
) {
  await page.evaluate(
    ({ sequence, craftButtonSelector }) => {
      let index = 0;
      const browserWindow = window as Window & {
        __idleMineCraftRandomCalls?: () => number;
      };
      browserWindow.__idleMineCraftRandomCalls = () => index;
      Math.random = () => sequence[index++] ?? 0.5;
      document.addEventListener(
        "click",
        (event) => {
          if (
            (event.target as Element | null)?.closest(craftButtonSelector) !==
            null
          ) {
            index = 0;
          }
        },
        true,
      );
    },
    { sequence: values, craftButtonSelector: buttonSelector },
  );
}

async function readBeyondStoredPickaxe(page: Page, key = "IdleMineBeyond") {
  const serialized = await page.evaluate(
    (storageKey) => localStorage.getItem(storageKey),
    key,
  );
  if (serialized === null)
    throw new Error(`The Beyond save slot ${key} is empty.`);
  const decoded = decodeRemixBeyondSave(serialized);
  if (decoded.status !== "valid") {
    throw new Error(`Expected a valid Beyond v1 save, got ${decoded.status}.`);
  }
  const pickaxe = decoded.save.state.simulation.pickaxe;
  return {
    name: pickaxe.name,
    power: pickaxe.power.toString(),
    quality: pickaxe.quality.toString(),
  };
}

test("a stale second tab purchase overwrites the newer save like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondContext = page.context();
  const beyondStalePage = await beyondContext.newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
      sourceStalePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
    ]);

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const beyondStaleCard = beyondStalePage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const remixCard = sourceBlacksmithCard(sourcePage);
    const remixStaleCard = sourceBlacksmithCard(sourceStalePage);
    await Promise.all(
      [beyondCard, beyondStaleCard, remixCard, remixStaleCard].map((card) =>
        expect(card).toBeVisible(),
      ),
    );
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(beyondStaleCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixCard.locator(".lvl")).toHaveText("0"),
      expect(remixStaleCard.locator(".lvl")).toHaveText("0"),
    ]);

    await Promise.all([beyondCard.click(), remixCard.click()]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondFirstState, remixFirstSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const remixFirstState = readSaveState(remixFirstSave);
    expect(beyondFirstState.upgrades.money["blacksmith"]).toBe(
      remixFirstState.upgrades["blacksmith"]?.level,
    );
    expect(beyondFirstState.resources.money).toBe(remixFirstState.money);
    expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
      encodedInitialSave,
    );
    await Promise.all([
      expect(beyondStaleCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixStaleCard.locator(".lvl")).toHaveText("0"),
    ]);

    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Save" }).click(),
      sourceStalePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondStaleState, remixStaleSave] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixStaleState = readSaveState(remixStaleSave);
    expect(beyondStaleState.upgrades.money["blacksmith"]).toBe(
      remixStaleState.upgrades["blacksmith"]?.level,
    );
    expect(beyondStaleState.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondStaleState.resources.money).toBe(remixStaleState.money);
    expect(remixStaleState.money).toBe("1000");
    const backupAfterStaleOverwrite = await readBeyondState(
      page,
      "IdleMineBeyondBackup",
    );
    expect(backupAfterStaleOverwrite).toEqual(beyondFirstState);

    // The newer snapshot can become the final writer again without merging.
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondFinalState, remixFinalSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const remixFinalState = readSaveState(remixFinalSave);
    expect(beyondFinalState.upgrades.money["blacksmith"]).toBe(
      remixFinalState.upgrades["blacksmith"]?.level,
    );
    expect(beyondFinalState.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondFinalState.resources.money).toBe(remixFinalState.money);
    expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
      encodedInitialSave,
    );
    const backupAfterFreshOverwrite = await readBeyondState(
      page,
      "IdleMineBeyondBackup",
    );
    expect(backupAfterFreshOverwrite).toEqual(beyondStaleState);

    // A later action from the stale tab writes its whole local snapshot. This
    // loses the newer Blacksmith purchase while retaining its own Active Power.
    await Promise.all([
      beyondStalePage
        .locator("footer button")
        .filter({ hasText: "Mining" })
        .click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Mining" })
        .click(),
    ]);
    const beyondStaleActivePower = beyondStalePage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="activePower"]',
    );
    const remixStaleActivePower = sourceActivePowerCard(sourceStalePage);
    await Promise.all([
      beyondStaleActivePower.click(),
      remixStaleActivePower.click(),
    ]);
    await Promise.all([
      expect(beyondStaleActivePower).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixStaleActivePower.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Save" }).click(),
      sourceStalePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondStaleActionState, remixStaleActionSave] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixStaleActionState = readSaveState(remixStaleActionSave);
    expect(beyondStaleActionState.upgrades.money["blacksmith"]).toBe(
      remixStaleActionState.upgrades["blacksmith"]?.level,
    );
    expect(beyondStaleActionState.upgrades.money["activePower"]).toBe(
      remixStaleActionState.upgrades["activePower"]?.level,
    );
    expect(beyondStaleActionState.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondStaleActionState.upgrades.money["activePower"]).toBe(1);
    expect(beyondStaleActionState.resources.money).toBe(
      remixStaleActionState.money,
    );
    expect(remixStaleActionState.money).toBe("0");
    const backupAfterStaleAction = await readBeyondState(
      page,
      "IdleMineBeyondBackup",
    );
    expect(backupAfterStaleAction).toEqual(beyondFinalState);
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
    ]);
    expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
      encodedInitialSave,
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale tab periodic autosave overwrites the newer save like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.pickaxe = { ...save.pickaxe, pow: "0", quality: "0" };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedAutosaveClock, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
      sourceStalePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      ),
    ]);

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const beyondStaleCard = beyondStalePage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const remixCard = sourceBlacksmithCard(sourcePage);
    const remixStaleCard = sourceBlacksmithCard(sourceStalePage);
    await Promise.all(
      [beyondCard, beyondStaleCard, remixCard, remixStaleCard].map((card) =>
        expect(card).toBeVisible(),
      ),
    );
    const [beyondInitial, remixInitial] = await Promise.all([
      readBeyondState(page),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beyondInitial.upgrades.money["blacksmith"]).toBe(0);
    expect(remixInitial).toBe(encodedInitialSave);

    await Promise.all([beyondCard.click(), remixCard.click()]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondNewerState, remixNewerSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    expect(beyondNewerState.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondNewerState.resources.money).toBe("970");
    expect(readSaveState(remixNewerSave).upgrades["blacksmith"]?.level).toBe(1);
    expect(readSaveState(remixNewerSave).money).toBe("970");
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      beyondInitial,
    );

    await Promise.all(
      [beyondStalePage, sourceStalePage].map((target) =>
        target.evaluate((elapsed) => {
          const testWindow = window as Window & {
            __crossTabAutosaveNow?: number;
          };
          if (testWindow.__crossTabAutosaveNow === undefined) {
            throw new Error("The stale-tab autosave clock is unavailable.");
          }
          testWindow.__crossTabAutosaveNow += elapsed;
        }, 60_001),
      ),
    );
    await Promise.all([
      expect(beyondStalePage.locator(".messagelog")).toContainText(
        "Game Saved!",
      ),
      expect(sourceStalePage.locator(".messagelog")).toContainText(
        "Game Saved!",
      ),
    ]);

    const [beyondStaleState, remixStaleSave] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    expect(beyondStaleState.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondStaleState.resources.money).toBe("1000");
    expect(readSaveState(remixStaleSave).upgrades["blacksmith"]?.level).toBe(0);
    expect(readSaveState(remixStaleSave).money).toBe("1000");
    expect(await readBeyondState(page)).toEqual(beyondStaleState);
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      beyondNewerState,
    );

    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
      expect(beyondStaleCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixStaleCard.locator(".lvl")).toHaveText("0"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale offline Settings import at exactly 300 seconds preserves the shared save like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const initialSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  initialSave.money = "1000";
  initialSave.highestMoney = "1000";
  initialSave.settings.theme = "light";
  initialSave.settings.tab = "main";
  initialSave.settings.upgradeTab = "money";
  initialSave.upgrades["blacksmith"] = { level: 0 };
  initialSave.lastActive = fixedTime;

  const importedSave = structuredClone(initialSave);
  importedSave.lastActive = fixedTime - 300_000;
  importedSave.settings.tab = "settings";
  const encodedInitialSave = encodeRemixLegacySave(initialSave);
  const encodedImport = encodeRemixLegacySave(importedSave);

  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourceFreshPage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourceFreshPage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourceFreshPage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      sourceFreshPage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
      sourceStalePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);

    const beyondFreshCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const beyondStaleCard = beyondStalePage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const sourceFreshCard = sourceBlacksmithCard(sourceFreshPage);
    const sourceStaleCard = sourceBlacksmithCard(sourceStalePage);
    await Promise.all(
      [beyondFreshCard, beyondStaleCard, sourceFreshCard, sourceStaleCard].map(
        (card) => expect(card).toBeVisible(),
      ),
    );
    await Promise.all([beyondFreshCard.click(), sourceFreshCard.click()]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourceFreshPage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourceFreshPage.getByRole("button", { name: "Save" }).click(),
    ]);
    const [newerBeyondState, newerSourceSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourceFreshPage),
    ]);
    const newerBeyondBackup = await readBeyondState(
      page,
      "IdleMineBeyondBackup",
    );
    expect(newerBeyondState.upgrades.money["blacksmith"]).toBe(1);
    expect(readSaveState(newerSourceSave).money).toBe("970");

    const beyondStaleField = beyondStalePage.locator(
      "[data-settings-save-field]",
    );
    const sourceStaleField = sourceStalePage.locator(
      "article.settings textarea",
    );
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStaleField.fill(encodedImport),
      sourceStaleField.fill(encodedImport),
    ]);
    await Promise.all([
      beyondStalePage
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      sourceStalePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-settings-export]").click(),
      sourceStalePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
    ]);
    expect(await beyondStaleField.inputValue()).toBe(
      await sourceStaleField.inputValue(),
    );

    expect(await readLegacySlot(sourceStalePage)).toBe(newerSourceSave);
    expect(await readBeyondState(page)).toEqual(newerBeyondState);
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      newerBeyondBackup,
    );

    await Promise.all([beyondStalePage.reload(), sourceStalePage.reload()]);
    await Promise.all([
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      sourceStalePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='mining']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Mining" })
        .click(),
    ]);
    await Promise.all([
      expect(beyondStaleCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(sourceStaleCard.locator(".lvl")).toHaveText("1"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("two stale tabs save the same upgrade purchase without merging like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondContext = page.context();
  const beyondSecondPage = await beyondContext.newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceSecondPage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondSecondPage, sourcePage, sourceSecondPage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondSecondPage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceSecondPage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondSecondPage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      ...[sourcePage, sourceSecondPage].map((target) =>
        target.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        ),
      ),
    ]);

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const beyondSecondCard = beyondSecondPage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const remixCard = sourceBlacksmithCard(sourcePage);
    const remixSecondCard = sourceBlacksmithCard(sourceSecondPage);
    await Promise.all(
      [beyondCard, beyondSecondCard, remixCard, remixSecondCard].map((card) =>
        expect(card).toBeVisible(),
      ),
    );
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(beyondSecondCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixCard.locator(".lvl")).toHaveText("0"),
      expect(remixSecondCard.locator(".lvl")).toHaveText("0"),
    ]);

    // Both tabs buy from their own level-zero snapshot before either saves.
    await Promise.all([
      beyondCard.click(),
      beyondSecondCard.click(),
      remixCard.click(),
      remixSecondCard.click(),
    ]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(beyondSecondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
      expect(remixSecondCard.locator(".lvl")).toHaveText("1"),
    ]);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondFirstWrite, remixFirstWrite] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const remixFirstState = readSaveState(remixFirstWrite);
    expect(beyondFirstWrite.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondFirstWrite.resources.money).toBe("970");
    expect(beyondFirstWrite.upgrades.money["blacksmith"]).toBe(
      remixFirstState.upgrades["blacksmith"]?.level,
    );
    expect(beyondFirstWrite.resources.money).toBe(remixFirstState.money);

    await Promise.all([
      beyondSecondPage.locator("[data-game-tab='settings']").click(),
      sourceSecondPage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondSecondPage.getByRole("button", { name: "Save" }).click(),
      sourceSecondPage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondFinalState, remixFinalSave] = await Promise.all([
      readBeyondState(beyondSecondPage),
      readLegacySlot(sourceSecondPage),
    ]);
    const remixFinalState = readSaveState(remixFinalSave);
    expect(beyondFinalState.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondFinalState.resources.money).toBe("970");
    expect(beyondFinalState.upgrades.money["blacksmith"]).toBe(
      remixFinalState.upgrades["blacksmith"]?.level,
    );
    expect(beyondFinalState.resources.money).toBe(remixFinalState.money);
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      beyondFirstWrite,
    );
    expect(await page.evaluate(() => localStorage.getItem("IdleMine"))).toBe(
      encodedInitialSave,
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale Settings save overwrites a newer Money purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.settings.numberFormatterIndex = 0;
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      ...[sourcePage, sourceStalePage].map((target) =>
        target.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        ),
      ),
    ]);

    const [beyondInitial, remixInitial] = await Promise.all([
      readBeyondSave(page),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beyondInitial.simulation.upgrades.money["blacksmith"]).toBe(0);
    expect(remixInitial).toBe(encodedInitialSave);

    const [beyondCard, remixCard] = [
      page.locator(
        '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
      ),
      sourceBlacksmithCard(sourcePage),
    ];
    await Promise.all([beyondCard.click(), remixCard.click()]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondNewer, remixNewerEncoded] = await Promise.all([
      readBeyondSave(page),
      readLegacySlot(sourcePage),
    ]);
    const remixNewer = readSaveState(remixNewerEncoded);
    expect(beyondNewer.simulation.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondNewer.simulation.resources.money).toBe("970");
    expect(beyondNewer.simulation.upgrades.money["blacksmith"]).toBe(
      remixNewer.upgrades["blacksmith"]?.level,
    );
    expect(beyondNewer.simulation.resources.money).toBe(remixNewer.money);
    expect(await readBeyondSave(page, "IdleMineBeyondBackup")).toEqual(
      beyondInitial,
    );

    // Selecting a formatter updates each stale tab's local snapshot without
    // writing it. The later manual Save persists that entire stale snapshot.
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.locator("article.settings select").selectOption("3"),
      sourceStalePage
        .locator("article.settings select")
        .selectOption({ index: 3 }),
    ]);
    await Promise.all([
      expect(beyondStalePage.locator("article.settings select")).toHaveValue(
        "3",
      ),
      expect(
        sourceStalePage.locator("article.settings select"),
      ).toHaveJSProperty("selectedIndex", 3),
    ]);
    expect(
      await sourceStalePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(remixNewerEncoded);
    expect(await readBeyondSave(beyondStalePage)).toEqual(beyondNewer);

    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Save" }).click(),
      sourceStalePage.getByRole("button", { name: "Save" }).click(),
    ]);
    const [beyondStale, remixStaleEncoded] = await Promise.all([
      readBeyondSave(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixStale = readSaveState(remixStaleEncoded);
    expect(beyondStale.simulation.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondStale.simulation.resources.money).toBe("1000");
    expect(beyondStale.settings.numberFormatterIndex).toBe(3);
    expect(remixStale.upgrades["blacksmith"]?.level).toBe(0);
    expect(remixStale.money).toBe("1000");
    expect(remixStale.settings.numberFormatterIndex).toBe(3);
    expect(beyondStale.simulation.upgrades.money["blacksmith"]).toBe(
      remixStale.upgrades["blacksmith"]?.level,
    );
    expect(beyondStale.simulation.resources.money).toBe(remixStale.money);
    expect(await readBeyondSave(page)).toEqual(beyondStale);
    expect(await readBeyondSave(page, "IdleMineBeyondBackup")).toEqual(
      beyondNewer,
    );

    // The fresh tab keeps its local purchase after the peer writes its stale
    // whole-game snapshot to shared storage.
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
    await expect(remixCard.locator(".lvl")).toHaveText("1");
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale Settings theme change overwrites a newer Money purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.settings.numberFormatterIndex = 0;
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      ...[sourcePage, sourceStalePage].map((target) =>
        target.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        ),
      ),
    ]);

    const [beyondInitial, remixInitial] = await Promise.all([
      readBeyondSave(page),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beyondInitial.simulation.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondInitial.simulation.resources.money).toBe("1000");
    expect(remixInitial).toBe(encodedInitialSave);

    const [beyondCard, remixCard] = [
      page.locator(
        '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
      ),
      sourceBlacksmithCard(sourcePage),
    ];
    await Promise.all([beyondCard.click(), remixCard.click()]);
    await Promise.all([
      expect(beyondCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondNewer, remixNewerEncoded] = await Promise.all([
      readBeyondSave(page),
      readLegacySlot(sourcePage),
    ]);
    const remixNewer = readSaveState(remixNewerEncoded);
    expect(beyondNewer.simulation.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondNewer.simulation.resources.money).toBe("970");
    expect(remixNewer.upgrades["blacksmith"]?.level).toBe(1);
    expect(remixNewer.money).toBe("970");
    expect(await readBeyondSave(page, "IdleMineBeyondBackup")).toEqual(
      beyondInitial,
    );

    // Remix's Light/Dark handlers call saveGame immediately. Beyond's theme
    // handler also persists the complete current application state.
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Dark" }).click(),
      sourceStalePage.getByRole("button", { name: "Dark" }).click(),
    ]);

    const [beyondStale, remixStaleEncoded] = await Promise.all([
      readBeyondSave(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixStale = readSaveState(remixStaleEncoded);
    expect(beyondStale.settings.theme).toBe("dark");
    expect(beyondStale.simulation.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondStale.simulation.resources.money).toBe("1000");
    expect(remixStale.settings.theme).toBe("dark");
    expect(remixStale.upgrades["blacksmith"]?.level).toBe(0);
    expect(remixStale.money).toBe("1000");
    expect(beyondStale.simulation.upgrades.money["blacksmith"]).toBe(
      remixStale.upgrades["blacksmith"]?.level,
    );
    expect(beyondStale.simulation.resources.money).toBe(remixStale.money);
    expect(await readBeyondSave(page)).toEqual(beyondStale);
    expect(await readBeyondSave(page, "IdleMineBeyondBackup")).toEqual(
      beyondNewer,
    );

    // The updated tab retains its local purchase and light theme after the
    // stale peer's automatic whole-game save.
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
    await expect(remixCard.locator(".lvl")).toHaveText("1");
    await expect(sourcePage.locator("#css_theme")).toHaveAttribute(
      "href",
      /Themes\/light\.css$/,
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale Gem purchase overwrites a newer Money purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  const gemPurchase = fixture.data.upgradeSemantics.purchaseSemantics.find(
    ({ name }) => name === "buy-uses-gem-resource",
  );
  const startingGemBalance = gemPurchase?.startingResources["gems"]?.decimal;
  if (
    !gemPurchase ||
    gemPurchase.group !== "gems" ||
    gemPurchase.key !== "offlineGems" ||
    gemPurchase.startingLevel !== 0 ||
    startingGemBalance === undefined ||
    gemPurchase.currentPrice.decimal !== startingGemBalance
  ) {
    throw new Error(
      "Pinned Gem purchase fixture is not an exact-price level-zero case.",
    );
  }
  save.money = "1000";
  save.highestMoney = "1000";
  save.gems = startingGemBalance;
  save.highestMineObjectLevel = 61;
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.gemUpgrades["offlineGems"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondContext = page.context();
  const beyondStalePage = await beyondContext.newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      ...[sourcePage, sourceStalePage].map((target) =>
        target.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        ),
      ),
    ]);

    const beyondMoneyCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const remixMoneyCard = sourceBlacksmithCard(sourcePage);
    const staleBeyondGemTab = beyondStalePage.locator(
      '[data-upgrade-tab="gems"]',
    );
    const staleRemixGemTab = sourceStalePage
      .locator(".upg-tabs button")
      .filter({ hasText: "Gem Upgrades" });
    await Promise.all([
      expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixMoneyCard.locator(".lvl")).toHaveText("0"),
      expect(staleBeyondGemTab).toBeVisible(),
      expect(staleRemixGemTab).toBeVisible(),
    ]);

    await Promise.all([beyondMoneyCard.click(), remixMoneyCard.click()]);
    await Promise.all([
      expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixMoneyCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondMoneyState, remixMoneySave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const remixMoneyState = readSaveState(remixMoneySave);
    expect(beyondMoneyState.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondMoneyState.upgrades.gems["offlineGems"]).toBe(0);
    expect(beyondMoneyState.resources.money).toBe("970");
    expect(beyondMoneyState.resources.gems).toBe("4444");
    expect(remixMoneyState.upgrades["blacksmith"]?.level).toBe(1);
    expect(remixMoneyState.gemUpgrades["offlineGems"]?.level).toBe(0);
    expect(remixMoneyState.money).toBe("970");
    expect(remixMoneyState.gems).toBe("4444");

    await Promise.all([staleBeyondGemTab.click(), staleRemixGemTab.click()]);
    const beyondGemCard = beyondStalePage.locator(
      '[data-upgrade-group="gems"][data-upgrade-key="offlineGems"]',
    );
    const remixGemCard = sourceOfflineGemsCard(sourceStalePage);
    await Promise.all([
      expect(beyondGemCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixGemCard.locator(".lvl")).toHaveText("0/15"),
    ]);
    await Promise.all([beyondGemCard.click(), remixGemCard.click()]);
    await Promise.all([
      expect(beyondGemCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixGemCard.locator(".lvl")).toHaveText("1/15"),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Save" }).click(),
      sourceStalePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondGemState, remixGemSave] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixGemState = readSaveState(remixGemSave);
    expect(beyondGemState.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondGemState.upgrades.gems["offlineGems"]).toBe(1);
    expect(beyondGemState.resources.money).toBe("1000");
    expect(beyondGemState.resources.gems).toBe("0");
    expect(remixGemState.upgrades["blacksmith"]?.level).toBe(0);
    expect(remixGemState.gemUpgrades["offlineGems"]?.level).toBe(1);
    expect(remixGemState.money).toBe("1000");
    expect(remixGemState.gems).toBe("0");
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      beyondMoneyState,
    );
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixMoneyCard.locator(".lvl")).toHaveText("1"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("a stale Money purchase overwrites a newer Gem purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  const gemPurchase = fixture.data.upgradeSemantics.purchaseSemantics.find(
    ({ name }) => name === "buy-uses-gem-resource",
  );
  const startingGemBalance = gemPurchase?.startingResources["gems"]?.decimal;
  if (
    !gemPurchase ||
    gemPurchase.group !== "gems" ||
    gemPurchase.key !== "offlineGems" ||
    gemPurchase.startingLevel !== 0 ||
    startingGemBalance === undefined ||
    gemPurchase.currentPrice.decimal !== startingGemBalance
  ) {
    throw new Error(
      "Pinned Gem purchase fixture is not an exact-price level-zero case.",
    );
  }
  save.money = "1000";
  save.highestMoney = "1000";
  save.gems = startingGemBalance;
  save.highestMineObjectLevel = 61;
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "gems";
  save.upgrades["blacksmith"] = { level: 0 };
  save.gemUpgrades["offlineGems"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);

  const beyondContext = page.context();
  const beyondStalePage = await beyondContext.newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      ...[sourcePage, sourceStalePage].map((target) =>
        target.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        ),
      ),
    ]);

    const updatedBeyondGemTab = page.locator('[data-upgrade-tab="gems"]');
    const updatedRemixGemTab = sourcePage
      .locator(".upg-tabs button")
      .filter({ hasText: "Gem Upgrades" });
    await Promise.all([
      expect(updatedBeyondGemTab).toBeVisible(),
      expect(updatedRemixGemTab).toBeVisible(),
    ]);
    await Promise.all([
      updatedBeyondGemTab.click(),
      updatedRemixGemTab.click(),
    ]);
    const beyondGemCard = page.locator(
      '[data-upgrade-group="gems"][data-upgrade-key="offlineGems"]',
    );
    const remixGemCard = sourceOfflineGemsCard(sourcePage);
    await Promise.all([
      expect(beyondGemCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixGemCard.locator(".lvl")).toHaveText("0/15"),
    ]);
    await Promise.all([beyondGemCard.click(), remixGemCard.click()]);
    await Promise.all([
      expect(beyondGemCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixGemCard.locator(".lvl")).toHaveText("1/15"),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondGemState, remixGemSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const remixGemState = readSaveState(remixGemSave);
    expect(beyondGemState.upgrades.money["blacksmith"]).toBe(0);
    expect(beyondGemState.upgrades.gems["offlineGems"]).toBe(1);
    expect(beyondGemState.resources.money).toBe("1000");
    expect(beyondGemState.resources.gems).toBe("0");
    expect(remixGemState.upgrades["blacksmith"]?.level).toBe(0);
    expect(remixGemState.gemUpgrades["offlineGems"]?.level).toBe(1);
    expect(remixGemState.money).toBe("1000");
    expect(remixGemState.gems).toBe("0");

    await Promise.all([
      beyondStalePage.locator('[data-upgrade-tab="money"]').click(),
      sourceStalePage
        .locator(".upg-tabs button")
        .filter({ hasText: "Money Upgrades" })
        .click(),
    ]);
    const beyondMoneyCard = beyondStalePage.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const remixMoneyCard = sourceBlacksmithCard(sourceStalePage);
    await Promise.all([
      expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "0"),
      expect(remixMoneyCard.locator(".lvl")).toHaveText("0"),
    ]);
    await Promise.all([beyondMoneyCard.click(), remixMoneyCard.click()]);
    await Promise.all([
      expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixMoneyCard.locator(".lvl")).toHaveText("1"),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-game-tab='settings']").click(),
      sourceStalePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondStalePage.getByRole("button", { name: "Save" }).click(),
      sourceStalePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [beyondMoneyState, remixMoneySave] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
    ]);
    const remixMoneyState = readSaveState(remixMoneySave);
    expect(beyondMoneyState.upgrades.money["blacksmith"]).toBe(1);
    expect(beyondMoneyState.upgrades.gems["offlineGems"]).toBe(0);
    expect(beyondMoneyState.resources.money).toBe("970");
    expect(beyondMoneyState.resources.gems).toBe(startingGemBalance);
    expect(remixMoneyState.upgrades["blacksmith"]?.level).toBe(1);
    expect(remixMoneyState.gemUpgrades["offlineGems"]?.level).toBe(0);
    expect(remixMoneyState.money).toBe("970");
    expect(remixMoneyState.gems).toBe(startingGemBalance);
    expect(await readBeyondState(page, "IdleMineBeyondBackup")).toEqual(
      beyondGemState,
    );
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(beyondGemCard).toHaveAttribute("data-upgrade-level", "1"),
      expect(remixGemCard.locator(".lvl")).toHaveText("1/15"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

for (const {
  label,
  purchaseName,
  group,
  key,
  highWater,
  modifier,
  titleSuffix,
  upgradeName,
} of [
  {
    label: "Wisdom",
    purchaseName: "buy-uses-wisdom-resource",
    group: "wisdom",
    key: "gemBoostSimple",
    highWater: 170,
    modifier: undefined,
    titleSuffix: undefined,
    upgradeName: "Simple Gem Boost",
  },
  {
    label: "Planet Coin",
    purchaseName: "buy-uses-planet-coin-resource",
    group: "planetCoins",
    key: "activePower",
    highWater: 90,
    modifier: undefined,
    titleSuffix: undefined,
    upgradeName: undefined,
  },
  {
    label: "Wisdom",
    purchaseName:
      "buy10-wisdom-simple-gem-boost-stops-before-alignment-on-affordability",
    group: "wisdom",
    key: "gemBoostSimple",
    highWater: 170,
    modifier: "Shift",
    titleSuffix: " using Shift bulk buy",
    upgradeName: "Simple Gem Boost",
  },
  {
    label: "Wisdom",
    purchaseName:
      "buy10-wisdom-power-power-active-buys-two-stops-on-affordability",
    group: "wisdom",
    key: "powerPowerActive",
    highWater: 170,
    modifier: "Shift",
    titleSuffix: " using Shift buy10 for two levels",
    upgradeName: "Power Power (Active)",
  },
] as const) {
  test(`a stale ${label} purchase${titleSuffix ?? ""} overwrites a newer Money purchase like pinned Remix`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as SaveFixture;
    const save = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    const purchase = fixture.data.upgradeSemantics.purchaseSemantics.find(
      ({ name }) => name === purchaseName,
    );
    const resourceKey = group === "wisdom" ? "wisdom" : "planetCoins";
    const startingBalance = purchase?.startingResources[resourceKey]?.decimal;
    if (
      !purchase ||
      purchase.group !== group ||
      purchase.key !== key ||
      purchase.startingLevel !== 0 ||
      startingBalance === undefined ||
      (modifier === undefined &&
        purchase.currentPrice.decimal !== startingBalance) ||
      (modifier !== undefined && purchase.operation?.method !== "buy10")
    ) {
      throw new Error(
        `Pinned ${label} purchase fixture is not an exact-price level-zero case.`,
      );
    }
    save.money = "1000";
    save.highestMoney = "1000";
    save.highestMineObjectLevel = highWater;
    save.mineObjectLevel = highWater;
    save.settings.theme = "light";
    save.settings.tab = "main";
    save.settings.upgradeTab = "money";
    save.upgrades["blacksmith"] = { level: 0 };
    if (group === "wisdom") {
      save.wisdom = startingBalance;
      save.maxWisdom = startingBalance;
      save.powers.upgrades[key] = { level: 0 };
    } else {
      save.planetCoins = startingBalance;
      save.maxPlanetCoins = startingBalance;
      save.planetCoinUpgrades[key] = { level: 0 };
    }
    save.lastActive = fixedTime;
    const encodedInitialSave = encodeRemixLegacySave(save);

    const beyondStalePage = await page.context().newPage();
    const sourceContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const sourceStalePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all(
        [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
          target.addInitScript(initializeSharedStorage, {
            encoded: encodedInitialSave,
            now: fixedTime,
          }),
        ),
      );
      await Promise.all([
        page.goto("/"),
        beyondStalePage.goto("/"),
        sourcePage.goto(sourceUrl),
        sourceStalePage.goto(sourceUrl),
      ]);
      await Promise.all([
        expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
        expect(beyondStalePage.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        ),
        ...[sourcePage, sourceStalePage].map((target) =>
          target.waitForFunction(() =>
            Boolean((window as Window & { game?: unknown }).game),
          ),
        ),
      ]);

      const beyondMoneyCard = page.locator(
        '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
      );
      const sourceMoneyCard = sourceBlacksmithCard(sourcePage);
      await Promise.all([
        expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "0"),
        expect(sourceMoneyCard.locator(".lvl")).toHaveText("0"),
      ]);
      await Promise.all([beyondMoneyCard.click(), sourceMoneyCard.click()]);
      await Promise.all([
        page.locator("[data-game-tab='settings']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);
      await Promise.all([
        page.getByRole("button", { name: "Save" }).click(),
        sourcePage.getByRole("button", { name: "Save" }).click(),
      ]);

      const [newerBeyondState, newerSourceSave] = await Promise.all([
        readBeyondState(page),
        readLegacySlot(sourcePage),
      ]);
      const newerSourceState = readSaveState(newerSourceSave);
      expect(newerBeyondState.upgrades.money["blacksmith"]).toBe(1);
      expect(newerBeyondState.resources.money).toBe("970");
      expect(newerSourceState.upgrades["blacksmith"]?.level).toBe(1);
      expect(newerSourceState.money).toBe("970");
      expect(newerSourceState[resourceKey]).toBe(startingBalance);

      const beyondStaleCard =
        group === "wisdom"
          ? beyondStalePage.locator(`[data-wisdom-upgrade="${key}"]`)
          : beyondStalePage.locator(
              `[data-upgrade-group="planetCoins"][data-upgrade-key="${key}"]`,
            );
      const sourceStaleCard =
        group === "wisdom"
          ? sourceStalePage
              .locator(
                "article.powers .powers-upgrades button.upgrade-standalone",
              )
              .filter({ hasText: upgradeName })
          : sourceActivePowerCard(sourceStalePage);
      if (group === "wisdom") {
        await Promise.all([
          beyondStalePage.locator("[data-game-tab='powers']").click(),
          sourceStalePage
            .locator("footer button")
            .filter({ hasText: "Powers" })
            .click(),
        ]);
      } else {
        await Promise.all([
          beyondStalePage.locator('[data-upgrade-tab="planetCoins"]').click(),
          sourceStalePage
            .locator(".upg-tabs button")
            .filter({ hasText: "PC Upgrades" })
            .click(),
        ]);
      }
      await Promise.all([
        expect(beyondStaleCard).toHaveAttribute("data-upgrade-level", "0"),
        group === "wisdom" && key === "gemBoostSimple"
          ? expect(sourceStaleCard).toContainText("0 / 10")
          : group === "planetCoins"
            ? expect(sourceStaleCard.locator(".lvl")).toContainText("0")
            : expect
                .poll(() =>
                  sourceStalePage.evaluate(
                    (upgradeKey) =>
                      (
                        window as Window & {
                          game?: {
                            powers?: {
                              upgrades?: Record<string, { level?: number }>;
                            };
                          };
                        }
                      ).game?.powers?.upgrades?.[upgradeKey]?.level,
                    key,
                  ),
                )
                .toBe(0),
      ]);
      const clickOptions = modifier
        ? { modifiers: [modifier] as ("Shift" | "Control")[] }
        : {};
      await Promise.all([
        beyondStaleCard.click(clickOptions),
        sourceStaleCard.click(clickOptions),
      ]);
      const expectedEndingLevel = purchase.endingLevel ?? 1;
      await Promise.all([
        expect(beyondStaleCard).toHaveAttribute(
          "data-upgrade-level",
          String(expectedEndingLevel),
        ),
        group === "wisdom" && key === "gemBoostSimple"
          ? expect(sourceStaleCard).toContainText(`${expectedEndingLevel} / 10`)
          : group === "planetCoins"
            ? expect(sourceStaleCard.locator(".lvl")).toContainText("1")
            : expect
                .poll(() =>
                  sourceStalePage.evaluate(
                    (upgradeKey) =>
                      (
                        window as Window & {
                          game?: {
                            powers?: {
                              upgrades?: Record<string, { level?: number }>;
                            };
                          };
                        }
                      ).game?.powers?.upgrades?.[upgradeKey]?.level,
                    key,
                  ),
                )
                .toBe(expectedEndingLevel),
      ]);
      await Promise.all([
        beyondStalePage.locator("[data-game-tab='settings']").click(),
        sourceStalePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);
      await Promise.all([
        beyondStalePage.getByRole("button", { name: "Save" }).click(),
        sourceStalePage.getByRole("button", { name: "Save" }).click(),
      ]);

      const [staleBeyondState, staleSourceSave, staleBackup] =
        await Promise.all([
          readBeyondState(beyondStalePage),
          readLegacySlot(sourceStalePage),
          readBeyondState(page, "IdleMineBeyondBackup"),
        ]);
      const staleSourceState = readSaveState(staleSourceSave);
      expect(staleBeyondState.resources).toMatchObject({ money: "1000" });
      const expectedEndingResource =
        purchase.endingResources?.[resourceKey]?.decimal ?? "0";
      expect(staleBeyondState.resources[resourceKey]).toBe(
        expectedEndingResource,
      );
      expect(staleBeyondState.upgrades.money["blacksmith"]).toBe(0);
      if (group === "wisdom") {
        expect(staleBeyondState.upgrades.wisdom?.[key]).toBe(
          expectedEndingLevel,
        );
        expect(staleSourceState).toMatchObject({
          money: "1000",
          wisdom: expectedEndingResource,
          upgrades: { blacksmith: { level: 0 } },
          powers: { upgrades: { [key]: { level: expectedEndingLevel } } },
        });
      } else {
        expect(staleBeyondState.upgrades.planetCoins?.[key]).toBe(1);
        expect(staleSourceState).toMatchObject({
          money: "1000",
          planetCoins: "0",
          upgrades: { blacksmith: { level: 0 } },
          planetCoinUpgrades: { [key]: { level: 1 } },
        });
      }
      expect(staleBackup).toEqual(newerBeyondState);

      await Promise.all([
        beyondStalePage.locator("[data-game-tab='settings']").click(),
        sourceStalePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);
      await Promise.all([
        beyondStalePage
          .locator("article.settings")
          .getByRole("button", { name: "Export" })
          .click(),
        sourceStalePage
          .locator("article.settings")
          .getByRole("button", { name: "Export" })
          .click(),
      ]);
      const [beyondExport, sourceExport] = await Promise.all([
        beyondStalePage.locator("article.settings textarea").inputValue(),
        sourceStalePage.locator("article.settings textarea").inputValue(),
      ]);
      expect(beyondExport).toBe(sourceExport);

      await Promise.all([
        page.locator("footer button").filter({ hasText: "Mining" }).click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Mining" })
          .click(),
      ]);
      await Promise.all([
        expect(beyondMoneyCard).toHaveAttribute("data-upgrade-level", "1"),
        expect(sourceMoneyCard.locator(".lvl")).toHaveText("1"),
      ]);
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}

test("a stale successful craft overwrites a newer purchase like pinned Remix", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SaveFixture;
  const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "better-craft-replaces-and-saves",
  );
  if (!attempt) throw new Error("The successful craft capture is missing.");
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.money = "1000";
  save.highestMoney = "1000";
  save.gems = attempt.input.gems;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.usedGemsLevel = attempt.input.usedGemsLevel;
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };
  save.upgrades = { blacksmith: { level: 0 } };
  save.gemUpgrades = {};
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedInitialSave = encodeRemixLegacySave(save);
  const beyondStalePage = await page.context().newPage();
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceStalePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all(
      [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
        target.addInitScript(initializeSharedStorage, {
          encoded: encodedInitialSave,
          now: fixedTime,
        }),
      ),
    );
    await Promise.all([
      page.goto("/"),
      beyondStalePage.goto("/"),
      sourcePage.goto(sourceUrl),
      sourceStalePage.goto(sourceUrl),
    ]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      expect(beyondStalePage.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      ),
      sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
      sourceStalePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);

    const beyondBlacksmith = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const sourceBlacksmith = sourceBlacksmithCard(sourcePage);
    await Promise.all([
      expect(beyondBlacksmith).toHaveAttribute("data-upgrade-level", "0"),
      expect(sourceBlacksmith.locator(".lvl")).toHaveText("0"),
    ]);
    await Promise.all([beyondBlacksmith.click(), sourceBlacksmith.click()]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Save" }).click(),
      sourcePage.getByRole("button", { name: "Save" }).click(),
    ]);

    const [newerBeyondState, newerSourceSave] = await Promise.all([
      readBeyondState(page),
      readLegacySlot(sourcePage),
    ]);
    const newerSourceState = readSaveState(newerSourceSave);
    expect(newerBeyondState.upgrades.money["blacksmith"]).toBe(1);
    expect(newerBeyondState.resources.money).toBe("970");
    expect(newerSourceState.upgrades["blacksmith"]?.level).toBe(1);
    expect(newerSourceState.money).toBe("970");

    await Promise.all([
      installCraftRandomSequence(beyondStalePage, attempt.input.randomValues),
      installCraftRandomSequence(
        sourceStalePage,
        attempt.input.randomValues,
        ".craft-pickaxe button:not(.level-change)",
      ),
    ]);
    await Promise.all([
      beyondStalePage.locator("[data-craft-pickaxe]").click(),
      sourceStalePage
        .locator(".craft-pickaxe button:not(.level-change)")
        .click(),
    ]);
    await Promise.all([
      expect(beyondStalePage.locator(".messagelog")).toContainText(
        "Got a new Pickaxe!",
      ),
      expect(sourceStalePage.locator(".messagelog")).toContainText(
        "Got a new Pickaxe!",
      ),
    ]);
    const [
      staleBeyond,
      staleSourceSave,
      beyondPickaxe,
      sourceRandomCalls,
      beyondRandomCalls,
    ] = await Promise.all([
      readBeyondState(beyondStalePage),
      readLegacySlot(sourceStalePage),
      readBeyondStoredPickaxe(beyondStalePage),
      sourceStalePage.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
      beyondStalePage.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
    ]);
    const staleSource = readSaveState(staleSourceSave);
    expect(beyondRandomCalls).toBe(attempt.randomCalls);
    expect(sourceRandomCalls).toBe(attempt.randomCalls);
    expect(staleBeyond.upgrades.money["blacksmith"]).toBe(0);
    expect(staleBeyond.resources.money).toBe("1000");
    expect(staleBeyond.resources.gems).toBe(attempt.result.gems.decimal);
    expect(staleSource.upgrades["blacksmith"]?.level).toBe(0);
    expect(staleSource.money).toBe("1000");
    expect(staleSource.gems).toBe(attempt.result.gems.decimal);
    expect(staleSource.pickaxe.name).not.toBe(
      attempt.input.equippedPickaxe.name,
    );
    expect(staleSource.pickaxe).toEqual({
      name: attempt.result.pickaxe.name,
      pow: attempt.result.pickaxe.power.decimal,
      quality: attempt.result.pickaxe.quality.decimal,
    });
    expect(
      Number(staleSource.pickaxe.pow) * Number(staleSource.pickaxe.quality),
    ).toBeGreaterThan(20);
    expect(beyondPickaxe).toEqual({
      name: staleSource.pickaxe.name,
      power: staleSource.pickaxe.pow,
      quality: staleSource.pickaxe.quality,
    });
    expect(await readBeyondState(page)).toMatchObject(staleBeyond);
    expect(await readLegacySlot(sourcePage)).toBe(staleSourceSave);
    expect(
      await readBeyondState(beyondStalePage, "IdleMineBeyondBackup"),
    ).toEqual(newerBeyondState);
    await Promise.all([
      page.locator("footer button").filter({ hasText: "Mining" }).click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(
        page.locator(
          '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
        ),
      ).toHaveAttribute("data-upgrade-level", "1"),
      expect(sourceBlacksmithCard(sourcePage).locator(".lvl")).toHaveText("1"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

for (const { attemptName, label, expectedRandomCalls, expectedSaveCalls } of [
  {
    attemptName: "equal-damage-is-a-dud",
    label: "dud",
    expectedRandomCalls: 10,
    expectedSaveCalls: 0,
  },
  {
    attemptName: "insufficient-gems-consumes-no-rng",
    label: "insufficient-Gem",
    expectedRandomCalls: 0,
    expectedSaveCalls: 0,
  },
  {
    attemptName: "bulk-replacements-save-each-intermediate-state",
    label: "bulk",
    expectedRandomCalls: 20,
    expectedSaveCalls: 2,
  },
  {
    attemptName: "bulk-success-dud-then-insufficient",
    label: "bulk success, dud, and insufficient-Gem",
    expectedRandomCalls: 20,
    expectedSaveCalls: 1,
  },
]) {
  test(`a stale ${label} craft matches pinned Remix after a newer purchase`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as SaveFixture;
    const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
      ({ input }) => input.name === attemptName,
    );
    if (!attempt)
      throw new Error(`The ${attemptName} craft capture is missing.`);
    expect(attempt.saveCalls).toBe(expectedSaveCalls);
    expect(attempt.saveSnapshots).toHaveLength(expectedSaveCalls);
    expect(attempt.randomCalls).toBe(expectedRandomCalls);
    const expectedCraftCount =
      (attempt.input.upgradeLevels?.planetCoins?.["bulkCraft"] ?? 0) + 1;

    const save = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    save.money = "1000";
    save.highestMoney = "1000";
    save.gems = attempt.input.gems;
    save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
    save.mineObjectLevel = attempt.input.highestMineObjectLevel;
    save.usedGemsLevel = attempt.input.usedGemsLevel;
    save.pickaxe = {
      name: attempt.input.equippedPickaxe.name,
      pow: attempt.input.equippedPickaxe.power,
      quality: attempt.input.equippedPickaxe.quality,
    };
    save.upgrades = {
      blacksmith: { level: 0 },
      ...Object.fromEntries(
        Object.entries(attempt.input.upgradeLevels?.money ?? {}).map(
          ([key, level]) => [key, { level }],
        ),
      ),
    };
    save.gemUpgrades = {};
    save.planetCoinUpgrades = Object.fromEntries(
      Object.entries(attempt.input.upgradeLevels?.planetCoins ?? {}).map(
        ([key, level]) => [key, { level }],
      ),
    );
    save.powers.data.values = ["1", "1", "1", "1", "1"];
    save.powers.upgrades = {};
    save.settings.theme = "light";
    save.settings.tab = "main";
    save.settings.upgradeTab = "money";
    save.lastActive = fixedTime;
    const encodedInitialSave = encodeRemixLegacySave(save);
    const beyondStalePage = await page.context().newPage();
    const sourceContext = await browser.newContext({
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const sourceStalePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all(
        [page, beyondStalePage, sourcePage, sourceStalePage].map((target) =>
          target.addInitScript(initializeSharedStorage, {
            encoded: encodedInitialSave,
            now: fixedTime,
          }),
        ),
      );
      await Promise.all([
        page.goto("/"),
        beyondStalePage.goto("/"),
        sourcePage.goto(sourceUrl),
        sourceStalePage.goto(sourceUrl),
      ]);
      await Promise.all([
        expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
        expect(beyondStalePage.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        ),
        ...[sourcePage, sourceStalePage].map((target) =>
          target.waitForFunction(() =>
            Boolean((window as Window & { game?: unknown }).game),
          ),
        ),
      ]);

      const freshBeyondBlacksmith = page.locator(
        '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
      );
      const freshSourceBlacksmith = sourceBlacksmithCard(sourcePage);
      await Promise.all([
        expect(freshBeyondBlacksmith).toHaveAttribute(
          "data-upgrade-level",
          "0",
        ),
        expect(freshSourceBlacksmith.locator(".lvl")).toHaveText("0"),
      ]);
      await Promise.all([
        freshBeyondBlacksmith.click(),
        freshSourceBlacksmith.click(),
      ]);
      await Promise.all([
        page.locator("[data-game-tab='settings']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);
      await Promise.all([
        page.getByRole("button", { name: "Save" }).click(),
        sourcePage.getByRole("button", { name: "Save" }).click(),
      ]);

      const [newerBeyondState, newerSourceSave, newerBeyondSlots] =
        await Promise.all([
          readBeyondState(page),
          readLegacySlot(sourcePage),
          page.evaluate(() => ({
            primary: localStorage.getItem("IdleMineBeyond"),
            backup: localStorage.getItem("IdleMineBeyondBackup"),
          })),
        ]);
      const newerSourceState = readSaveState(newerSourceSave);
      expect(newerBeyondState.upgrades.money["blacksmith"]).toBe(1);
      expect(newerBeyondState.resources.money).toBe("970");
      expect(newerBeyondState.resources.gems).toBe(attempt.input.gems);
      expect(newerSourceState.upgrades["blacksmith"]?.level).toBe(1);
      expect(newerSourceState.money).toBe("970");
      expect(newerSourceState.gems).toBe(attempt.input.gems);
      expect((await readBeyondState(beyondStalePage)).resources.gems).toBe(
        attempt.input.gems,
      );

      if (attempt.input.usedGemsLevel > 0) {
        if (!attempt.input.craftGems) {
          throw new Error(`The ${attemptName} Gem cost capture is missing.`);
        }
        await Promise.all([
          beyondStalePage.locator('[data-craft-gem-level="increase"]').click(),
          sourceStalePage
            .locator(".craft-pickaxe button.level-change")
            .last()
            .click(),
        ]);
        await expect(
          beyondStalePage.locator("[data-craft-gem-cost]"),
        ).toHaveText(attempt.input.craftGems.decimal);
      }

      await Promise.all([
        installCraftRandomSequence(beyondStalePage, attempt.input.randomValues),
        installCraftRandomSequence(
          sourceStalePage,
          attempt.input.randomValues,
          ".craft-pickaxe button:not(.level-change)",
        ),
      ]);
      if (attempt.input.shiftHeld) {
        await Promise.all([
          beyondStalePage.keyboard.down("Shift"),
          sourceStalePage.keyboard.down("Shift"),
        ]);
        try {
          await Promise.all([
            expect(
              beyondStalePage.locator("[data-craft-pickaxe]"),
            ).toContainText(`x ${expectedCraftCount}`),
            beyondStalePage.locator("[data-craft-pickaxe]").click(),
            sourceStalePage
              .locator(".craft-pickaxe button:not(.level-change)")
              .click(),
          ]);
        } finally {
          await Promise.all([
            beyondStalePage.keyboard.up("Shift"),
            sourceStalePage.keyboard.up("Shift"),
          ]);
        }
      } else {
        await Promise.all([
          beyondStalePage.locator("[data-craft-pickaxe]").click(),
          sourceStalePage
            .locator(".craft-pickaxe button:not(.level-change)")
            .click(),
        ]);
      }
      const craftMessage = attempt.messageLog[0]?.message;
      if (!craftMessage)
        throw new Error(`The ${attemptName} message is missing.`);
      await Promise.all([
        expect(beyondStalePage.locator(".messagelog")).toContainText(
          craftMessage,
        ),
        expect(sourceStalePage.locator(".messagelog")).toContainText(
          craftMessage,
        ),
        expect(
          beyondStalePage.locator(".stats > div").first().locator("p").first(),
        ).toHaveText(attempt.result.pickaxe.name),
        expect(
          sourceStalePage.locator(".stats > div").first().locator("p").first(),
        ).toHaveText(attempt.result.pickaxe.name),
      ]);

      const [
        staleSourceGems,
        staleBeyondGems,
        liveSourceGemDecimal,
        freshSourceGems,
        freshBeyondGems,
        sourceRandomCalls,
        beyondRandomCalls,
      ] = await Promise.all([
        sourceStalePage.locator("header > span").nth(1).textContent(),
        beyondStalePage.locator("header > span").nth(1).textContent(),
        sourceStalePage.evaluate(() =>
          (
            window as Window & {
              game?: { gems: { toString(): string } };
            }
          ).game?.gems.toString(),
        ),
        sourcePage.locator("header > span").nth(1).textContent(),
        page.locator("header > span").nth(1).textContent(),
        sourceStalePage.evaluate(() =>
          (
            window as Window & { __idleMineCraftRandomCalls?: () => number }
          ).__idleMineCraftRandomCalls?.(),
        ),
        beyondStalePage.evaluate(() =>
          (
            window as Window & { __idleMineCraftRandomCalls?: () => number }
          ).__idleMineCraftRandomCalls?.(),
        ),
      ]);
      expect(staleBeyondGems).toBe(staleSourceGems);
      if (attemptName === "insufficient-gems-consumes-no-rng") {
        expect(staleSourceGems).toBe(freshSourceGems);
      } else if (expectedSaveCalls === 0) {
        expect(staleSourceGems?.trim()).toBe("0");
      }
      expect(liveSourceGemDecimal).toBe(attempt.result.gems.decimal);
      expect(freshBeyondGems).toBe(freshSourceGems);
      expect(sourceRandomCalls).toBe(attempt.randomCalls);
      expect(beyondRandomCalls).toBe(attempt.randomCalls);
      const [staleSourceSave, beyondAfter, beyondPrimaryState] =
        await Promise.all([
          readLegacySlot(sourceStalePage),
          page.evaluate(() => ({
            primary: localStorage.getItem("IdleMineBeyond"),
            backup: localStorage.getItem("IdleMineBeyondBackup"),
          })),
          readBeyondState(page),
        ]);
      expect(beyondAfter.primary).not.toBeNull();
      if (expectedSaveCalls === 0) {
        expect(staleSourceSave).toBe(newerSourceSave);
        expect(beyondAfter).toEqual(newerBeyondSlots);
        expect(beyondPrimaryState).toEqual(newerBeyondState);
      } else {
        const sourceAfterState = readSaveState(staleSourceSave);
        const firstSnapshot = attempt.saveSnapshots[0]!;
        const lastSnapshot = attempt.saveSnapshots.at(-1)!;
        expect(sourceAfterState).toMatchObject({
          money: "1000",
          gems: lastSnapshot.gems.decimal,
          upgrades: { blacksmith: { level: 0 } },
          pickaxe: {
            name: lastSnapshot.pickaxe.name,
            pow: lastSnapshot.pickaxe.power.decimal,
            quality: lastSnapshot.pickaxe.quality.decimal,
          },
        });
        expect(beyondPrimaryState.resources.gems).toBe(
          lastSnapshot.gems.decimal,
        );
        expect(beyondPrimaryState.upgrades.money["blacksmith"]).toBe(0);
        expect(await readBeyondStoredPickaxe(page)).toEqual({
          name: lastSnapshot.pickaxe.name,
          power: lastSnapshot.pickaxe.power.decimal,
          quality: lastSnapshot.pickaxe.quality.decimal,
        });
        const expectedBackup =
          expectedSaveCalls === 1
            ? newerBeyondState
            : {
                resources: { gems: firstSnapshot.gems.decimal },
              };
        if (expectedSaveCalls === 1) {
          expect(
            await readBeyondState(page, "IdleMineBeyondBackup"),
          ).toMatchObject(expectedBackup);
        } else {
          expect(
            (await readBeyondState(page, "IdleMineBeyondBackup")).resources
              .gems,
          ).toBe(firstSnapshot.gems.decimal);
          expect(
            await readBeyondStoredPickaxe(page, "IdleMineBeyondBackup"),
          ).toEqual({
            name: firstSnapshot.pickaxe.name,
            power: firstSnapshot.pickaxe.power.decimal,
            quality: firstSnapshot.pickaxe.quality.decimal,
          });
        }
      }
      const sourceSharedState = readSaveState(await readLegacySlot(sourcePage));
      if (expectedSaveCalls === 0) {
        expect(sourceSharedState).toMatchObject({
          money: "970",
          gems: attempt.input.gems,
          upgrades: { blacksmith: { level: 1 } },
        });
      } else {
        const lastSnapshot = attempt.saveSnapshots.at(-1)!;
        expect(sourceSharedState).toMatchObject({
          money: "1000",
          gems: lastSnapshot.gems.decimal,
          upgrades: { blacksmith: { level: 0 } },
          pickaxe: {
            name: lastSnapshot.pickaxe.name,
            pow: lastSnapshot.pickaxe.power.decimal,
            quality: lastSnapshot.pickaxe.quality.decimal,
          },
        });
      }
      await Promise.all([
        page.locator("footer button").filter({ hasText: "Mining" }).click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Mining" })
          .click(),
      ]);
      await Promise.all([
        expect(freshBeyondBlacksmith).toHaveAttribute(
          "data-upgrade-level",
          "1",
        ),
        expect(freshSourceBlacksmith.locator(".lvl")).toHaveText("1"),
      ]);
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
