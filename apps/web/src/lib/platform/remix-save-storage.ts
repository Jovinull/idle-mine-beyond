import {
  REMIX_BEYOND_BACKUP_SAVE_KEY,
  REMIX_BEYOND_PRIMARY_SAVE_KEY,
  type RemixBeyondSaveStorageAdapter,
} from "@idle-mine-beyond/persistence";

type BrowserStorage = Pick<Storage, "getItem" | "setItem">;

export interface BrowserRemixRecoveryData {
  readonly format: "idle-mine-beyond-recovery";
  readonly version: 1;
  readonly saves: {
    readonly beyondPrimary: string | null;
    readonly beyondBackup: string | null;
    readonly remixLegacy: string | null;
  };
}

export const REMIX_LEGACY_SAVE_KEY = "IdleMine";

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

/** Clears all origin-local browser keys, matching Remix Hard Reset. */
export function clearBrowserRemixStorage(): void {
  window.localStorage.clear();
}

/** Reads, but never mutates or removes, the pinned Remix save key. */
export function readBrowserRemixLegacySave(
  providedStorage?: Pick<Storage, "getItem">,
): string | null {
  return (providedStorage ?? window.localStorage).getItem(
    REMIX_LEGACY_SAVE_KEY,
  );
}

/** Reads every save slot for an explicit user-requested recovery export. */
export function readBrowserRemixRecoveryData(
  providedStorage?: Pick<Storage, "getItem">,
): BrowserRemixRecoveryData {
  const storage = providedStorage ?? window.localStorage;
  return {
    format: "idle-mine-beyond-recovery",
    version: 1,
    saves: {
      beyondPrimary: storage.getItem(REMIX_BEYOND_PRIMARY_SAVE_KEY),
      beyondBackup: storage.getItem(REMIX_BEYOND_BACKUP_SAVE_KEY),
      remixLegacy: storage.getItem(REMIX_LEGACY_SAVE_KEY),
    },
  };
}

/** Reads native Beyond slots and the legacy browser key without mutating them. */
export async function readRemixRecoveryData(input: {
  readonly storage: RemixBeyondSaveStorageAdapter;
  readonly readLegacySave: () => string | null | Promise<string | null>;
}): Promise<BrowserRemixRecoveryData> {
  const [beyondPrimary, beyondBackup, remixLegacy] = await Promise.all([
    input.storage.readPrimary(),
    input.storage.readBackup(),
    input.readLegacySave(),
  ]);

  return {
    format: "idle-mine-beyond-recovery",
    version: 1,
    saves: { beyondPrimary, beyondBackup, remixLegacy },
  };
}
