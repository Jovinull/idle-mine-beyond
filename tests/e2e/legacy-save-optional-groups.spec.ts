import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
const seedKey = "legacy-save-optional-groups-seeded";

type LegacySave = {
  lastActive: number;
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
  settings: { tab: string; theme: string };
};

type OptionalGroupFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    saveSemantics: {
      missingOptionalGroups: { inputJson: string };
      emptyPresentGroups: { inputJson: string };
    };
  };
};

type ExportedSave = {
  money: string;
  gems: string;
  planetCoins: string;
  wisdom: string;
  lastActive: number;
  settings: { tab: string; theme: string };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  pickaxe: { name: string; pow: string; quality: string };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as OptionalGroupFixture;

function encodeJson(inputJson: string): string {
  return encodeRemixLegacySave(
    JSON.parse(inputJson) as Record<string, unknown>,
  );
}

function makeSeedSave(): string {
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.lastActive = fixedTime;
  return encodeRemixLegacySave(save);
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

test("matches Remix imports with absent versus present empty save groups", async ({
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
  const seedSave = makeSeedSave();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(seedPage, {
        encoded: seedSave,
        key: seedKey,
        time: fixedTime,
      }),
      sourcePage.addInitScript(seedPage, {
        encoded: seedSave,
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
    ] as const;

    for (const scenario of cases) {
      await test.step(scenario.name, async () => {
        await setSaveAndReload(page, sourcePage, seedSave);
        await selectSettings(page, sourcePage);
        const [beyondExport, sourceExport] = await importAndExport(
          page,
          sourcePage,
          encodeJson(scenario.inputJson),
        );
        const [result, sourceResult] = await Promise.all([
          decodeExport(page, beyondExport),
          decodeExport(sourcePage, sourceExport),
        ]);
        expect(result, `${scenario.name} complete source export`).toEqual(
          sourceResult,
        );
        expect(result.money).toBe("0");
        expect(result.gems).toBe("0");
        expect(result.planetCoins).toBe("0");
        expect(result.wisdom).toBe("0");
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
      });
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
