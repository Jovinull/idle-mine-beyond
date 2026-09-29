import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  calculateRemixOfflineCapSeconds,
  Decimal,
  processRemixOfflineProgress,
  type DecimalSource,
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
    offlineProgressionSemantics: {
      sourcePaths: string[];
      thresholdSeconds: number;
      defaultOfflineHours: number;
      moneyMultiplier: number;
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
