import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type WisdomUpgrade = {
  name: string;
  maxLevel: number | "Infinity";
  samples: { level: number; price: { decimal: string } }[];
};

type WisdomFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: { groups: { wisdom: Record<string, WisdomUpgrade> } };
  };
};

type WisdomSave = {
  lastActive: number;
  highestMineObjectLevel: number;
  mineObjectLevel: number;
  maxWisdom: string;
  wisdom: string;
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  settings: {
    numberFormatterIndex: number;
    tab: string;
    theme: string;
  };
};

type ExportedWisdomSave = {
  wisdom: string;
  maxWisdom: string;
  powers: { upgrades: Record<string, { level: number }> };
};

type SourceGame = {
  wisdom: { toString(): string };
  powers: {
    upgrades: Record<
      string,
      {
        level: number;
        currentPrice: () => {
          toString(): string;
          mul: (value: string) => { toString(): string };
        };
      }
    >;
  };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as WisdomFixture;
const wisdomUpgrades = Object.entries(
  fixture.data.upgradeSemantics.groups.wisdom,
);
const fixedTime = Date.now();

async function clickVisiblePair(
  beyond: Locator,
  source: Locator,
): Promise<void> {
  await Promise.all([
    expect(beyond).toBeVisible({ timeout: 10_000 }),
    expect(source).toBeVisible({ timeout: 10_000 }),
    expect(beyond).toBeEnabled({ timeout: 10_000 }),
    expect(source).toBeEnabled({ timeout: 10_000 }),
  ]);
  await beyond.evaluate((element) => (element as HTMLButtonElement).click());
  await source.evaluate((element) => (element as HTMLButtonElement).click());
}

function makeWisdomSave(
  theme: "light" | "dark",
  wisdom: string,
  selectedUpgrade?: { key: string; level: number },
): WisdomSave {
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as WisdomSave;
  save.lastActive = fixedTime;
  save.highestMineObjectLevel = 170;
  save.mineObjectLevel = 170;
  save.wisdom = wisdom;
  save.maxWisdom = wisdom;
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = Object.fromEntries(
    wisdomUpgrades.map(([key]) => [
      key,
      { level: key === selectedUpgrade?.key ? selectedUpgrade.level : 0 },
    ]),
  );
  save.settings.numberFormatterIndex = 0;
  save.settings.tab = "main";
  save.settings.theme = theme;
  return save;
}

async function encodeWithPinnedRuntime(
  sourcePage: Page,
  save: WisdomSave,
): Promise<string> {
  return sourcePage.evaluate((value) => {
    return btoa(escape(encodeURIComponent(JSON.stringify(value))));
  }, save);
}

async function seedPage(page: Page, encodedSave: string): Promise<void> {
  await page.addInitScript(
    ({ time, encoded }) => {
      const initializedKey = "wisdom-affordability-initialized";
      if (sessionStorage.getItem(initializedKey) !== "true") {
        localStorage.clear();
        localStorage.setItem("IdleMine", encoded);
        sessionStorage.setItem(initializedKey, "true");
      }
      const nextSave = sessionStorage.getItem("wisdom-affordability-next-save");
      if (nextSave !== null) {
        localStorage.clear();
        localStorage.setItem("IdleMine", nextSave);
        sessionStorage.removeItem("wisdom-affordability-next-save");
      }
      Date.now = () => time;
    },
    { time: fixedTime, encoded: encodedSave },
  );
}

async function replaceSave(page: Page, encodedSave: string): Promise<void> {
  await page.evaluate((encoded) => {
    sessionStorage.setItem("wisdom-affordability-next-save", encoded);
  }, encodedSave);
}

async function readSourceState(
  page: Page,
  keys: string[],
): Promise<{
  wisdom: string;
  levels: number[];
  balanceText: string;
  buttonTexts: string[];
}> {
  return page.evaluate((upgradeKeys) => {
    const game = (window as Window & { game?: SourceGame }).game;
    if (!game) throw new Error("Pinned Remix game state is unavailable.");
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article.powers .powers-upgrades button.upgrade-standalone",
      ),
    );
    return {
      wisdom: game.wisdom.toString(),
      levels: upgradeKeys.map((key) => game.powers.upgrades[key]!.level),
      balanceText:
        document
          .querySelector<HTMLElement>("article.powers p.wisdom")
          ?.innerText.replace(/\s+/g, " ")
          .trim() ?? "",
      buttonTexts: buttons.map((button) =>
        button.innerText.replace(/\s+/g, " ").trim(),
      ),
    };
  }, keys);
}

async function readBeyondState(
  page: Page,
  keys: string[],
): Promise<{ levels: number[]; balanceText: string; buttonTexts: string[] }> {
  return page.evaluate((upgradeKeys) => {
    const buttons = upgradeKeys.map((key) =>
      document.querySelector<HTMLElement>(`[data-wisdom-upgrade="${key}"]`),
    );
    if (buttons.some((button) => !button)) {
      throw new Error("Beyond Wisdom upgrade button is unavailable.");
    }
    return {
      levels: buttons.map((button) =>
        Number(button!.getAttribute("data-upgrade-level")),
      ),
      balanceText:
        document
          .querySelector<HTMLElement>("[data-wisdom-balance]")
          ?.innerText.replace(/\s+/g, " ")
          .trim() ?? "",
      buttonTexts: buttons.map((button) =>
        button!.innerText.replace(/\s+/g, " ").trim(),
      ),
    };
  }, keys);
}

async function exportAndDecode(
  page: Page,
  sourcePage: Page,
): Promise<[string, ExportedWisdomSave, string, ExportedWisdomSave]> {
  await clickVisiblePair(
    page.locator("[data-game-tab='settings']"),
    sourcePage.locator("footer button").filter({ hasText: "Settings" }),
  );
  const beyondSettings = page.locator("main article");
  const sourceSettings = sourcePage.locator("main article");
  await clickVisiblePair(
    beyondSettings.getByRole("button", { name: "Export" }),
    sourceSettings.getByRole("button", { name: "Export" }),
  );
  const [beyondExport, sourceExport] = await Promise.all([
    page.locator("[data-settings-save-field]").inputValue(),
    sourceSettings.locator("textarea").inputValue(),
  ]);
  const decode = (target: Page, encoded: string) =>
    target.evaluate((value) => {
      return JSON.parse(
        unescape(decodeURIComponent(atob(value))),
      ) as ExportedWisdomSave;
    }, encoded);
  const [beyondValue, sourceValue] = await Promise.all([
    decode(page, beyondExport),
    decode(sourcePage, sourceExport),
  ]);
  return [beyondExport, beyondValue, sourceExport, sourceValue];
}

for (const [caseKey, caseUpgrade] of wisdomUpgrades) {
  test(`matches Remix Wisdom affordability for ${caseUpgrade.name} below and at price`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const sourceContext = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    const baselineSave = makeWisdomSave("light", "1e100000000");
    const baselineEncoded = await encodeWithPinnedRuntime(
      sourcePage,
      baselineSave,
    );
    const keys = wisdomUpgrades.map(([key]) => key);
    const upgradesForCase = [[caseKey, caseUpgrade]] as const;

    try {
      await Promise.all([
        seedPage(page, baselineEncoded),
        seedPage(sourcePage, baselineEncoded),
      ]);
      await Promise.all([
        page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 }),
        sourcePage.goto(sourceUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        }),
      ]);
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await sourcePage.waitForFunction(() =>
        Boolean((window as Window & { game?: unknown }).game),
      );

      const sourcePrices = await sourcePage.evaluate((upgradeKeys) => {
        const game = (window as Window & { game?: SourceGame }).game;
        if (!game) throw new Error("Pinned Remix game state is unavailable.");
        return [0, 1].flatMap((level) =>
          upgradeKeys.map((key) => {
            const upgrade = game.powers.upgrades[key]!;
            const previousLevel = upgrade.level;
            upgrade.level = level;
            const price = upgrade.currentPrice();
            upgrade.level = previousLevel;
            return {
              key,
              level,
              price: price.toString(),
              below: price.mul("0.99").toString(),
            };
          }),
        );
      }, keys);

      for (const startingLevel of [0, 1]) {
        for (const [key, upgrade] of upgradesForCase) {
          const sourcePrice = sourcePrices.find(
            (item) => item.key === key && item.level === startingLevel,
          );
          const capturedPrice = upgrade.samples.find(
            (sample) => sample.level === startingLevel,
          )?.price.decimal;
          if (!sourcePrice || !capturedPrice) {
            throw new Error(
              `Missing captured level-${startingLevel} Wisdom price for ${key}.`,
            );
          }
          expect(
            sourcePrice.price,
            `${key} pinned level-${startingLevel} price`,
          ).toBe(capturedPrice);

          for (const boundary of [
            { name: "below", balance: sourcePrice.below, affordable: false },
            { name: "exact", balance: sourcePrice.price, affordable: true },
          ]) {
            const encoded = await encodeWithPinnedRuntime(
              sourcePage,
              makeWisdomSave("light", boundary.balance, {
                key,
                level: startingLevel,
              }),
            );
            await Promise.all([
              replaceSave(page, encoded),
              replaceSave(sourcePage, encoded),
            ]);
            await Promise.all([
              page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 }),
              sourcePage.reload({
                waitUntil: "domcontentloaded",
                timeout: 30_000,
              }),
            ]);
            await expect(page.locator("#app")).toHaveAttribute(
              "data-app-state",
              "ready",
            );
            await sourcePage.waitForFunction(() =>
              Boolean((window as Window & { game?: unknown }).game),
            );
            await clickVisiblePair(
              page.locator("[data-game-tab='powers']"),
              sourcePage.locator("footer button").filter({ hasText: "Powers" }),
            );

            const expectedBefore = keys.map((otherKey) =>
              otherKey === key ? startingLevel : 0,
            );
            const [sourceBefore, beyondBefore] = await Promise.all([
              readSourceState(sourcePage, keys),
              readBeyondState(page, keys),
            ]);
            expect(
              sourceBefore.wisdom,
              `${key} level ${startingLevel} ${boundary.name} initial Wisdom`,
            ).toBe(boundary.balance);
            expect(sourceBefore.levels).toEqual(expectedBefore);
            expect(beyondBefore.levels).toEqual(sourceBefore.levels);
            expect(beyondBefore.balanceText).toBe(sourceBefore.balanceText);
            expect(beyondBefore.buttonTexts).toEqual(sourceBefore.buttonTexts);

            await clickVisiblePair(
              page.locator(`[data-wisdom-upgrade="${key}"]`),
              sourcePage
                .locator(
                  "article.powers .powers-upgrades button.upgrade-standalone",
                )
                .filter({ hasText: upgrade.name }),
            );
            const expectedLevel = startingLevel + Number(boundary.affordable);
            const [sourceAfter, beyondAfter] = await Promise.all([
              readSourceState(sourcePage, keys),
              readBeyondState(page, keys),
            ]);
            expect(
              sourceAfter.levels[keys.indexOf(key)],
              `${key} level ${startingLevel} ${boundary.name} source level after click`,
            ).toBe(expectedLevel);
            expect(
              sourceAfter.levels,
              `${key} level ${startingLevel} ${boundary.name} all levels`,
            ).toEqual(
              keys.map((otherKey) => (otherKey === key ? expectedLevel : 0)),
            );
            expect(
              sourceAfter.wisdom,
              `${key} level ${startingLevel} ${boundary.name} Wisdom`,
            ).toBe(boundary.affordable ? "0" : boundary.balance);
            expect(beyondAfter.levels).toEqual(sourceAfter.levels);
            expect(beyondAfter.balanceText).toBe(sourceAfter.balanceText);
            expect(beyondAfter.buttonTexts).toEqual(sourceAfter.buttonTexts);

            if (boundary.affordable) {
              const [beyondExport, beyondValue, sourceExport, sourceValue] =
                await exportAndDecode(page, sourcePage);
              expect(
                beyondExport,
                `${key} level ${startingLevel} ${boundary.name} encoded save`,
              ).toBe(sourceExport);
              expect(
                beyondValue,
                `${key} level ${startingLevel} ${boundary.name} decoded save`,
              ).toEqual(sourceValue);
              expect(
                sourceValue.wisdom,
                `${key} level ${startingLevel} ${boundary.name} saved Wisdom`,
              ).toBe("0");
              expect(sourceValue.powers.upgrades[key]?.level).toBe(
                expectedLevel,
              );
            }
          }
        }
      }
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
