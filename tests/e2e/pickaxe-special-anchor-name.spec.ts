import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

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
type Fixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    pickaxeCraftingSemantics: { attempts: CraftAttempt[] };
  };
};

const fixedClock = 1_700_000_000_000;

function seedLegacySave({
  encoded,
  now,
}: {
  encoded: string;
  now: number;
}): void {
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Date.now = () => now;
}

async function waitForStableScreen(
  page: Page,
  viewport: { width: number; height: number },
): Promise<Buffer> {
  await page.mouse.move(viewport.width - 1, viewport.height - 1);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  return page.screenshot({ animations: "disabled" });
}

async function installCraftRandomSequence(
  page: Page,
  values: number[],
): Promise<void> {
  await page.evaluate((sequence) => {
    let index = 0;
    const browserWindow = window as Window & {
      __idleMineCraftRandomCalls?: () => number;
    };
    browserWindow.__idleMineCraftRandomCalls = () => index;
    Math.random = () => sequence[index++] ?? 0.5;
  }, values);
}

for (const theme of ["light", "dark"] as const) {
  test(`matches Remix special-anchor pickaxe name after a live craft in ${theme} theme`, async ({
    browser,
    page,
  }) => {
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as Fixture;
    const craft = fixture.data.pickaxeCraftingSemantics.attempts.find(
      ({ name }) => name === "special-anchor-generated-name-live-craft",
    );
    if (!craft) throw new Error("Missing captured special-anchor name craft.");

    const save = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    save.gems = craft.input.gems;
    save.mineObjectLevel = craft.input.highestMineObjectLevel;
    save.highestMineObjectLevel = craft.input.highestMineObjectLevel;
    save.lastActive = fixedClock;
    save.settings["tab"] = "main";
    save.settings["theme"] = theme;
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
    const viewport = { width: 1440, height: 900 };
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      viewport,
    });
    const sourcePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.setViewportSize(viewport),
        page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
        sourcePage.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
      ]);
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
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
      expect(await page.locator(".messagelog").innerText()).toBe(
        await sourcePage.locator(".messagelog").innerText(),
      );
      const [beyondCalls, remixCalls] = await Promise.all([
        page.evaluate(() =>
          (
            window as Window & {
              __idleMineCraftRandomCalls?: () => number;
            }
          ).__idleMineCraftRandomCalls?.(),
        ),
        sourcePage.evaluate(() =>
          (
            window as Window & {
              __idleMineCraftRandomCalls?: () => number;
            }
          ).__idleMineCraftRandomCalls?.(),
        ),
      ]);
      expect(beyondCalls).toBe(craft.randomCalls);
      expect(remixCalls).toBe(craft.randomCalls);

      const [beyondPng, remixPng] = await Promise.all([
        waitForStableScreen(page, viewport),
        waitForStableScreen(sourcePage, viewport),
      ]);
      const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
      const remixHash = createHash("sha256").update(remixPng).digest("hex");
      if (beyondHash !== remixHash) {
        await Promise.all([
          test.info().attach(`special-anchor-${theme}-beyond.png`, {
            body: beyondPng,
            contentType: "image/png",
          }),
          test.info().attach(`special-anchor-${theme}-remix.png`, {
            body: remixPng,
            contentType: "image/png",
          }),
        ]);
      }
      expect(beyondHash, `special-anchor Mining screen in ${theme}`).toBe(
        remixHash,
      );
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
