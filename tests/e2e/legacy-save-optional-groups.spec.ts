import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
const seedKey = "legacy-save-optional-groups-seeded";

type LegacySave = {
  lastActive: number;
  usedGemsLevel: number;
  money: string;
  gems: string;
  planetCoins: string;
  wisdom: string;
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
  timer: { autoPickaxe: number; save: number };
  settings: { tab: string; theme: string };
};

type OptionalGroupFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    saveSemantics: {
      missingOptionalGroups: { inputJson: string };
      emptyPresentGroups: { inputJson: string };
      powerValueReloadSemantics: {
        extendedInputJson: string;
        shortInputJson: string;
        afterExtended: string[];
        afterShort: string[];
      };
    };
    saveExportSemantics: {
      variants: { name: string; inputJson?: string }[];
    };
  };
};

type ExportedSave = {
  money: string;
  gems: string;
  usedGemsLevel: number;
  planetCoins: string;
  wisdom: string;
  lastActive: number;
  settings: { tab: string; theme: string; numberFormatterIndex: number };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
  timer: { autoPickaxe: number; save: number };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as OptionalGroupFixture;
const highMagnitudeDecimalSave = fixture.data.saveExportSemantics.variants.find(
  (variant) => variant.name === "high-magnitude-decimal-fields",
);
const variedUpgradeSave = fixture.data.saveExportSemantics.variants.find(
  (variant) => variant.name === "varied-settings-and-all-upgrades",
);
if (!highMagnitudeDecimalSave?.inputJson) {
  throw new Error("Missing the captured high-magnitude Decimal save.");
}
if (!variedUpgradeSave?.inputJson) {
  throw new Error("Missing the captured varied all-upgrade save.");
}

async function encodeWithPinnedRuntime(
  page: Page,
  save: unknown,
): Promise<string> {
  return page.evaluate((value) => {
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error("Pinned save input is not JSON.");
    return btoa(escape(encodeURIComponent(json)));
  }, save);
}

async function encodeJsonWithPinnedRuntime(
  page: Page,
  inputJson: string,
): Promise<string> {
  return encodeWithPinnedRuntime(page, JSON.parse(inputJson));
}

function makeSeedSave(): LegacySave {
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.lastActive = fixedTime;
  return save;
}

function seedPage({
  encoded,
  key,
  time,
}: {
  encoded: string;
  key: string;
  time: number;
}) {
  if (sessionStorage.getItem(key) !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem(key, "true");
  }
  Date.now = () => time;
}

function seedFreshPage({ key, time }: { key: string; time: number }): void {
  if (sessionStorage.getItem(key) !== "true") {
    localStorage.clear();
    sessionStorage.setItem(key, "true");
  }
  Date.now = () => time;
}

async function setSaveAndReload(
  page: Page,
  sourcePage: Page,
  encoded: string,
): Promise<void> {
  await Promise.all(
    [page, sourcePage].map((currentPage) =>
      currentPage.evaluate((save) => {
        localStorage.clear();
        localStorage.setItem("IdleMine", save);
      }, encoded),
    ),
  );
  await Promise.all([page.reload(), sourcePage.reload()]);
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await sourcePage.waitForFunction(() =>
    Boolean((window as Window & { game?: unknown }).game),
  );
}

async function selectSettings(page: Page, sourcePage: Page): Promise<void> {
  await Promise.all([
    page.locator("[data-game-tab='settings']").click(),
    sourcePage.locator("footer button").filter({ hasText: "Settings" }).click(),
  ]);
  await expect(page.locator("[data-settings-save-field]")).toBeVisible();
  await expect(sourcePage.locator("article.settings textarea")).toBeVisible();
}

async function importAndExport(
  page: Page,
  sourcePage: Page,
  encodedImport: string,
): Promise<[string, string]> {
  const beyondField = page.locator("[data-settings-save-field]");
  const sourceField = sourcePage.locator("article.settings textarea");
  await Promise.all([
    beyondField.fill(encodedImport),
    sourceField.fill(encodedImport),
  ]);
  await Promise.all([
    page.getByRole("button", { name: "Import (from Text Field)" }).click(),
    sourcePage
      .locator("article.settings")
      .getByRole("button", { name: "Import (from Text Field)" })
      .click(),
  ]);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await Promise.all([
    page.getByRole("button", { name: "Export" }).click(),
    sourcePage
      .locator("article.settings")
      .getByRole("button", { name: "Export" })
      .click(),
  ]);
  return Promise.all([beyondField.inputValue(), sourceField.inputValue()]);
}

async function decodeExport(
  page: Page,
  encoded: string,
): Promise<ExportedSave> {
  return page.evaluate((value) => {
    const decoded = unescape(decodeURIComponent(atob(value)));
    return JSON.parse(decoded) as ExportedSave;
  }, encoded);
}

test("matches Remix imports with optional groups and varied all-upgrade state", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const seedSave = makeSeedSave();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const encodedSeedSave = await encodeWithPinnedRuntime(sourcePage, seedSave);
    await Promise.all([
      page.addInitScript(seedPage, {
        encoded: encodedSeedSave,
        key: seedKey,
        time: fixedTime,
      }),
      sourcePage.addInitScript(seedPage, {
        encoded: encodedSeedSave,
        key: seedKey,
        time: fixedTime,
      }),
    ]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );

    const cases = [
      {
        name: "absent optional groups",
        inputJson: fixture.data.saveSemantics.missingOptionalGroups.inputJson,
        expected: {
          money: "0",
          gems: "0",
          planetCoins: "0",
          wisdom: "0",
          moneyUpgrade: 4,
          gemUpgrade: 0,
          planetCoinUpgrade: 0,
          wisdomUpgrade: 7,
          power: "2",
          pickaxe: { name: "Probe Pickaxe", pow: "123", quality: "4" },
          theme: "dark",
          settingsTab: "settings",
        },
      },
      {
        name: "present empty optional groups",
        inputJson: fixture.data.saveSemantics.emptyPresentGroups.inputJson,
        expected: {
          money: "0",
          gems: "0",
          planetCoins: "0",
          wisdom: "0",
          moneyUpgrade: 4,
          gemUpgrade: 5,
          planetCoinUpgrade: 6,
          wisdomUpgrade: 0,
          power: "2",
          pickaxe: { name: "Toy Pickaxe", pow: "0", quality: "0" },
          theme: "dark",
          settingsTab: "settings",
        },
      },
      {
        name: "varied resources, settings, and all upgrade groups",
        inputJson: fixture.data.saveExportSemantics.variants.find(
          (variant) => variant.name === "varied-settings-and-all-upgrades",
        )!.inputJson!,
        expected: {
          money: "314159.265",
          gems: "12345",
          planetCoins: "6789",
          wisdom: "9876",
          moneyUpgrade: 8,
          gemUpgrade: 9,
          planetCoinUpgrade: 8,
          wisdomUpgrade: 5,
          power: "11",
          pickaxe: {
            name: "Deep export probe",
            pow: "456",
            quality: "7.5",
          },
          theme: "dark",
          settingsTab: "settings",
        },
      },
      {
        name: "high-magnitude Decimal resources, Powers, and pickaxe fields",
        inputJson: highMagnitudeDecimalSave.inputJson!,
        expected: null,
      },
    ] as const;

    for (const scenario of cases) {
      await test.step(scenario.name, async () => {
        await setSaveAndReload(page, sourcePage, encodedSeedSave);
        await selectSettings(page, sourcePage);
        const encodedImport = await encodeJsonWithPinnedRuntime(
          sourcePage,
          scenario.inputJson,
        );
        const [beyondExport, sourceExport] = await importAndExport(
          page,
          sourcePage,
          encodedImport,
        );
        const [result, sourceResult] = await Promise.all([
          decodeExport(page, beyondExport),
          decodeExport(sourcePage, sourceExport),
        ]);
        expect(result, `${scenario.name} complete source export`).toEqual(
          sourceResult,
        );
        if (scenario.expected === null) {
          expect(beyondExport, `${scenario.name} encoded save`).toBe(
            sourceExport,
          );
          return;
        }
        expect(result.money).toBe(scenario.expected.money ?? "0");
        expect(result.gems).toBe(scenario.expected.gems ?? "0");
        expect(result.planetCoins).toBe(scenario.expected.planetCoins ?? "0");
        expect(result.wisdom).toBe(scenario.expected.wisdom ?? "0");
        expect(result.upgrades["idleSpeed"]!.level).toBe(
          scenario.expected.moneyUpgrade,
        );
        expect(result.gemUpgrades["offlineGems"]!.level).toBe(
          scenario.expected.gemUpgrade,
        );
        expect(result.planetCoinUpgrades["offlinePC"]!.level).toBe(
          scenario.expected.planetCoinUpgrade,
        );
        expect(result.powers.upgrades["powerPowerActive"]!.level).toBe(
          scenario.expected.wisdomUpgrade,
        );
        expect(result.powers.data.values[0]).toBe(scenario.expected.power);
        expect(result.pickaxe).toEqual(scenario.expected.pickaxe);
        expect(result.settings).toMatchObject({
          tab: scenario.expected.settingsTab,
          theme: scenario.expected.theme,
        });
        if (
          scenario.name === "varied resources, settings, and all upgrade groups"
        ) {
          expect(beyondExport, `${scenario.name} encoded save`).toBe(
            sourceExport,
          );
        }
      });
    }

    const partialInputs: {
      name: string;
      omit:
        | "settings"
        | "upgrades"
        | "gemUpgrades"
        | "planetCoinUpgrades"
        | "powers"
        | "pickaxe";
      check: (result: ExportedSave) => void;
    }[] = [
      {
        name: "settings group absent retains the live formatter",
        omit: "settings",
        check: (result) => expect(result.settings.numberFormatterIndex).toBe(3),
      },
      {
        name: "Money upgrades absent retain live levels",
        omit: "upgrades",
        check: (result) => {
          expect(result.upgrades["idleSpeed"]!.level).toBe(4);
          expect(result.upgrades["blacksmith"]!.level).toBe(0);
        },
      },
      {
        name: "Gem upgrades absent reset the live group",
        omit: "gemUpgrades",
        check: (result) =>
          expect(result.gemUpgrades["offlineGems"]!.level).toBe(0),
      },
      {
        name: "Planet Coin upgrades absent reset the live group",
        omit: "planetCoinUpgrades",
        check: (result) =>
          expect(result.planetCoinUpgrades["offlinePC"]!.level).toBe(0),
      },
      {
        name: "Powers group absent retains values and upgrades",
        omit: "powers",
        check: (result) => {
          expect(result.powers.data.values[0]).toBe("2");
          expect(result.powers.upgrades["powerPowerActive"]!.level).toBe(7);
        },
      },
      {
        name: "pickaxe group absent retains the live tool",
        omit: "pickaxe",
        check: (result) =>
          expect(result.pickaxe).toEqual({
            name: "Probe Pickaxe",
            pow: "123",
            quality: "4",
          }),
      },
    ];

    for (const scenario of partialInputs) {
      await test.step(scenario.name, async () => {
        await setSaveAndReload(page, sourcePage, encodedSeedSave);
        await selectSettings(page, sourcePage);
        const input = JSON.parse(variedUpgradeSave.inputJson!) as Record<
          string,
          unknown
        >;
        delete input[scenario.omit];
        const encodedImport = await encodeWithPinnedRuntime(sourcePage, input);
        const [beyondExport, sourceExport] = await importAndExport(
          page,
          sourcePage,
          encodedImport,
        );
        const [result, sourceResult] = await Promise.all([
          decodeExport(page, beyondExport),
          decodeExport(sourcePage, sourceExport),
        ]);
        expect(result, `${scenario.name} complete source export`).toEqual(
          sourceResult,
        );
        expect(beyondExport, `${scenario.name} encoded save`).toBe(
          sourceExport,
        );
        scenario.check(result);
      });
    }

    for (const scenario of [
      {
        name: "Powers data absent retains values and imports upgrades",
        omit: "data",
        expectedValue: "2",
        expectedUpgrade: 5,
      },
      {
        name: "Powers upgrades absent resets upgrades and imports values",
        omit: "upgrades",
        expectedValue: "11",
        expectedUpgrade: 0,
      },
    ] as const) {
      await test.step(scenario.name, async () => {
        await setSaveAndReload(page, sourcePage, encodedSeedSave);
        await selectSettings(page, sourcePage);
        const input = JSON.parse(variedUpgradeSave.inputJson!) as {
          powers: Record<string, unknown>;
          [key: string]: unknown;
        };
        delete input.powers[scenario.omit];
        const encodedImport = await encodeWithPinnedRuntime(sourcePage, input);
        const [beyondExport, sourceExport] = await importAndExport(
          page,
          sourcePage,
          encodedImport,
        );
        const [result, sourceResult] = await Promise.all([
          decodeExport(page, beyondExport),
          decodeExport(sourcePage, sourceExport),
        ]);
        expect(result, `${scenario.name} complete source export`).toEqual(
          sourceResult,
        );
        expect(beyondExport, `${scenario.name} encoded save`).toBe(
          sourceExport,
        );
        expect(result.powers.data.values[0]).toBe(scenario.expectedValue);
        expect(result.powers.upgrades["powerPowerActive"]!.level).toBe(
          scenario.expectedUpgrade,
        );
      });
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("matches optional-group save import from a fresh runtime", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const initialize = {
      key: "legacy-save-fresh-import-seeded",
      time: fixedTime,
    };
    await Promise.all([
      page.addInitScript(seedFreshPage, initialize),
      sourcePage.addInitScript(seedFreshPage, initialize),
    ]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );

    await selectSettings(page, sourcePage);
    const [beyondExport, sourceExport] = await importAndExport(
      page,
      sourcePage,
      await encodeJsonWithPinnedRuntime(
        sourcePage,
        fixture.data.saveSemantics.missingOptionalGroups.inputJson,
      ),
    );
    const [beyondResult, sourceResult] = await Promise.all([
      decodeExport(page, beyondExport),
      decodeExport(sourcePage, sourceExport),
    ]);
    expect(beyondResult, "complete fresh-runtime export").toEqual(sourceResult);
    expect(beyondExport, "encoded fresh-runtime export").toBe(sourceExport);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("defaults missing lastActive to the injected clock during Settings import", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const encodedSeedSave = await encodeWithPinnedRuntime(
      sourcePage,
      makeSeedSave(),
    );
    const initialize = {
      encoded: encodedSeedSave,
      key: "legacy-save-missing-last-active",
      time: fixedTime,
    };
    await Promise.all([
      page.addInitScript(seedPage, initialize),
      sourcePage.addInitScript(seedPage, initialize),
    ]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await selectSettings(page, sourcePage);

    const input = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as Record<string, unknown>;
    delete input["lastActive"];
    const encodedImport = await encodeWithPinnedRuntime(sourcePage, input);
    const [beyondExport, sourceExport] = await importAndExport(
      page,
      sourcePage,
      encodedImport,
    );
    const [result, sourceResult] = await Promise.all([
      decodeExport(page, beyondExport),
      decodeExport(sourcePage, sourceExport),
    ]);

    expect(result, "complete missing-lastActive export").toEqual(sourceResult);
    expect(beyondExport, "encoded missing-lastActive export").toBe(
      sourceExport,
    );
    expect(result.lastActive).toBe(fixedTime);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("retains extra Power values after importing a shorter save in Settings", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const encodedSeedSave = await encodeWithPinnedRuntime(
      sourcePage,
      makeSeedSave(),
    );
    const initialize = { key: seedKey, time: fixedTime };
    await Promise.all([
      page.addInitScript(seedPage, {
        ...initialize,
        encoded: encodedSeedSave,
      }),
      sourcePage.addInitScript(seedPage, {
        ...initialize,
        encoded: encodedSeedSave,
      }),
    ]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await selectSettings(page, sourcePage);

    const reloadSemantics =
      fixture.data.saveSemantics.powerValueReloadSemantics;
    const encodedExtendedSave = await encodeJsonWithPinnedRuntime(
      sourcePage,
      reloadSemantics.extendedInputJson,
    );
    const [beyondExtendedExport, sourceExtendedExport] = await importAndExport(
      page,
      sourcePage,
      encodedExtendedSave,
    );
    const [beyondExtended, sourceExtended] = await Promise.all([
      decodeExport(page, beyondExtendedExport),
      decodeExport(sourcePage, sourceExtendedExport),
    ]);
    expect(sourceExtended.powers.data.values).toEqual(
      reloadSemantics.afterExtended,
    );
    expect(beyondExtended.powers.data.values).toEqual(
      reloadSemantics.afterExtended,
    );
    expect(beyondExtended, "seven-value complete export").toEqual(
      sourceExtended,
    );
    expect(beyondExtendedExport, "seven-value encoded export").toBe(
      sourceExtendedExport,
    );

    const encodedShortSave = await encodeJsonWithPinnedRuntime(
      sourcePage,
      reloadSemantics.shortInputJson,
    );
    const [beyondShortExport, sourceShortExport] = await importAndExport(
      page,
      sourcePage,
      encodedShortSave,
    );
    const [beyondShort, sourceShort] = await Promise.all([
      decodeExport(page, beyondShortExport),
      decodeExport(sourcePage, sourceShortExport),
    ]);
    expect(sourceShort.powers.data.values).toEqual(reloadSemantics.afterShort);
    expect(beyondShort.powers.data.values).toEqual(reloadSemantics.afterShort);
    expect(beyondShort, "five-then-retained-values complete export").toEqual(
      sourceShort,
    );
    expect(beyondShortExport, "five-then-retained-values encoded export").toBe(
      sourceShortExport,
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("preserves the current Gem Waster selection when importing a legacy save", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const seedSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  seedSave.lastActive = fixedTime;
  seedSave.usedGemsLevel = 1;
  seedSave.upgrades = {
    ...seedSave.upgrades,
    gemWaster: { level: 1 },
  };
  seedSave.settings.tab = "main";

  const importedSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  importedSave.lastActive = fixedTime;
  importedSave.usedGemsLevel = 0;
  importedSave.upgrades = {
    ...importedSave.upgrades,
    gemWaster: { level: 1 },
  };
  importedSave.settings.tab = "main";

  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const [encodedSeed, encodedImport] = await Promise.all([
      encodeWithPinnedRuntime(sourcePage, seedSave),
      encodeWithPinnedRuntime(sourcePage, importedSave),
    ]);
    await Promise.all([
      page.addInitScript(seedPage, {
        encoded: encodedSeed,
        key: "legacy-save-gem-waster-import-seeded",
        time: fixedTime,
      }),
      sourcePage.addInitScript(seedPage, {
        encoded: encodedSeed,
        key: "legacy-save-gem-waster-import-seeded",
        time: fixedTime,
      }),
    ]);
    await page.emulateMedia({ colorScheme: "dark" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );

    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText("1"),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText("1"),
    ]);
    await Promise.all([
      page.locator('[data-craft-gem-level="increase"]').click(),
      sourcePage.locator(".craft-pickaxe button.level-change").last().click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText("3"),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText("3"),
    ]);

    await selectSettings(page, sourcePage);
    const [beyondExport, sourceExport] = await importAndExport(
      page,
      sourcePage,
      encodedImport,
    );
    expect(beyondExport, "complete imported legacy export bytes").toBe(
      sourceExport,
    );
    const [beyondResult, sourceResult] = await Promise.all([
      decodeExport(page, beyondExport),
      decodeExport(sourcePage, sourceExport),
    ]);
    expect(beyondResult.usedGemsLevel).toBe(1);
    expect(sourceResult.usedGemsLevel).toBe(1);

    await Promise.all([
      page.locator("[data-game-tab='mining']").click(),
      sourcePage.locator("footer button").filter({ hasText: "Mining" }).click(),
    ]);
    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText("3"),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText("3"),
    ]);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("does not restore a serialized Gem Waster selector on cold start", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const coldStartSave = makeSeedSave();
  coldStartSave.usedGemsLevel = 2;
  coldStartSave.upgrades = {
    ...coldStartSave.upgrades,
    gemWaster: { level: 1 },
  };
  coldStartSave.settings.tab = "main";

  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const encodedSave = await encodeWithPinnedRuntime(
      sourcePage,
      coldStartSave,
    );
    const initialization = {
      encoded: encodedSave,
      key: "legacy-save-gem-waster-selector-cold-start",
      time: fixedTime,
    };
    await Promise.all([
      page.addInitScript(seedPage, initialization),
      sourcePage.addInitScript(seedPage, initialization),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );

    await Promise.all([
      expect(page.locator("[data-craft-gem-cost]")).toHaveText("1"),
      expect(
        sourcePage.locator(".craft-pickaxe button:not(.level-change)"),
      ).toContainText("1"),
    ]);
    await selectSettings(page, sourcePage);
    await Promise.all([
      page.getByRole("button", { name: "Export" }).click(),
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Export" })
        .click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      page.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("article.settings textarea").inputValue(),
    ]);
    expect(beyondExport, "cold-start selector export bytes").toBe(sourceExport);
    const [beyondState, sourceState] = await Promise.all([
      decodeExport(page, beyondExport),
      decodeExport(sourcePage, sourceExport),
    ]);
    expect(coldStartSave.usedGemsLevel).toBe(2);
    expect(sourceState.usedGemsLevel).toBe(0);
    expect(beyondState.usedGemsLevel).toBe(0);
    expect(beyondState, "cold-start complete export").toEqual(sourceState);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

test("preserves live timers when importing serialized timer values", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const seedSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  seedSave.lastActive = fixedTime;
  seedSave.settings.tab = "main";

  const importedSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  importedSave.lastActive = fixedTime;
  importedSave.settings.tab = "main";
  importedSave.timer = { autoPickaxe: 987_654, save: 876_543 };

  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const [encodedSeed, encodedImport] = await Promise.all([
      encodeWithPinnedRuntime(sourcePage, seedSave),
      encodeWithPinnedRuntime(sourcePage, importedSave),
    ]);
    await Promise.all([
      page.addInitScript(seedPage, {
        encoded: encodedSeed,
        key: "legacy-save-timers-seeded",
        time: fixedTime,
      }),
      sourcePage.addInitScript(seedPage, {
        encoded: encodedSeed,
        key: "legacy-save-timers-seeded",
        time: fixedTime,
      }),
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await selectSettings(page, sourcePage);

    const exportCurrent = async () => {
      const beyondField = page.locator("[data-settings-save-field]");
      const sourceField = sourcePage.locator("article.settings textarea");
      await Promise.all([
        page.getByRole("button", { name: "Export" }).click(),
        sourcePage
          .locator("article.settings")
          .getByRole("button", { name: "Export" })
          .click(),
      ]);
      const [beyondEncoded, sourceEncoded] = await Promise.all([
        beyondField.inputValue(),
        sourceField.inputValue(),
      ]);
      return Promise.all([
        decodeExport(page, beyondEncoded),
        decodeExport(sourcePage, sourceEncoded),
      ]);
    };
    const beforeImport = await exportCurrent();
    const [beyondEncoded, sourceEncoded] = await importAndExport(
      page,
      sourcePage,
      encodedImport,
    );
    expect(beyondEncoded, "complete imported legacy export bytes").toBe(
      sourceEncoded,
    );
    const [beyondAfterImport, sourceAfterImport] = await Promise.all([
      decodeExport(page, beyondEncoded),
      decodeExport(sourcePage, sourceEncoded),
    ]);
    expect(beyondAfterImport.timer).toEqual(beforeImport[0].timer);
    expect(sourceAfterImport.timer).toEqual(beforeImport[1].timer);
    expect(beyondAfterImport.timer).not.toEqual(importedSave.timer);
    expect(sourceAfterImport.timer).not.toEqual(importedSave.timer);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
