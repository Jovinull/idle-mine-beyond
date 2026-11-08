import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type ImportErrorCase = {
  name: string;
  encoded: string;
  thrownErrorName: string | null;
  thrownErrorMessage?: string | null | undefined;
};
type ErrorFixture = {
  data: {
    saveSemantics: {
      loadErrors: readonly ImportErrorCase[];
      fieldApplicationErrors: readonly ImportErrorCase[];
    };
  };
};
type SourceLoadError = { name: string; message: string };

const fixedTime = 1_700_000_000_000;
const fixtureUrl = new URL(
  "../fixtures/parity/remix-reference-corpus.json",
  import.meta.url,
);

function seedFreshRuntime(time: number): void {
  localStorage.clear();
  Date.now = () => time;
}

async function readySourcePage(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    Boolean(
      (window as Window & { game?: unknown }).game &&
      document.querySelector("#app > footer"),
    ),
  );
}

async function selectSettings(
  beyondPage: Page,
  sourcePage: Page,
): Promise<void> {
  await Promise.all([
    beyondPage.locator("[data-game-tab='settings']").click(),
    sourcePage.locator("footer button").filter({ hasText: "Settings" }).click(),
  ]);
  await expect(
    beyondPage.locator("article.settings [data-settings-save-field]"),
  ).toBeVisible();
  await expect(sourcePage.locator("article.settings textarea")).toBeVisible();
}

async function resetPairedPages(
  beyondPage: Page,
  sourcePage: Page,
): Promise<void> {
  await Promise.all([beyondPage.reload(), sourcePage.reload()]);
  await Promise.all([
    expect(beyondPage.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    ),
    readySourcePage(sourcePage),
  ]);
  await selectSettings(beyondPage, sourcePage);
  await instrumentSourceLoadErrors(sourcePage);
}

async function storageSnapshot(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage)
        .sort()
        .map((key) => [key, localStorage.getItem(key) ?? ""]),
    ),
  );
}

async function instrumentSourceLoadErrors(page: Page): Promise<void> {
  await page.evaluate(() => {
    type SourceRuntime = Window & {
      app?: { loadGame: (...args: unknown[]) => unknown };
      __remixLoadFailure?: { name: string; message: string } | undefined;
    };
    const runtime = window as SourceRuntime;
    const app = runtime.app;
    if (!app) throw new Error("Pinned Remix Vue app is unavailable.");
    const original = app.loadGame;
    app.loadGame = (...args) => {
      runtime.__remixLoadFailure = undefined;
      try {
        return original(...args);
      } catch (error) {
        runtime.__remixLoadFailure =
          error instanceof Error
            ? { name: error.name, message: error.message }
            : { name: "Error", message: String(error) };
        throw error;
      }
    };
  });
}

async function sourceLoadFailure(page: Page): Promise<SourceLoadError> {
  return page.evaluate(() => {
    const failure = (
      window as Window & {
        __remixLoadFailure?: SourceLoadError;
      }
    ).__remixLoadFailure;
    if (!failure) throw new Error("The source load error was not captured.");
    return failure;
  });
}

async function importCase(
  beyondPage: Page,
  sourcePage: Page,
  scenario: ImportErrorCase,
): Promise<void> {
  const beyondDialogs: string[] = [];
  const sourceDialogs: string[] = [];
  const handleDialogs =
    (messages: string[]) =>
    async (dialog: { message(): string; accept(): Promise<void> }) => {
      messages.push(dialog.message());
      await dialog.accept();
    };
  const onBeyondDialog = handleDialogs(beyondDialogs);
  const onSourceDialog = handleDialogs(sourceDialogs);
  beyondPage.on("dialog", onBeyondDialog);
  sourcePage.on("dialog", onSourceDialog);

  try {
    const beyondField = beyondPage.locator(
      "article.settings [data-settings-save-field]",
    );
    const sourceField = sourcePage.locator("article.settings textarea");
    await Promise.all([
      beyondField.fill(scenario.encoded),
      sourceField.fill(scenario.encoded),
    ]);
    await Promise.all([
      beyondPage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
      sourcePage
        .locator("article.settings")
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);

    await expect(beyondPage.getByRole("alert")).toBeVisible();
    const [beyondErrorText, sourceFailure] = await Promise.all([
      beyondPage.getByRole("alert").innerText(),
      sourceLoadFailure(sourcePage),
    ]);
    expect(beyondErrorText, `${scenario.name} error message`).toBe(
      sourceFailure.message,
    );
    expect(beyondDialogs, `${scenario.name} decode alerts`).toEqual(
      sourceDialogs,
    );
  } finally {
    beyondPage.off("dialog", onBeyondDialog);
    sourcePage.off("dialog", onSourceDialog);
  }
}

test("matches captured codec and missing-Story errors in this browser", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(
    await readFile(fixtureUrl, "utf8"),
  ) as ErrorFixture;
  const sourceContext = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  try {
    const sourceUrl = await routePinnedRemixOracle(sourcePage);
    await Promise.all([
      page.addInitScript(seedFreshRuntime, fixedTime),
      sourcePage.addInitScript(seedFreshRuntime, fixedTime),
    ]);
    await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await readySourcePage(sourcePage);
    await selectSettings(page, sourcePage);
    await instrumentSourceLoadErrors(sourcePage);

    const codecErrorCases = fixture.data.saveSemantics.loadErrors.filter(
      ({ thrownErrorName }) => thrownErrorName !== "TypeError",
    );
    for (const scenario of codecErrorCases) {
      const [beyondBefore, sourceBefore] = await Promise.all([
        storageSnapshot(page),
        storageSnapshot(sourcePage),
      ]);

      await test.step(scenario.name, async () => {
        await importCase(page, sourcePage, scenario);
        expect(
          await storageSnapshot(page),
          `${scenario.name} Beyond storage`,
        ).toEqual(beyondBefore);
        expect(
          await storageSnapshot(sourcePage),
          `${scenario.name} Remix storage`,
        ).toEqual(sourceBefore);
      });
    }

    const missingStoryCase = fixture.data.saveSemantics.fieldApplicationErrors
      .filter(({ name }) => name === "missing-story-after-resources")
      .map(({ name, encoded, thrownErrorName, thrownErrorMessage }) => ({
        name,
        encoded,
        thrownErrorName,
        thrownErrorMessage,
      }))[0];
    if (!missingStoryCase) {
      throw new Error("Missing captured story-field application failure.");
    }

    await resetPairedPages(page, sourcePage);
    const [beyondBefore, sourceBefore] = await Promise.all([
      storageSnapshot(page),
      storageSnapshot(sourcePage),
    ]);
    await test.step(missingStoryCase.name, async () => {
      await importCase(page, sourcePage, missingStoryCase);
      expect(
        await storageSnapshot(page),
        `${missingStoryCase.name} Beyond storage`,
      ).toEqual(beyondBefore);
      expect(
        await storageSnapshot(sourcePage),
        `${missingStoryCase.name} Remix storage`,
      ).toEqual(sourceBefore);
    });
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
