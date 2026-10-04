import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type SaveFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
  };
};

test("an unsaved upgrade purchase is lost on reload like pinned Remix", async ({
  page,
  browser,
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
  ) as SaveFixture;
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    money: string;
    highestMoney: string;
    highestMineObjectLevel: number;
    mineObjectLevel: number;
    lastActive: number;
    settings: { theme: string; tab: string; upgradeTab?: string };
    upgrades: Record<string, { level: number }>;
  };
  const fixedTime = 1_700_000_000_000;
  save.money = "1000";
  save.highestMoney = "1000";
  save.settings.theme = "light";
  save.settings.tab = "main";
  save.settings.upgradeTab = "money";
  save.upgrades["blacksmith"] = { level: 0 };
  save.lastActive = fixedTime;
  const encodedSave = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = ({
    encoded,
    now,
  }: {
    encoded: string;
    now: number;
  }) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    Date.now = () => now;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
      sourcePage.addInitScript(initializePage, {
        encoded: encodedSave,
        now: fixedTime,
      }),
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );

    const beyondCard = page.locator(
      '[data-upgrade-group="money"][data-upgrade-key="blacksmith"]',
    );
    const sourceCard = sourcePage
      .locator(".upgradelist .upgrade")
      .filter({ has: sourcePage.locator('img[src$="blacksmith.png"]') })
      .first();
    await expect(beyondCard).toBeVisible();
    await expect(sourceCard).toBeVisible();
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "0");
    await expect(sourceCard.locator(".lvl")).toHaveText("0");

    const readStorage = () =>
      page.evaluate(() => ({
        legacy: localStorage.getItem("IdleMine"),
        beyond: localStorage.getItem("IdleMineBeyond"),
      }));
    const [beforePurchase, sourceBeforePurchase] = await Promise.all([
      readStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beforePurchase.legacy).toBe(encodedSave);
    expect(beforePurchase.beyond).not.toBeNull();
    expect(sourceBeforePurchase).toBe(encodedSave);

    await Promise.all([beyondCard.click(), sourceCard.click()]);
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "1");
    await expect(sourceCard.locator(".lvl")).toHaveText("1");
    const [afterPurchase, sourceAfterPurchase] = await Promise.all([
      readStorage(),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(afterPurchase).toEqual(beforePurchase);
    expect(sourceAfterPurchase).toBe(sourceBeforePurchase);

    await Promise.all([page.reload(), sourcePage.reload()]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await sourcePage.waitForFunction(() =>
      Boolean((window as Window & { game?: unknown }).game),
    );
    await expect(beyondCard).toHaveAttribute("data-upgrade-level", "0");
    await expect(sourceCard.locator(".lvl")).toHaveText("0");
    expect(await readStorage()).toEqual(beforePurchase);
    expect(
      await sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ).toBe(sourceBeforePurchase);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
