import type { RemixMineObjectCatalog } from "./mine-objects.js";
import type { RemixSimulationState } from "./remix-simulation-state.js";
import { createInitialRemixSimulationState } from "./remix-simulation-state.js";

/**
 * Recreates the pinned `loadGame(initialGame, false, true)` state. Remix leaves
 * its two loop timers untouched and reloads `lastActive` from the startup
 * snapshot; the caller injects that timestamp from the platform boundary.
 */
export function createRemixHardResetSimulationState(
  current: RemixSimulationState,
  catalog: RemixMineObjectCatalog,
  initialGameTimestampMs: number,
): RemixSimulationState {
  const initial = createInitialRemixSimulationState(catalog);
  return {
    ...initial,
    autoPickaxeTimer: current.autoPickaxeTimer,
    saveTimer: current.saveTimer,
    lastActiveMs: initialGameTimestampMs,
  };
}
