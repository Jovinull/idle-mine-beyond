import { expect, test } from "@playwright/test";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

test("matches the live Settings import of a canonical four-byte name", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
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
      Date.now = () => 1_793_865_600_000;
    });
    await sourcePage.goto(sourceUrl);
    await expect(sourcePage.locator("#app > footer")).toBeVisible();

    const sourceInput = await sourcePage.evaluate(() => {
      const remix = window as unknown as {
        game: { pickaxe: { name: string } };
        functions: { getSaveString(): string };
      };
      remix.game.pickaxe.name = "Pickaxe 🚀";
      return remix.functions.getSaveString();
    });

    await sourcePage.getByRole("button", { name: /Settings/ }).click();
    const sourceSettings = sourcePage.locator("article.settings");
    await sourceSettings.locator("textarea").fill(sourceInput);
    await sourceSettings
      .getByRole("button", { name: "Import (from Text Field)" })
      .click();
    const sourceImportedNameCodeUnits = await sourcePage.evaluate(() => {
      const remix = window as unknown as {
        game: { pickaxe: { name: string } };
      };
      return Array.from(
        { length: remix.game.pickaxe.name.length },
        (_, index) => remix.game.pickaxe.name.charCodeAt(index),
      );
    });

    await page.addInitScript(() => {
      localStorage.clear();
      Date.now = () => 1_793_865_600_000;
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await page.locator("[data-game-tab='settings']").click();
    const settings = page.locator("article.settings");
    await settings.locator("[data-settings-save-field]").fill(sourceInput);
    await settings
      .getByRole("button", { name: "Import (from Text Field)" })
      .click();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("IdleMineBeyond")))
      .not.toBeNull();
    const beyondImportedNameCodeUnits = await page.evaluate(() => {
      const raw = localStorage.getItem("IdleMineBeyond");
      if (!raw) throw new Error("Imported Beyond save was not persisted.");
      const saved = JSON.parse(raw) as {
        state: { simulation: { pickaxe: { name: string } } };
      };
      const name = saved.state.simulation.pickaxe.name;
      return Array.from({ length: name.length }, (_, index) =>
        name.charCodeAt(index),
      );
    });
    const initialNameCodeUnits = [
      ...Array.from("Pickaxe ", (character) => character.charCodeAt(0)),
      0xf0,
      0x9f,
      0x9a,
      0x80,
    ];
    expect(sourceImportedNameCodeUnits).toEqual(initialNameCodeUnits);
    expect(beyondImportedNameCodeUnits).toEqual(sourceImportedNameCodeUnits);

    await sourceSettings
      .locator("button")
      .filter({ hasText: "Export" })
      .click();
    await settings.locator("[data-settings-export]").click();
    const [sourceExport, beyondExport] = await Promise.all([
      sourceSettings.locator("textarea").inputValue(),
      settings.locator("[data-settings-save-field]").inputValue(),
    ]);
    expect(beyondExport, "complete live legacy export").toBe(sourceExport);

    const readExport = (target: typeof page, encoded: string) =>
      target.evaluate((value) => {
        const decoded = unescape(decodeURIComponent(atob(value)));
        const save = JSON.parse(decoded) as {
          pickaxe: { name: string };
        };
        return {
          decoded,
          name: save.pickaxe.name,
          nameCodeUnits: Array.from(
            { length: save.pickaxe.name.length },
            (_, index) => save.pickaxe.name.charCodeAt(index),
          ),
        };
      }, encoded);
    const [sourceResult, beyondResult] = await Promise.all([
      readExport(sourcePage, sourceExport),
      readExport(page, beyondExport),
    ]);
    expect(beyondResult, "decoded save after Settings import").toEqual(
      sourceResult,
    );
    expect(sourceResult.nameCodeUnits).toEqual([
      ...Array.from("Pickaxe ", (character) => character.charCodeAt(0)),
      0xc3,
      0xb0,
      0xc2,
      0x9f,
      0xc2,
      0x9a,
      0xc2,
      0x80,
    ]);
  } finally {
    await Promise.all([sourcePage.close(), sourceContext.close()]);
  }
});
