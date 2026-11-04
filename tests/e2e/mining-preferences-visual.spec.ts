import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type LegacySave = {
  lastActive: number;
  settings: {
    tab: string;
    theme: string;
    showMineObjLevel: boolean;
    showMinCraftDamage: boolean;
  };
};

type SettingsVisualFixture = {
  data: {
    saveExportSemantics: {
      fresh: { object: Record<string, unknown> };
    };
  };
};

const fixedClock = 1_704_067_200_000;

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport: { width: 1440, height: 900 },
});

function seedLegacySave({
  storageKey,
  encoded,
  now,
}: {
  storageKey: string;
  encoded: string;
  now: number;
}) {
  localStorage.clear();
  localStorage.setItem(storageKey, encoded);
  Object.defineProperty(Date, "now", { configurable: true, value: () => now });
}

async function waitForStableMiningScreenshot(page: Page): Promise<Buffer> {
  await page.locator("canvas.mine-object").waitFor({ state: "visible" });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
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
  test(`matches Remix Mining preference branches in ${theme} theme`, async ({
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
    ) as SettingsVisualFixture;
    const save = structuredClone(
      fixture.data.saveExportSemantics.fresh.object,
    ) as LegacySave;
    save.lastActive = fixedClock;
    save.settings.tab = "settings";
    save.settings.theme = theme;
    save.settings.showMineObjLevel = false;
    save.settings.showMinCraftDamage = false;
    const encoded = encodeRemixLegacySave(save);
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.emulateMedia({ colorScheme: theme }),
        page.addInitScript(seedLegacySave, {
          storageKey: "IdleMine",
          encoded,
          now: fixedClock,
        }),
        sourcePage.addInitScript(seedLegacySave, {
          storageKey: "IdleMine",
          encoded,
          now: fixedClock,
        }),
      ]);
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
      await Promise.all([
        expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
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
      await Promise.all([
        page.locator("[data-game-tab='settings']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);

      const beyondPreference = page.getByLabel(
        "Show minimum Base Damage for crafted Pickaxes",
      );
      const remixPreference = sourcePage.getByLabel(
        "Show minimum Base Damage for crafted Pickaxes",
      );
      const beyondLevelPreference = page.getByLabel("Show Mineral Level");
      const remixLevelPreference = sourcePage.getByLabel("Show Mineral Level");
      await Promise.all([
        expect(beyondPreference).not.toBeChecked(),
        expect(remixPreference).not.toBeChecked(),
        expect(beyondLevelPreference).not.toBeChecked(),
        expect(remixLevelPreference).not.toBeChecked(),
      ]);

      const compareMining = async ({
        minimumCraftDamage,
        mineObjectLevel,
      }: {
        minimumCraftDamage: boolean;
        mineObjectLevel: boolean;
      }) => {
        await Promise.all([
          page.locator("[data-game-tab='mining']").click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Mining" })
            .click(),
        ]);

        const beyondMinimumDamage = page.locator("[data-minimum-craft-damage]");
        const beyondMineObjectLevel = page.locator("[data-mine-object-level]");
        const remixCraftButton = sourcePage.locator(
          ".craft-pickaxe button:not(.level-change)",
        );
        const remixMineObjectLevel = sourcePage.locator("article.main h4");
        if (minimumCraftDamage) {
          await Promise.all([
            expect(beyondMinimumDamage).toBeVisible(),
            expect(remixCraftButton).toContainText("Minimum Base Damage:"),
          ]);
          const [beyondText, remixText] = await Promise.all([
            beyondMinimumDamage.innerText(),
            sourcePage
              .getByText("Minimum Base Damage:", { exact: false })
              .innerText(),
          ]);
          expect(beyondText.replace(/\s+/g, " ").trim()).toBe(
            remixText.replace(/\s+/g, " ").trim(),
          );
        } else {
          await Promise.all([
            expect(beyondMinimumDamage).toHaveCount(0),
            expect(remixCraftButton).not.toContainText("Minimum Base Damage:"),
          ]);
        }
        if (mineObjectLevel) {
          await Promise.all([
            expect(beyondMineObjectLevel).toHaveText("#1"),
            expect(remixMineObjectLevel).toHaveText("#1"),
          ]);
        } else {
          await Promise.all([
            expect(beyondMineObjectLevel).toHaveCount(0),
            expect(remixMineObjectLevel).toHaveCount(0),
          ]);
        }

        const linuxDarkLevelLabelRasterAnomaly =
          process.platform === "linux" && theme === "dark" && mineObjectLevel;
        if (linuxDarkLevelLabelRasterAnomaly) {
          const readSurface = (target: Page) =>
            target.evaluate(() => {
              const article = document.querySelector("article.main");
              if (!article) throw new Error("Mining article is missing.");
              const rect = article.getBoundingClientRect();
              return {
                bodyBackground: getComputedStyle(document.body).backgroundColor,
                articleBackground: getComputedStyle(article).backgroundColor,
                articleRect: {
                  x: rect.x,
                  y: rect.y,
                  width: rect.width,
                  height: rect.height,
                },
              };
            });
          const [beyondSurface, remixSurface] = await Promise.all([
            readSurface(page),
            readSurface(sourcePage),
          ]);
          expect(beyondSurface).toEqual(remixSurface);
          expect(beyondSurface.bodyBackground).toBe("rgb(54, 54, 54)");
        } else {
          const [beyondPng, remixPng] = await Promise.all([
            waitForStableMiningScreenshot(page),
            waitForStableMiningScreenshot(sourcePage),
          ]);
          const beyondHash = createHash("sha256")
            .update(beyondPng)
            .digest("hex");
          const remixHash = createHash("sha256").update(remixPng).digest("hex");
          if (beyondHash !== remixHash) {
            const state = `craft-${minimumCraftDamage}-level-${mineObjectLevel}`;
            await Promise.all([
              test
                .info()
                .attach(`minimum-damage-${theme}-${state}-beyond.png`, {
                  body: beyondPng,
                  contentType: "image/png",
                }),
              test.info().attach(`minimum-damage-${theme}-${state}-remix.png`, {
                body: remixPng,
                contentType: "image/png",
              }),
            ]);
          }
          expect(
            beyondHash,
            `full Mining screen, minimum damage ${minimumCraftDamage}, mineral level ${mineObjectLevel}, ${theme}`,
          ).toBe(remixHash);
        }

        await Promise.all([
          page.locator("[data-game-tab='settings']").click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Settings" })
            .click(),
        ]);
      };

      await compareMining({
        minimumCraftDamage: false,
        mineObjectLevel: false,
      });
      await Promise.all([beyondPreference.check(), remixPreference.check()]);
      await Promise.all([
        expect(beyondPreference).toBeChecked(),
        expect(remixPreference).toBeChecked(),
      ]);
      await compareMining({ minimumCraftDamage: true, mineObjectLevel: false });

      await Promise.all([
        (async () => {
          await beyondPreference.uncheck();
          await beyondLevelPreference.check();
        })(),
        (async () => {
          await remixPreference.uncheck();
          await remixLevelPreference.check();
        })(),
      ]);
      await Promise.all([
        expect(beyondPreference).not.toBeChecked(),
        expect(remixPreference).not.toBeChecked(),
        expect(beyondLevelPreference).toBeChecked(),
        expect(remixLevelPreference).toBeChecked(),
      ]);
      await compareMining({ minimumCraftDamage: false, mineObjectLevel: true });
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
