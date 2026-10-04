import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

type ImportErrorCase = {
  name: string;
  encoded: string;
  alertMessages: string[];
  thrownErrorMessage: string | null;
};

test("matches Remix malformed-save messages without persisting failed imports", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { saveSemantics: { loadErrors: ImportErrorCase[] } } };

  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_700_000_000_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const settings = page.locator("article.settings");
  const saveField = settings.locator("[data-settings-save-field]");
  const importButton = settings.getByRole("button", {
    name: "Import (from Text Field)",
  });
  const before = await page.evaluate(() =>
    localStorage.getItem("IdleMineBeyond"),
  );

  for (const scenario of fixture.data.saveSemantics.loadErrors) {
    const alerts: string[] = [];
    const handleDialog = async (dialog: import("@playwright/test").Dialog) => {
      alerts.push(dialog.message());
      await dialog.accept();
    };
    page.on("dialog", handleDialog);
    try {
      await saveField.fill(scenario.encoded);
      await importButton.click();
      await expect(page.getByRole("alert")).toHaveText(
        scenario.thrownErrorMessage ?? "",
      );
    } finally {
      page.off("dialog", handleDialog);
    }

    expect(alerts, scenario.name).toEqual(scenario.alertMessages);
    expect(
      await page.evaluate(() => localStorage.getItem("IdleMineBeyond")),
      scenario.name,
    ).toBe(before);
  }
});
