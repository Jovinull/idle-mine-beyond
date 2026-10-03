import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import {
  calculateRemixOfflineCapSeconds,
  calculateRemixMiningRates,
  Decimal,
  createInitialRemixSimulationState,
  getRemixMineObject,
  performRemixSimulationAction,
  processRemixOfflineProgress,
  resolveRemixMiningInput,
  type DecimalSource,
  type RemixMineObjectCatalog,
  type RemixSimulationState,
} from "../../packages/core/src/index.js";
import {
  createRemixFormatters,
  formatNumber,
} from "../../packages/formatting/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    formulaSemantics: {
      scenarios: {
        name: string;
        input: {
          objectId: number;
          pickaxe: { power: string; quality: string };
          miningPower: string;
          exquisityPower: string;
          upgrades: Record<string, Record<string, number>>;
        };
        result: {
          moneyPerSecond: { decimal: string };
          gemsPerSecond: { decimal: string };
          planetCoinsPerSecond: { decimal: string };
        };
      }[];
    };
    offlineLoadRateCompositionSemantics: {
      scenarios: {
        name: string;
        input: {
          formulaScenario: string;
          objectId: number;
          pickaxe: { power: string; quality: string };
          miningPower: string;
          exquisityPower: string;
          miningUpgrades: Record<string, Record<string, number>>;
          offlineUpgrades: {
            offlineTime: number;
            offlineGems: number;
            offlinePC: number;
          };
          initialResources: {
            money: string;
            highestMoney: string;
            gems: string;
            planetCoins: string;
            maxPlanetCoins: string;
          };
          elapsedSeconds: number;
          nowMs: number;
          clockAdvancesMs: number[];
        };
        clockReadCount: number;
        dateNowReads: number[];
        highestDamageableObjectLevel: number;
        rates: {
          moneyPerSecond: DecimalSnapshot;
          gemsPerSecond: DecimalSnapshot;
          planetCoinsPerSecond: DecimalSnapshot;
        };
        stateAfterLoad: {
          money: DecimalSnapshot;
          highestMoney: DecimalSnapshot;
          gems: DecimalSnapshot;
          planetCoins: DecimalSnapshot;
          maxPlanetCoins: DecimalSnapshot;
          lastActive: number;
        };
        events: { type: string; message: string; color: string }[];
        storageWrites: {
          key: string;
          save: {
            lastActive: number;
            money: DecimalSnapshot;
            highestMoney: DecimalSnapshot;
            gems: DecimalSnapshot;
            planetCoins: DecimalSnapshot;
            maxPlanetCoins: DecimalSnapshot;
          };
        }[];
      }[];
    };
    offlineProgressionSemantics: {
      sourcePaths: string[];
      thresholdSeconds: number;
      defaultOfflineHours: number;
      moneyMultiplier: number;
      fixedSeedSample: {
        algorithm: "xorshift32";
        seed: string;
        count: number;
        elapsedSeconds: number[];
      };
      scenarios: {
        name: string;
        input: {
          elapsedSeconds: number;
          omitLastActive?: boolean;
          noOffline: boolean;
          clockAdvancesMs: number[];
          rates: { money: string; gems: string; planetCoins: string };
          upgrades: {
            offlineTime: number;
            offlineGems: number;
            offlinePC: number;
          };
          initialState: {
            money: string;
            highestMoney: string;
            gems: string;
            planetCoins: string;
            maxPlanetCoins: string;
          };
          nowMs: number;
        };
        clockReadCount: number;
        dateNowReads: number[];
        stateAfterLoad: {
          money: DecimalSnapshot;
          highestMoney: DecimalSnapshot;
          gems: DecimalSnapshot;
          planetCoins: DecimalSnapshot;
          maxPlanetCoins: DecimalSnapshot;
          lastActive: number;
        };
        events: { type: string; message: string; color: string }[];
        storageWrites: {
          key: string;
          save: {
            lastActive: number;
            money: DecimalSnapshot;
            highestMoney: DecimalSnapshot;
            gems: DecimalSnapshot;
            planetCoins: DecimalSnapshot;
            maxPlanetCoins: DecimalSnapshot;
          };
        }[];
      }[];
    };
  };
};

type DecimalSnapshot = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

function snapshot(value: DecimalSource): DecimalSnapshot {
  const decimal = new Decimal(value);
  return {
    decimal: decimal.toString(),
    mantissa: decimal.mantissa,
    exponent: decimal.exponent,
  };
}

it("extracts the pinned offline progression threshold, caps, and load effects", () => {
  const semantics = corpus.data.offlineProgressionSemantics;
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(semantics.sourcePaths).toEqual([
    "Scripts/Define/functions.js",
    "Scripts/Define/game.js",
    "Scripts/upgrade.js",
  ]);
  expect(semantics.thresholdSeconds).toBe(300);
  expect(semantics.defaultOfflineHours).toBe(6);
  expect(semantics.moneyMultiplier).toBe(0.5);
  expect(semantics.fixedSeedSample).toMatchObject({
    algorithm: "xorshift32",
    seed: "0x4f46464c",
    count: 16,
  });
  const sampledScenarios = semantics.scenarios.slice(
    -semantics.fixedSeedSample.count,
  );
  expect(sampledScenarios.map(({ input }) => input.elapsedSeconds)).toEqual(
    semantics.fixedSeedSample.elapsedSeconds,
  );
  expect(
    semantics.fixedSeedSample.elapsedSeconds.every(
      (seconds) => seconds > semantics.thresholdSeconds && seconds < 8 * 3600,
    ),
  ).toBe(true);

  const formatter = createRemixFormatters().find(
    (candidate) => candidate.name === "Standard",
  );
  expect(formatter).toBeDefined();

  for (const scenario of semantics.scenarios) {
    const { input } = scenario;
    let clockReadCount = 0;
    const clock = {
      now() {
        const offset =
          input.clockAdvancesMs[
            Math.min(clockReadCount, input.clockAdvancesMs.length - 1)
          ] ?? 0;
        clockReadCount++;
        return input.nowMs + offset;
      },
    };
    const lastActiveMs = input.omitLastActive
      ? undefined
      : input.nowMs - input.elapsedSeconds * 1000;
    const start = input.initialState;
    const initialState =
      lastActiveMs === undefined ? { ...start } : { ...start, lastActiveMs };
    const result = processRemixOfflineProgress({
      state: initialState,
      clock,
      noOffline: input.noOffline,
      maxOfflineSeconds: calculateRemixOfflineCapSeconds(
        input.upgrades.offlineTime,
      ),
      moneyPerSecond: input.rates.money,
      gemsPerSecond: input.rates.gems,
      planetCoinsPerSecond: input.rates.planetCoins,
      offlineGemsMultiplier: 0.05 * input.upgrades.offlineGems,
      offlinePlanetCoinsMultiplier: 0.05 * input.upgrades.offlinePC,
      formatNumber: (value, precision, limit, below1000) =>
        formatNumber(value, formatter!, precision, limit, below1000),
    });

    expect(clockReadCount, scenario.name).toBe(scenario.clockReadCount);
    expect(clockReadCount, `${scenario.name}: source clock reads`).toBe(
      scenario.dateNowReads.length,
    );
    const expectedElapsed =
      (scenario.dateNowReads[1]! -
        (lastActiveMs ?? scenario.dateNowReads[0]!)) /
      1000;
    expect(result.elapsedSeconds, scenario.name).toBe(expectedElapsed);
    const expectedApplied = expectedElapsed > 300 && !input.noOffline;
    expect(result.applied, scenario.name).toBe(expectedApplied);
    const expectedProcessed = expectedApplied
      ? Math.min(
          calculateRemixOfflineCapSeconds(input.upgrades.offlineTime),
          expectedElapsed,
        )
      : 0;
    expect(result.processedSeconds, scenario.name).toBe(expectedProcessed);

    expect(
      {
        money: snapshot(result.state.money),
        highestMoney: snapshot(result.state.highestMoney),
        gems: snapshot(result.state.gems),
        planetCoins: snapshot(result.state.planetCoins),
        maxPlanetCoins: snapshot(result.state.maxPlanetCoins),
        lastActive: result.state.lastActiveMs,
      },
      scenario.name,
    ).toEqual(scenario.stateAfterLoad);
    expect(result.effects.filter(({ type }) => type === "logMessage")).toEqual(
      expectedApplied ? [scenario.events[0]] : [],
    );
    expect(result.effects.map(({ type }) => type)).toEqual(
      expectedApplied ? ["logMessage", "save"] : [],
    );
    if (expectedApplied) {
      expect(scenario.events[1]).toEqual({
        type: "logMessage",
        message: "Game Saved!",
        color: "#00a5ff",
      });
      expect(scenario.storageWrites).toEqual([
        {
          key: "IdleMine",
          save: scenario.stateAfterLoad,
        },
      ]);
    } else {
      expect(scenario.storageWrites, scenario.name).toEqual([]);
    }
  }
});

it("uses the source default and upgrade-adjusted offline caps", () => {
  expect(calculateRemixOfflineCapSeconds(0)).toBe(6 * 3600);
  expect(calculateRemixOfflineCapSeconds(1)).toBe(7 * 3600);
  expect(calculateRemixOfflineCapSeconds(2)).toBe(8 * 3600);
  expect(calculateRemixOfflineCapSeconds(42)).toBe(48 * 3600);
});

it("does not resolve live rates when the source threshold rejects offline rewards", () => {
  const resolveRates = vi.fn(() => ({
    moneyPerSecond: 1,
    gemsPerSecond: 1,
    planetCoinsPerSecond: 1,
  }));
  let read = 0;

  const result = processRemixOfflineProgress({
    state: {
      money: 0,
      highestMoney: 0,
      gems: 0,
      planetCoins: 0,
      maxPlanetCoins: 0,
      lastActiveMs: 0,
    },
    clock: { now: () => [100, 300_000][read++]! },
    noOffline: false,
    maxOfflineSeconds: 6 * 3600,
    offlineGemsMultiplier: 1,
    offlinePlanetCoinsMultiplier: 1,
    resolveRates,
    formatNumber: () => "0",
  });

  expect(result.applied).toBe(false);
  expect(resolveRates).not.toHaveBeenCalled();
});

it("derives offline rewards from source-captured full mining states", () => {
  const formatter = createRemixFormatters().find(
    (candidate) => candidate.name === "Standard",
  );
  expect(formatter).toBeDefined();

  for (const scenario of corpus.data.formulaSemantics.scenarios) {
    const { input } = scenario;
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    state.mineObjectLevel = input.objectId;
    state.highestMineObjectLevel = input.objectId;
    state.currentObject = getRemixMineObject(
      input.objectId,
      corpus.data.mineObjectCatalog,
    );
    state.pickaxe = {
      name: state.pickaxe.name,
      power: new Decimal(input.pickaxe.power),
      quality: new Decimal(input.pickaxe.quality),
    };
    state.powers.mining = new Decimal(input.miningPower);
    state.powers.exquisity = new Decimal(input.exquisityPower);
    state.resources.gems = new Decimal(0);
    for (const [group, levels] of Object.entries(input.upgrades)) {
      Object.assign(
        state.upgrades[group as keyof RemixSimulationState["upgrades"]],
        levels,
      );
    }
    state.upgrades.gems.offlineGems = 15;
    state.upgrades.planetCoins.offlinePC = 10;
    state.lastActiveMs = 10_000;
    const clockValues = [3_610_000, 3_611_000, 3_612_000, 3_613_000];
    let clockReadCount = 0;
    const result = performRemixSimulationAction({
      state,
      action: { type: "offlineLoad" },
      catalog: corpus.data.mineObjectCatalog,
      clock: {
        now() {
          return clockValues[clockReadCount++]!;
        },
      },
      formatNumber: (value, precision, limit, below1000) =>
        formatNumber(value, formatter!, precision, limit, below1000),
    });
    if (result.type !== "offlineLoad") {
      throw new Error(`${scenario.name}: expected an offline-load result.`);
    }

    const expectedMoney = new Decimal(
      scenario.result.moneyPerSecond.decimal,
    ).mul(0.5 * 3601);
    const expectedGems = Decimal.floor(
      new Decimal(scenario.result.gemsPerSecond.decimal).mul(0.75 * 3601),
    );
    const expectedPlanetCoins = Decimal.floor(
      new Decimal(scenario.result.planetCoinsPerSecond.decimal).mul(0.5 * 3601),
    );

    expect(clockReadCount, scenario.name).toBe(4);
    expect(result.elapsedSeconds, scenario.name).toBe(3601);
    expect(result.processedSeconds, scenario.name).toBe(3601);
    expect(result.applied, scenario.name).toBe(true);
    expect(result.rewards.money.toString(), scenario.name).toBe(
      expectedMoney.toString(),
    );
    expect(result.rewards.gems.toString(), scenario.name).toBe(
      expectedGems.toString(),
    );
    expect(result.rewards.planetCoins.toString(), scenario.name).toBe(
      expectedPlanetCoins.toString(),
    );
    expect(result.state.resources.money.toString(), scenario.name).toBe(
      expectedMoney.toString(),
    );
    expect(result.state.resources.highestMoney.toString(), scenario.name).toBe(
      expectedMoney.toString(),
    );
    expect(result.state.resources.gems.toString(), scenario.name).toBe(
      expectedGems.toString(),
    );
    expect(result.state.resources.planetCoins.toString(), scenario.name).toBe(
      expectedPlanetCoins.toString(),
    );
    expect(
      result.state.resources.maxPlanetCoins.toString(),
      scenario.name,
    ).toBe(expectedPlanetCoins.toString());
    expect(result.state.lastActiveMs, scenario.name).toBe(3_613_000);
    expect(
      result.effects.map(({ type }) => type),
      scenario.name,
    ).toEqual(["logMessage", "save"]);
    expect(result.effects[1], scenario.name).toEqual({
      type: "save",
      state: result.state,
    });
  }
});

it("matches direct Remix loads using live mining rates and source save effects", () => {
  const formatter = createRemixFormatters().find(
    (candidate) => candidate.name === "Standard",
  );
  expect(formatter).toBeDefined();

  for (const scenario of corpus.data.offlineLoadRateCompositionSemantics
    .scenarios) {
    const { input } = scenario;
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    state.mineObjectLevel = input.objectId;
    state.highestMineObjectLevel = input.objectId;
    state.currentObject = getRemixMineObject(
      input.objectId,
      corpus.data.mineObjectCatalog,
    );
    state.pickaxe = {
      name: "Reference offline-rate probe",
      power: new Decimal(input.pickaxe.power),
      quality: new Decimal(input.pickaxe.quality),
    };
    state.powers.mining = new Decimal(input.miningPower);
    state.powers.exquisity = new Decimal(input.exquisityPower);
    for (const [group, levels] of Object.entries(input.miningUpgrades)) {
      Object.assign(
        state.upgrades[group as keyof RemixSimulationState["upgrades"]],
        levels,
      );
    }
    state.upgrades.planetCoins.offlineTime = input.offlineUpgrades.offlineTime;
    state.upgrades.gems.offlineGems = input.offlineUpgrades.offlineGems;
    state.upgrades.planetCoins.offlinePC = input.offlineUpgrades.offlinePC;
    state.resources.money = new Decimal(input.initialResources.money);
    state.resources.highestMoney = new Decimal(
      input.initialResources.highestMoney,
    );
    state.resources.gems = new Decimal(input.initialResources.gems);
    state.resources.planetCoins = new Decimal(
      input.initialResources.planetCoins,
    );
    state.resources.maxPlanetCoins = new Decimal(
      input.initialResources.maxPlanetCoins,
    );
    state.lastActiveMs = input.nowMs - input.elapsedSeconds * 1000;

    const resolvedMining = resolveRemixMiningInput({
      state,
      catalog: corpus.data.mineObjectCatalog,
    });
    const rates = calculateRemixMiningRates(resolvedMining.mining);
    expect(resolvedMining.highestDamageableMineObjectLevel, scenario.name).toBe(
      scenario.highestDamageableObjectLevel,
    );
    expect(
      {
        moneyPerSecond: snapshot(rates.moneyPerSecond),
        gemsPerSecond: snapshot(rates.gemsPerSecond),
        planetCoinsPerSecond: snapshot(rates.planetCoinsPerSecond),
      },
      scenario.name,
    ).toEqual(scenario.rates);

    let clockReadCount = 0;
    const result = performRemixSimulationAction({
      state,
      action: { type: "offlineLoad" },
      catalog: corpus.data.mineObjectCatalog,
      clock: {
        now() {
          return input.nowMs + input.clockAdvancesMs[clockReadCount++]!;
        },
      },
      formatNumber: (value, precision, limit, below1000) =>
        formatNumber(value, formatter!, precision, limit, below1000),
    });
    if (result.type !== "offlineLoad") {
      throw new Error(`${scenario.name}: expected an offline-load result.`);
    }

    expect(clockReadCount, scenario.name).toBe(scenario.clockReadCount);
    expect(result.elapsedSeconds, scenario.name).toBe(
      (scenario.dateNowReads[1]! - state.lastActiveMs!) / 1000,
    );
    expect(
      {
        money: snapshot(result.state.resources.money),
        highestMoney: snapshot(result.state.resources.highestMoney),
        gems: snapshot(result.state.resources.gems),
        planetCoins: snapshot(result.state.resources.planetCoins),
        maxPlanetCoins: snapshot(result.state.resources.maxPlanetCoins),
        lastActive: result.state.lastActiveMs,
      },
      scenario.name,
    ).toEqual(scenario.stateAfterLoad);
    expect(result.effects[0], scenario.name).toEqual(scenario.events[0]);
    expect(result.effects[1], scenario.name).toEqual({
      type: "save",
      state: result.state,
    });
    expect(scenario.events[1], scenario.name).toEqual({
      type: "logMessage",
      message: "Game Saved!",
      color: "#00a5ff",
    });
    expect(scenario.storageWrites[0]?.save, scenario.name).toEqual({
      lastActive: result.state.lastActiveMs,
      money: snapshot(result.state.resources.money),
      highestMoney: snapshot(result.state.resources.highestMoney),
      gems: snapshot(result.state.resources.gems),
      planetCoins: snapshot(result.state.resources.planetCoins),
      maxPlanetCoins: snapshot(result.state.resources.maxPlanetCoins),
    });
  }
});
