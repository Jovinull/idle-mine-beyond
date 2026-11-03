import { expect, test } from "@playwright/test";

const primarySaveKey = "IdleMineBeyond";
const backupSaveKey = "IdleMineBeyondBackup";

for (const failureKey of [backupSaveKey, primarySaveKey]) {
  test(`reports and recovers a browser write failure at ${failureKey}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      type StorageFailureWindow = Window & {
        __idleMineBeyondFailKey?: string | null;
        __idleMineBeyondWriteAttempts?: string[];
      };

      localStorage.clear();
      Date.now = () => 1_700_000_000_000;

      const testWindow = window as StorageFailureWindow;
      testWindow.__idleMineBeyondFailKey = null;
      testWindow.__idleMineBeyondWriteAttempts = [];

      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function setItem(key, value) {
        if (key === "IdleMineBeyond" || key === "IdleMineBeyondBackup") {
          testWindow.__idleMineBeyondWriteAttempts?.push(key);
        }
        if (testWindow.__idleMineBeyondFailKey === key) {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        originalSetItem.call(this, key, value);
      };
    });

    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await page.locator("[data-game-tab='settings']").click();

    const settings = page.locator("article.settings");
    const showMineLevel = settings.locator('[data-setting="showMineObjLevel"]');
    const showCraftDamage = settings.locator(
      '[data-setting="showMinCraftDamage"]',
    );
    const initialShowMineLevel = await showMineLevel.isChecked();

    await showMineLevel.setChecked(!initialShowMineLevel);
    await settings.getByRole("button", { name: "Save" }).click();
    const firstPrimary = await page.evaluate(
      (key) => localStorage.getItem(key),
      primarySaveKey,
    );
    expect(firstPrimary).not.toBeNull();
    await page.locator("[data-game-tab='mining']").click();
    await expect(page.locator(".messagelog p").first()).toHaveText(
      "Game Saved!",
    );
    await page.locator("[data-game-tab='settings']").click();

    await showCraftDamage.setChecked(true);
    await settings.getByRole("button", { name: "Save" }).click();
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), primarySaveKey),
      )
      .not.toBe(firstPrimary);
    await page.locator("[data-game-tab='mining']").click();
    const baselineMessages = await page
      .locator(".messagelog p")
      .allTextContents();
    await page.locator("[data-game-tab='settings']").click();

    const baseline = await page.evaluate(
      ({ primaryKey, backupKey }) => ({
        primary: localStorage.getItem(primaryKey),
        backup: localStorage.getItem(backupKey),
      }),
      { primaryKey: primarySaveKey, backupKey: backupSaveKey },
    );
    expect(baseline.primary).not.toBeNull();
    expect(baseline.backup).toBe(firstPrimary);

    await showMineLevel.setChecked(initialShowMineLevel);
    await page.evaluate((key) => {
      const testWindow = window as Window & {
        __idleMineBeyondFailKey?: string | null;
        __idleMineBeyondWriteAttempts?: string[];
      };
      testWindow.__idleMineBeyondFailKey = key;
      testWindow.__idleMineBeyondWriteAttempts = [];
    }, failureKey);

    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings.getByRole("alert")).toHaveText(
      "Save failed: storageFailed",
    );

    const failedWrite = await page.evaluate(
      ({ primaryKey, backupKey }) => {
        const testWindow = window as Window & {
          __idleMineBeyondWriteAttempts?: string[];
        };
        return {
          primary: localStorage.getItem(primaryKey),
          backup: localStorage.getItem(backupKey),
          attempts: testWindow.__idleMineBeyondWriteAttempts,
        };
      },
      { primaryKey: primarySaveKey, backupKey: backupSaveKey },
    );

    expect(failedWrite.primary).toBe(baseline.primary);
    expect(failedWrite.attempts).toEqual(
      failureKey === backupSaveKey
        ? [backupSaveKey]
        : [backupSaveKey, primarySaveKey],
    );
    expect(failedWrite.backup).toBe(
      failureKey === backupSaveKey ? baseline.backup : baseline.primary,
    );

    await page.locator("[data-game-tab='mining']").click();
    await expect(
      page.locator(".messagelog p").allTextContents(),
    ).resolves.toEqual(baselineMessages);
    await page.locator("[data-game-tab='settings']").click();

    await page.evaluate(() => {
      const testWindow = window as Window & {
        __idleMineBeyondFailKey?: string | null;
        __idleMineBeyondWriteAttempts?: string[];
      };
      testWindow.__idleMineBeyondFailKey = null;
      testWindow.__idleMineBeyondWriteAttempts = [];
    });
    await settings.getByRole("button", { name: "Save" }).click();
    await expect(settings.getByRole("alert")).toBeHidden();

    const recoveredWrite = await page.evaluate(
      ({ primaryKey, backupKey }) => {
        const testWindow = window as Window & {
          __idleMineBeyondWriteAttempts?: string[];
        };
        const serialized = localStorage.getItem(primaryKey);
        if (!serialized)
          throw new Error("Retry did not write the primary save.");
        return {
          primary: JSON.parse(serialized) as {
            state: { settings: { showMineObjLevel: boolean } };
          },
          backup: localStorage.getItem(backupKey),
          attempts: testWindow.__idleMineBeyondWriteAttempts,
        };
      },
      { primaryKey: primarySaveKey, backupKey: backupSaveKey },
    );

    expect(recoveredWrite.primary.state.settings.showMineObjLevel).toBe(
      initialShowMineLevel,
    );
    expect(recoveredWrite.backup).toBe(baseline.primary);
    expect(recoveredWrite.attempts).toEqual([backupSaveKey, primarySaveKey]);
    await page.locator("[data-game-tab='mining']").click();
    await expect(
      page.locator(".messagelog p").allTextContents(),
    ).resolves.toEqual(["Game Saved!", ...baselineMessages].slice(0, 6));
  });
}
