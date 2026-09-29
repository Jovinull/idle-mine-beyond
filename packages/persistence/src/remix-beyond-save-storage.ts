import type { RemixMineObjectCatalog } from "@idle-mine-beyond/core";
import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";
import {
  decodeRemixBeyondSave,
  encodeRemixBeyondSave,
  restoreRemixBeyondSave,
  type DecodeRemixBeyondSaveResult,
} from "./remix-beyond-save.js";

export const REMIX_BEYOND_PRIMARY_SAVE_KEY = "IdleMineBeyond";
export const REMIX_BEYOND_BACKUP_SAVE_KEY = "IdleMineBeyondBackup";
export const REMIX_SAVE_CONFIRMED_MESSAGE = "Game Saved!";
export const REMIX_SAVE_CONFIRMED_COLOR = "#00a5ff";

export interface RemixBeyondSaveStorageAdapter {
  readPrimary(): Promise<string | null>;
  writePrimary(serialized: string): Promise<void>;
  readBackup(): Promise<string | null>;
  writeBackup(serialized: string): Promise<void>;
}

export interface RemixBeyondSaveConfirmationEffect {
  readonly type: "logMessage";
  readonly message: typeof REMIX_SAVE_CONFIRMED_MESSAGE;
  readonly color: typeof REMIX_SAVE_CONFIRMED_COLOR;
}

export type PersistRemixBeyondSaveResult =
  | {
      readonly status: "saved";
      readonly state: RemixLegacySaveApplicationState;
      readonly serialized: string;
      readonly confirmation: RemixBeyondSaveConfirmationEffect | null;
    }
  | {
      readonly status: "invalidState";
      readonly state: RemixLegacySaveApplicationState;
      readonly message: string;
    }
  | {
      readonly status: "storageFailed";
      readonly state: RemixLegacySaveApplicationState;
      readonly serialized: string;
      readonly message: string;
    }
  | {
      readonly status: "incompatibleSave";
      readonly state: RemixLegacySaveApplicationState;
      readonly serialized: string;
      readonly version: unknown;
    };

export type LoadRemixBeyondSaveResult =
  | {
      readonly status: "loaded";
      readonly source: "primary" | "backup";
      readonly state: RemixLegacySaveApplicationState;
    }
  | {
      readonly status: "unsupportedVersion";
      readonly source: "primary" | "backup";
      readonly version: unknown;
    }
  | { readonly status: "empty" }
  | {
      readonly status: "invalid";
      readonly primary: Exclude<
        DecodeRemixBeyondSaveResult,
        { status: "valid" }
      > | null;
      readonly backup: Exclude<
        DecodeRemixBeyondSaveResult,
        { status: "valid" }
      > | null;
    }
  | {
      readonly status: "storageFailed";
      readonly message: string;
      readonly primaryFailure?: Exclude<
        DecodeRemixBeyondSaveResult,
        { status: "valid" }
      > | null;
    };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Writes a source-timestamped state to the Beyond primary save. The caller
 * supplies the timestamp captured at the source save call; offline loading
 * already includes its captured save time in the returned state. A previous
 * primary is copied to the backup before replacement. Confirmation is
 * returned only after the primary write succeeds.
 */
export async function persistRemixBeyondSave(input: {
  state: RemixLegacySaveApplicationState;
  saveTimestampMs: number;
  storage: RemixBeyondSaveStorageAdapter;
  announceConfirmation?: boolean;
}): Promise<PersistRemixBeyondSaveResult> {
  const state: RemixLegacySaveApplicationState = {
    ...input.state,
    simulation: {
      ...input.state.simulation,
      lastActiveMs: input.saveTimestampMs,
    },
  };

  let serialized: string;
  try {
    serialized = encodeRemixBeyondSave(state);
  } catch (error) {
    return { status: "invalidState", state, message: errorMessage(error) };
  }

  try {
    const previous = await input.storage.readPrimary();
    if (previous !== null) {
      const previousResult = decodeRemixBeyondSave(previous);
      if (previousResult.status === "unsupportedVersion") {
        return {
          status: "incompatibleSave",
          state,
          serialized,
          version: previousResult.version,
        };
      }

      if (previousResult.status === "valid") {
        const existingBackup = await input.storage.readBackup();
        const backupResult =
          existingBackup === null
            ? null
            : decodeRemixBeyondSave(existingBackup);
        if (backupResult?.status === "unsupportedVersion") {
          return {
            status: "incompatibleSave",
            state,
            serialized,
            version: backupResult.version,
          };
        }
        await input.storage.writeBackup(previous);
      } else {
        const existingBackup = await input.storage.readBackup();
        const backupResult =
          existingBackup === null
            ? null
            : decodeRemixBeyondSave(existingBackup);
        if (backupResult?.status === "unsupportedVersion") {
          return {
            status: "incompatibleSave",
            state,
            serialized,
            version: backupResult.version,
          };
        }
        if (backupResult?.status !== "valid") {
          await input.storage.writeBackup(previous);
        }
      }
    }
    await input.storage.writePrimary(serialized);
  } catch (error) {
    return {
      status: "storageFailed",
      state,
      serialized,
      message: errorMessage(error),
    };
  }

  return {
    status: "saved",
    state,
    serialized,
    confirmation:
      input.announceConfirmation === false
        ? null
        : {
            type: "logMessage",
            message: REMIX_SAVE_CONFIRMED_MESSAGE,
            color: REMIX_SAVE_CONFIRMED_COLOR,
          },
  };
}

/**
 * Loads the primary save, falling back to the backup when it is missing or
 * invalid. Recovery is reported to the caller and never rewrites storage.
 */
export async function loadRemixBeyondSaveFromStorage(input: {
  storage: RemixBeyondSaveStorageAdapter;
  catalog: RemixMineObjectCatalog;
}): Promise<LoadRemixBeyondSaveResult> {
  let primaryText: string | null;
  try {
    primaryText = await input.storage.readPrimary();
  } catch (error) {
    return { status: "storageFailed", message: errorMessage(error) };
  }

  let primaryFailure: Exclude<
    DecodeRemixBeyondSaveResult,
    { status: "valid" }
  > | null = null;
  if (primaryText !== null) {
    const primary = decodeRemixBeyondSave(primaryText);
    if (primary.status === "valid") {
      return {
        status: "loaded",
        source: "primary",
        state: restoreRemixBeyondSave(primary.save, input.catalog),
      };
    }
    if (primary.status === "unsupportedVersion") {
      return {
        status: "unsupportedVersion",
        source: "primary",
        version: primary.version,
      };
    }
    primaryFailure = primary;
  }

  let backupText: string | null;
  try {
    backupText = await input.storage.readBackup();
  } catch (error) {
    return {
      status: "storageFailed",
      message: errorMessage(error),
      primaryFailure,
    };
  }

  let backupFailure: Exclude<
    DecodeRemixBeyondSaveResult,
    { status: "valid" }
  > | null = null;
  if (backupText !== null) {
    const backup = decodeRemixBeyondSave(backupText);
    if (backup.status === "valid") {
      return {
        status: "loaded",
        source: "backup",
        state: restoreRemixBeyondSave(backup.save, input.catalog),
      };
    }
    if (backup.status === "unsupportedVersion") {
      return {
        status: "unsupportedVersion",
        source: "backup",
        version: backup.version,
      };
    }
    backupFailure = backup;
  }

  if (primaryText === null && backupText === null) return { status: "empty" };
  return {
    status: "invalid",
    primary: primaryFailure,
    backup: backupFailure,
  };
}
