import {
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "./mine-objects.js";
import type { RemixSimulationState } from "./remix-simulation-state.js";

/** Reproduces Remix's guarded mine-object selection and full-object reset. */
export function selectRemixMineObject(
  state: RemixSimulationState,
  level: number,
  catalog: RemixMineObjectCatalog,
): RemixSimulationState {
  if (level < 0 || level > state.highestMineObjectLevel) return state;

  return {
    ...state,
    mineObjectLevel: level,
    currentObject: getRemixMineObject(level, catalog),
  };
}
