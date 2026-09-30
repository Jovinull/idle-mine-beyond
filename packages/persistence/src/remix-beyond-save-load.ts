import {
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixOfflineClock,
  type RemixOfflineNumberFormatter,
} from "@idle-mine-beyond/core";
import {
  loadRemixBeyondSaveFromStorage,
  persistRemixBeyondSave,
  type LoadRemixBeyondSaveResult,
  type PersistRemixBeyondSaveResult,
  type RemixBeyondSaveConfirmationEffect,
  type RemixBeyondSaveStorageAdapter,
} from "./remix-beyond-save-storage.js";
import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";

export type RemixBeyondSaveLoadEffect =
  | { readonly type: "setTheme"; readonly theme: string }
  | {
      readonly type: "logMessage";
      readonly message: string;
      readonly color: string;
    }
  | RemixBeyondSaveConfirmationEffect;

type SaveFailure = Exclude<PersistRemixBeyondSaveResult, { status: "saved" }>;
type LoadFailure = Exclude<LoadRemixBeyondSaveResult, { status: "loaded" }>;

export type LoadRemixBeyondSaveIntoStateResult =
  | {
      readonly status: "loaded";
      readonly source: "primary" | "backup";
      readonly state: RemixLegacySaveApplicationState;
      readonly elapsedSeconds: number;
      readonly processedSeconds: number;
      readonly applied: boolean;
      readonly effects: RemixBeyondSaveLoadEffect[];
    }
  | {
      readonly status: "persistenceFailed";
      readonly source: "primary" | "backup";
      readonly state: RemixLegacySaveApplicationState;
      readonly elapsedSeconds: number;
      readonly processedSeconds: number;
      readonly applied: boolean;
      readonly persistence: SaveFailure;
      readonly effects: RemixBeyondSaveLoadEffect[];
    }
  | { readonly status: "loadFailed"; readonly result: LoadFailure };

/**
 * Restores a Beyond save, applies the same offline-load transition used by
 * Remix, and persists its source-ordered save effect before confirming it.
 */
export async function loadRemixBeyondSaveIntoState(input: {
  storage: RemixBeyondSaveStorageAdapter;
  catalog: RemixMineObjectCatalog;
  clock: RemixOfflineClock;
  resolveNumberFormatter(index: number): RemixOfflineNumberFormatter;
  dispatchEffect(effect: RemixBeyondSaveLoadEffect): void | Promise<void>;
}): Promise<LoadRemixBeyondSaveIntoStateResult> {
  const loaded = await loadRemixBeyondSaveFromStorage({
    storage: input.storage,
    catalog: input.catalog,
  });
  if (loaded.status !== "loaded") {
    return { status: "loadFailed", result: loaded };
  }

  const state = loaded.state;
  const effects: RemixBeyondSaveLoadEffect[] = [];
  const dispatch = async (effect: RemixBeyondSaveLoadEffect) => {
    await input.dispatchEffect(effect);
    effects.push(effect);
  };

  await dispatch({ type: "setTheme", theme: state.settings.theme });

  let numberFormatter: RemixOfflineNumberFormatter | undefined;
  const offline = performRemixSimulationAction({
    state: state.simulation,
    action: { type: "offlineLoad" },
    catalog: input.catalog,
    clock: input.clock,
    formatNumber(value, precision, limit, below1000) {
      numberFormatter ??= input.resolveNumberFormatter(
        state.settings.numberFormatterIndex,
      );
      return numberFormatter(value, precision, limit, below1000);
    },
  });
  if (offline.type !== "offlineLoad") {
    throw new Error("Expected the Beyond save to run an offline-load action.");
  }

  const nextState = { ...state, simulation: offline.state };
  for (const effect of offline.effects) {
    if (effect.type === "logMessage") {
      await dispatch(effect);
      continue;
    }

    const persisted = await persistRemixBeyondSave({
      state: { ...state, simulation: effect.state },
      saveTimestampMs: effect.state.lastActiveMs ?? Number.NaN,
      storage: input.storage,
    });
    if (persisted.status !== "saved") {
      return {
        status: "persistenceFailed",
        source: loaded.source,
        state: nextState,
        elapsedSeconds: offline.elapsedSeconds,
        processedSeconds: offline.processedSeconds,
        applied: offline.applied,
        persistence: persisted,
        effects,
      };
    }
    if (persisted.confirmation !== null) {
      await dispatch(persisted.confirmation);
    }
  }

  return {
    status: "loaded",
    source: loaded.source,
    state: nextState,
    elapsedSeconds: offline.elapsedSeconds,
    processedSeconds: offline.processedSeconds,
    applied: offline.applied,
    effects,
  };
}
