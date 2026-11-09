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
    pickaxeCraftingSemantics: {
      attempts: {
        input: {
          name: string;
          gems: string;
          usedGemsLevel: number;
          highestMineObjectLevel: number;
          equippedPickaxe: { name: string; power: string; quality: string };
          randomValues: number[];
        };
        randomCalls: number;
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
      }>;
    };
  };
};

type LegacySave = {
  money: string;
  gems: string;
  highestMoney: string;
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
  settings: { theme?: string; numberFormatterIndex?: number };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  pickaxe: { name: string; pow: string; quality: string };
};

type ObservableBeyondState = {
  resources: { money: string; gems: string };
  upgrades: {
    money: Record<string, number>;
    gems: Record<string, number>;
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
