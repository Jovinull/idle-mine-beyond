import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type CraftAttempt = {
  name: string;
  input: {
    gems: string;
    highestMineObjectLevel: number;
    equippedPickaxe: { name: string; power: string; quality: string };
    randomValues: number[];
  };
  randomCalls: number;
  messageLog: { message: string; color: string }[];
  result: {
    pickaxe: {
      name: string;
      power: { decimal: string };
      quality: { decimal: string };
    };
  };
};

type LegacySave = {
  gems: string;
  mineObjectLevel: number;
  highestMineObjectLevel: number;
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

type CraftCorpus = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    pickaxeCraftingSemantics: { attempts: CraftAttempt[] };
  };
};

const fixedClock = 1_700_000_000_000;

function seedSave({ encoded, now }: { encoded: string; now: number }) {
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
    (
      window as Window & { __craftRandomCalls?: () => number }
    ).__craftRandomCalls = () => index;
    Math.random = () => sequence[index++] ?? 0.5;
  }, values);
}

test("exports the pinned special-anchor craft result exactly", async ({
  browser,
  page,
}) => {
  test.setTimeout(120_000);
  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as CraftCorpus;
  const craft = corpus.data.pickaxeCraftingSemantics.attempts.find(
    ({ name }) => name === "special-anchor-generated-name-live-craft",
  );
  if (!craft) throw new Error("Missing captured special-anchor name craft.");
  expect(craft.result.pickaxe.name).toBe("Sturdy HD 4943-b Pick");
  expect(craft.randomCalls).toBe(10);

  const save = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.gems = craft.input.gems;
  save.mineObjectLevel = craft.input.highestMineObjectLevel;
  save.highestMineObjectLevel = craft.input.highestMineObjectLevel;
  save.lastActive = fixedClock;
  Object.assign(save.settings, { tab: "main", theme: "light" });
  save.upgrades = {};
  save.gemUpgrades = {};
  save.planetCoinUpgrades = {};
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = {};
  save.pickaxe = {
    name: craft.input.equippedPickaxe.name,
    pow: craft.input.equippedPickaxe.power,
    quality: craft.input.equippedPickaxe.quality,
  };
  const encoded = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.setViewportSize({ width: 1440, height: 900 }),
      page.addInitScript(seedSave, { encoded, now: fixedClock }),
      sourcePage.addInitScript(seedSave, { encoded, now: fixedClock }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await Promise.all([
      expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
      sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      ),
    ]);
    await Promise.all([
      installCraftRandomSequence(page, craft.input.randomValues),
      installCraftRandomSequence(sourcePage, craft.input.randomValues),
    ]);
    await Promise.all([
      page.locator("[data-craft-pickaxe]").click(),
      sourcePage.locator(".craft-pickaxe button:not(.level-change)").click(),
    ]);
    const beyondName = page
      .locator(".stats > div")
      .first()
      .locator("p")
      .first();
    const sourceName = sourcePage
      .locator(".stats > div")
      .first()
      .locator("p")
      .first();
    await Promise.all([
      expect(beyondName).toHaveText(craft.result.pickaxe.name),
      expect(sourceName).toHaveText(craft.result.pickaxe.name),
      expect(page.locator(".messagelog")).toContainText(
        craft.messageLog[0]!.message,
      ),
      expect(sourcePage.locator(".messagelog")).toContainText(
        craft.messageLog[0]!.message,
      ),
    ]);
    const [beyondCalls, remixCalls] = await Promise.all([
      page.evaluate(() =>
        (
          window as Window & { __craftRandomCalls?: () => number }
        ).__craftRandomCalls?.(),
      ),
      sourcePage.evaluate(() =>
        (
          window as Window & { __craftRandomCalls?: () => number }
        ).__craftRandomCalls?.(),
      ),
    ]);
    expect(beyondCalls).toBe(craft.randomCalls);
    expect(remixCalls).toBe(craft.randomCalls);

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      page.locator("[data-settings-export]").click(),
      sourcePage
        .locator("article.settings button")
        .filter({ hasText: "Export" })
        .click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport, "complete special-anchor save export bytes").toBe(
      sourceExport,
    );
    const beyondDecoded = decodeRemixLegacySave(beyondExport);
    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    expect(beyondDecoded.status).toBe("success");
    expect(sourceDecoded.status).toBe("success");
    if (
      beyondDecoded.status !== "success" ||
      sourceDecoded.status !== "success"
    ) {
      throw new Error("Could not decode the special-anchor craft exports.");
    }
    expect(beyondDecoded.value).toEqual(sourceDecoded.value);
    expect((beyondDecoded.value as LegacySave).pickaxe).toEqual({
      name: craft.result.pickaxe.name,
      pow: craft.result.pickaxe.power.decimal,
      quality: craft.result.pickaxe.quality.decimal,
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
