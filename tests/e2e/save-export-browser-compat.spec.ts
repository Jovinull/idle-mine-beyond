import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

const fixedTime = 1_700_000_000_000;
const seedKey = "firefox-varied-save-seeded";

type SaveCorpus = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    saveExportSemantics: {
      variants: { name: string; inputJson?: string }[];
    };
  };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as SaveCorpus;

function encodeJson(inputJson: string): string {
  return encodeRemixLegacySave(
    JSON.parse(inputJson) as Record<string, unknown>,
  );
}

function seedPage({ encoded, key }: { encoded: string; key: string }) {
  if (sessionStorage.getItem(key) !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem(key, "true");
  }
  Date.now = () => 1_700_000_000_000;
}

async function exportCurrentSave(
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

async function decodeExport(page: Page, encoded: string): Promise<unknown> {
  return page.evaluate((value) => {
    const decoded = unescape(decodeURIComponent(atob(value)));
    return JSON.parse(decoded) as unknown;
  }, encoded);
}

test("matches a live varied all-upgrade save export in this browser", async ({
  browser,
  browserName,
  page,
}) => {
  test.skip(
    browserName !== "firefox" && browserName !== "webkit",
    "Dedicated Firefox and WebKit export gate.",
  );
  test.setTimeout(180_000);

  const seed = JSON.parse(
    corpus.data.saveApplicationSemantics.inputJson,
  ) as Record<string, unknown>;
  seed["lastActive"] = fixedTime;
  const encodedSeed = encodeRemixLegacySave(seed);
  const variant = corpus.data.saveExportSemantics.variants.find(
    (item) => item.name === "varied-settings-and-all-upgrades",
  );
  if (!variant?.inputJson) {
    throw new Error("The varied all-upgrade source fixture is missing.");
  }

  const sourceContext = await browser.newContext({
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(seedPage, { encoded: encodedSeed, key: seedKey }),
      sourcePage.addInitScript(seedPage, {
        encoded: encodedSeed,
        key: seedKey,
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
    await expect(page.locator("[data-settings-save-field]")).toBeVisible();
    await expect(sourcePage.locator("article.settings textarea")).toBeVisible();

    const [beyondExport, sourceExport] = await exportCurrentSave(
      page,
      sourcePage,
      encodeJson(variant.inputJson),
    );
    const [beyondValue, sourceValue] = await Promise.all([
      decodeExport(page, beyondExport),
      decodeExport(sourcePage, sourceExport),
    ]);
    expect(beyondExport, "complete encoded live save").toBe(sourceExport);
    expect(beyondValue, "complete decoded live save").toEqual(sourceValue);
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
