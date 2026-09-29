import {
  calculateRemixOfflineCapSeconds,
  Decimal,
  processRemixOfflineProgress,
  type DecimalSource,
} from "@idle-mine-beyond/core";
import {
  createRemixFormatters,
  formatNumber,
} from "@idle-mine-beyond/formatting";

type CapturedOfflineScenario = {
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
  stateAfterLoad: unknown;
  events: unknown[];
  storageWrites: unknown[];
};

type ProbeInput = {
  scenarios: CapturedOfflineScenario[];
};

function snapshot(value: DecimalSource) {
  const decimal = new Decimal(value);
  return {
    decimal: decimal.toString(),
    mantissa: decimal.mantissa,
    exponent: decimal.exponent,
  };
}

function evaluate(input: ProbeInput) {
  const standard = createRemixFormatters().find(
    (formatter) => formatter.name === "Standard",
  );
  if (!standard) throw new Error("Standard number formatter is missing.");

  return input.scenarios.map((scenario) => {
    const { input: scenarioInput } = scenario;
    const dateNowReads: number[] = [];
    const clock = {
      now() {
        const offset =
          scenarioInput.clockAdvancesMs[
            Math.min(
              dateNowReads.length,
              scenarioInput.clockAdvancesMs.length - 1,
            )
          ] ?? 0;
        const value = scenarioInput.nowMs + offset;
        dateNowReads.push(value);
        return value;
      },
    };
    const lastActiveMs = scenarioInput.omitLastActive
      ? undefined
      : scenarioInput.nowMs - scenarioInput.elapsedSeconds * 1000;
    const initialState =
      lastActiveMs === undefined
        ? { ...scenarioInput.initialState }
        : { ...scenarioInput.initialState, lastActiveMs };
    const result = processRemixOfflineProgress({
      state: initialState,
      clock,
      noOffline: scenarioInput.noOffline,
      maxOfflineSeconds: calculateRemixOfflineCapSeconds(
        scenarioInput.upgrades.offlineTime,
      ),
      moneyPerSecond: scenarioInput.rates.money,
      gemsPerSecond: scenarioInput.rates.gems,
      planetCoinsPerSecond: scenarioInput.rates.planetCoins,
      offlineGemsMultiplier: 0.05 * scenarioInput.upgrades.offlineGems,
      offlinePlanetCoinsMultiplier: 0.05 * scenarioInput.upgrades.offlinePC,
      formatNumber: (value, precision, limit, below1000) =>
        formatNumber(value, standard, precision, limit, below1000),
    });
    const stateAfterLoad = {
      money: snapshot(result.state.money),
      highestMoney: snapshot(result.state.highestMoney),
      gems: snapshot(result.state.gems),
      planetCoins: snapshot(result.state.planetCoins),
      maxPlanetCoins: snapshot(result.state.maxPlanetCoins),
      lastActive: result.state.lastActiveMs,
    };
    const saved = result.effects.some((effect) => effect.type === "save");
    const events = result.effects.flatMap((effect) =>
      effect.type === "logMessage"
        ? [effect]
        : [
            {
              type: "logMessage",
              message: "Game Saved!",
              color: "#00a5ff",
            },
          ],
    );
    const storageWrites = saved
      ? [{ key: "IdleMine", save: stateAfterLoad }]
      : [];

    return {
      name: scenario.name,
      elapsedSeconds: result.elapsedSeconds,
      processedSeconds: result.processedSeconds,
      applied: result.applied,
      clockReadCount: dateNowReads.length,
      dateNowReads,
      stateAfterLoad,
      events,
      storageWrites,
    };
  });
}

const result = document.querySelector<HTMLPreElement>("#result");
if (!result) throw new Error("Offline progression probe output is missing.");

(
  window as Window & {
    __idleMineOfflineProbe?: (input: ProbeInput) => unknown;
  }
).__idleMineOfflineProbe = evaluate;
result.textContent = "Offline progression parity probe ready";
result.dataset.ready = "true";
