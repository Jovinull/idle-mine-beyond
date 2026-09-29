import {
  Decimal,
  getRemixMineObject,
  performRemixMiningAction,
  type RemixMineObjectCatalog,
  type RemixMiningUpgradeLevels,
  type RemixMiningTransitionResources,
} from "@idle-mine-beyond/core";

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

type MiningHitCase = {
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
};

type ProbeInput = {
  catalog: RemixMineObjectCatalog;
  cases: MiningHitCase[];
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

function levelsForCase(
  input: MiningHitCase["input"],
): RemixMiningUpgradeLevels {
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

function snapshotResources(resources: RemixMiningTransitionResources) {
  return Object.fromEntries(
    Object.entries(resources).map(([key, value]) => [
      key,
      snapshotDecimal(new Decimal(value)),
    ]),
  );
}

function run(input: ProbeInput) {
  return input.cases.map((scenario) => {
    const caseInput = scenario.input;
    const currentObject = getRemixMineObject(caseInput.objectId, input.catalog);
    currentObject.hp = new Decimal(caseInput.currentHp);
    let randomCalls = 0;
    const result = performRemixMiningAction({
      state: {
        mineObjectLevel: caseInput.objectId,
        highestMineObjectLevel: caseInput.highestMineObjectLevel,
        currentObject,
        resources: caseInput.resources,
        powers: {
          mining: caseInput.powers[0]!,
          wisdom: caseInput.powers[3]!,
          exquisity: caseInput.powers[4]!,
        },
        pickaxe: caseInput.pickaxe,
        upgrades: levelsForCase(caseInput),
        autoPickaxeTimer: caseInput.autoPickaxeTimer,
        saveTimer: caseInput.saveTimer,
      },
      action: caseInput.action,
      deltaSeconds: caseInput.elapsedMilliseconds / 1000,
      catalog: input.catalog,
      random: {
        nextDouble() {
          const value = caseInput.randomValues[randomCalls];
          if (value === undefined) {
            throw new Error(`${scenario.name} exhausted its RNG fixture.`);
          }
          randomCalls++;
          return value;
        },
      },
    });

    return {
      name: scenario.name,
      highestDamageableMineObjectLevel: result.highestDamageableMineObjectLevel,
      result: {
        hitOccurred: result.hitOccurred,
        hitDamage: snapshotDecimal(result.hitDamage),
        damagedObjectHp: snapshotDecimal(result.damagedObjectHp),
        currentObjectHp: snapshotDecimal(result.state.currentObject.hp),
        currentObjectWasReplaced: result.objectBroken,
        resources: snapshotResources(result.state.resources),
        highestMineObjectLevel: result.state.highestMineObjectLevel,
        miningPower: snapshotDecimal(new Decimal(result.state.powers.mining)),
        autoPickaxeTimer: result.state.autoPickaxeTimer,
        saveTimer: result.state.saveTimer,
        randomCalls,
        frameEvents: result.frameEvents,
      },
    };
  });
}

const result = document.querySelector<HTMLPreElement>("#result");
if (!result) throw new Error("Mining-transition probe failed to initialize.");

const browserWindow = window as Window & {
  __idleMineMiningTransitionProbe?: (input: ProbeInput) => unknown;
};
browserWindow.__idleMineMiningTransitionProbe = run;
result.dataset.ready = "true";
result.textContent = "ready";
