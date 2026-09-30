import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

type StoryRuntimeFixture = {
  freshGame: {
    chapterHeading: string;
    objectiveHtml: string;
  };
};

type SettingsRuntimeFixture = {
  data: {
    initialState: {
      minimumCraftDamage: { decimal: string };
      numberFormatters: string[];
      settings: {
        numberFormatterIndex: number;
        showMineObjLevel: boolean;
        showMinCraftDamage: boolean;
        theme: string;
      };
      story: { highestUnlocked: number };
    };
    saveApplicationSemantics: {
      inputJson: string;
      resources: { money: { decimal: string } };
    };
  };
};

test("connects the persistent game session to mining and the Story tab", async ({
  page,
}) => {
  const story = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as StoryRuntimeFixture;
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(
    page.getByRole("heading", { name: "Idle Mine: Remix" }),
  ).toBeVisible();
  await expect(page.locator("[data-mine-object-hp]")).toHaveText("100");

  await page.locator("canvas.mine-object[data-damageable='true']").click();
  await expect(page.locator("[data-mine-object-hp]")).toHaveText("80");

  const moneyUpgrades = page.locator('[data-upgrade-group="money"]');
  await expect(moneyUpgrades).toHaveCount(8);
  await expect(moneyUpgrades.nth(0)).toHaveAttribute(
    "data-upgrade-key",
    "blacksmith",
  );
  await moneyUpgrades.nth(0).hover();
  const blacksmithDetails = page.locator('[data-upgrade-details="blacksmith"]');
  await expect(blacksmithDetails.locator("h3")).toHaveText("Blacksmith");
  await expect(blacksmithDetails).toContainText("20 → 32");
  await expect(blacksmithDetails).toContainText("$ 30");

  const storyTab = page.locator("[data-game-tab='story']");
  await expect(storyTab.locator(".notification")).toBeVisible();
  await storyTab.click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
  await expect(page.locator(".objective")).toHaveJSProperty(
    "innerHTML",
    story.freshGame.objectiveHtml,
  );
  await expect(storyTab.locator(".notification")).toHaveCount(0);

  await page.locator("[data-story-action='increaseStoryPage']").click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
  await page.locator("[data-game-tab='mining']").click();
  await page.locator("[data-game-tab='story']").click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    story.freshGame.chapterHeading,
  );
});

test("buys the source-priced Blacksmith with single and modifier controls", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const save = {
      money: "1e100",
      gems: 5,
      story: {},
      upgrades: { blacksmith: { level: 0 } },
    };
    const encoded = btoa(escape(encodeURIComponent(JSON.stringify(save))));
    localStorage.setItem("IdleMine", encoded);
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");

  const blacksmith = page.locator(
    '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
  );
  await expect(blacksmith).not.toHaveClass(/cantafford/);
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "1");
  await page.keyboard.down("Shift");
  await expect(
    page.locator('[data-upgrade-details="blacksmith"] .multibuy.active'),
  ).toHaveText("Hold SHIFT to buy 10");
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "10");

  await page.keyboard.down("Control");
  await expect(
    page.locator('[data-upgrade-details="blacksmith"] .multibuy.active'),
  ).toHaveText("Hold CTRL to buy 100");
  await blacksmith.click();
  await expect(blacksmith).toHaveAttribute("data-upgrade-level", "100");
  await page.keyboard.up("Control");
  await page.keyboard.up("Shift");
});

test("applies and saves source-backed Settings preferences", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  const { initialState } = reference.data;

  await page.addInitScript(() => {
    if (sessionStorage.getItem("settings-e2e-started") !== "true") {
      localStorage.clear();
      sessionStorage.setItem("settings-e2e-started", "true");
    }
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  await expect(settings.locator("h2")).toHaveText("Settings");
  const notationSelect = settings.locator("#numberformatselect");
  await expect(notationSelect.locator("option")).toHaveText(
    initialState.numberFormatters,
  );
  await expect(notationSelect).toHaveValue(
    String(initialState.settings.numberFormatterIndex),
  );

  await notationSelect.selectOption("3");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    initialState.numberFormatters[3]!,
  );
  await settings.getByLabel("Show Mineral Level").check();
  await settings
    .getByLabel("Show minimum Base Damage for crafted Pickaxes")
    .check();
  await settings.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(54, 54, 54)",
  );
  await expect(page.locator("body")).toHaveCSS("color", "rgb(193, 193, 193)");
  await settings.getByRole("button", { name: "Save" }).click();

  await page.locator("[data-game-tab='mining']").click();
  await expect(page.locator("[data-mine-object-level]")).toHaveText("#1");
  await expect(page.locator("[data-minimum-craft-damage]")).toContainText(
    initialState.minimumCraftDamage.decimal,
  );
  await expect(page.locator(".messagelog")).toContainText("Game Saved!");
  const savedSettings = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Manual save was not written.");
    return (JSON.parse(serialized) as { state: { settings: unknown } }).state
      .settings;
  });
  expect(savedSettings).toMatchObject({
    numberFormatterIndex: 3,
    showMineObjLevel: true,
    showMinCraftDamage: true,
    theme: "dark",
  });

  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    initialState.numberFormatters[3]!,
  );
  await page.locator("[data-game-tab='settings']").click();
  await expect(notationSelect).toHaveValue("3");
  await expect(settings.getByLabel("Show Mineral Level")).toBeChecked();
  await expect(
    settings.getByLabel("Show minimum Base Damage for crafted Pickaxes"),
  ).toBeChecked();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(54, 54, 54)",
  );
});

test("exports and imports the pinned legacy save through the Settings text field", async ({
  page,
}) => {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SettingsRuntimeFixture;
  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  const saveField = settings.locator("[data-settings-save-field]");
  await settings.getByRole("button", { name: "Export" }).click();
  const exported = await saveField.inputValue();
  expect(exported).not.toBe("Exported String will appear here...");
  const exportedValue = await page.evaluate((encoded) => {
    const decoded = decodeURIComponent(atob(encoded));
    return JSON.parse(unescape(decoded)) as {
      money: string;
      gems: string;
      story: { highestUnlocked: number };
      settings: { theme: string };
    };
  }, exported);
  expect(exportedValue).toMatchObject({
    money: "0",
    gems: "5",
    settings: { theme: "light" },
  });
  expect(Number.isInteger(exportedValue.story.highestUnlocked)).toBe(true);
  expect(
    await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
  ).toBe(null);

  const legacyJson = reference.data.saveApplicationSemantics.inputJson;
  const legacyString = await page.evaluate((json) => {
    return btoa(escape(encodeURIComponent(json)));
  }, legacyJson);
  await saveField.fill(legacyString);
  await settings
    .getByRole("button", { name: "Import (from Text Field)" })
    .click();

  await expect(page.locator("#app")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#app")).toHaveAttribute(
    "data-number-formatter",
    reference.data.initialState.numberFormatters[3]!,
  );
  await expect(page.locator("[data-game-tab='settings']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const imported = await page.evaluate(() => {
    const serialized = localStorage.getItem("IdleMineBeyond");
    if (!serialized) throw new Error("Imported save was not persisted.");
    return JSON.parse(serialized) as {
      state: {
        simulation: { resources: { money: string }; mineObjectLevel: number };
        settings: {
          tab: string;
          numberFormatterIndex: number;
          showMineObjLevel: boolean;
          showMinCraftDamage: boolean;
          theme: string;
        };
      };
    };
  });
  expect(imported.state.simulation.resources.money).toBe(
    reference.data.saveApplicationSemantics.resources.money.decimal,
  );
  expect(imported.state.simulation.mineObjectLevel).toBe(3);
  expect(imported.state.settings).toMatchObject({
    tab: "settings",
    numberFormatterIndex: 3,
    showMineObjLevel: true,
    showMinCraftDamage: true,
    theme: "dark",
  });
});
