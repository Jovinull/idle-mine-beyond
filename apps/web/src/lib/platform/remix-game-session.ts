import {
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixMiningRandom,
  type RemixOfflineClock,
  type RemixOfflineNumberFormatter,
  type RemixSimulationAction,
  type RemixSimulationActionResult,
  type RemixStoryMilestone,
} from "@idle-mine-beyond/core";
import { createInitialRemixSimulationState } from "@idle-mine-beyond/core";
import {
  createInitialRemixLegacySaveApplicationState,
  importRemixLegacySaveToBeyond,
  loadRemixBeyondSaveIntoState,
  persistRemixBeyondSave,
  type PersistRemixBeyondSaveResult,
  type RemixBeyondSaveConfirmationEffect,
  type RemixBeyondSaveStorageAdapter,
  type RemixLegacySaveApplicationState,
} from "@idle-mine-beyond/persistence";

export type RemixWebSessionEffect =
  | { readonly type: "setTheme"; readonly theme: string }
  | {
      readonly type: "logMessage";
      readonly message: string;
      readonly color: string;
    };

export type RemixWebSessionSource = "fresh" | "legacy" | "primary" | "backup";

type SaveFailure = Exclude<PersistRemixBeyondSaveResult, { status: "saved" }>;

export type RemixWebSessionInitialization =
  | {
      readonly status: "ready";
      readonly source: RemixWebSessionSource;
      readonly state: RemixLegacySaveApplicationState;
      readonly saveFailure?: SaveFailure;
    }
  | {
      readonly status: "recoveryRequired";
      readonly reason: string;
      readonly detail?: unknown;
    };

export type RemixWebSessionActionResult =
  | {
      readonly status: "applied";
      readonly result: RemixSimulationActionResult;
      readonly state: RemixLegacySaveApplicationState;
      readonly effects: RemixWebSessionEffect[];
    }
  | {
      readonly status: "persistenceFailed";
      readonly result: RemixSimulationActionResult;
      readonly state: RemixLegacySaveApplicationState;
      readonly persistence: SaveFailure;
      readonly effects: RemixWebSessionEffect[];
    }
  | {
      readonly status: "recoveryRequired";
      readonly initialization: RemixWebSessionInitialization;
    };

export interface RemixWebGameSession {
  initialize(): Promise<RemixWebSessionInitialization>;
  getState(): RemixLegacySaveApplicationState | undefined;
  dispatch(action: RemixSimulationAction): Promise<RemixWebSessionActionResult>;
}

export interface CreateRemixWebGameSessionInput {
  readonly catalog: RemixMineObjectCatalog;
  readonly storyMilestones: readonly RemixStoryMilestone[];
  readonly random: RemixMiningRandom;
  readonly clock: RemixOfflineClock;
  readonly storage: RemixBeyondSaveStorageAdapter;
  readonly readLegacySave: () => string | null | Promise<string | null>;
  readonly resolveNumberFormatter: (
    index: number,
  ) => RemixOfflineNumberFormatter;
  readonly dispatchEffect: (
    effect: RemixWebSessionEffect,
  ) => void | Promise<void>;
}

function initialApplicationState(
  catalog: RemixMineObjectCatalog,
): RemixLegacySaveApplicationState {
  return createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(catalog),
  );
}

function actionInput(
  state: RemixLegacySaveApplicationState["simulation"],
  action: RemixSimulationAction,
  numberFormatterIndex: number,
  input: CreateRemixWebGameSessionInput,
) {
  if (action.type === "activeClick" || action.type === "idleFrame") {
    return performRemixSimulationAction({
      state,
      action,
      catalog: input.catalog,
      storyMilestones: input.storyMilestones,
      random: input.random,
    });
  }
  if (action.type === "craftPickaxe") {
    return performRemixSimulationAction({
      state,
      action,
      catalog: input.catalog,
      random: input.random,
    });
  }
  if (action.type === "offlineLoad") {
    let formatter: RemixOfflineNumberFormatter | undefined;
    return performRemixSimulationAction({
      state,
      action,
      catalog: input.catalog,
      clock: input.clock,
      formatNumber(value, precision, limit, below1000) {
        formatter ??= input.resolveNumberFormatter(numberFormatterIndex);
        return formatter(value, precision, limit, below1000);
      },
    });
  }
  return performRemixSimulationAction({ state, action });
}

/**
 * Owns browser-session startup and serializes state transitions with their
 * persistence effects. The Svelte layer supplies state rendering and visible
 * effect handling; this module contains no DOM or storage globals.
 */
export function createRemixWebGameSession(
  input: CreateRemixWebGameSessionInput,
): RemixWebGameSession {
  let state: RemixLegacySaveApplicationState | undefined;
  let initialization: Promise<RemixWebSessionInitialization> | undefined;
  let actionQueue: Promise<void> = Promise.resolve();

  async function initializeOnce(): Promise<RemixWebSessionInitialization> {
    const beyond = await loadRemixBeyondSaveIntoState({
      storage: input.storage,
      catalog: input.catalog,
      clock: input.clock,
      resolveNumberFormatter: input.resolveNumberFormatter,
      dispatchEffect: input.dispatchEffect,
    });

    if (beyond.status === "loaded") {
      state = beyond.state;
      return {
        status: "ready",
        source: beyond.source,
        state,
      };
    }
    if (beyond.status === "persistenceFailed") {
      state = beyond.state;
      return {
        status: "ready",
        source: beyond.source,
        state,
        saveFailure: beyond.persistence,
      };
    }
    if (beyond.result.status !== "empty") {
      return {
        status: "recoveryRequired",
        reason: "Beyond save could not be loaded safely.",
        detail: beyond.result,
      };
    }

    let legacySave: string | null;
    try {
      legacySave = await input.readLegacySave();
    } catch (error) {
      return {
        status: "recoveryRequired",
        reason: "The legacy Remix save could not be read.",
        detail: error instanceof Error ? error.message : String(error),
      };
    }

    if (legacySave === null) {
      state = initialApplicationState(input.catalog);
      return { status: "ready", source: "fresh", state };
    }

    const migrated = await importRemixLegacySaveToBeyond({
      load: {
        state: initialApplicationState(input.catalog),
        saveString: legacySave,
        catalog: input.catalog,
        clock: input.clock,
        resolveNumberFormatter: input.resolveNumberFormatter,
      },
      storage: input.storage,
      dispatchEffect: input.dispatchEffect,
    });
    if (migrated.status === "legacyLoadFailed") {
      return {
        status: "recoveryRequired",
        reason: "The legacy Remix save could not be imported.",
        detail: migrated.result,
      };
    }

    state = migrated.loaded.state;
    if (migrated.status === "persistenceFailed") {
      return {
        status: "ready",
        source: "legacy",
        state,
        saveFailure: migrated.persistence,
      };
    }
    return { status: "ready", source: "legacy", state };
  }

  async function dispatchNow(
    action: RemixSimulationAction,
  ): Promise<RemixWebSessionActionResult> {
    const initialized = await initialize();
    if (initialized.status !== "ready") {
      return { status: "recoveryRequired", initialization: initialized };
    }
    const current = state;
    if (!current) throw new Error("Ready session has no application state.");

    const result = actionInput(
      current.simulation,
      action,
      current.settings.numberFormatterIndex,
      input,
    );
    let nextState: RemixLegacySaveApplicationState = {
      ...current,
      simulation: result.state,
    };
    state = nextState;
    const effects: RemixWebSessionEffect[] = [];

    const dispatchEffect = async (effect: RemixWebSessionEffect) => {
      await input.dispatchEffect(effect);
      effects.push(effect);
    };

    for (const effect of result.effects) {
      if (effect.type === "logMessage") {
        await dispatchEffect(effect);
        continue;
      }

      const saveTimestampMs =
        action.type === "offlineLoad" && effect.state.lastActiveMs !== undefined
          ? effect.state.lastActiveMs
          : input.clock.now();
      const persisted = await persistRemixBeyondSave({
        state: { ...current, simulation: effect.state },
        saveTimestampMs,
        storage: input.storage,
      });
      if (persisted.status !== "saved") {
        state = nextState;
        return {
          status: "persistenceFailed",
          result,
          state: nextState,
          persistence: persisted,
          effects,
        };
      }

      nextState = {
        ...nextState,
        simulation: { ...nextState.simulation, lastActiveMs: saveTimestampMs },
      };
      state = nextState;
      const confirmation: RemixBeyondSaveConfirmationEffect | null =
        persisted.confirmation;
      if (confirmation !== null) await dispatchEffect(confirmation);
    }

    return { status: "applied", result, state: nextState, effects };
  }

  function initialize(): Promise<RemixWebSessionInitialization> {
    initialization ??= initializeOnce();
    return initialization;
  }

  function dispatch(
    action: RemixSimulationAction,
  ): Promise<RemixWebSessionActionResult> {
    const task = actionQueue.then(() => dispatchNow(action));
    actionQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  return { initialize, getState: () => state, dispatch };
}
