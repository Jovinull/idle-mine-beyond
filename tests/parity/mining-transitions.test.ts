import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  advanceRemixAutoPickaxeTimer,
  advanceRemixSaveTimer,
  applyRemixMiningHit,
  calculateRemixActiveDamage,
  calculateRemixHighestDamageableMineObjectLevel,
  calculateRemixIdleDamage,
  calculateRemixMiningFactors,
  getRemixMineObject,
  performRemixMiningAction,
  type RemixMineObjectCatalog,
  type RemixMiningTransitionState,
} from "../../packages/core/src/index.js";

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type MiningResources = {
  money: string;
  highestMoney: string;
  gems: string;
  planetCoins: string;
  maxPlanetCoins: string;
  wisdom: string;
  maxWisdom: string;
};

type CapturedMiningHit = {
  name: string;
  input: {
    action: "activeClick" | "idleTick";
    objectId: number;
    currentHp: string;
    highestMineObjectLevel: number;
    pickaxe: { power: string; quality: string };
    powers: string[];
    resources: MiningResources;
    upgrades: Record<string, Record<string, number>>;
    autoPickaxeTimer: number;
    saveTimer: number;
    elapsedMilliseconds: number;
    randomValues: number[];
  };
  effects: {
    gemChance: DecimalSnapshot;
    gemMultiplier: DecimalSnapshot;
    lastObjectGemMultiplier: DecimalSnapshot;
    powerWisdom: DecimalSnapshot;
    miningPowerGainMultiplier: DecimalSnapshot;
  };
  highestDamageableMineObjectLevel: number;
  result: {
    hitOccurred: boolean;
    hitDamage: DecimalSnapshot;
    damagedObjectHp: DecimalSnapshot;
    currentObjectHp: DecimalSnapshot;
    currentObjectWasReplaced: boolean;
    resources: Record<string, DecimalSnapshot>;
    highestMineObjectLevel: number;
    miningPower: DecimalSnapshot;
    autoPickaxeTimer: number;
    saveTimer: number;
    randomCalls: number;
    frameEvents: ("save" | "refreshStoryNotifications")[];
  };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    miningHitSemantics: {
      sourcePaths: string[];
      randomSource: string;
      cases: CapturedMiningHit[];
    };
  };
};

function safeNumber(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

function snapshotDecimal(value: Decimal): DecimalSnapshot {
  return {
    decimal: value.toString(),
    mantissa: safeNumber(value.mantissa),
    exponent: safeNumber(value.exponent),
  };
}

function levelsForCase(input: CapturedMiningHit["input"]) {
  const get = (family: string, key: string) =>
    input.upgrades[family]?.[key] ?? 0;
  return {
    money: {
      activePower: get("money", "activePower"),
      idlePower: get("money", "idlePower"),
      idleSpeed: get("money", "idleSpeed"),
      gemChance: get("money", "gemChance"),
    },
    gems: {
      idlePower: get("gems", "idlePower"),
      gemChance: get("gems", "gemChance"),
      gemMultiply: get("gems", "gemMultiply"),
    },
    planetCoins: {
      activePower: get("planetCoins", "activePower"),
      gemChance: get("planetCoins", "gemChance"),
      gemMultiply: get("planetCoins", "gemMultiply"),
      lastObjGems: get("planetCoins", "lastObjGems"),
    },
    wisdom: input.upgrades["wisdom"] ?? {},
  };
}

function snapshotResources(
  resources: RemixMiningTransitionState["resources"],
): Record<string, DecimalSnapshot> {
  return Object.fromEntries(
    Object.entries(resources).map(([key, value]) => [
      key,
      snapshotDecimal(new Decimal(value)),
    ]),
  );
}

it("matches captured Remix auto-pickaxe threshold and single-hit timing", () => {
  const cases = corpus.data.miningHitSemantics.cases.filter(
    ({ input, name }) =>
      input.action === "idleTick" && name.startsWith("idle-timer"),
  );
  expect(cases).toHaveLength(2);

  for (const scenario of cases) {
    const factors = calculateRemixMiningFactors({
      levels: levelsForCase(scenario.input),
      powers: {
        mining: scenario.input.powers[0]!,
        exquisity: scenario.input.powers[4]!,
      },
      highestMineObjectLevel: scenario.input.highestMineObjectLevel,
      currentObjectIsHighestDamageable: false,
    });
    const tick = advanceRemixAutoPickaxeTimer({
      timer: scenario.input.autoPickaxeTimer,
      deltaSeconds: scenario.input.elapsedMilliseconds / 1000,
      idleSpeed: factors.idleSpeed,
    });

    expect(tick.shouldHit, scenario.name).toBe(scenario.result.hitOccurred);
    expect(tick.timer, scenario.name).toBe(scenario.result.autoPickaxeTimer);
  }
});

it("matches captured update-frame save scheduling and event order", () => {
  const cases = corpus.data.miningHitSemantics.cases.filter(
    ({ input }) => input.action === "idleTick",
  );

  for (const scenario of cases) {
    const save = advanceRemixSaveTimer({
      timer: scenario.input.saveTimer,
      deltaSeconds: scenario.input.elapsedMilliseconds / 1000,
    });
    expect(save.timer, scenario.name).toBe(scenario.result.saveTimer);
    expect(save.shouldSave, scenario.name).toBe(
      scenario.result.frameEvents.includes("save"),
    );
    expect(scenario.result.frameEvents, scenario.name).toEqual(
      save.shouldSave
        ? ["save", "refreshStoryNotifications"]
        : ["refreshStoryNotifications"],
    );
  }

  for (const scenario of corpus.data.miningHitSemantics.cases.filter(
    ({ input }) => input.action === "activeClick",
  )) {
    expect(scenario.result.frameEvents, scenario.name).toEqual([]);
  }
});

it("matches captured Remix object damage, rewards, RNG order, and power growth", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(corpus.data.miningHitSemantics.sourcePaths).toEqual([
    "Scripts/main.js",
    "Scripts/Define/functions.js",
    "Scripts/mineobject.js",
  ]);
  expect(corpus.data.miningHitSemantics.randomSource).toBe("Math.random");

  for (const scenario of corpus.data.miningHitSemantics.cases) {
    const input = scenario.input;
    const object = getRemixMineObject(
      input.objectId,
      corpus.data.mineObjectCatalog,
    );
    object.hp = new Decimal(input.currentHp);
    const factors = calculateRemixMiningFactors({
      levels: levelsForCase(input),
      powers: {
        mining: input.powers[0]!,
        exquisity: input.powers[4]!,
      },
      highestMineObjectLevel: input.highestMineObjectLevel,
      currentObjectIsHighestDamageable: false,
    });
    const mining = {
      object,
      pickaxe: input.pickaxe,
      factors,
    };
    const highestDamageableMineObjectLevel =
      calculateRemixHighestDamageableMineObjectLevel({
        currentMineObjectLevel: input.objectId,
        mining,
        catalog: corpus.data.mineObjectCatalog,
      });
    expect(
      highestDamageableMineObjectLevel,
      `${scenario.name} highest damageable object`,
    ).toBe(scenario.highestDamageableMineObjectLevel);

    const hitDamage =
      input.action === "activeClick"
        ? calculateRemixActiveDamage(mining)
        : calculateRemixIdleDamage(mining);
    expect(snapshotDecimal(hitDamage), `${scenario.name} hit damage`).toEqual(
      scenario.result.hitDamage,
    );

    const state: RemixMiningTransitionState = Object.freeze({
      mineObjectLevel: input.objectId,
      highestMineObjectLevel: input.highestMineObjectLevel,
      currentObject: Object.freeze(object),
      resources: Object.freeze({ ...input.resources }),
      powers: Object.freeze({
        mining: input.powers[0]!,
        wisdom: scenario.effects.powerWisdom.decimal,
      }),
    });
    const shouldHit =
      input.action === "activeClick" ||
      advanceRemixAutoPickaxeTimer({
        timer: input.autoPickaxeTimer,
        deltaSeconds: input.elapsedMilliseconds / 1000,
        idleSpeed: factors.idleSpeed,
      }).shouldHit;

    let nextState = state;
    let damagedObjectHp = object.hp;
    let objectBroken = false;
    let randomCalls = 0;
    if (shouldHit) {
      const result = applyRemixMiningHit({
        state,
        damage: hitDamage,
        highestDamageableMineObjectLevel,
        effects: {
          gemChance: scenario.effects.gemChance.decimal,
          gemMultiplier: scenario.effects.gemMultiplier.decimal,
          lastObjectGemMultiplier:
            scenario.effects.lastObjectGemMultiplier.decimal,
          miningPowerGainMultiplier:
            scenario.effects.miningPowerGainMultiplier.decimal,
        },
        random: {
          nextDouble() {
            const value = input.randomValues[randomCalls];
            if (value === undefined) {
              throw new Error(`${scenario.name} exhausted its RNG fixture.`);
            }
            randomCalls++;
            return value;
          },
        },
      });
      nextState = result.state;
      damagedObjectHp = result.damagedObjectHp;
      objectBroken = result.objectBroken;
    }

    expect(
      {
        hitOccurred: shouldHit,
        hitDamage: snapshotDecimal(hitDamage),
        damagedObjectHp: snapshotDecimal(damagedObjectHp),
        currentObjectHp: snapshotDecimal(nextState.currentObject.hp),
        currentObjectWasReplaced: objectBroken,
        resources: snapshotResources(nextState.resources),
        highestMineObjectLevel: nextState.highestMineObjectLevel,
        miningPower: snapshotDecimal(new Decimal(nextState.powers.mining)),
        autoPickaxeTimer:
          input.action === "idleTick"
            ? advanceRemixAutoPickaxeTimer({
                timer: input.autoPickaxeTimer,
                deltaSeconds: input.elapsedMilliseconds / 1000,
                idleSpeed: factors.idleSpeed,
              }).timer
            : input.autoPickaxeTimer,
        randomCalls,
      },
      scenario.name,
    ).toEqual({
      hitOccurred: scenario.result.hitOccurred,
      hitDamage: scenario.result.hitDamage,
      damagedObjectHp: scenario.result.damagedObjectHp,
      currentObjectHp: scenario.result.currentObjectHp,
      currentObjectWasReplaced: scenario.result.currentObjectWasReplaced,
      resources: scenario.result.resources,
      highestMineObjectLevel: scenario.result.highestMineObjectLevel,
      miningPower: scenario.result.miningPower,
      autoPickaxeTimer: scenario.result.autoPickaxeTimer,
      randomCalls: scenario.result.randomCalls,
    });
  }
});

it("matches source cases through the injected-state mining action boundary", () => {
  for (const scenario of corpus.data.miningHitSemantics.cases) {
    const input = scenario.input;
    const currentObject = getRemixMineObject(
      input.objectId,
      corpus.data.mineObjectCatalog,
    );
    currentObject.hp = new Decimal(input.currentHp);
    Object.freeze(currentObject.colors);
    for (const drop of Object.values(currentObject.drops)) Object.freeze(drop);
    Object.freeze(currentObject.drops);
    const upgrades = levelsForCase(input);
    for (const family of Object.values(upgrades)) Object.freeze(family);
    const state = Object.freeze({
      mineObjectLevel: input.objectId,
      highestMineObjectLevel: input.highestMineObjectLevel,
      currentObject: Object.freeze(currentObject),
      resources: Object.freeze({ ...input.resources }),
      powers: Object.freeze({
        mining: input.powers[0]!,
        wisdom: scenario.effects.powerWisdom.decimal,
        exquisity: input.powers[4]!,
      }),
      pickaxe: Object.freeze(input.pickaxe),
      upgrades: Object.freeze(upgrades),
      autoPickaxeTimer: input.autoPickaxeTimer,
      saveTimer: input.saveTimer,
    });
    let randomCalls = 0;
    const result = performRemixMiningAction({
      state,
      action: input.action,
      deltaSeconds: input.elapsedMilliseconds / 1000,
      catalog: corpus.data.mineObjectCatalog,
      random: {
        nextDouble() {
          const value = input.randomValues[randomCalls];
          if (value === undefined) {
            throw new Error(`${scenario.name} exhausted its RNG fixture.`);
          }
          randomCalls++;
          return value;
        },
      },
    });

    expect(
      {
        hitOccurred: result.hitOccurred,
        hitDamage: snapshotDecimal(result.hitDamage),
        damagedObjectHp: snapshotDecimal(result.damagedObjectHp),
        currentObjectHp: snapshotDecimal(result.state.currentObject.hp),
        objectBroken: result.objectBroken,
        resources: snapshotResources(result.state.resources),
        highestMineObjectLevel: result.state.highestMineObjectLevel,
        wisdomPower: snapshotDecimal(new Decimal(result.state.powers.wisdom)),
        exquisityPower: snapshotDecimal(
          new Decimal(result.state.powers.exquisity),
        ),
        miningPower: snapshotDecimal(new Decimal(result.state.powers.mining)),
        autoPickaxeTimer: result.state.autoPickaxeTimer,
        saveTimer: result.state.saveTimer,
        frameEvents: result.frameEvents,
        highestDamageableMineObjectLevel:
          result.highestDamageableMineObjectLevel,
        randomCalls,
      },
      scenario.name,
    ).toEqual({
      hitOccurred: scenario.result.hitOccurred,
      hitDamage: scenario.result.hitDamage,
      damagedObjectHp: scenario.result.damagedObjectHp,
      currentObjectHp: scenario.result.currentObjectHp,
      objectBroken: scenario.result.currentObjectWasReplaced,
      resources: scenario.result.resources,
      highestMineObjectLevel: scenario.result.highestMineObjectLevel,
      wisdomPower: scenario.effects.powerWisdom,
      exquisityPower: snapshotDecimal(new Decimal(input.powers[4]!)),
      miningPower: scenario.result.miningPower,
      autoPickaxeTimer: scenario.result.autoPickaxeTimer,
      saveTimer: scenario.result.saveTimer,
      highestDamageableMineObjectLevel:
        scenario.highestDamageableMineObjectLevel,
      randomCalls: scenario.result.randomCalls,
      frameEvents: scenario.result.frameEvents,
    });
  }
});
