import { expect, test } from "@playwright/test";

const primarySaveKey = "IdleMineBeyond";
const backupSaveKey = "IdleMineBeyondBackup";
const legacySaveKey = "IdleMine";

for (const failureKey of [primarySaveKey, backupSaveKey]) {
  test(`preserves saves and requests recovery when ${failureKey} cannot be read`, async ({
    page,
  }) => {
    await page.addInitScript(
      ({ failureKey: storageFailureKey, primaryKey, backupKey, legacyKey }) => {
        type StorageReadFailureWindow = Window & {
          __idleMineStorageReadAttempts?: string[];
          __idleMineStorageWriteAttempts?: string[];
          __idleMineReadSlots?: () => Record<string, string | null>;
        };

        localStorage.clear();
        localStorage.setItem(
          primaryKey,
          storageFailureKey === primaryKey
            ? "preserve-primary"
            : "invalid-primary-to-enter-backup-read",
        );
        localStorage.setItem(backupKey, "preserve-backup");
        localStorage.setItem(legacyKey, "preserve-legacy-save");
        Date.now = () => 1_700_000_000_000;

        const testWindow = window as StorageReadFailureWindow;
        testWindow.__idleMineStorageReadAttempts = [];
        testWindow.__idleMineStorageWriteAttempts = [];

        const originalGetItem = Storage.prototype.getItem;
        const originalSetItem = Storage.prototype.setItem;
        testWindow.__idleMineReadSlots = () => ({
          [primaryKey]: originalGetItem.call(localStorage, primaryKey),
          [backupKey]: originalGetItem.call(localStorage, backupKey),
          [legacyKey]: originalGetItem.call(localStorage, legacyKey),
        });
        Storage.prototype.getItem = function getItem(key) {
          testWindow.__idleMineStorageReadAttempts?.push(key);
          if (key === storageFailureKey) {
            throw new DOMException("Storage access blocked", "SecurityError");
          }
          return originalGetItem.call(this, key);
        };
        Storage.prototype.setItem = function setItem(key, value) {
          testWindow.__idleMineStorageWriteAttempts?.push(key);
          originalSetItem.call(this, key, value);
        };
      },
      {
        failureKey,
        primaryKey: primarySaveKey,
        backupKey: backupSaveKey,
        legacyKey: legacySaveKey,
      },
    );

    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "recovery",
    );
    const recovery = page.getByRole("alert");
    await expect(
      recovery.getByRole("heading", { name: "Save needs attention" }),
    ).toBeVisible();
    await expect(recovery).toContainText(
      "Beyond save could not be loaded safely.",
    );

    const startup = await page.evaluate(() => {
      const testWindow = window as Window & {
        __idleMineStorageReadAttempts?: string[];
        __idleMineStorageWriteAttempts?: string[];
        __idleMineReadSlots?: () => Record<string, string | null>;
      };
      return {
        reads: testWindow.__idleMineStorageReadAttempts,
        writes: testWindow.__idleMineStorageWriteAttempts,
        slots: testWindow.__idleMineReadSlots?.(),
      };
    });
    expect(startup.reads).toEqual(
      failureKey === primarySaveKey
        ? [primarySaveKey]
        : [primarySaveKey, backupSaveKey],
    );
    expect(startup.writes).toEqual([]);
    expect(startup.slots).toEqual({
      [primarySaveKey]:
        failureKey === primarySaveKey
          ? "preserve-primary"
          : "invalid-primary-to-enter-backup-read",
      [backupSaveKey]: "preserve-backup",
      [legacySaveKey]: "preserve-legacy-save",
    });

    await recovery
      .getByRole("button", { name: "Download recovery data" })
      .click();
    await expect(page.locator("[data-recovery-result]")).toHaveText(
      "Could not read recovery data: Storage access blocked",
    );
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "recovery",
    );

    const afterExportFailure = await page.evaluate(() => {
      const testWindow = window as Window & {
        __idleMineStorageReadAttempts?: string[];
        __idleMineStorageWriteAttempts?: string[];
        __idleMineReadSlots?: () => Record<string, string | null>;
      };
      return {
        reads: testWindow.__idleMineStorageReadAttempts,
        writes: testWindow.__idleMineStorageWriteAttempts,
        slots: testWindow.__idleMineReadSlots?.(),
      };
    });
    expect(afterExportFailure.reads).toEqual(
      failureKey === primarySaveKey
        ? [primarySaveKey, primarySaveKey, backupSaveKey, legacySaveKey]
        : [
            primarySaveKey,
            backupSaveKey,
            primarySaveKey,
            backupSaveKey,
            legacySaveKey,
          ],
    );
    expect(afterExportFailure.writes).toEqual([]);
    expect(afterExportFailure.slots).toEqual(startup.slots);
  });
}
