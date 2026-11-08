import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type CraftAttempt = {
  name: string;
  randomCalls: number;
  input: {
    name: string;
    gems: string;
    highestMineObjectLevel: number;
    equippedPickaxe: { name: string; power: string; quality: string };
    randomValues: number[];
  };
  messageLog: { message: string }[];
  result: {
    gems: { decimal: string };
    pickaxe: {
      name: string;
      power: { decimal: string };
      quality: { decimal: string };
    };
  };
};

type CraftVisualFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    pickaxeCraftingSemantics: {
      attempts: CraftAttempt[];
      craftControls: {
        controls: {
          name: string;
          input: {
            usedGemsLevel: number;
            moneyGemWasterLevel: number;
            gemUpgradeWasterLevel: number;
          };
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
const cases = [
  "better-craft-replaces-and-saves",
  "equal-damage-is-a-dud",
  "strictly-weaker-craft-is-a-dud",
  "insufficient-gems-consumes-no-rng",
] as const;
const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
] as const;
const viewportCases = viewports.flatMap((viewport) =>
  cases.map((caseName) => ({ caseName, viewport })),
);

function seedLegacySave({ encoded, now }: { encoded: string; now: number }) {
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
  for (const { caseName, viewport } of viewportCases) {
    test(`matches Remix ${caseName} craft screen at ${viewport.width}x${viewport.height} in ${theme} theme`, async ({
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
      ) as CraftVisualFixture;
      const attempt = fixture.data.pickaxeCraftingSemantics.attempts.find(
        ({ input }) => input.name === caseName,
      );
      if (!attempt) throw new Error(`Missing pinned craft case ${caseName}.`);

      const save = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      save.gems = attempt.input.gems;
      save.mineObjectLevel = attempt.input.highestMineObjectLevel;
      save.highestMineObjectLevel = attempt.input.highestMineObjectLevel;
      save.lastActive = fixedClock;
      save.settings["tab"] = "main";
      save.settings["theme"] = theme;
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
      const compareFullCraftPanel =
        caseName === "better-craft-replaces-and-saves" &&
        viewport.width === 1366;
      if (compareFullCraftPanel) {
        save.upgrades["gemWaster"] = { level: 1 };
        save.gemUpgrades["gemWaster"] = { level: 2 };
      }
      const encoded = encodeRemixLegacySave(save);
      const sourceContext = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "UTC",
        viewport,
      });
      const sourcePage = await sourceContext.newPage();
      const beyondPageErrors: string[] = [];
      page.on("pageerror", (error) => beyondPageErrors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") beyondPageErrors.push(message.text());
      });

      try {
        const sourceUrl = await routePinnedRemixOracle(sourceContext);
        await Promise.all([
          page.setViewportSize(viewport),
          page.addInitScript(seedLegacySave, { encoded, now: fixedClock }),
          sourcePage.addInitScript(seedLegacySave, {
            encoded,
            now: fixedClock,
          }),
        ]);
        await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
        await Promise.all([
          expect(
            page.locator("#app"),
            `Beyond page errors: ${JSON.stringify(beyondPageErrors)}`,
          ).toHaveAttribute("data-app-state", "ready", { timeout: 30_000 }),
          sourcePage.waitForFunction(() =>
            Boolean(
              (window as Window & { game?: unknown }).game &&
              document.querySelector("#app > footer"),
            ),
          ),
        ]);
        await Promise.all([
          expect(page.locator("body")).toHaveAttribute("data-theme", theme),
          sourcePage.waitForFunction(
            (selectedTheme) =>
              document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
                null &&
              document
                .querySelector<HTMLLinkElement>("#css_theme")
                ?.getAttribute("href") === `Themes/${selectedTheme}.css`,
            theme,
          ),
        ]);
        await Promise.all([
          installCraftRandomSequence(page, attempt.input.randomValues),
          installCraftRandomSequence(sourcePage, attempt.input.randomValues),
        ]);

        if (compareFullCraftPanel) {
          const beyondIncrease = page.locator(
            '[data-craft-gem-level="increase"]',
          );
          const sourceIncrease = sourcePage
            .locator(".craft-pickaxe button.level-change")
            .last();
          await Promise.all([beyondIncrease.click(), sourceIncrease.click()]);
          await Promise.all([
            expect(page.locator("[data-craft-gem-cost]")).toHaveText("3"),
            expect(
              sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
            ).toContainText("3"),
          ]);

          const [panelPng, sourcePanelPng] = await Promise.all([
            waitForStableScreen(page, viewport),
            waitForStableScreen(sourcePage, viewport),
          ]);
          const panelHash = createHash("sha256").update(panelPng).digest("hex");
          const sourcePanelHash = createHash("sha256")
            .update(sourcePanelPng)
            .digest("hex");
          if (panelHash !== sourcePanelHash) {
            await Promise.all([
              test.info().attach(`craft-panel-${theme}-beyond-1366x768.png`, {
                body: panelPng,
                contentType: "image/png",
              }),
              test.info().attach(`craft-panel-${theme}-remix-1366x768.png`, {
                body: sourcePanelPng,
                contentType: "image/png",
              }),
            ]);
          }
          expect(
            panelHash,
            `full Mining craft panel at 1366x768 in ${theme}`,
          ).toBe(sourcePanelHash);

          const beyondDecrease = page.locator(
            '[data-craft-gem-level="decrease"]',
          );
          const sourceDecrease = sourcePage
            .locator(".craft-pickaxe button.level-change")
            .first();
          await Promise.all([beyondDecrease.click(), sourceDecrease.click()]);
          await Promise.all([
            expect(page.locator("[data-craft-gem-cost]")).toHaveText("1"),
            expect(
              sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
            ).toContainText("1"),
          ]);
        }

        await Promise.all([
          page.locator("[data-craft-pickaxe]").click(),
          sourcePage
            .locator(".craft-pickaxe button:not(.level-change)")
            .click(),
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
        expect(beyondCalls).toBe(attempt.randomCalls);
        expect(remixCalls).toBe(attempt.randomCalls);

        const [beyondPng, remixPng] = await Promise.all([
          waitForStableScreen(page, viewport),
          waitForStableScreen(sourcePage, viewport),
        ]);
        const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
        const remixHash = createHash("sha256").update(remixPng).digest("hex");
        if (beyondHash !== remixHash) {
          await Promise.all([
            test.info().attach(`${caseName}-${theme}-beyond.png`, {
              body: beyondPng,
              contentType: "image/png",
            }),
            test.info().attach(`${caseName}-${theme}-remix.png`, {
              body: remixPng,
              contentType: "image/png",
            }),
          ]);
        }
        expect(
          beyondHash,
          `${caseName} full-screen pixels at ${viewport.width}x${viewport.height} in ${theme}`,
        ).toBe(remixHash);
      } finally {
        await sourceContext.close().catch(() => undefined);
      }
    });
  }
}

const gemWasterVisualStates = [
  { name: "lower-interior", gemUpgradeLevel: 2, costs: ["3"] },
  { name: "interior", gemUpgradeLevel: 2, costs: ["3", "10"] },
  { name: "maximum", gemUpgradeLevel: 2, costs: ["3", "10", "35"] },
] as const;

for (const selectorState of gemWasterVisualStates) {
  for (const theme of ["light", "dark"] as const) {
    for (const viewport of viewports) {
      test(`matches Remix ${selectorState.name} Gem Waster craft panel in ${theme} theme at ${viewport.width}x${viewport.height}`, async ({
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
        ) as CraftVisualFixture;
        const save = JSON.parse(
          fixture.data.saveApplicationSemantics.inputJson,
        ) as LegacySave;
        save.gems = "1000";
        save.mineObjectLevel = 0;
        save.highestMineObjectLevel = 0;
        save.lastActive = fixedClock;
        save.settings["tab"] = "main";
        save.settings["theme"] = theme;
        save.upgrades = { gemWaster: { level: 1 } };
        save.gemUpgrades = {
          gemWaster: { level: selectorState.gemUpgradeLevel },
        };
        save.planetCoinUpgrades = {};
        save.powers.data.values = ["1", "1", "1", "1", "1"];
        save.powers.upgrades = {};
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
            page.setViewportSize(viewport),
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
              {
                timeout: 30_000,
              },
            ),
            sourcePage.waitForFunction(() =>
              Boolean(
                (window as Window & { game?: unknown }).game &&
                document.querySelector("#app > footer"),
              ),
            ),
          ]);
          await Promise.all([
            expect(page.locator("body")).toHaveAttribute("data-theme", theme),
            sourcePage.waitForFunction(
              (selectedTheme) =>
                document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
                  null &&
                document
                  .querySelector<HTMLLinkElement>("#css_theme")
                  ?.getAttribute("href") === `Themes/${selectedTheme}.css`,
              theme,
            ),
          ]);

          const beyondIncrease = page.locator(
            '[data-craft-gem-level="increase"]',
          );
          const sourceIncrease = sourcePage
            .locator(".craft-pickaxe button.level-change")
            .last();
          for (const costText of selectorState.costs) {
            await Promise.all([beyondIncrease.click(), sourceIncrease.click()]);
            await Promise.all([
              expect(page.locator("[data-craft-gem-cost]")).toHaveText(
                costText,
              ),
              expect(
                sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
              ).toContainText(costText),
            ]);
          }
          if (selectorState.name === "maximum") {
            await Promise.all([
              expect(beyondIncrease).toBeDisabled(),
              expect(beyondIncrease.locator("img")).toHaveCount(0),
              expect(sourceIncrease).toBeDisabled(),
              expect(sourceIncrease.locator("img")).toHaveCount(0),
            ]);
          } else {
            const beyondDecrease = page.locator(
              '[data-craft-gem-level="decrease"]',
            );
            const sourceDecrease = sourcePage
              .locator(".craft-pickaxe button.level-change")
              .first();
            await Promise.all([
              expect(beyondIncrease).toBeEnabled(),
              expect(beyondIncrease.locator("img")).toHaveCount(1),
              expect(sourceIncrease).toBeEnabled(),
              expect(sourceIncrease.locator("img")).toHaveCount(1),
              expect(beyondDecrease).toBeEnabled(),
              expect(beyondDecrease.locator("img")).toHaveCount(1),
              expect(sourceDecrease).toBeEnabled(),
              expect(sourceDecrease.locator("img")).toHaveCount(1),
            ]);
          }

          const [beyondPng, remixPng] = await Promise.all([
            waitForStableScreen(page, viewport),
            waitForStableScreen(sourcePage, viewport),
          ]);
          const beyondHash = createHash("sha256")
            .update(beyondPng)
            .digest("hex");
          const remixHash = createHash("sha256").update(remixPng).digest("hex");
          if (beyondHash !== remixHash) {
            await Promise.all([
              test
                .info()
                .attach(
                  `craft-${selectorState.name}-cost-${theme}-${viewport.width}x${viewport.height}-beyond.png`,
                  { body: beyondPng, contentType: "image/png" },
                ),
              test
                .info()
                .attach(
                  `craft-${selectorState.name}-cost-${theme}-${viewport.width}x${viewport.height}-remix.png`,
                  { body: remixPng, contentType: "image/png" },
                ),
            ]);
          }
          expect(
            beyondHash,
            `Gem Waster ${selectorState.name}-cost full screen in ${theme} at ${viewport.width}x${viewport.height}`,
          ).toBe(remixHash);
        } finally {
          await sourceContext.close().catch(() => undefined);
        }
      });
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of viewports) {
    test(`matches Remix when Gem Waster is not owned in ${theme} theme at ${viewport.width}x${viewport.height}`, async ({
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
      ) as CraftVisualFixture;
      const sourceControl =
        fixture.data.pickaxeCraftingSemantics.craftControls.controls.find(
          ({ name }) => name === "gem-waster-not-owned",
        );
      if (!sourceControl) {
        throw new Error(
          "Pinned Gem Waster not-owned control state is missing.",
        );
      }
      expect(sourceControl.input).toEqual({
        usedGemsLevel: 0,
        moneyGemWasterLevel: 0,
        gemUpgradeWasterLevel: 2,
      });
      expect(sourceControl.displayedGemCost).toBe("1");
      expect(sourceControl.buttons).toEqual([]);

      const save = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      save.gems = "1000";
      save.mineObjectLevel = 0;
      save.highestMineObjectLevel = 0;
      save.usedGemsLevel = sourceControl.input.usedGemsLevel;
      save.lastActive = fixedClock;
      save.settings["tab"] = "main";
      save.settings["theme"] = theme;
      save.upgrades = {
        gemWaster: { level: sourceControl.input.moneyGemWasterLevel },
      };
      save.gemUpgrades = {
        gemWaster: { level: sourceControl.input.gemUpgradeWasterLevel },
      };
      save.planetCoinUpgrades = {};
      save.powers.data.values = ["1", "1", "1", "1", "1"];
      save.powers.upgrades = {};
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
        await page.setViewportSize(viewport);
        await Promise.all([
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
            { timeout: 30_000 },
          ),
          sourcePage.waitForFunction(() =>
            Boolean(
              (window as Window & { game?: unknown }).game &&
              document.querySelector("#app > footer"),
            ),
          ),
        ]);
        await Promise.all([
          expect(page.locator("body")).toHaveAttribute("data-theme", theme),
          sourcePage.waitForFunction(
            (selectedTheme) =>
              document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
                null &&
              document
                .querySelector<HTMLLinkElement>("#css_theme")
                ?.getAttribute("href") === `Themes/${selectedTheme}.css`,
            theme,
          ),
        ]);

        await Promise.all([
          expect(page.locator("[data-craft-gem-level]")).toHaveCount(0),
          expect(
            sourcePage.locator(".craft-pickaxe button.level-change"),
          ).toHaveCount(0),
          expect(page.locator("[data-craft-gem-cost]")).toContainText(
            sourceControl.displayedGemCost,
          ),
          expect(
            sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
          ).toContainText(sourceControl.displayedGemCost),
        ]);

        const [beyondPng, remixPng] = await Promise.all([
          waitForStableScreen(page, viewport),
          waitForStableScreen(sourcePage, viewport),
        ]);
        const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
        const remixHash = createHash("sha256").update(remixPng).digest("hex");
        if (beyondHash !== remixHash) {
          await Promise.all([
            test.info().attach(`gem-waster-not-owned-${theme}-beyond.png`, {
              body: beyondPng,
              contentType: "image/png",
            }),
            test.info().attach(`gem-waster-not-owned-${theme}-remix.png`, {
              body: remixPng,
              contentType: "image/png",
            }),
          ]);
        }
        expect(
          beyondHash,
          `Gem Waster not-owned screen in ${theme} at ${viewport.width}x${viewport.height}`,
        ).toBe(remixHash);
      } finally {
        await sourceContext.close().catch(() => undefined);
      }
    });
  }
}
