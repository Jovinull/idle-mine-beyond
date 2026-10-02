import {
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixOfflineClock,
  type RemixOfflineNumberFormatter,
  type RemixOfflineRewards,
  type RemixSimulationEffect,
} from "@idle-mine-beyond/core";
import {
  applyRemixLegacySaveFields,
  RemixLegacySaveApplicationError,
  type RemixLegacySaveApplicationEffect,
  type RemixLegacySaveApplicationState,
  type RemixLegacySaveClock,
  type RemixLegacySaveData,
} from "./remix-legacy-save-application.js";
import {
  decodeRemixLegacySave,
  type RemixLegacySaveDecodeResult,
} from "./remix-save-codec.js";

export type RemixLegacySaveLoadEffect =
  | RemixLegacySaveApplicationEffect
  | { type: "logMessage"; message: string; color: string }
  | { type: "save"; state: RemixLegacySaveApplicationState };

export type RemixLegacySaveNumberFormatterResolver = (
  formatterIndex: number,
) => RemixOfflineNumberFormatter;

export interface LoadRemixLegacySaveInput {
  state: RemixLegacySaveApplicationState;
  saveString: string;
  catalog: RemixMineObjectCatalog;
  clock: RemixLegacySaveClock & RemixOfflineClock;
  resolveNumberFormatter: RemixLegacySaveNumberFormatterResolver;
  noOffline?: boolean;
}

export type LoadRemixLegacySaveResult =
  | {
      status: "loaded";
      state: RemixLegacySaveApplicationState;
      elapsedSeconds: number;
      processedSeconds: number;
      applied: boolean;
      rewards: RemixOfflineRewards;
      effects: RemixLegacySaveLoadEffect[];
    }
  | {
      status: "applicationFailed";
      partialState: RemixLegacySaveApplicationState;
      effects: RemixLegacySaveApplicationEffect[];
      error: { name: string; message: string };
      evaluatedLastActiveFallbackMs?: number;
    }
  | Exclude<RemixLegacySaveDecodeResult, { status: "success" }>;

function toLoadedSaveEffect(
  effect: RemixSimulationEffect,
  applicationState: RemixLegacySaveApplicationState,
): RemixLegacySaveLoadEffect {
  if (effect.type === "save") {
    return {
      type: "save",
      state: { ...applicationState, simulation: effect.state },
    };
  }
  return effect;
}

/**
 * Decodes and applies one wrapped Remix save, then runs the source-ordered
 * offline-load transition. It performs no storage, DOM, or browser I/O.
 */
export function loadRemixLegacySaveIntoState(
  input: LoadRemixLegacySaveInput,
): LoadRemixLegacySaveResult {
  const decoded = decodeRemixLegacySave(input.saveString);
  if (decoded.status !== "success") return decoded;

  let application;
  try {
    application = applyRemixLegacySaveFields({
      state: input.state,
      save: decoded.value as RemixLegacySaveData,
      catalog: input.catalog,
      clock: input.clock,
    });
  } catch (error) {
    if (!(error instanceof RemixLegacySaveApplicationError)) throw error;
    return {
      status: "applicationFailed",
      partialState: error.partialState,
      effects: error.effects,
      error: { name: error.name, message: error.message },
      ...(error.evaluatedLastActiveFallbackMs === undefined
        ? {}
        : {
            evaluatedLastActiveFallbackMs: error.evaluatedLastActiveFallbackMs,
          }),
    };
  }
  let numberFormatter: RemixOfflineNumberFormatter | undefined;
  const formatNumber: RemixOfflineNumberFormatter = (
    value,
    precision,
    limit,
    below1000,
  ) => {
    numberFormatter ??= input.resolveNumberFormatter(
      application.state.settings.numberFormatterIndex,
    );
    return numberFormatter(value, precision, limit, below1000);
  };
  const offline = performRemixSimulationAction({
    state: application.state.simulation,
    action: {
      type: "offlineLoad",
      ...(input.noOffline === undefined ? {} : { noOffline: input.noOffline }),
      evaluatedLastActiveFallbackMs: application.evaluatedLastActiveFallbackMs,
    },
    catalog: input.catalog,
    clock: input.clock,
    formatNumber,
  });
  if (offline.type !== "offlineLoad") {
    throw new Error("Expected the legacy save to run an offline-load action.");
  }

  const state = { ...application.state, simulation: offline.state };
  return {
    status: "loaded",
    state,
    elapsedSeconds: offline.elapsedSeconds,
    processedSeconds: offline.processedSeconds,
    applied: offline.applied,
    rewards: offline.rewards,
    effects: [
      ...application.effects,
      ...offline.effects.map((effect) =>
        toLoadedSaveEffect(effect, application.state),
      ),
    ],
  };
}
