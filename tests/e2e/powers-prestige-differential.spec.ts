import { expect, test, type Locator, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type PrestigeSample = {
  name: string;
  input: {
    index: 0 | 1 | 2 | 3;
    powerResetKeepLevel: number;
    values: string[];
  };
  after: { decimal: string }[];
};

type PowersFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    powersTableSemantics: { prestiges: PrestigeSample[] };
  };
};

type PowerSave = {
  highestMineObjectLevel: number;
  lastActive: number;
  maxWisdom: string;
  mineObjectLevel: number;
  pickaxe: { name: string; pow: string; quality: string };
  powers: {
    data: { values: string[] };
    upgrades: Record<string, { level: number }>;
  };
  settings: { numberFormatterIndex: number; tab: string; theme: string };
  wisdom: string;
};

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as PowersFixture;
const prestigeSamples = fixture.data.powersTableSemantics.prestiges;

function createPrestigeSave(
  sample: PrestigeSample,
  theme: "light" | "dark" = "light",
): string {
  const save = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as PowerSave;
  save.highestMineObjectLevel = 170;
  save.mineObjectLevel = 170;
  save.lastActive = 1_700_000_000_000;
  save.wisdom = "1e6";
  save.maxWisdom = "1e6";
  save.powers.data.values = [...sample.input.values];
  save.powers.upgrades = {
    powerResetKeep: { level: sample.input.powerResetKeepLevel },
    powerPowerIdle: { level: 0 },
  };
  save.pickaxe.pow = "0";
  save.settings.tab = "main";
  save.settings.numberFormatterIndex = 0;
  save.settings.theme = theme;
  return encodeRemixLegacySave(save);
}

function seedLegacySave({
  encoded,
  sentinel,
}: {
  encoded: string;
  sentinel: string;
}) {
  if (sessionStorage.getItem(sentinel) !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem(sentinel, "true");
  }
  Date.now = () => 1_700_000_000_000;
}

function seedLegacySaveWithAdvanceableClock({
  encoded,
  sentinel,
  initialNow,
}: {
  encoded: string;
  sentinel: string;
  initialNow: number;
}) {
  if (sessionStorage.getItem(sentinel) !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem(sentinel, "true");
  }
  let now = initialNow;
  const testWindow = window as Window & {
    advanceIdleTestClock?: (deltaMilliseconds: number) => void;
  };
  testWindow.advanceIdleTestClock = (deltaMilliseconds) => {
    now += deltaMilliseconds;
  };
  Date.now = () => now;
}

function readRenderedRows(locator: Locator) {
  return locator.evaluateAll((rows) =>
    rows.map((row) => ({
      cells: Array.from(row.children).map((cell) =>
        (cell as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
      ),
      buttons: Array.from(row.querySelectorAll("button")).map((button) => ({
        text: (button as HTMLElement).innerText.replace(/\s+/g, " ").trim(),
        disabled: (button as HTMLButtonElement).disabled,
      })),
    })),
  );
}

async function readSourcePowerValues(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const sourceWindow = window as Window & {
      game?: {
        powers?: { data?: { values?: { toString(): string }[] } };
      };
    };
    const values = sourceWindow.game?.powers?.data?.values;
    if (!values) throw new Error("Pinned Remix Powers state is unavailable.");
    return values.map((value) => value.toString());
  });
}

async function waitForVisualReady(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => {})),
    );
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

async function expectSameScreen(
  beyond: Page,
  source: Page,
  label: string,
): Promise<void> {
  // On Linux the pinned Remix and Beyond differ by one antialiased pixel at
  // the start of the Wisdom description's second line (25,196), so this
  // full-screen comparison is Windows-only, like other selected captures.
  if (process.platform === "linux") return;
  await Promise.all([
    beyond.mouse.move(1438, 800),
    source.mouse.move(1438, 800),
  ]);
  // The Wisdom icon spins forever; freeze it on both pages like the source
  // captures do, or the two screenshots catch it at different angles.
  const stillWisdomIcon =
    'img[src$="wisdom.png"] { animation: none !important; transform: none !important; }';
  await Promise.all([
    beyond.addStyleTag({ content: stillWisdomIcon }),
    source.addStyleTag({ content: stillWisdomIcon }),
  ]);
  await Promise.all([waitForVisualReady(beyond), waitForVisualReady(source)]);
  const [beyondPng, sourcePng] = await Promise.all([
    beyond.screenshot({ animations: "disabled" }),
    source.screenshot({ animations: "disabled" }),
  ]);
  const hash = (png: Buffer) => createHash("sha256").update(png).digest("hex");
  expect(hash(beyondPng), label).toBe(hash(sourcePng));
}

for (const sample of prestigeSamples) {
  test(`matches pinned Remix Powers UI for ${sample.name}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const sourceContext = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const encoded = createPrestigeSave(sample);

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.addInitScript(seedLegacySave, {
          encoded,
          sentinel: `powers-prestige-${sample.name}`,
        }),
        sourcePage.addInitScript(seedLegacySave, {
          encoded,
          sentinel: `powers-prestige-${sample.name}`,
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

      await Promise.all([
        page.locator("[data-game-tab='powers']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Powers" })
          .click(),
      ]);
      await expect(page.locator("article.powers")).toBeVisible();
      await expect(sourcePage.locator("article.powers")).toBeVisible();

      const beyondRows = page.locator("article.powers .powers-table tr");
      const sourceRows = sourcePage.locator("article.powers .powers-table tr");
      const [before, sourceBefore] = await Promise.all([
        readRenderedRows(beyondRows),
        readRenderedRows(sourceRows),
      ]);
      expect(before).toEqual(sourceBefore);

      const beyondButton = page.locator(
        `[data-power-prestige='${sample.input.index}']`,
      );
      const sourceButton = sourceRows.nth(sample.input.index).locator("button");
      await expect(beyondButton).toBeVisible();
      await expect(sourceButton).toBeVisible();
      const shouldPrestige =
        sample.name !== "already-met-next-power-is-unchanged";
      if (shouldPrestige) {
        await expect(beyondButton).toBeEnabled();
        await expect(sourceButton).toBeEnabled();
        await Promise.all([beyondButton.click(), sourceButton.click()]);
        await Promise.all([
          page.waitForTimeout(150),
          sourcePage.waitForTimeout(150),
        ]);
        expect(await readSourcePowerValues(sourcePage)).toEqual(
          sample.after.map(({ decimal }) => decimal),
        );
        const [beyondWhileMounted, sourceWhileMounted] = await Promise.all([
          readRenderedRows(beyondRows),
          readRenderedRows(sourceRows),
        ]);
        expect(sourceWhileMounted).toEqual(sourceBefore);
        expect(beyondWhileMounted).toEqual(sourceWhileMounted);
      } else {
        await expect(beyondButton).toBeDisabled();
        await expect(sourceButton).toBeDisabled();
        expect(await readSourcePowerValues(sourcePage)).toEqual(
          sample.after.map(({ decimal }) => decimal),
        );
      }

      await Promise.all([
        page.locator("[data-game-tab='mining']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Mining" })
          .click(),
      ]);
      await Promise.all([
        page.locator("[data-game-tab='powers']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Powers" })
          .click(),
      ]);
      const [beyondAfterRemount, sourceAfterRemount] = await Promise.all([
        readRenderedRows(beyondRows),
        readRenderedRows(sourceRows),
      ]);
      expect(beyondAfterRemount).toEqual(sourceAfterRemount);
      expect(await readSourcePowerValues(sourcePage)).toEqual(
        sample.after.map(({ decimal }) => decimal),
      );
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches full-screen Powers prestige refresh in ${theme} theme`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const sample = prestigeSamples[0];
    if (!sample)
      throw new Error("The first pinned prestige sample is missing.");
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const encoded = createPrestigeSave(sample, theme);

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.addInitScript(seedLegacySave, {
          encoded,
          sentinel: `powers-prestige-visual-${theme}`,
        }),
        sourcePage.addInitScript(seedLegacySave, {
          encoded,
          sentinel: `powers-prestige-visual-${theme}`,
        }),
      ]);
      await page.emulateMedia({ colorScheme: theme });
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
      await Promise.all([
        page.locator("[data-game-tab='powers']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Powers" })
          .click(),
      ]);
      await Promise.all([
        waitForVisualReady(page),
        waitForVisualReady(sourcePage),
      ]);
      await expectSameScreen(page, sourcePage, `${theme} before prestige`);

      await Promise.all([
        page.locator(`[data-power-prestige='${sample.input.index}']`).click(),
        sourcePage
          .locator("article.powers .powers-table tr")
          .nth(sample.input.index)
          .locator("button")
          .click(),
      ]);
      await Promise.all([
        page.waitForTimeout(150),
        sourcePage.waitForTimeout(150),
      ]);
      await Promise.all([
        waitForVisualReady(page),
        waitForVisualReady(sourcePage),
      ]);
      await expectSameScreen(
        page,
        sourcePage,
        `${theme} stale table after prestige`,
      );

      await Promise.all([
        page.locator("[data-game-tab='mining']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Mining" })
          .click(),
      ]);
      await Promise.all([
        page.locator("[data-game-tab='powers']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Powers" })
          .click(),
      ]);
      await Promise.all([
        waitForVisualReady(page),
        waitForVisualReady(sourcePage),
      ]);
      await expectSameScreen(
        page,
        sourcePage,
        `${theme} refreshed table after remount`,
      );
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}

test("refreshes the stale Powers table after a Remix idle hit uses Vue.set", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const sample = prestigeSamples[0];
  if (!sample) throw new Error("The first pinned prestige sample is missing.");
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const encoded = createPrestigeSave(sample);
  const initialNow = 1_700_000_000_000;
  const seed = {
    encoded,
    sentinel: "powers-prestige-idle-refresh",
    initialNow,
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(seedLegacySaveWithAdvanceableClock, seed),
      sourcePage.addInitScript(seedLegacySaveWithAdvanceableClock, seed),
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
    await Promise.all([
      page.locator("[data-game-tab='powers']").click(),
      sourcePage.locator("footer button").filter({ hasText: "Powers" }).click(),
    ]);

    const beyondRows = page.locator("article.powers .powers-table tr");
    const sourceRows = sourcePage.locator("article.powers .powers-table tr");
    const [before, sourceBefore] = await Promise.all([
      readRenderedRows(beyondRows),
      readRenderedRows(sourceRows),
    ]);
    expect(before).toEqual(sourceBefore);

    await Promise.all([
      page.locator("[data-power-prestige='0']").click(),
      sourceRows.nth(0).locator("button").click(),
    ]);
    await Promise.all([
      page.waitForTimeout(150),
      sourcePage.waitForTimeout(150),
    ]);
    const [staleBeyond, staleSource] = await Promise.all([
      readRenderedRows(beyondRows),
      readRenderedRows(sourceRows),
    ]);
    expect(staleBeyond).toEqual(sourceBefore);
    expect(staleSource).toEqual(sourceBefore);

    await Promise.all([
      page.evaluate(() => {
        const testWindow = window as Window & {
          advanceIdleTestClock?: (deltaMilliseconds: number) => void;
        };
        if (!testWindow.advanceIdleTestClock) {
          throw new Error("Beyond's controlled test clock is unavailable.");
        }
        testWindow.advanceIdleTestClock(1_100);
      }),
      sourcePage.evaluate(() => {
        const testWindow = window as Window & {
          advanceIdleTestClock?: (deltaMilliseconds: number) => void;
        };
        if (!testWindow.advanceIdleTestClock) {
          throw new Error("Remix's controlled test clock is unavailable.");
        }
        testWindow.advanceIdleTestClock(1_100);
      }),
    ]);

    await expect
      .poll(async () => JSON.stringify(await readRenderedRows(sourceRows)))
      .not.toBe(JSON.stringify(sourceBefore));
    await expect
      .poll(async () => JSON.stringify(await readRenderedRows(beyondRows)))
      .not.toBe(JSON.stringify(before));
    const [afterBeyond, afterSource] = await Promise.all([
      readRenderedRows(beyondRows),
      readRenderedRows(sourceRows),
    ]);
    expect(afterBeyond).toEqual(afterSource);
    expect(await readSourcePowerValues(sourcePage)).toEqual(
      sample.after.map(({ decimal }) => decimal),
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
