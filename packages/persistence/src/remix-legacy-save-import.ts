import {
  loadRemixLegacySaveIntoState,
  type LoadRemixLegacySaveInput,
  type LoadRemixLegacySaveResult,
  type RemixLegacySaveLoadEffect,
} from "./remix-legacy-save-load.js";
import {
  persistRemixBeyondSave,
  type PersistRemixBeyondSaveResult,
  type RemixBeyondSaveConfirmationEffect,
  type RemixBeyondSaveStorageAdapter,
} from "./remix-beyond-save-storage.js";

type LoadedLegacySave = Extract<
  LoadRemixLegacySaveResult,
  { status: "loaded" }
>;

type FailedBeyondSave = Exclude<
  PersistRemixBeyondSaveResult,
  { status: "saved" }
>;

export type RemixLegacySaveImportEffect =
  | Exclude<RemixLegacySaveLoadEffect, { type: "save" }>
  | RemixBeyondSaveConfirmationEffect;

export type ImportRemixLegacySaveToBeyondResult =
  | {
      readonly status: "imported";
      readonly loaded: LoadedLegacySave;
      readonly persisted: Extract<
        PersistRemixBeyondSaveResult,
        { status: "saved" }
      >[];
      readonly effects: RemixLegacySaveImportEffect[];
    }
  | {
      readonly status: "persistenceFailed";
      readonly loaded: LoadedLegacySave;
      readonly persistence: FailedBeyondSave;
      readonly persisted: Extract<
        PersistRemixBeyondSaveResult,
        { status: "saved" }
      >[];
      readonly effects: RemixLegacySaveImportEffect[];
    }
  | {
      readonly status: "legacyLoadFailed";
      readonly result: Exclude<LoadRemixLegacySaveResult, { status: "loaded" }>;
    };

/**
 * Applies the pinned legacy loader, dispatches its non-save effects in source
 * order, and writes the resulting state to the separate Beyond save keys.
 * The `IdleMine` legacy key is never read or removed by this migration path.
 */
export async function importRemixLegacySaveToBeyond(input: {
  load: LoadRemixLegacySaveInput;
  storage: RemixBeyondSaveStorageAdapter;
  dispatchEffect(effect: RemixLegacySaveImportEffect): void | Promise<void>;
}): Promise<ImportRemixLegacySaveToBeyondResult> {
  const loaded = loadRemixLegacySaveIntoState(input.load);
  if (loaded.status !== "loaded") {
    return { status: "legacyLoadFailed", result: loaded };
  }

  const effects: RemixLegacySaveImportEffect[] = [];
  const persisted: Extract<
    PersistRemixBeyondSaveResult,
    { status: "saved" }
  >[] = [];
  let sourceSaveEffectSeen = false;

  const dispatch = async (effect: RemixLegacySaveImportEffect) => {
    await input.dispatchEffect(effect);
    effects.push(effect);
  };

  for (const effect of loaded.effects) {
    if (effect.type !== "save") {
      await dispatch(effect);
      continue;
    }

    sourceSaveEffectSeen = true;
    const result = await persistRemixBeyondSave({
      state: effect.state,
      saveTimestampMs: effect.state.simulation.lastActiveMs ?? Number.NaN,
      storage: input.storage,
    });
    if (result.status !== "saved") {
      return {
        status: "persistenceFailed",
        loaded,
        persistence: result,
        persisted,
        effects,
      };
    }
    persisted.push(result);
    if (result.confirmation !== null) await dispatch(result.confirmation);
  }

  if (!sourceSaveEffectSeen) {
    const result = await persistRemixBeyondSave({
      state: loaded.state,
      saveTimestampMs: loaded.state.simulation.lastActiveMs ?? Number.NaN,
      storage: input.storage,
      announceConfirmation: false,
    });
    if (result.status !== "saved") {
      return {
        status: "persistenceFailed",
        loaded,
        persistence: result,
        persisted,
        effects,
      };
    }
    persisted.push(result);
  }

  return { status: "imported", loaded, persisted, effects };
}
