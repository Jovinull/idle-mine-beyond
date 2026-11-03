import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

test("matches Remix render failure for an imported out-of-range formatter", async ({
  page,
  browser,
}) => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      initialState: { numberFormatters: string[] };
      saveApplicationSemantics: { inputJson: string };
    };
  };
  const fixedTime = 1_700_000_000_000;
  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    lastActive: number;
    settings: { numberFormatterIndex: number };
  };
  save.lastActive = fixedTime;
  save.settings.numberFormatterIndex =
    fixture.data.initialState.numberFormatters.length;
  const saveJson = JSON.stringify(save);

  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const beyondPageErrors: string[] = [];
  const sourcePageErrors: string[] = [];
  page.on("pageerror", (error) => beyondPageErrors.push(error.message));
  sourcePage.on("pageerror", (error) => sourcePageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") beyondPageErrors.push(message.text());
  });
  sourcePage.on("console", (message) => {
    if (message.type() === "error") sourcePageErrors.push(message.text());
  });

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(() => {
        localStorage.clear();
        Date.now = () => 1_700_000_000_000;
      }),
      sourcePage.addInitScript(() => {
        localStorage.clear();
        Date.now = () => 1_700_000_000_000;
      }),
    ]);
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
      page.locator("[data-game-tab='settings']").click(),
      sourcePage.getByRole("button", { name: "Settings" }).click(),
    ]);
    const encoded = await page.evaluate((json) => {
      return btoa(escape(encodeURIComponent(json)));
    }, saveJson);
    await Promise.all([
      page.locator("[data-settings-save-field]").fill(encoded),
      sourcePage.locator("article.settings textarea").fill(encoded),
    ]);
    await Promise.all([
      page.getByRole("button", { name: "Import (from Text Field)" }).click(),
      sourcePage
        .getByRole("button", { name: "Import (from Text Field)" })
        .click(),
    ]);

    const sourceFormatter = await sourcePage.evaluate(() => {
      const source = window as Window & {
        functions?: { formatNumber(value: number): string };
        game?: { numberFormatter?: { name?: string } };
      };
      try {
        const text = source.functions?.formatNumber(1);
        return {
          status: "formatted",
          formatter: source.game?.numberFormatter?.name ?? null,
          text: text ?? null,
        };
      } catch (error) {
        return {
          status: "threw",
          formatter: source.game?.numberFormatter?.name ?? null,
          errorName: error instanceof Error ? error.name : typeof error,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    });
    const sourceRenderError =
      "Cannot read properties of undefined (reading 'name')";
    expect(sourceFormatter.status).toBe("threw");
    expect(sourceFormatter.errorName).toBe("TypeError");
    expect(sourceFormatter.errorMessage).toBe(sourceRenderError);
    await expect
      .poll(() =>
        sourcePageErrors.some((message) => message.includes(sourceRenderError)),
      )
      .toBe(true);
    await expect
      .poll(() =>
        beyondPageErrors.some((message) => message.includes(sourceRenderError)),
      )
      .toBe(true);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
