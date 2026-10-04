import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
const groups = [
  { beyond: "gems", remix: "gems", label: "Gem Upgrades" },
  { beyond: "planetCoins", remix: "planetcoins", label: "PC Upgrades" },
] as const;

type LegacySave = {
  highestMineObjectLevel: number;
  lastActive: number;
  mineObjectLevel: number;
  settings: { tab: string; upgradeTab: string };
};

function seedPage({ encoded, time }: { encoded: string; time: number }): void {
  if (sessionStorage.getItem("upgrade-tab-state-seeded") !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem("upgrade-tab-state-seeded", "true");
  }
  Date.now = () => time;
}

async function startPages(browser: Browser, beyondPage: Page, encoded: string) {
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const sourceUrl = await routePinnedRemixOracle(sourceContext);
  await Promise.all([
    sourcePage.addInitScript(seedPage, { encoded, time: fixedTime }),
    beyondPage.addInitScript(seedPage, { encoded, time: fixedTime }),
  ]);
  await beyondPage.emulateMedia({ colorScheme: "light" });
  await beyondPage.setViewportSize({ width: 1440, height: 900 });
  await Promise.all([sourcePage.goto(sourceUrl), beyondPage.goto("/")]);
  await expect(beyondPage.locator("#app")).toHaveAttribute(
    "data-app-state",
    "ready",
  );
  await sourcePage.waitForFunction(() =>
    Boolean(
      (window as Window & { game?: unknown }).game &&
      document.querySelector("#app > footer"),
    ),
  );
  return { sourceContext, sourcePage, beyondPage };
}

function readUpgradeTab(encoded: string): string {
  const result = decodeRemixLegacySave(encoded);
  if (result.status !== "success") {
    throw new Error("The exported Remix save did not decode successfully.");
  }
  const value = result.value as { settings?: { upgradeTab?: unknown } };
  if (typeof value.settings?.upgradeTab !== "string") {
    throw new Error("The exported Remix save has no settings.upgradeTab.");
  }
  return value.settings.upgradeTab;
}

test("preserves the selected upgrade group across tabs and legacy export", async ({
  browser,
  page,
}) => {
  test.setTimeout(90_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { saveApplicationSemantics: { inputJson: string } } };
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";

  const { sourceContext, sourcePage, beyondPage } = await startPages(
    browser,
    page,
    encodeRemixLegacySave(save),
  );

  try {
    for (const group of groups) {
      await Promise.all([
        beyondPage.locator(`[data-upgrade-tab="${group.beyond}"]`).click(),
        sourcePage
          .locator(".upg-tabs button")
          .filter({ hasText: group.label })
          .click(),
      ]);

      await Promise.all([
        beyondPage.locator('[data-game-tab="story"]').click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Story" })
          .click(),
      ]);
      await Promise.all([
        beyondPage.locator('[data-game-tab="mining"]').click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Mining" })
          .click(),
      ]);

      await expect(
        beyondPage.locator(`[data-upgrade-tab="${group.beyond}"]`),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        beyondPage.locator(`[data-upgrade-group="${group.beyond}"]`),
      ).not.toHaveCount(0);
      await expect
        .poll(() =>
          sourcePage.evaluate(
            () =>
              (
                window as Window & {
                  game?: { settings?: { upgradeTab?: string } };
                }
              ).game?.settings?.upgradeTab,
          ),
        )
        .toBe(group.remix);
      const sourceCardCount = await sourcePage
        .locator(".upgradelist .upgrade")
        .count();
      const beyondCardCount = await beyondPage
        .locator(`[data-upgrade-group="${group.beyond}"]`)
        .count();
      expect(beyondCardCount, `${group.remix} visible shop cards`).toBe(
        sourceCardCount,
      );
    }

    await Promise.all([
      beyondPage.locator('[data-game-tab="settings"]').click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
    await Promise.all([
      beyondPage.locator("[data-settings-export]").click(),
      sourcePage.getByRole("button", { name: "Export", exact: true }).click(),
    ]);
    const [beyondExport, sourceExport] = await Promise.all([
      beyondPage.locator("[data-settings-save-field]").inputValue(),
      sourcePage.locator("textarea").inputValue(),
    ]);
    expect(readUpgradeTab(beyondExport)).toBe("planetcoins");
    expect(readUpgradeTab(sourceExport)).toBe("planetcoins");

    await Promise.all([sourcePage.reload(), beyondPage.reload()]);
    await expect(beyondPage.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await expect(
      beyondPage.locator('[data-upgrade-tab="money"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        sourcePage.evaluate(
          () =>
            (
              window as Window & {
                game?: { settings?: { upgradeTab?: string } };
              }
            ).game?.settings?.upgradeTab,
        ),
      )
      .toBe("money");
  } finally {
    await sourceContext.close();
  }
});
