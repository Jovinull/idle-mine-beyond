import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  REMIX_UPGRADE_KEYS,
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    initialState: {
      timer: { autoPickaxe: number; save: number };
      resources: Record<string, { decimal: string }>;
      progress: {
        mineObjectLevel: number;
        highestMineObjectLevel: number;
      };
      pickaxe: {
        name: string;
        pow: { decimal: string };
        quality: { decimal: string };
      };
      upgrades: Record<string, Record<string, { level: number }>>;
      powers: {
        unlocked: boolean;
        data: { values: { decimal: string }[] };
      };
      story: {
        page: number;
        highestUnlocked: number;
        notifications: number;
      };
      usedGemsLevel: number;
    };
    mineObjectCatalog: RemixMineObjectCatalog;
  };
};

it("constructs the source-observed fresh simulation state", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  const expected = corpus.data.initialState;
  const state = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );

  expect(state.mineObjectLevel).toBe(expected.progress.mineObjectLevel);
  expect(state.highestMineObjectLevel).toBe(
    expected.progress.highestMineObjectLevel,
  );
  expect(state.currentObject.id).toBe(0);
  expect(state.currentObject.name).toBe("Mud");
  expect(state.currentObject.hp.toString()).toBe(
    corpus.data.mineObjectCatalog.base[0]!.hp.decimal,
  );
  expect(state.currentObject.hp.toString()).toBe(
    state.currentObject.totalHp.toString(),
  );
  expect(
    Object.fromEntries(
      Object.entries(state.resources).map(([key, value]) => [
        key,
        value.toString(),
      ]),
    ),
  ).toEqual(
    Object.fromEntries(
      Object.entries(expected.resources).map(([key, value]) => [
        key,
        value.decimal,
      ]),
    ),
  );
  expect({
    name: state.pickaxe.name,
    power: state.pickaxe.power.toString(),
    quality: state.pickaxe.quality.toString(),
  }).toEqual({
    name: expected.pickaxe.name,
    power: expected.pickaxe.pow.decimal,
    quality: expected.pickaxe.quality.decimal,
  });
  expect(
    [
      state.powers.mining,
      state.powers.craftsmanship,
      state.powers.expertise,
      state.powers.wisdom,
      state.powers.exquisity,
    ].map((value) => value.toString()),
  ).toEqual(expected.powers.data.values.map(({ decimal }) => decimal));
  expect(state.upgrades).toEqual(
    Object.fromEntries(
      Object.entries(REMIX_UPGRADE_KEYS).map(([group, keys]) => [
        group,
        Object.fromEntries(
          keys.map((key) => [
            key,
            expected.upgrades[group === "wisdom" ? "powers" : group]![key]!
              .level,
          ]),
        ),
      ]),
    ),
  );
  expect(state.powersUnlocked).toBe(expected.powers.unlocked);
  expect(state.autoPickaxeTimer).toBe(expected.timer.autoPickaxe);
  expect(state.saveTimer).toBe(expected.timer.save);
  expect(state.usedGemsLevel).toBe(expected.usedGemsLevel);
  expect(state.story).toEqual({
    page: expected.story.page,
    highestUnlocked: expected.story.highestUnlocked,
    notifications: expected.story.notifications,
  });
});

it("returns independently mutable state instances", () => {
  const first = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  const second = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );

  expect(first).not.toBe(second);
  expect(first.resources.gems).not.toBe(second.resources.gems);
  expect(first.currentObject.colors).not.toBe(second.currentObject.colors);
  expect(first.upgrades.money).not.toBe(second.upgrades.money);
});
