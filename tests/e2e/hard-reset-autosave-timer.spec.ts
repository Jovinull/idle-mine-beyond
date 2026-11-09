import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type HardResetFixture = {
  data: {
    hardResetSemantics: {
      confirmed: { after: { lastActive: number } };
    };
    saveApplicationSemantics: { inputJson: string };
  };
};

test("retains the Hard Reset save timer until its next autosave threshold", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as HardResetFixture;
  const startupTime =
    reference.data.hardResetSemantics.confirmed.after.lastActive;
  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as { lastActive: number };
  save.lastActive = startupTime;
  const encodedSave = encodeRemixLegacySave(save);
  const sourceContext = await browser.newContext({
    colorScheme: "light",
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
    let currentTime = now;
    Object.defineProperty(window, "__hardResetAutosaveNow", {
      configurable: false,
      get: () => currentTime,
      set: (next: number) => {
        currentTime = next;
      },
    });
    Date.now = () => currentTime;
  };
  const advanceClock = (elapsed: number) =>
    Promise.all(
      [page, sourcePage].map((target) =>
        target.evaluate((duration) => {
          const testWindow = window as Window & {
            __hardResetAutosaveNow?: number;
          };
          if (testWindow.__hardResetAutosaveNow === undefined) {
            throw new Error("The controlled Hard Reset clock is missing.");
          }
          testWindow.__hardResetAutosaveNow += duration;
        }, elapsed),
      ),
    );
  const confirmReset = (target: typeof page) => {
    const prompts: string[] = [];
    target.on("dialog", async (dialog) => {
      prompts.push(dialog.message());
      await dialog.accept();
    });
    return prompts;
  };
  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, {
        encoded: encodedSave,
        now: startupTime,
      }),
      sourcePage.addInitScript(initializePage, {
        encoded: encodedSave,
        now: startupTime,
      }),
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
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);

    const [beyondStorageBeforeReset, sourceStorageBeforeReset] =
      await Promise.all([
        page.evaluate(() => ({
          primary: localStorage.getItem("IdleMineBeyond"),
          legacy: localStorage.getItem("IdleMine"),
        })),
        sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
      ]);
    expect(beyondStorageBeforeReset.legacy).toBe(encodedSave);
    expect(beyondStorageBeforeReset.primary).not.toBeNull();
    expect(sourceStorageBeforeReset).toBe(encodedSave);

    await advanceClock(59_999);
    await Promise.all([
      page.waitForTimeout(120),
      sourcePage.waitForTimeout(120),
    ]);
    const [beyondStorageAtThreshold, sourceStorageAtThreshold] =
      await Promise.all([
        page.evaluate(() => ({
          primary: localStorage.getItem("IdleMineBeyond"),
          legacy: localStorage.getItem("IdleMine"),
        })),
        sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
      ]);
    expect(beyondStorageAtThreshold).toEqual(beyondStorageBeforeReset);
    expect(sourceStorageAtThreshold).toBe(sourceStorageBeforeReset);
    const sourceTimerBeforeReset = await sourcePage.evaluate(
      () =>
        (window as Window & { game?: { timer?: { save?: number } } }).game
          ?.timer?.save,
    );
    expect(sourceTimerBeforeReset).toBe(59.999);

    const beyondPrompts = confirmReset(page);
    const sourcePrompts = confirmReset(sourcePage);
    await Promise.all([
      page.locator("[data-settings-hard-reset]").click(),
      sourcePage
        .locator("article.settings button")
        .filter({ hasText: "Hard Reset" })
        .click(),
    ]);
    await expect.poll(() => beyondPrompts.length).toBe(3);
    await expect.poll(() => sourcePrompts.length).toBe(3);
    expect(sourcePrompts).toEqual(beyondPrompts);
    expect(
      await sourcePage.evaluate(
        () =>
          (window as Window & { game?: { timer?: { save?: number } } }).game
            ?.timer?.save,
      ),
    ).toBe(59.999);
    expect(
      await Promise.all(
        [page, sourcePage].map((target) =>
          target.evaluate(() => localStorage.length),
        ),
      ),
    ).toEqual([0, 0]);

    await advanceClock(1);
    await Promise.all([
      page.waitForTimeout(120),
      sourcePage.waitForTimeout(120),
    ]);
    expect(
      await sourcePage.evaluate(
        () =>
          (window as Window & { game?: { timer?: { save?: number } } }).game
            ?.timer?.save,
      ),
    ).toBe(60);
    expect(
      await Promise.all(
        [page, sourcePage].map((target) =>
          target.evaluate(() => localStorage.length),
        ),
      ),
    ).toEqual([0, 0]);

    await advanceClock(1);
    await Promise.all([
      page.waitForTimeout(120),
      sourcePage.waitForTimeout(120),
    ]);
    expect(
      await sourcePage.evaluate(
        () =>
          (window as Window & { game?: { timer?: { save?: number } } }).game
            ?.timer?.save,
      ),
    ).toBe(0);
    expect(
      await Promise.all(
        [page, sourcePage].map((target) =>
          target.evaluate(() => Object.keys(localStorage)),
        ),
      ),
    ).toEqual([["IdleMineBeyond"], ["IdleMine"]]);
    const [beyondSavedStorage, sourceSavedStorage] = await Promise.all([
      page.evaluate(() => ({
        primary: localStorage.getItem("IdleMineBeyond"),
        legacy: localStorage.getItem("IdleMine"),
      })),
      sourcePage.evaluate(() => localStorage.getItem("IdleMine")),
    ]);
    expect(beyondSavedStorage.primary).not.toBeNull();
    expect(beyondSavedStorage.legacy).toBeNull();
    expect(sourceSavedStorage).not.toBeNull();

    await Promise.all([
      page.locator("[data-game-tab='settings']").click(),
      sourcePage
        .locator("footer button")
        .filter({ hasText: "Settings" })
        .click(),
    ]);
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
    expect(beyondExport).toBe(sourceExport);
    expect(
      await page.evaluate((value) => {
        const decoded = unescape(decodeURIComponent(atob(value)));
        return JSON.parse(decoded) as unknown;
      }, beyondExport),
    ).toEqual(
      await sourcePage.evaluate((value) => {
        const decoded = unescape(decodeURIComponent(atob(value)));
        return JSON.parse(decoded) as unknown;
      }, sourceExport),
    );
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
