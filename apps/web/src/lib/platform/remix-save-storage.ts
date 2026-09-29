import {
  REMIX_BEYOND_BACKUP_SAVE_KEY,
  REMIX_BEYOND_PRIMARY_SAVE_KEY,
  type RemixBeyondSaveStorageAdapter,
} from "@idle-mine-beyond/persistence";

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

/** Creates the webview adapter without exposing browser storage to game code. */
export function createBrowserRemixSaveStorage(
  providedStorage?: BrowserStorage,
): RemixBeyondSaveStorageAdapter {
  const getStorage = () => providedStorage ?? window.localStorage;
  return {
    async readPrimary() {
      return getStorage().getItem(REMIX_BEYOND_PRIMARY_SAVE_KEY);
    },
    async writePrimary(serialized) {
      getStorage().setItem(REMIX_BEYOND_PRIMARY_SAVE_KEY, serialized);
    },
    async readBackup() {
      return getStorage().getItem(REMIX_BEYOND_BACKUP_SAVE_KEY);
    },
    async writeBackup(serialized) {
      getStorage().setItem(REMIX_BEYOND_BACKUP_SAVE_KEY, serialized);
    },
  };
}
