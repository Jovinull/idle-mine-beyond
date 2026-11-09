import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type CraftAttempt = {
  name: string;
  randomCalls: number;
  saveCalls: number;
  input: {
    name: string;
    gems: string;
    usedGemsLevel: number;
    highestMineObjectLevel: number;
    equippedPickaxe: { name: string; power: string; quality: string };
    randomValues: number[];
  };
  messageLog: { message: string }[];
  saveSnapshots: unknown[];
  result: {
    gems: { decimal: string };
    pickaxe: { name: string };
  };
};

type CraftCorpus = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    pickaxeCraftingSemantics: { attempts: CraftAttempt[] };
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
const noSaveCases = [
  "equal-damage-is-a-dud",
  "strictly-weaker-craft-is-a-dud",
  "insufficient-gems-consumes-no-rng",
];

function seedSave({ encoded, now }: { encoded: string; now: number }) {
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Date.now = () => now;
}

async function installRandomSequence(
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

for (const caseName of noSaveCases) {
  test(`matches Remix ${caseName} without changing persisted saves`, async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    const corpus = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as CraftCorpus;
    const attempt = corpus.data.pickaxeCraftingSemantics.attempts.find(
      ({ input }) => input.name === caseName,
    );
    if (!attempt) throw new Error(`Pinned craft case is missing: ${caseName}`);
    expect(attempt.saveCalls).toBe(0);
    expect(attempt.saveSnapshots).toEqual([]);

    const save = JSON.parse(
      corpus.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    Object.assign(save, {
      gems: attempt.input.gems,
      mineObjectLevel: attempt.input.highestMineObjectLevel,
      highestMineObjectLevel: attempt.input.highestMineObjectLevel,
      usedGemsLevel: attempt.input.usedGemsLevel,
      lastActive: fixedClock,
    });
    Object.assign(save.settings, { tab: "main", theme: "light" });
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
    const encodedSource = encodeRemixLegacySave(save);
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
        page.addInitScript(seedSave, {
          encoded: encodedSource,
          now: fixedClock,
        }),
        sourcePage.addInitScript(seedSave, {
          encoded: encodedSource,
          now: fixedClock,
        }),
      ]);
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
      await Promise.all([
        expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
        sourcePage.waitForFunction(() =>
          Boolean((window as Window & { game?: unknown }).game),
        ),
      ]);
      const [sourceBefore, beyondBefore] = await Promise.all([
        sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
        page.evaluate(() => ({
          primary: localStorage.getItem("IdleMineBeyond"),
          backup: localStorage.getItem("IdleMineBeyondBackup"),
        })),
      ]);
      await Promise.all([
        installRandomSequence(page, attempt.input.randomValues),
        installRandomSequence(sourcePage, attempt.input.randomValues),
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
      const [sourceGems, beyondGems] = await Promise.all([
        sourcePage.locator("header > span").nth(1).textContent(),
        page.locator("header > span").nth(1).textContent(),
      ]);
      expect(beyondGems, `${caseName} live Gem balance`).toBe(sourceGems);
      const [sourceAfter, beyondAfter, sourceCalls, beyondCalls] =
        await Promise.all([
          sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
          page.evaluate(() => ({
            primary: localStorage.getItem("IdleMineBeyond"),
            backup: localStorage.getItem("IdleMineBeyondBackup"),
          })),
          sourcePage.evaluate(() =>
            (
              window as Window & { __craftRandomCalls?: () => number }
            ).__craftRandomCalls?.(),
          ),
          page.evaluate(() =>
            (
              window as Window & { __craftRandomCalls?: () => number }
            ).__craftRandomCalls?.(),
          ),
        ]);
      expect(sourceAfter, `${caseName} Remix primary save`).toBe(sourceBefore);
      expect(beyondAfter, `${caseName} Beyond primary and backup`).toEqual(
        beyondBefore,
      );
      expect(sourceCalls).toBe(attempt.randomCalls);
      expect(beyondCalls).toBe(attempt.randomCalls);
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
