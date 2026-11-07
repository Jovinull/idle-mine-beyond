import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

test("imports a minimized historical-shaped save through Settings", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-historical-save-shape.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    input: Record<string, unknown> & {
      money: string;
      highestMoney: string;
      gems: string;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      pickaxe: { name: string; pow: string; quality: string };
    };
  };
  const encoded = encodeRemixLegacySave(fixture.input);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await sourcePage.addInitScript(() => {
      localStorage.clear();
      Date.now = () => 1_704_067_200_000;
    });
    await sourcePage.goto(sourceUrl);
    await expect(sourcePage.locator("#app > footer")).toBeVisible();
    await sourcePage.getByRole("button", { name: /Settings/ }).click();
    const sourceSettings = sourcePage.locator("article.settings");
    await sourceSettings.locator("textarea").fill(encoded);
    await sourceSettings
      .getByRole("button", { name: "Import (from Text Field)" })
      .click();

    await page.addInitScript(() => {
      localStorage.clear();
      Date.now = () => 1_704_067_200_000;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await page.locator("[data-game-tab='settings']").click();

    const settings = page.locator("article.settings");
    await settings.locator("[data-settings-save-field]").fill(encoded);
    await settings
      .getByRole("button", { name: "Import (from Text Field)" })
      .click();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("IdleMineBeyond")))
      .not.toBeNull();
    const imported = await page.evaluate(() => {
      const value = localStorage.getItem("IdleMineBeyond");
      if (!value) throw new Error("Imported Beyond save was not persisted.");
      return JSON.parse(value) as {
        state: {
          simulation: {
            mineObjectLevel: number;
            highestMineObjectLevel: number;
            resources: {
              money: string;
              highestMoney: string;
              gems: string;
              planetCoins: string;
              wisdom: string;
            };
            pickaxe: { name: string; power: string; quality: string };
          };
        };
      };
    });

    expect(imported.state.simulation).toMatchObject({
      mineObjectLevel: fixture.input.mineObjectLevel,
      highestMineObjectLevel: fixture.input.highestMineObjectLevel,
      resources: {
        money: fixture.input.money,
        highestMoney: fixture.input.highestMoney,
        gems: fixture.input.gems,
        planetCoins: "0",
        wisdom: "0",
      },
      pickaxe: {
        name: fixture.input.pickaxe.name,
        power: fixture.input.pickaxe.pow,
        quality: fixture.input.pickaxe.quality,
      },
    });
    expect(
      await page.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBeNull();

    await sourcePage
      .locator("article.settings button")
      .filter({ hasText: "Export" })
      .click();
    await settings.locator("[data-settings-export]").click();
    const [sourceExport, beyondExport] = await Promise.all([
      sourcePage.locator("article.settings textarea").inputValue(),
      settings.locator("[data-settings-save-field]").inputValue(),
    ]);
    const sourceDecoded = decodeRemixLegacySave(sourceExport);
    const beyondDecoded = decodeRemixLegacySave(beyondExport);
    if (
      sourceDecoded.status !== "success" ||
      beyondDecoded.status !== "success"
    ) {
      throw new Error("The source or Beyond export could not be decoded.");
    }
    const sourceObject = sourceDecoded.value as Record<string, unknown>;
    const beyondObject = beyondDecoded.value as Record<string, unknown>;
    const topLevelDifferences = Array.from(
      new Set([...Object.keys(sourceObject), ...Object.keys(beyondObject)]),
    )
      .filter(
        (key) =>
          JSON.stringify(sourceObject[key]) !==
          JSON.stringify(beyondObject[key]),
      )
      .map((key) => ({
        key,
        source: sourceObject[key],
        beyond: beyondObject[key],
      }));
    if (topLevelDifferences.length > 0) {
      throw new Error(
        `Source/Beyond exports differ: ${JSON.stringify(topLevelDifferences)}`,
      );
    }
    expect(beyondExport).toBe(sourceExport);
  } finally {
    await sourceContext.close();
  }
});
