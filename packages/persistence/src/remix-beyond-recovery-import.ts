import {
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixOfflineClock,
  type RemixOfflineNumberFormatter,
} from "@idle-mine-beyond/core";
import {
  decodeRemixBeyondRecoveryFile,
  type DecodeRemixBeyondRecoveryFileResult,
  type RemixBeyondRecoveryFileSource,
} from "./remix-beyond-recovery-file.js";
import { restoreRemixBeyondSave } from "./remix-beyond-save.js";
import {
  persistRemixBeyondSave,
  type PersistRemixBeyondSaveResult,
  type RemixBeyondSaveConfirmationEffect,
  type RemixBeyondSaveStorageAdapter,
} from "./remix-beyond-save-storage.js";
import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";

export type RemixBeyondRecoveryImportEffect =
  | { readonly type: "setTheme"; readonly theme: string }
  | {
      readonly type: "logMessage";
      readonly message: string;
      readonly color: string;
    }
  | RemixBeyondSaveConfirmationEffect;

type SaveFailure = Exclude<PersistRemixBeyondSaveResult, { status: "saved" }>;

export type ImportRemixBeyondRecoveryFileResult =
  | {
      readonly status: "recovered";
      readonly source: RemixBeyondRecoveryFileSource;
      readonly state: RemixLegacySaveApplicationState;
      readonly effects: RemixBeyondRecoveryImportEffect[];
    }
  | {
      readonly status: "fileRejected";
      readonly result: Exclude<
        DecodeRemixBeyondRecoveryFileResult,
        { status: "valid" }
      >;
    }
  | {
      readonly status: "persistenceFailed";
      readonly source: RemixBeyondRecoveryFileSource;
      readonly state: RemixLegacySaveApplicationState;
      readonly persistence: SaveFailure;
    };

/**
 * Restores a validated Beyond save from a recovery file, applies the normal
 * source-backed offline-load transition, then persists through the guarded
 * primary/backup coordinator. Invalid and future-version files never write.
 */
export async function importRemixBeyondRecoveryFile(input: {
  serialized: string;
  catalog: RemixMineObjectCatalog;
  clock: RemixOfflineClock;
  resolveNumberFormatter(index: number): RemixOfflineNumberFormatter;
  storage: RemixBeyondSaveStorageAdapter;
  dispatchEffect(effect: RemixBeyondRecoveryImportEffect): void | Promise<void>;
}): Promise<ImportRemixBeyondRecoveryFileResult> {
  const decoded = decodeRemixBeyondRecoveryFile(input.serialized);
  if (decoded.status !== "valid") {
    return { status: "fileRejected", result: decoded };
  }

  const restored = restoreRemixBeyondSave(decoded.save, input.catalog);
  const effects: RemixBeyondRecoveryImportEffect[] = [
    { type: "setTheme", theme: restored.settings.theme },
  ];
  let numberFormatter: RemixOfflineNumberFormatter | undefined;
  const offline = performRemixSimulationAction({
    state: restored.simulation,
    action: { type: "offlineLoad" },
    catalog: input.catalog,
    clock: input.clock,
    formatNumber(value, precision, limit, below1000) {
      numberFormatter ??= input.resolveNumberFormatter(
        restored.settings.numberFormatterIndex,
      );
      return numberFormatter(value, precision, limit, below1000);
    },
  });
  if (offline.type !== "offlineLoad") {
    throw new Error("Expected a Beyond recovery file to run offline loading.");
  }

  const state = { ...restored, simulation: offline.state };
  let offlineSaveEffectSeen = false;
  for (const effect of offline.effects) {
    if (effect.type === "logMessage") {
      effects.push(effect);
    } else {
      offlineSaveEffectSeen = true;
    }
  }

  const persisted = await persistRemixBeyondSave({
    state,
    saveTimestampMs: offline.state.lastActiveMs ?? Number.NaN,
    storage: input.storage,
    announceConfirmation: offlineSaveEffectSeen,
  });
  if (persisted.status !== "saved") {
    return {
      status: "persistenceFailed",
      source: decoded.source,
      state,
      persistence: persisted,
    };
  }
  if (persisted.confirmation !== null) effects.push(persisted.confirmation);

  for (const effect of effects) await input.dispatchEffect(effect);
  return {
    status: "recovered",
    source: decoded.source,
    state: persisted.state,
    effects,
  };
}
