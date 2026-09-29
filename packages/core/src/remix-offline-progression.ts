import { Decimal, type DecimalSource } from "./decimal.js";

export const REMIX_OFFLINE_MONEY_MULTIPLIER = 0.5;
export const REMIX_OFFLINE_THRESHOLD_SECONDS = 300;
export const REMIX_OFFLINE_DEFAULT_HOURS = 6;
export const REMIX_OFFLINE_MESSAGE_COLOR = "#948a00";

export interface RemixOfflineClock {
  now(): number;
}

export interface RemixOfflineState {
  readonly money: DecimalSource;
  readonly highestMoney: DecimalSource;
  readonly gems: DecimalSource;
  readonly planetCoins: DecimalSource;
  readonly maxPlanetCoins: DecimalSource;
  readonly lastActiveMs?: number;
}

export interface RemixOfflineRewards {
  readonly money: Decimal;
  readonly gems: Decimal;
  readonly planetCoins: Decimal;
}

export interface RemixOfflineRates {
  readonly moneyPerSecond: DecimalSource;
  readonly gemsPerSecond: DecimalSource;
  readonly planetCoinsPerSecond: DecimalSource;
}

type RemixOfflineProgressInput = {
  readonly state: RemixOfflineState;
  readonly clock: RemixOfflineClock;
  /** Date.now() already evaluated by a preceding legacy-save field load. */
  readonly evaluatedLastActiveFallbackMs?: number;
  readonly noOffline: boolean;
  readonly maxOfflineSeconds: number;
  readonly offlineGemsMultiplier: DecimalSource;
  readonly offlinePlanetCoinsMultiplier: DecimalSource;
  readonly formatNumber: RemixOfflineNumberFormatter;
} & ({ readonly resolveRates: () => RemixOfflineRates } | RemixOfflineRates);

export type RemixOfflineEffect =
  | {
      readonly type: "logMessage";
      readonly message: string;
      readonly color: typeof REMIX_OFFLINE_MESSAGE_COLOR;
    }
  | { readonly type: "save" };

export interface RemixOfflineResult {
  readonly state: RemixOfflineState & { readonly lastActiveMs: number };
  readonly elapsedSeconds: number;
  readonly processedSeconds: number;
  readonly applied: boolean;
  readonly rewards: RemixOfflineRewards;
  readonly effects: readonly RemixOfflineEffect[];
}

export interface RemixOfflineNumberFormatter {
  (
    value: DecimalSource,
    precision: number,
    limit: DecimalSource,
    below1000: number,
  ): string;
}

export function calculateRemixOfflineCapSeconds(
  offlineTimeUpgradeHours: DecimalSource,
): number {
  return (
    3600 *
    (REMIX_OFFLINE_DEFAULT_HOURS +
      new Decimal(offlineTimeUpgradeHours).toNumber())
  );
}

export function formatRemixOfflineRewardMessage(
  rewards: RemixOfflineRewards,
  formatNumber: RemixOfflineNumberFormatter,
): string {
  let message = `Welcome back! While you were away, your Auto-Mining-Device earned you ${formatNumber(rewards.money, 2, "1e12", 0)} $`;
  if (rewards.gems.gt(0)) {
    message += ` and ${formatNumber(rewards.gems, 2, "1e12", 0)} gem(s)`;
  }
  message += ".";
  if (rewards.planetCoins.gt(0)) {
    message += ` You also got ${formatNumber(rewards.planetCoins, 2, "1e12", 0)} Planet Coins.`;
  }
  return message;
}

export function processRemixOfflineProgress(
  input: RemixOfflineProgressInput,
): RemixOfflineResult {
  // loadVal(loadObj.lastActive, Date.now()) evaluates the fallback even when
  // the save already has lastActive, then loadGame reads Date.now() again.
  const fallbackNowMs =
    input.evaluatedLastActiveFallbackMs ?? input.clock.now();
  const lastActiveMs = input.state.lastActiveMs ?? fallbackNowMs;
  const nowMs = input.clock.now();
  const elapsedSeconds = (nowMs - lastActiveMs) / 1000;
  const zeroRewards: RemixOfflineRewards = {
    money: new Decimal(0),
    gems: new Decimal(0),
    planetCoins: new Decimal(0),
  };

  if (elapsedSeconds <= REMIX_OFFLINE_THRESHOLD_SECONDS || input.noOffline) {
    return {
      state: { ...input.state, lastActiveMs },
      elapsedSeconds,
      processedSeconds: 0,
      applied: false,
      rewards: zeroRewards,
      effects: [],
    };
  }

  const processedSeconds = Math.min(input.maxOfflineSeconds, elapsedSeconds);
  const rates =
    "resolveRates" in input
      ? input.resolveRates()
      : {
          moneyPerSecond: input.moneyPerSecond,
          gemsPerSecond: input.gemsPerSecond,
          planetCoinsPerSecond: input.planetCoinsPerSecond,
        };
  const moneyReward = new Decimal(rates.moneyPerSecond).mul(
    REMIX_OFFLINE_MONEY_MULTIPLIER * processedSeconds,
  );
  const gemMultiplierSeconds =
    new Decimal(input.offlineGemsMultiplier).toNumber() * processedSeconds;
  const planetCoinMultiplierSeconds =
    new Decimal(input.offlinePlanetCoinsMultiplier).toNumber() *
    processedSeconds;
  const gemsReward = Decimal.floor(
    new Decimal(rates.gemsPerSecond).mul(gemMultiplierSeconds),
  );
  const planetCoinsReward = Decimal.floor(
    new Decimal(rates.planetCoinsPerSecond).mul(planetCoinMultiplierSeconds),
  );
  const rewards: RemixOfflineRewards = {
    money: moneyReward,
    gems: gemsReward,
    planetCoins: planetCoinsReward,
  };
  const money = new Decimal(input.state.money).add(moneyReward);
  const planetCoins = new Decimal(input.state.planetCoins).add(
    planetCoinsReward,
  );

  input.clock.now();
  const savedAtMs = input.clock.now();
  const state: RemixOfflineState & { readonly lastActiveMs: number } = {
    money,
    highestMoney: Decimal.max(money, input.state.highestMoney),
    gems: new Decimal(input.state.gems).add(gemsReward),
    planetCoins,
    maxPlanetCoins: Decimal.max(planetCoins, input.state.maxPlanetCoins),
    lastActiveMs: savedAtMs,
  };

  return {
    state,
    elapsedSeconds,
    processedSeconds,
    applied: true,
    rewards,
    effects: [
      {
        type: "logMessage",
        message: formatRemixOfflineRewardMessage(rewards, input.formatNumber),
        color: REMIX_OFFLINE_MESSAGE_COLOR,
      },
      { type: "save" },
    ],
  };
}
