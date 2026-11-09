import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type CraftAttempt = {
  randomCalls: number;
  input: {
    gems: string;
    usedGemsLevel: number;
    highestMineObjectLevel: number;
    equippedPickaxe: { name: string; power: string; quality: string };
    randomValues: number[];
  };
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
};

type CraftFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    pickaxeCraftingSemantics: {
      attempts: (CraftAttempt & {
        input: CraftAttempt["input"] & { name: string };
      })[];
      craftControls: {
        controls: {
          name: string;
          displayedGemCost: string;
          buttons: { disabled: boolean; image: string | null }[];
        }[];
      };
    };
  };
};

type LegacySave = {
  gems: string;
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  usedGemsLevel: number;
  lastActive: number;
  settings: Record<string, unknown>;
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
};

const fixedClock = 1_700_000_000_000;

function seedLegacySave({ encoded, now }: { encoded: string; now: number }) {
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Date.now = () => now;
}

async function installCraftRandomSequence(
  page: import("@playwright/test").Page,
  values: number[],
) {
  await page.evaluate((sequence) => {
    let index = 0;
    const browserWindow = window as Window & {
      __idleMineCraftRandomCalls?: () => number;
    };
    browserWindow.__idleMineCraftRandomCalls = () => index;
    Math.random = () => sequence[index++] ?? 0.5;
  }, values);
}

test("source-pairs successful single craft replacement through persisted export", async ({
  browser,
  page,
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
  ) as CraftFixture;
  const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "better-craft-replaces-and-saves",
  );
  if (!attempt)
    throw new Error("The captured successful craft replacement is missing.");
  expect(attempt.saveSnapshots).toHaveLength(1);

  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.gems = attempt.input.gems;
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.usedGemsLevel = attempt.input.usedGemsLevel;
  save.lastActive = fixedClock;
  save.settings["tab"] = "main";
  save.settings["theme"] = "light";
  save.upgrades = {};
  save.gemUpgrades = {};
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };
  const encoded = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.setViewportSize({ width: 1440, height: 900 }),
      page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
      sourcePage.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready", {
        timeout: 30_000,
      }),
      sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);
    await Promise.all([
      installCraftRandomSequence(page, attempt.input.randomValues),
      installCraftRandomSequence(sourcePage, attempt.input.randomValues),
    ]);
    await Promise.all([
      page.locator("[data-craft-pickaxe]").click(),
      sourcePage.locator(".craft-pickaxe button:not(.level-change)").click(),
    ]);
    await Promise.all([
      expect(page.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(sourcePage.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(
        page.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
      expect(
        sourcePage.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
    ]);
    const [beyondCalls, remixCalls] = await Promise.all([
      page.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
      sourcePage.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
    ]);
    expect(beyondCalls).toBe(attempt.randomCalls);
    expect(remixCalls).toBe(attempt.randomCalls);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-settings-save-field]")).toBeVisible(),
      expect(sourcePage.locator("article.settings textarea")).toBeVisible(),
      page.locator("[data-settings-export]").click(),
      sourcePage
        .locator("article.settings button")
        .filter({ hasText: "Export" })
        .click(),
    ]);
    const [beyondExport, remixExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport, "successful craft replacement export bytes").toBe(
      remixExport,
    );
    const [beyondDecoded, remixDecoded] = [
      decodeRemixLegacySave(beyondExport),
      decodeRemixLegacySave(remixExport),
    ];
    expect(beyondDecoded.status).toBe("success");
    expect(remixDecoded.status).toBe("success");
    if (
      beyondDecoded.status !== "success" ||
      remixDecoded.status !== "success"
    ) {
      throw new Error(
        "Could not decode the successful craft replacement exports.",
      );
    }
    expect(beyondDecoded.value).toEqual(remixDecoded.value);
    const decodedSave = beyondDecoded.value as LegacySave;
    expect(decodedSave.gems).toBe(attempt.saveSnapshots[0]!.gems.decimal);
    expect(decodedSave.pickaxe).toEqual({
      name: attempt.saveSnapshots[0]!.pickaxe.name,
      pow: attempt.saveSnapshots[0]!.pickaxe.power.decimal,
      quality: attempt.saveSnapshots[0]!.pickaxe.quality.decimal,
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("source-pairs a selected Gem Waster craft through persisted export", async ({
  browser,
  page,
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
  ) as CraftFixture;
  const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) => input.name === "selected-gem-level-controls-craft-cost",
  );
  if (!attempt)
    throw new Error("The captured selected Gem Waster craft is missing.");
  expect(attempt.input.usedGemsLevel).toBe(1);
  expect(attempt.input.gems).toBe("3");
  expect(attempt.saveSnapshots).toHaveLength(1);

  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.gems = attempt.input.gems;
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.usedGemsLevel = 0;
  save.lastActive = fixedClock;
  save.settings["tab"] = "main";
  save.settings["theme"] = "light";
  save.upgrades = { gemWaster: { level: 1 } };
  save.gemUpgrades = {};
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };
  const encoded = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.setViewportSize({ width: 1440, height: 900 }),
      page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
      sourcePage.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready", {
        timeout: 30_000,
      }),
      sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);

    await Promise.all([
      page.locator('[data-craft-gem-level="increase"]').click(),
      sourcePage.locator(".craft-pickaxe button.level-change").last().click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText("3"),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText("3"),
    ]);

    await Promise.all([
      installCraftRandomSequence(page, attempt.input.randomValues),
      installCraftRandomSequence(sourcePage, attempt.input.randomValues),
    ]);
    await Promise.all([
      page.locator("[data-craft-pickaxe]").click(),
      sourcePage.locator(".craft-pickaxe button:not(.level-change)").click(),
    ]);
    await Promise.all([
      expect(page.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(sourcePage.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(
        page.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
      expect(
        sourcePage.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
    ]);
    const [beyondCalls, remixCalls] = await Promise.all([
      page.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
      sourcePage.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
    ]);
    expect(beyondCalls).toBe(attempt.randomCalls);
    expect(remixCalls).toBe(attempt.randomCalls);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-settings-save-field]")).toBeVisible(),
      expect(sourcePage.locator("article.settings textarea")).toBeVisible(),
      page.locator("[data-settings-export]").click(),
      sourcePage
        .locator("article.settings button")
        .filter({ hasText: "Export" })
        .click(),
    ]);
    const [beyondExport, remixExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport, "selected Gem Waster craft export bytes").toBe(
      remixExport,
    );
    const [beyondDecoded, remixDecoded] = [
      decodeRemixLegacySave(beyondExport),
      decodeRemixLegacySave(remixExport),
    ];
    expect(beyondDecoded.status).toBe("success");
    expect(remixDecoded.status).toBe("success");
    if (
      beyondDecoded.status !== "success" ||
      remixDecoded.status !== "success"
    ) {
      throw new Error(
        "Could not decode the selected Gem Waster craft exports.",
      );
    }
    expect(beyondDecoded.value).toEqual(remixDecoded.value);
    const decodedSave = beyondDecoded.value as LegacySave;
    expect(decodedSave.gems).toBe(attempt.saveSnapshots[0]!.gems.decimal);
    expect(decodedSave.pickaxe).toEqual({
      name: attempt.saveSnapshots[0]!.pickaxe.name,
      pow: attempt.saveSnapshots[0]!.pickaxe.power.decimal,
      quality: attempt.saveSnapshots[0]!.pickaxe.quality.decimal,
    });
    expect(decodedSave.usedGemsLevel).toBe(attempt.input.usedGemsLevel);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("source-pairs a maximum Gem Waster craft through persisted export", async ({
  browser,
  page,
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
  ) as CraftFixture;
  const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
    ({ input }) =>
      input.name === "maximum-selected-gem-level-controls-craft-cost",
  );
  const maxControl =
    fixture.data.pickaxeCraftingSemantics.craftControls.controls.find(
      ({ name }) => name === "maximum-selected-level",
    );
  if (!attempt || !maxControl)
    throw new Error("The maximum Gem Waster craft capture is missing.");
  expect(attempt.input.usedGemsLevel).toBe(3);
  expect(attempt.input.gems).toBe(maxControl.displayedGemCost);
  expect(maxControl.displayedGemCost).toBe("35");
  expect(maxControl.buttons).toEqual([
    { disabled: false, image: "Images/btn_left.png" },
    { disabled: true, image: null },
  ]);
  expect(attempt.saveSnapshots).toHaveLength(1);

  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.gems = attempt.input.gems;
  save.mineObjectLevel = attempt.input.highestMineObjectLevel;
  save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
  save.usedGemsLevel = 0;
  save.lastActive = fixedClock;
  save.settings["tab"] = "main";
  save.settings["theme"] = "light";
  save.upgrades = { gemWaster: { level: 1 } };
  save.gemUpgrades = { gemWaster: { level: 2 } };
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: attempt.input.equippedPickaxe.name,
    pow: attempt.input.equippedPickaxe.power,
    quality: attempt.input.equippedPickaxe.quality,
  };
  const encoded = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.setViewportSize({ width: 1440, height: 900 }),
      page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
      sourcePage.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready", {
        timeout: 30_000,
      }),
      sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);

    for (let level = 0; level < attempt.input.usedGemsLevel; level++) {
      await Promise.all([
        page.locator('[data-craft-gem-level="increase"]').click(),
        sourcePage.locator(".craft-pickaxe button.level-change").last().click(),
      ]);
    }
    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText(
        maxControl.displayedGemCost,
      ),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText(maxControl.displayedGemCost),
      expect(page.locator('[data-craft-gem-level="increase"]')).toBeDisabled(),
      expect(
        sourcePage.locator(".craft-pickaxe button.level-change").last(),
      ).toBeDisabled(),
    ]);

    await Promise.all([
      installCraftRandomSequence(page, attempt.input.randomValues),
      installCraftRandomSequence(sourcePage, attempt.input.randomValues),
    ]);
    await Promise.all([
      page.locator("[data-craft-pickaxe]").click(),
      sourcePage.locator(".craft-pickaxe button:not(.level-change)").click(),
    ]);
    await Promise.all([
      expect(page.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(sourcePage.locator(".messagelog")).toContainText(
        attempt.messageLog[0]!.message,
      ),
      expect(
        page.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
      expect(
        sourcePage.locator(".stats > div").first().locator("p").first(),
      ).toHaveText(attempt.result.pickaxe.name),
    ]);
    const [beyondCalls, remixCalls] = await Promise.all([
      page.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
      sourcePage.evaluate(() =>
        (
          window as Window & { __idleMineCraftRandomCalls?: () => number }
        ).__idleMineCraftRandomCalls?.(),
      ),
    ]);
    expect(beyondCalls).toBe(attempt.randomCalls);
    expect(remixCalls).toBe(attempt.randomCalls);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-settings-save-field]")).toBeVisible(),
      expect(sourcePage.locator("article.settings textarea")).toBeVisible(),
      page.locator("[data-settings-export]").click(),
      sourcePage
        .locator("article.settings button")
        .filter({ hasText: "Export" })
        .click(),
    ]);
    const [beyondExport, remixExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport, "maximum Gem Waster craft export bytes").toBe(
      remixExport,
    );
    const [beyondDecoded, remixDecoded] = [
      decodeRemixLegacySave(beyondExport),
      decodeRemixLegacySave(remixExport),
    ];
    expect(beyondDecoded.status).toBe("success");
    expect(remixDecoded.status).toBe("success");
    if (
      beyondDecoded.status !== "success" ||
      remixDecoded.status !== "success"
    ) {
      throw new Error("Could not decode the maximum Gem Waster craft exports.");
    }
    expect(beyondDecoded.value).toEqual(remixDecoded.value);
    const decodedSave = beyondDecoded.value as LegacySave;
    expect(decodedSave.gems).toBe(attempt.saveSnapshots[0]!.gems.decimal);
    expect(decodedSave.pickaxe).toEqual({
      name: attempt.saveSnapshots[0]!.pickaxe.name,
      pow: attempt.saveSnapshots[0]!.pickaxe.power.decimal,
      quality: attempt.saveSnapshots[0]!.pickaxe.quality.decimal,
    });
    expect(decodedSave.usedGemsLevel).toBe(attempt.input.usedGemsLevel);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
