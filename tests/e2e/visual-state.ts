import { readFile } from "node:fs/promises";
import {
  createInitialRemixSimulationState,
  Decimal,
  getRemixMineObject,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  encodeRemixBeyondSave,
} from "../../packages/persistence/src/index.js";

type VisualState = {
  readonly clockMs: number;
  readonly theme: "light" | "dark";
  readonly tab: "main" | "settings";
};

type StoryVisualState = {
  readonly clockMs: number;
  readonly theme: "light" | "dark";
  readonly source: {
    readonly mineObjectLevel: number;
    readonly highestMineObjectLevel: number;
    readonly currentObjectHp: string;
    readonly money: string;
    readonly highestMoney?: string;
    readonly gems: string;
    readonly pickaxeName: string;
    readonly pickaxePower: string;
    readonly pickaxeQuality: string;
    readonly blacksmithLevel: number;
    readonly story: {
      readonly page: number;
      readonly highestUnlocked: number;
      readonly notifications: number;
    };
  };
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

/** Builds a Beyond save from one exact source-captured Story screen state. */
export async function createBeyondStoryVisualSave({
  clockMs,
  theme,
  source,
}: StoryVisualState): Promise<string> {
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
  const simulation = {
    ...initial.simulation,
    mineObjectLevel: source.mineObjectLevel,
    highestMineObjectLevel: source.highestMineObjectLevel,
    currentObject: getRemixMineObject(source.mineObjectLevel, catalog),
    resources: {
      ...initial.simulation.resources,
      money: new Decimal(source.money),
      highestMoney: new Decimal(source.highestMoney ?? source.money),
      gems: new Decimal(source.gems),
    },
    pickaxe: {
      name: source.pickaxeName,
      power: new Decimal(source.pickaxePower),
      quality: new Decimal(source.pickaxeQuality),
    },
    upgrades: {
      ...initial.simulation.upgrades,
      money: {
        ...initial.simulation.upgrades.money,
        blacksmith: source.blacksmithLevel,
      },
    },
    lastActiveMs: clockMs,
    story: { ...source.story },
  };
  return encodeRemixBeyondSave({
    ...initial,
    simulation,
    settings: { ...initial.settings, theme, tab: "story" },
  });
}
