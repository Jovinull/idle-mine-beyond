import { Decimal, type DecimalSource } from "./decimal.js";
import type { MineObject, RemixMineObjectCatalog } from "./mine-objects.js";
import { getRemixMineObject } from "./mine-objects.js";
import {
  calculateRemixActiveDamage,
  calculateRemixIdleDamage,
  type RemixMiningInput,
} from "./mining-rates.js";
import {
  calculateRemixMiningFactors,
  calculateRemixMiningPowerGainMultiplier,
  type RemixMiningUpgradeLevels,
} from "./remix-mining-upgrades.js";

export type RemixMiningTransitionResources = {
  money: DecimalSource;
  highestMoney: DecimalSource;
  gems: DecimalSource;
  planetCoins: DecimalSource;
  maxPlanetCoins: DecimalSource;
  wisdom: DecimalSource;
  maxWisdom: DecimalSource;
};

export type RemixMiningTransitionState = {
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  currentObject: MineObject;
  resources: RemixMiningTransitionResources;
  powers: {
    mining: DecimalSource;
    wisdom: DecimalSource;
  };
};

export type RemixMiningRandom = {
  nextDouble(): number;
};

export type RemixMiningHitEffects = {
  gemChance: DecimalSource;
  gemMultiplier: DecimalSource;
  lastObjectGemMultiplier: DecimalSource;
  miningPowerGainMultiplier: DecimalSource;
};

export type RemixMiningHitResult = {
  state: RemixMiningTransitionState;
  damagedObjectHp: Decimal;
  objectBroken: boolean;
};

export type RemixMiningAction = "activeClick" | "idleTick";

export type RemixMiningActionState = RemixMiningTransitionState & {
  powers: RemixMiningTransitionState["powers"] & {
    exquisity: DecimalSource;
  };
  pickaxe: { power: DecimalSource; quality: DecimalSource };
  upgrades: RemixMiningUpgradeLevels;
  autoPickaxeTimer: number;
  saveTimer: number;
};

export type RemixMiningFrameEvent = "save" | "refreshStoryNotifications";

export type RemixMiningActionResult = {
  state: RemixMiningActionState;
  hitOccurred: boolean;
  hitDamage: Decimal;
  damagedObjectHp: Decimal;
  objectBroken: boolean;
  highestDamageableMineObjectLevel: number;
  frameEvents: RemixMiningFrameEvent[];
};

/**
 * Applies one source-compatible active click or idle hit to immutable state.
 * The caller supplies the damage, source-derived effects, highest-damageable
 * scan result, and random service used by the selected hit.
 */
export function applyRemixMiningHit(input: {
  state: RemixMiningTransitionState;
  damage: DecimalSource;
  highestDamageableMineObjectLevel: number;
  effects: RemixMiningHitEffects;
  random: RemixMiningRandom;
}): RemixMiningHitResult {
  const { state, damage, effects, random } = input;
  const damagedObjectHp = new Decimal(state.currentObject.hp).sub(damage);
  const objectBroken = damagedObjectHp.lte(0);
  const resources = { ...state.resources };
  let currentObject: MineObject = {
    ...state.currentObject,
    hp: damagedObjectHp,
  };
  let highestMineObjectLevel = state.highestMineObjectLevel;

  if (objectBroken) {
    resources.money = new Decimal(resources.money).add(
      state.currentObject.value,
    );
    resources.highestMoney = Decimal.max(
      resources.money,
      resources.highestMoney,
    );
    highestMineObjectLevel = Math.max(
      highestMineObjectLevel,
      state.mineObjectLevel + 1,
    );
    currentObject = {
      ...state.currentObject,
      hp: new Decimal(state.currentObject.totalHp),
    };

    if (random.nextDouble() < new Decimal(effects.gemChance).toNumber()) {
      const lastObjectBonus =
        state.mineObjectLevel === input.highestDamageableMineObjectLevel
          ? new Decimal(effects.lastObjectGemMultiplier)
          : new Decimal(1);
      resources.gems = Decimal.round(
        new Decimal(resources.gems).add(
          new Decimal(effects.gemMultiplier).mul(lastObjectBonus),
        ),
      );
    }

    const planetCoinDrop = state.currentObject.drops["planetcoin"];
    if (
      planetCoinDrop !== undefined &&
      random.nextDouble() < planetCoinDrop.chance
    ) {
      resources.planetCoins = new Decimal(resources.planetCoins).add(
        planetCoinDrop.amount,
      );
      resources.maxPlanetCoins = Decimal.max(
        resources.planetCoins,
        resources.maxPlanetCoins,
      );
    }

    const wisdomDrop = state.currentObject.drops["wisdom"];
    if (wisdomDrop !== undefined && random.nextDouble() < wisdomDrop.chance) {
      resources.wisdom = new Decimal(resources.wisdom).add(
        new Decimal(wisdomDrop.amount).mul(state.powers.wisdom),
      );
      resources.maxWisdom = Decimal.max(resources.wisdom, resources.maxWisdom);
    }
  }

  return {
    state: {
      mineObjectLevel: state.mineObjectLevel,
      highestMineObjectLevel,
      currentObject,
      resources,
      powers: {
        mining: new Decimal(state.powers.mining).mul(
          effects.miningPowerGainMultiplier,
        ),
        wisdom: state.powers.wisdom,
      },
    },
    damagedObjectHp,
    objectBroken,
  };
}

/**
 * Advances Remix's one-hit idle timer. It uses a strict threshold and drops
 * excess elapsed time when a hit is due instead of catching up multiple hits.
 */
export function advanceRemixAutoPickaxeTimer(input: {
  timer: number;
  deltaSeconds: number;
  idleSpeed: DecimalSource;
}): { timer: number; shouldHit: boolean } {
  const timer = input.timer + input.deltaSeconds;
  if (timer > 1 / new Decimal(input.idleSpeed).toNumber()) {
    return { timer: 0, shouldHit: true };
  }
  return { timer, shouldHit: false };
}

/** Reproduces the source's strict 60-second autosave timer and single reset. */
export function advanceRemixSaveTimer(input: {
  timer: number;
  deltaSeconds: number;
}): { timer: number; shouldSave: boolean } {
  const timer = input.timer + input.deltaSeconds;
  if (timer > 60) return { timer: 0, shouldSave: true };
  return { timer, shouldSave: false };
}

/**
 * Reproduces `functions.getHighestDamageableMineObjectLevel()` for a current
 * object and its already-evaluated factors. Remix compares the Mud-baseline
 * active/idle damage against up to ten objects around the selected ID.
 */
export function calculateRemixHighestDamageableMineObjectLevel(input: {
  currentMineObjectLevel: number;
  mining: RemixMiningInput;
  catalog: RemixMineObjectCatalog;
}): number {
  const baselineObject = getRemixMineObject(0, input.catalog);
  const idleDamage = calculateRemixIdleDamage(input.mining, baselineObject);
  const activeDamage = calculateRemixActiveDamage(input.mining, baselineObject);

  for (
    let id = Math.max(0, input.currentMineObjectLevel - 1);
    id < input.currentMineObjectLevel + 10;
    id++
  ) {
    const defense = getRemixMineObject(id, input.catalog).defense;
    if (idleDamage.sub(defense).lte(0) || activeDamage.sub(defense).lte(0)) {
      return id - 1;
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Resolves one active click or one animation-frame idle update using only
 * explicit game state, elapsed time, content, and RNG services.
 */
export function performRemixMiningAction(input: {
  state: RemixMiningActionState;
  action: RemixMiningAction;
  deltaSeconds: number;
  catalog: RemixMineObjectCatalog;
  random: RemixMiningRandom;
}): RemixMiningActionResult {
  const { state } = input;
  const upgradeInput = {
    levels: state.upgrades,
    powers: {
      mining: state.powers.mining,
      exquisity: state.powers.exquisity,
    },
    highestMineObjectLevel: state.highestMineObjectLevel,
    currentObjectIsHighestDamageable: false,
  };
  const baselineFactors = calculateRemixMiningFactors({
    ...upgradeInput,
    currentObjectIsHighestDamageable: false,
  });
  const miningForScan: RemixMiningInput = {
    object: state.currentObject,
    pickaxe: state.pickaxe,
    factors: baselineFactors,
  };
  const highestDamageableMineObjectLevel =
    calculateRemixHighestDamageableMineObjectLevel({
      currentMineObjectLevel: state.mineObjectLevel,
      mining: miningForScan,
      catalog: input.catalog,
    });
  const factors = calculateRemixMiningFactors({
    ...upgradeInput,
    currentObjectIsHighestDamageable:
      state.mineObjectLevel === highestDamageableMineObjectLevel,
  });
  const mining: RemixMiningInput = {
    object: state.currentObject,
    pickaxe: state.pickaxe,
    factors,
  };
  const hitDamage =
    input.action === "activeClick"
      ? calculateRemixActiveDamage(mining)
      : calculateRemixIdleDamage(mining);
  const timer =
    input.action === "idleTick"
      ? advanceRemixAutoPickaxeTimer({
          timer: state.autoPickaxeTimer,
          deltaSeconds: input.deltaSeconds,
          idleSpeed: factors.idleSpeed,
        })
      : { timer: state.autoPickaxeTimer, shouldHit: true };
  const save =
    input.action === "idleTick"
      ? advanceRemixSaveTimer({
          timer: state.saveTimer,
          deltaSeconds: input.deltaSeconds,
        })
      : { timer: state.saveTimer, shouldSave: false };
  const frameEvents: RemixMiningFrameEvent[] =
    input.action === "idleTick"
      ? save.shouldSave
        ? ["save", "refreshStoryNotifications"]
        : ["refreshStoryNotifications"]
      : [];
  const hitOccurred = input.action === "activeClick" || timer.shouldHit;

  if (!hitOccurred) {
    return {
      state: {
        ...state,
        autoPickaxeTimer: timer.timer,
        saveTimer: save.timer,
      },
      hitOccurred,
      hitDamage,
      damagedObjectHp: new Decimal(state.currentObject.hp),
      objectBroken: false,
      highestDamageableMineObjectLevel,
      frameEvents,
    };
  }

  const hit = applyRemixMiningHit({
    state,
    damage: hitDamage,
    highestDamageableMineObjectLevel,
    effects: {
      gemChance: factors.gemChance,
      gemMultiplier: factors.gemMultiplier,
      lastObjectGemMultiplier: factors.lastObjectGemMultiplier,
      miningPowerGainMultiplier: calculateRemixMiningPowerGainMultiplier({
        upgradeInput,
        action: input.action,
      }),
    },
    random: input.random,
  });

  return {
    state: {
      ...state,
      ...hit.state,
      powers: { ...state.powers, ...hit.state.powers },
      autoPickaxeTimer: timer.timer,
      saveTimer: save.timer,
    },
    hitOccurred,
    hitDamage,
    damagedObjectHp: hit.damagedObjectHp,
    objectBroken: hit.objectBroken,
    highestDamageableMineObjectLevel,
    frameEvents,
  };
}
