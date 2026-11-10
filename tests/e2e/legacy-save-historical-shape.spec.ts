import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
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
      settings: { numberFormatterIndex: number };
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

    // The captured timestamp is only 60 seconds old, so Remix applies the
    // import without writing either save slot.
    expect(
      await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
    ).toBeNull();
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBeNull();
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

    const [sourceNumberFormat, beyondNumberFormat] = await Promise.all([
      sourceSettings.locator("select").evaluate((element) => {
        const select = element as HTMLSelectElement;
        return {
          selectedIndex: select.selectedIndex,
          selectedLabel: select.selectedOptions[0]?.textContent?.trim() ?? "",
        };
      }),
      settings.locator("select").evaluate((element) => {
        const select = element as HTMLSelectElement;
        return {
          selectedIndex: select.selectedIndex,
          selectedLabel: select.selectedOptions[0]?.textContent?.trim() ?? "",
        };
      }),
    ]);
    expect(beyondNumberFormat, "imported number-format selection").toEqual(
      sourceNumberFormat,
    );
    expect(sourceNumberFormat).toEqual({
      selectedIndex: -1,
      selectedLabel: "",
    });

    await Promise.all([
      page.mouse.move(1439, 899),
      sourcePage.mouse.move(1439, 899),
      page.evaluate(() => document.fonts.ready),
      sourcePage.evaluate(() => document.fonts.ready),
    ]);
    await Promise.all([
      page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      ),
      sourcePage.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      ),
    ]);
    const [beyondPng, sourcePng] = await Promise.all([
      page.screenshot({ animations: "disabled" }),
      sourcePage.screenshot({ animations: "disabled" }),
    ]);
    const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
    const sourceHash = createHash("sha256").update(sourcePng).digest("hex");
    if (beyondHash !== sourceHash) {
      await Promise.all([
        test.info().attach("historical-save-settings-beyond.png", {
          body: beyondPng,
          contentType: "image/png",
        }),
        test.info().attach("historical-save-settings-remix.png", {
          body: sourcePng,
          contentType: "image/png",
        }),
      ]);
    }
    expect(beyondHash, "historical-save import full-screen pixels").toBe(
      sourceHash,
    );

    await Promise.all([
      page.locator("[data-game-tab='mining']").click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    const [sourceAfterReentry, beyondAfterReentry] = await Promise.all([
      sourceSettings.locator("select").evaluate((element) => {
        const select = element as HTMLSelectElement;
        return {
          selectedIndex: select.selectedIndex,
          selectedLabel: select.selectedOptions[0]?.textContent?.trim() ?? "",
        };
      }),
      settings.locator("select").evaluate((element) => {
        const select = element as HTMLSelectElement;
        return {
          selectedIndex: select.selectedIndex,
          selectedLabel: select.selectedOptions[0]?.textContent?.trim() ?? "",
        };
      }),
    ]);
    expect(
      beyondAfterReentry,
      "number-format selection after tab reentry",
    ).toEqual(sourceAfterReentry);
  } finally {
    await sourceContext.close();
  }
});
