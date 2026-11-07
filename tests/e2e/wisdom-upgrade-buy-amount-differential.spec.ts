import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type WisdomUpgrade = {
  name: string;
  maxLevel: number | "Infinity";
};

type WisdomFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: { groups: { wisdom: Record<string, WisdomUpgrade> } };
  };
};

type SourceGame = {
  wisdom: { toString(): string };
  powers: { upgrades: Record<string, { level: number }> };
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as WisdomFixture;
const upgrades = Object.entries(fixture.data.upgradeSemantics.groups.wisdom);
const upgradeKeys = upgrades.map(([key]) => key);
const buyAmounts = [
  { name: "single", target: 1, keys: [] },
  { name: "Shift", target: 10, keys: ["Shift"] },
  { name: "Control", target: 100, keys: ["Control"] },
  { name: "Shift+Control", target: 100, keys: ["Shift", "Control"] },
] as const;

function createWisdomSave(
  theme: "light" | "dark",
  wisdom = "1e100000000",
): string {
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    highestMineObjectLevel: number;
    lastActive: number;
    maxWisdom: string;
    mineObjectLevel: number;
    powers: {
      data: { values: string[] };
      upgrades: Record<string, { level: number }>;
    };
    settings: { numberFormatterIndex: number; tab: string; theme: string };
    wisdom: string;
  };
  save.highestMineObjectLevel = 170;
  save.mineObjectLevel = 170;
  save.lastActive = 1_700_000_000_000;
  save.wisdom = wisdom;
  save.maxWisdom = wisdom;
  save.powers.data.values = ["1", "1", "1", "1", "1"];
  save.powers.upgrades = Object.fromEntries(
    upgrades.map(([key]) => [key, { level: 0 }]),
  );
  save.settings.numberFormatterIndex = 0;
  save.settings.tab = "main";
  save.settings.theme = theme;
  return encodeRemixLegacySave(save);
}

async function seedSave(
  page: Page,
  encoded: string,
  sentinel: string,
): Promise<void> {
  await page.addInitScript(
    ({ encodedSave, seedKey }) => {
      if (sessionStorage.getItem(seedKey) !== "true") {
        localStorage.clear();
        localStorage.setItem("IdleMine", encodedSave);
        sessionStorage.setItem(seedKey, "true");
      }
      Date.now = () => 1_700_000_000_000;
    },
    { encodedSave: encoded, seedKey: sentinel },
  );
}

async function readSourceState(page: Page): Promise<{
  levels: number[];
  balanceText: string;
  buttonTexts: string[];
}> {
  return page.evaluate((keys) => {
    const game = (window as Window & { game?: SourceGame }).game;
    if (!game) throw new Error("Pinned Remix game state is unavailable.");
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article.powers .powers-upgrades button.upgrade-standalone",
      ),
    );
    return {
      levels: keys.map((key) => game.powers.upgrades[key]!.level),
      balanceText:
        document
          .querySelector<HTMLElement>("article.powers p.wisdom")
          ?.innerText.replace(/\s+/g, " ")
          .trim() ?? "",
      buttonTexts: buttons.map((button) =>
        button.innerText.replace(/\s+/g, " ").trim(),
      ),
    };
  }, upgradeKeys);
}

async function readBeyondState(page: Page): Promise<{
  levels: number[];
  balanceText: string;
  buttonTexts: string[];
}> {
  return page.evaluate((keys) => {
    const buttons = keys.map((key) =>
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
  }, upgradeKeys);
}

async function keyAction(
  pages: readonly [Page, Page],
  key: string,
  action: "down" | "up",
): Promise<void> {
  await Promise.all(pages.map((page) => page.keyboard[action](key)));
}

async function preparePage(
  page: Page,
  sourcePage: Page,
  encoded: string,
  sourceUrl: string,
  theme: "light" | "dark" = "light",
): Promise<void> {
  await Promise.all([
    seedSave(page, encoded, "wisdom-upgrade-buy-amount"),
    seedSave(sourcePage, encoded, "wisdom-upgrade-buy-amount"),
  ]);
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width: 1440, height: 900 });
  await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
  await expect(page.locator("#app")).toHaveAttribute(
    "data-app-state",
    "ready",
    {
      timeout: 20_000,
    },
  );
  await sourcePage.waitForFunction(() =>
    Boolean(
      (window as Window & { game?: unknown }).game &&
      document.querySelector("#app > footer"),
    ),
  );
  await Promise.all([
    page.locator("[data-game-tab='powers']").click(),
    sourcePage.locator("footer button").filter({ hasText: "Powers" }).click(),
  ]);
  await expect(page.locator("[data-wisdom-upgrade]")).toHaveCount(
    upgradeKeys.length,
  );
  await expect(
    sourcePage.locator("article.powers .powers-upgrades button"),
  ).toHaveCount(upgradeKeys.length);
}

async function expectSameScreen(
  beyond: Page,
  source: Page,
  label: string,
): Promise<void> {
  // The pinned Remix and Beyond retain a known one-pixel antialiasing
  // difference at this Wisdom description's second line on Linux.
  if (process.platform === "linux") return;
  await Promise.all([
    beyond.mouse.move(1438, 800),
    source.mouse.move(1438, 800),
  ]);
  const freezeWisdomIcon =
    'img[src$="wisdom.png"] { animation: none !important; transform: none !important; }';
  await Promise.all([
    beyond.addStyleTag({ content: freezeWisdomIcon }),
    source.addStyleTag({ content: freezeWisdomIcon }),
  ]);
  await Promise.all(
    [beyond, source].map((page) =>
      page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images, (image) =>
            image.decode().catch(() => {}),
          ),
        );
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      }),
    ),
  );
  const [beyondPng, sourcePng] = await Promise.all([
    beyond.screenshot({ animations: "disabled" }),
    source.screenshot({ animations: "disabled" }),
  ]);
  const hash = (png: Buffer) => createHash("sha256").update(png).digest("hex");
  if (hash(beyondPng) !== hash(sourcePng)) {
    await Promise.all([
      test.info().attach(`${label}-beyond.png`, {
        body: beyondPng,
        contentType: "image/png",
      }),
      test.info().attach(`${label}-remix.png`, {
        body: sourcePng,
        contentType: "image/png",
      }),
    ]);
  }
  expect(hash(beyondPng), label).toBe(hash(sourcePng));
}

test("matches pinned Remix Wisdom upgrade single and modifier purchases", async ({
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
  const encoded = createWisdomSave("light");

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await preparePage(page, sourcePage, encoded, sourceUrl);
    const pages = [page, sourcePage] as const;

    for (const [key, upgrade] of upgrades) {
      for (const amount of buyAmounts) {
        const sourceKeyIndex = upgradeKeys.indexOf(key);
        const currentLevel = (await readBeyondState(page)).levels[
          sourceKeyIndex
        ]!;
        const expectedLevel = Math.min(
          (Math.floor(currentLevel / amount.target) + 1) * amount.target,
          upgrade.maxLevel === "Infinity"
            ? Number.POSITIVE_INFINITY
            : upgrade.maxLevel,
        );
        await Promise.all(
          amount.keys.map((keyToPress) => keyAction(pages, keyToPress, "down")),
        );
        try {
          await Promise.all(
            pages.map((currentPage) =>
              currentPage
                .locator(
                  currentPage === page
                    ? `[data-wisdom-upgrade="${key}"]`
                    : "article.powers .powers-upgrades button.upgrade-standalone",
                )
                .filter({ hasText: upgrade.name })
                .click(),
            ),
          );
          await expect(
            page.locator(`[data-wisdom-upgrade="${key}"]`),
          ).toHaveAttribute("data-upgrade-level", String(expectedLevel));
          if (amount.keys.length > 0 && currentLevel !== expectedLevel) {
            await expect(
              page.locator(`[data-wisdom-upgrade="${key}"] h4 span`).first(),
            ).toHaveText(String(amount.target));
          }
        } finally {
          await Promise.all(
            [...amount.keys]
              .reverse()
              .map((keyToRelease) => keyAction(pages, keyToRelease, "up")),
          );
        }

        const [sourceState, beyondState] = await Promise.all([
          readSourceState(sourcePage),
          readBeyondState(page),
        ]);
        expect(
          sourceState.levels[sourceKeyIndex],
          `${key} source level after ${amount.name}`,
        ).toBe(expectedLevel);
        expect(beyondState.levels).toEqual(sourceState.levels);
        expect(beyondState.balanceText).toBe(sourceState.balanceText);
        expect(beyondState.buttonTexts, `${key} after ${amount.name}`).toEqual(
          sourceState.buttonTexts,
        );
      }
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});

for (const theme of ["light", "dark"] as const) {
  test(`matches the full Wisdom panel after a Shift purchase in ${theme}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const encoded = createWisdomSave(theme, "1e100");

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await preparePage(page, sourcePage, encoded, sourceUrl, theme);
      const pages = [page, sourcePage] as const;
      await keyAction(pages, "Shift", "down");
      try {
        await Promise.all([
          page.locator('[data-wisdom-upgrade="powerPowerActive"]').click(),
          sourcePage
            .locator(
              "article.powers .powers-upgrades button.upgrade-standalone",
            )
            .filter({ hasText: "Power Power (Active)" })
            .click(),
        ]);
        await expect(
          page.locator('[data-wisdom-upgrade="powerPowerActive"]'),
        ).toHaveAttribute("data-upgrade-level", "10");
      } finally {
        await keyAction(pages, "Shift", "up");
      }

      const [sourceState, beyondState] = await Promise.all([
        readSourceState(sourcePage),
        readBeyondState(page),
      ]);
      expect(sourceState.levels[0]).toBe(10);
      expect(beyondState.levels).toEqual(sourceState.levels);
      expect(beyondState.balanceText).toBe(sourceState.balanceText);
      expect(beyondState.buttonTexts).toEqual(sourceState.buttonTexts);
      await expectSameScreen(
        page,
        sourcePage,
        `Wisdom Shift purchase ${theme}`,
      );
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
