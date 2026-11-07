import { createHash } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
const viewports = [
  { name: "1440x900", size: { width: 1440, height: 900 } },
  { name: "1366x768", size: { width: 1366, height: 768 } },
] as const;

const groups = [
  { beyond: "money", remix: "Money Upgrades", key: "blacksmith" },
  { beyond: "gems", remix: "Gem Upgrades", key: "blacksmith" },
  { beyond: "planetCoins", remix: "PC Upgrades", key: "activePower" },
] as const;

const modifierStates = [
  { name: "shift", keys: ["Shift"], active: [true, false] },
  { name: "control", keys: ["Control"], active: [false, true] },
  {
    name: "shift-control",
    keys: ["Shift", "Control"],
    active: [false, true],
  },
] as const;

type Theme = "light" | "dark";
type LegacySave = {
  money: string;
  gems: string;
  planetCoins: string;
  highestMineObjectLevel: number;
  mineObjectLevel: number;
  lastActive: number;
  settings: Record<string, unknown>;
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
};

type Fixture = {
  data: { saveApplicationSemantics: { inputJson: string } };
};

function seedPage({ encoded, time }: { encoded: string; time: number }): void {
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Date.now = () => time;
}

async function startPages(
  browser: Browser,
  beyondPage: Page,
  encoded: string,
  theme: Theme,
  viewport: { width: number; height: number },
) {
  const sourceContext = await browser.newContext({
    colorScheme: theme,
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    viewport,
  });
  const sourcePage = await sourceContext.newPage();
  const sourceUrl = await routePinnedRemixOracle(sourceContext);
  await Promise.all([
    beyondPage.setViewportSize(viewport),
    beyondPage.emulateMedia({ colorScheme: theme }),
    sourcePage.addInitScript(seedPage, { encoded, time: fixedTime }),
    beyondPage.addInitScript(seedPage, { encoded, time: fixedTime }),
  ]);
  await Promise.all([beyondPage.goto("/"), sourcePage.goto(sourceUrl)]);
  await Promise.all([
    expect(beyondPage.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    ),
    sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    ),
  ]);
  return { sourceContext, sourcePage };
}

async function waitForStableScreen(page: Page): Promise<Buffer> {
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

for (const theme of ["light", "dark"] as const) {
  for (const group of groups) {
    for (const viewport of viewports) {
      test(`matches full-screen ${group.beyond} shop modifier hints in ${theme} theme at ${viewport.name}`, async ({
        browser,
        page,
      }) => {
        test.setTimeout(120_000);
        const fixture = JSON.parse(
          await readFile(
            new URL(
              "../fixtures/parity/remix-reference-corpus.json",
              import.meta.url,
            ),
            "utf8",
          ),
        ) as Fixture;
        const save = JSON.parse(
          fixture.data.saveApplicationSemantics.inputJson,
        ) as LegacySave;
        save.money = "1e1000";
        save.gems = "1e1000";
        save.planetCoins = "1e1000";
        save.highestMineObjectLevel = 90;
        save.mineObjectLevel = 1;
        save.lastActive = fixedTime;
        save.settings["tab"] = "main";
        save.settings["theme"] = theme;
        save.settings["upgradeTab"] = "money";
        save.upgrades = { activePower: { level: 0 } };
        save.gemUpgrades = { offlineGems: { level: 0 } };
        save.planetCoinUpgrades = { activePower: { level: 0 } };

        const { sourceContext, sourcePage } = await startPages(
          browser,
          page,
          encodeRemixLegacySave(save),
          theme,
          viewport.size,
        );

        try {
          if (group.beyond !== "money") {
            await Promise.all([
              page.locator(`[data-upgrade-tab="${group.beyond}"]`).click(),
              sourcePage
                .locator(".upg-tabs button")
                .filter({ hasText: group.remix })
                .click(),
            ]);
          }

          const beyondCard = page.locator(
            `[data-upgrade-group="${group.beyond}"][data-upgrade-key="${group.key}"]`,
          );
          const sourceCard = sourcePage
            .locator(".upgradelist .upgrade")
            .first();
          const beyondRefreshCard = page
            .locator(`[data-upgrade-group="${group.beyond}"][data-upgrade-key]`)
            .nth(1);
          const sourceRefreshCard = sourcePage
            .locator(".upgradelist .upgrade")
            .nth(1);
          await Promise.all([beyondCard.hover(), sourceCard.hover()]);
          const beyondHints = page.locator(
            `[data-upgrade-details="${group.key}"] .multibuy`,
          );
          const sourceHints = sourcePage.locator(
            ".highlightedupgrade .multibuy",
          );
          await expect(beyondHints).toHaveCount(2);
          await expect(sourceHints).toHaveCount(2);

          for (const state of modifierStates) {
            for (const key of state.keys) {
              await Promise.all([
                page.keyboard.down(key),
                sourcePage.keyboard.down(key),
              ]);
            }

            // Remix updates these classes on a later Vue render, not on keydown.
            await Promise.all([
              beyondRefreshCard.hover(),
              sourceRefreshCard.hover(),
            ]);
            await Promise.all([beyondCard.hover(), sourceCard.hover()]);
            const expected = state.active;
            for (let index = 0; index < expected.length; index += 1) {
              await Promise.all([
                expect(beyondHints.nth(index)).toHaveClass(
                  expected[index] ? /active/ : /^(?!.*active)/,
                ),
                expect(sourceHints.nth(index)).toHaveClass(
                  expected[index] ? /active/ : /^(?!.*active)/,
                ),
              ]);
            }

            const [beyondPng, remixPng] = await Promise.all([
              waitForStableScreen(page),
              waitForStableScreen(sourcePage),
            ]);
            const beyondHash = createHash("sha256")
              .update(beyondPng)
              .digest("hex");
            const remixHash = createHash("sha256")
              .update(remixPng)
              .digest("hex");
            const screenshotName = `shop-modifier-${group.beyond}-${state.name}-${theme}-${viewport.name}`;
            if (beyondHash !== remixHash) {
              await Promise.all([
                test.info().attach(`${screenshotName}-beyond.png`, {
                  body: beyondPng,
                  contentType: "image/png",
                }),
                test.info().attach(`${screenshotName}-remix.png`, {
                  body: remixPng,
                  contentType: "image/png",
                }),
              ]);
            }
            expect(beyondHash, `${screenshotName} full-screen PNG`).toBe(
              remixHash,
            );

            for (const key of [...state.keys].reverse()) {
              await Promise.all([
                page.keyboard.up(key),
                sourcePage.keyboard.up(key),
              ]);
            }
          }
        } finally {
          await sourceContext.close().catch(() => undefined);
        }
      });
    }
  }
}
