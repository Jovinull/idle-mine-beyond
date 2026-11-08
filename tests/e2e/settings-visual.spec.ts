import { expect, test, type Locator } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { createFreshBeyondVisualSave } from "./visual-state.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type SettingsVisualFixture = {
  data: {
    initialState: { numberFormatters: string[] };
    saveExportSemantics: {
      fresh: {
        object: {
          lastActive: number;
          settings: {
            tab: string;
            numberFormatterIndex: number;
            theme: string;
          };
        };
      };
    };
  };
};

async function setVisiblePreferences(
  settings: Locator,
  notation: string | { index: number },
) {
  await settings.locator("select").selectOption(notation);
  await settings.getByLabel("Show Mineral Level").check();
  await settings
    .getByLabel("Show minimum Base Damage for crafted Pickaxes")
    .check();
}

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport: { width: 1440, height: 900 },
});

for (const theme of ["light", "dark"] as const) {
  test(`matches the fresh Remix Settings ${theme} screen`, async ({ page }) => {
    const fixedClock = 1_704_067_200_000;
    const serialized = await createFreshBeyondVisualSave({
      clockMs: fixedClock,
      theme,
      tab: "settings",
    });
    await page.addInitScript(
      ({ now, save }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", save);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
      },
      { now: fixedClock, save: serialized },
    );
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("[data-settings-panel]")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Idle Mine", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://www.kongregate.com/games/crovie/idle-mine",
    );
    await expect(
      page.getByRole("link", { name: "ad-notations", exact: true }),
    ).toHaveAttribute(
      "href",
      "https://github.com/antimatter-dimensions/notations",
    );
    const socialLinks = page.locator("article.settings .social a");
    await expect(socialLinks).toHaveCount(3);
    for (const [index, href] of [
      "https://www.youtube.com/veprogames",
      "https://veprogames.github.io",
      "https://idle-mine-remix.fandom.com/wiki/",
    ].entries()) {
      await expect(socialLinks.nth(index)).toHaveAttribute("href", href);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1439, 899);
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        animation.pause();
        animation.currentTime = 0;
      }
    });

    await expect(page).toHaveScreenshot(
      `settings-fresh-${theme}-1440x900.png`,
      { maxDiffPixels: 0 },
    );
  });
}

test("matches Remix after changing and saving Settings preferences", async ({
  browser,
  page,
}) => {
  const fixedClock = 1_704_067_200_000;
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsVisualFixture;
  const legacySave = structuredClone(
    fixture.data.saveExportSemantics.fresh.object,
  );
  legacySave.lastActive = fixedClock;
  legacySave.settings.tab = "settings";
  const encoded = encodeRemixLegacySave(legacySave);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = ({ now, save }: { now: number; save: string }) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", save);
    Date.now = () => now;
  };

  const compareScreen = async (name: string) => {
    const beyondViewportWidth = page.viewportSize()?.width ?? 1440;
    const remixViewportWidth = sourcePage.viewportSize()?.width ?? 1440;
    await Promise.all([
      page.mouse.move(beyondViewportWidth - 1, 0),
      sourcePage.mouse.move(remixViewportWidth - 1, 0),
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
    const [beyondPng, remixPng] = await Promise.all([
      page.screenshot({ animations: "disabled" }),
      sourcePage.screenshot({ animations: "disabled" }),
    ]);
    const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
    const remixHash = createHash("sha256").update(remixPng).digest("hex");
    if (beyondHash !== remixHash) {
      await Promise.all([
        test.info().attach(`${name}-beyond.png`, {
          body: beyondPng,
          contentType: "image/png",
        }),
        test.info().attach(`${name}-remix.png`, {
          body: remixPng,
          contentType: "image/png",
        }),
      ]);
    }
    expect(beyondHash, `${name} full-screen pixels`).toBe(remixHash);
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, { now: fixedClock, save: encoded }),
      sourcePage.addInitScript(initializePage, {
        now: fixedClock,
        save: encoded,
      }),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(
      ({ formatterName, theme }) => {
        const game = (
          window as Window & {
            game?: { numberFormatter?: { name?: string } };
          }
        ).game;
        const themeStylesheet =
          document.querySelector<HTMLLinkElement>("#css_theme");
        return (
          Boolean(game && document.querySelector("#app > footer")) &&
          game?.numberFormatter?.name === formatterName &&
          themeStylesheet !== null &&
          themeStylesheet.sheet !== null &&
          themeStylesheet?.getAttribute("href") === `Themes/${theme}.css`
        );
      },
      {
        formatterName:
          fixture.data.initialState.numberFormatters[
            legacySave.settings.numberFormatterIndex
          ]!,
        theme: legacySave.settings.theme,
      },
    );
    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);

    const beyondSettings = page.locator("article.settings");
    const remixSettings = sourcePage.locator("article.settings");
    await Promise.all([
      expect(beyondSettings).toBeVisible(),
      expect(remixSettings).toBeVisible(),
    ]);
    await compareScreen("settings-initial-light");

    await Promise.all([
      setVisiblePreferences(beyondSettings, "3"),
      setVisiblePreferences(remixSettings, { index: 3 }),
    ]);
    await expect(beyondSettings.locator("#numberformatselect")).toHaveValue(
      "3",
    );
    await expect(remixSettings.locator("select")).toHaveValue(
      fixture.data.initialState.numberFormatters[3]!,
    );
    await expect(beyondSettings.getByLabel("Show Mineral Level")).toBeChecked();
    await expect(remixSettings.getByLabel("Show Mineral Level")).toBeChecked();
    await compareScreen("settings-preferences-light");

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Dark" }).click(),
      remixSettings.getByRole("button", { name: "Dark" }).click(),
    ]);
    await Promise.all([
      expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(54, 54, 54)",
      ),
      sourcePage.waitForFunction(
        () =>
          document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
            null &&
          getComputedStyle(document.body).backgroundColor === "rgb(54, 54, 54)",
      ),
    ]);
    await compareScreen("settings-preferences-dark");

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Save" }).click(),
      remixSettings.getByRole("button", { name: "Save" }).click(),
    ]);
    const [beyondSaved, remixSaved] = await Promise.all([
      page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beyondSaved, "Beyond manual save").not.toBeNull();
    expect(remixSaved, "Remix manual save").not.toBeNull();
    await compareScreen("settings-preferences-saved");

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Export" }).click(),
      remixSettings.getByRole("button", { name: "Export" }).click(),
    ]);
    const [beyondExport, remixExport] = await Promise.all([
      beyondSettings.locator("textarea").inputValue(),
      remixSettings.locator("textarea").inputValue(),
    ]);
    expect(beyondExport, "Settings export text").toBe(remixExport);
    await compareScreen("settings-export-dark");

    await Promise.all([
      page.setViewportSize({ width: 1366, height: 768 }),
      sourcePage.setViewportSize({ width: 1366, height: 768 }),
    ]);
    await compareScreen("settings-export-dark-1366x768");
    await Promise.all([
      page.setViewportSize({ width: 1440, height: 900 }),
      sourcePage.setViewportSize({ width: 1440, height: 900 }),
    ]);

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Light" }).click(),
      remixSettings.getByRole("button", { name: "Light" }).click(),
    ]);
    await Promise.all([
      expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(250, 250, 250)",
      ),
      sourcePage.waitForFunction(
        () =>
          document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
            null &&
          getComputedStyle(document.body).backgroundColor ===
            "rgb(250, 250, 250)",
      ),
    ]);
    await compareScreen("settings-preferences-light-after-dark");

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Save" }).click(),
      remixSettings.getByRole("button", { name: "Save" }).click(),
    ]);
    const [beyondSavedLight, remixSavedLight] = await Promise.all([
      page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(
      beyondSavedLight,
      "Beyond manual save in light theme",
    ).not.toBeNull();
    expect(remixSavedLight, "Remix manual save in light theme").not.toBeNull();
    await compareScreen("settings-preferences-saved-light");

    await Promise.all([
      beyondSettings.getByRole("button", { name: "Export" }).click(),
      remixSettings.getByRole("button", { name: "Export" }).click(),
    ]);
    const [beyondExportLight, remixExportLight] = await Promise.all([
      beyondSettings.locator("textarea").inputValue(),
      remixSettings.locator("textarea").inputValue(),
    ]);
    expect(beyondExportLight, "Settings export text in light theme").toBe(
      remixExportLight,
    );
    await compareScreen("settings-export-light");

    await Promise.all([
      page.setViewportSize({ width: 1366, height: 768 }),
      sourcePage.setViewportSize({ width: 1366, height: 768 }),
    ]);
    await compareScreen("settings-export-light-1366x768");
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
