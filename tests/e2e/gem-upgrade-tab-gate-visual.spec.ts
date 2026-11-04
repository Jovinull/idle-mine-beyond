import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type LegacySave = {
  highestMineObjectLevel: number;
  lastActive: number;
  mineObjectLevel: number;
  settings: { tab: string; theme: string; upgradeTab: string };
};

type ShopGateFixture = {
  data: { saveApplicationSemantics: { inputJson: string } };
};

const fixedClock = 1_704_067_200_000;
const viewport = { width: 1440, height: 900 };

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport,
});

function seedLegacySave({ encoded, now }: { encoded: string; now: number }) {
  localStorage.clear();
  localStorage.setItem("IdleMine", encoded);
  Object.defineProperty(Date, "now", { configurable: true, value: () => now });
}

async function waitForStableMiningScreenshot(page: Page): Promise<Buffer> {
  await page.locator("canvas.mine-object").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(viewport.width - 1, viewport.height - 1);
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
  for (const level of [60, 61] as const) {
    test(`matches Remix Gem upgrade tab gate at high-water ${level} in ${theme} theme`, async ({
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
      ) as ShopGateFixture;
      const save = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      save.highestMineObjectLevel = level;
      save.mineObjectLevel = level;
      save.lastActive = fixedClock;
      save.settings.tab = "main";
      save.settings.theme = theme;
      save.settings.upgradeTab = "money";
      const encoded = encodeRemixLegacySave(save);
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
          page.emulateMedia({ colorScheme: theme }),
          page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
          sourcePage.addInitScript(seedLegacySave, {
            encoded,
            now: fixedClock,
          }),
        ]);
        await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
        await Promise.all([
          expect(page.locator("#app")).toHaveAttribute(
            "data-app-state",
            "ready",
          ),
          sourcePage.waitForFunction(
            (selectedTheme) =>
              Boolean(
                (window as Window & { game?: unknown }).game &&
                document.querySelector("#app > footer") &&
                document.querySelector<HTMLLinkElement>("#css_theme")?.sheet &&
                document
                  .querySelector<HTMLLinkElement>("#css_theme")
                  ?.getAttribute("href") === `Themes/${selectedTheme}.css`,
              ),
            theme,
          ),
        ]);

        const sourceTabs = sourcePage.locator(".upg-tabs");
        const beyondTabs = page.locator(".upgrade-panel .upg-tabs");
        const sourceGemTab = sourceTabs
          .locator("button")
          .filter({ hasText: "Gem Upgrades" });
        const beyondGemTab = page.locator('[data-upgrade-tab="gems"]');
        if (level === 60) {
          await Promise.all([
            expect(sourceTabs).toHaveCount(0),
            expect(beyondTabs).toHaveCount(0),
            expect(sourceGemTab).toHaveCount(0),
            expect(beyondGemTab).toHaveCount(0),
          ]);
        } else {
          await Promise.all([
            expect(sourceTabs).toBeVisible(),
            expect(beyondTabs).toBeVisible(),
            expect(sourceTabs.locator("button")).toHaveCount(2),
            expect(page.locator("[data-upgrade-tab]")).toHaveCount(2),
            expect(sourceGemTab).toBeVisible(),
            expect(beyondGemTab).toBeVisible(),
            expect(
              sourcePage
                .locator(".upg-tabs button")
                .filter({ hasText: "PC Upgrades" }),
            ).toHaveCount(0),
            expect(
              page.locator('[data-upgrade-tab="planetCoins"]'),
            ).toHaveCount(0),
          ]);
        }

        const [remixPng, beyondPng] = await Promise.all([
          waitForStableMiningScreenshot(sourcePage),
          waitForStableMiningScreenshot(page),
        ]);
        const remixHash = createHash("sha256").update(remixPng).digest("hex");
        const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
        if (remixHash !== beyondHash) {
          await Promise.all([
            test.info().attach(`gem-tab-${level}-${theme}-remix.png`, {
              body: remixPng,
              contentType: "image/png",
            }),
            test.info().attach(`gem-tab-${level}-${theme}-beyond.png`, {
              body: beyondPng,
              contentType: "image/png",
            }),
          ]);
        }
        expect(
          beyondHash,
          `full Mining screen at high-water ${level} in ${theme}`,
        ).toBe(remixHash);
      } finally {
        await sourceContext.close().catch(() => undefined);
      }
    });
  }
}
