import { readFile } from "node:fs/promises";
import { createInitialRemixSimulationState } from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  encodeRemixBeyondSave,
} from "../../packages/persistence/src/index.js";

type VisualState = {
  readonly clockMs: number;
  readonly theme: "light" | "dark";
  readonly tab: "main" | "settings";
};

/** Builds a source-observed fresh save for deterministic full-screen E2E captures. */
export async function createFreshBeyondVisualSave({
  clockMs,
  theme,
  tab,
}: VisualState): Promise<string> {
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { mineObjectCatalog: unknown } };
  const catalog = reference.data.mineObjectCatalog as Parameters<
    typeof createInitialRemixSimulationState
  >[0];
  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(catalog),
  );
  return encodeRemixBeyondSave({
    ...initial,
    simulation: { ...initial.simulation, lastActiveMs: clockMs },
    settings: { ...initial.settings, theme, tab },
  });
}
