import { expect, test } from "@playwright/test";

const primarySaveKey = "IdleMineBeyond";
const backupSaveKey = "IdleMineBeyondBackup";

test("surfaces an actual browser storage quota failure without confirming a save", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const quotaProbe = await page.evaluate(() => {
    type QuotaTestWindow = Window & {
      __idleMineQuotaProbe?: {
        readonly errorName: string;
        readonly keysWritten: number;
        readonly storageLength: number;
        readonly writeAttempts: string[];
        readonly writeErrors: Array<{ key: string; name: string }>;
      };
    };

    const primaryKey = "IdleMineBeyond";
    const backupKey = "IdleMineBeyondBackup";
    localStorage.clear();

    const chunk = "q".repeat(1024);
    let keysWritten = 0;
    let errorName = "";
    for (let index = 0; index < 10_000; index += 1) {
      try {
        localStorage.setItem(`__quota_probe_${index}`, chunk);
        keysWritten += 1;
      } catch (error) {
        errorName = error instanceof DOMException ? error.name : "unknown";
        break;
      }
    }
    if (errorName !== "QuotaExceededError") {
      throw new Error(
        `Expected a real browser quota error, received ${errorName || "none"}.`,
      );
    }

    const writeAttempts: string[] = [];
    const writeErrors: Array<{ key: string; name: string }> = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === primaryKey || key === backupKey) {
        writeAttempts.push(key);
      }
      try {
        originalSetItem.call(this, key, value);
      } catch (error) {
        if (key === primaryKey || key === backupKey) {
          writeErrors.push({
            key,
            name: error instanceof DOMException ? error.name : "unknown",
          });
        }
        throw error;
      }
    };

    const primaryPresent = localStorage.getItem(primaryKey) !== null;
    const backupPresent = localStorage.getItem(backupKey) !== null;
    (window as QuotaTestWindow).__idleMineQuotaProbe = {
      errorName,
      keysWritten,
      storageLength: localStorage.length,
      writeAttempts,
      writeErrors,
    };
    return { errorName, keysWritten, primaryPresent, backupPresent };
  });

  expect(quotaProbe.errorName).toBe("QuotaExceededError");
  expect(quotaProbe.keysWritten).toBeGreaterThan(0);
  expect(quotaProbe.primaryPresent).toBe(false);
  expect(quotaProbe.backupPresent).toBe(false);

  const settings = page.locator("article.settings");
  await settings.locator("[data-settings-save]").click();
  const result = await page.evaluate(() => {
    type QuotaTestWindow = Window & {
      __idleMineQuotaProbe?: {
        readonly errorName: string;
        readonly keysWritten: number;
        readonly storageLength: number;
        readonly writeAttempts: string[];
        readonly writeErrors: Array<{ key: string; name: string }>;
      };
    };
    const probe = (window as QuotaTestWindow).__idleMineQuotaProbe;
    if (!probe) throw new Error("The browser quota probe result is missing.");
    return {
      ...probe,
      storageLengthAfter: localStorage.length,
      primary: localStorage.getItem("IdleMineBeyond"),
      backup: localStorage.getItem("IdleMineBeyondBackup"),
    };
  });

  expect(result.writeAttempts, JSON.stringify(result)).toEqual([
    primarySaveKey,
  ]);
  expect(result.writeErrors, JSON.stringify(result)).toEqual([
    { key: primarySaveKey, name: "QuotaExceededError" },
  ]);
  await expect(settings.getByRole("alert")).toHaveText(
    "Save failed: storageFailed",
  );
  expect(result.errorName).toBe("QuotaExceededError");
  expect(result.primary).toBeNull();
  expect(result.backup).toBeNull();
  expect(result.storageLengthAfter).toBe(result.storageLength);

  await page.locator("[data-game-tab='mining']").click();
  await expect(page.locator(".messagelog")).not.toContainText("Game Saved!");
});
