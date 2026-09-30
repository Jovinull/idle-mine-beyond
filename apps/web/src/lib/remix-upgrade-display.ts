import {
  Decimal,
  calculateRemixUpgradeEffect,
  calculateRemixUpgradePrice,
  getRemixUpgradeMaxLevel,
  type RemixSimulationState,
  type RemixUpgradeContext,
} from "@idle-mine-beyond/core";
import {
  formatNumber,
  formatThousands,
  type NotationFormatter,
} from "@idle-mine-beyond/formatting";

export type RemixShopUpgradeGroup = "money" | "gems" | "planetCoins";

type EffectDisplay = {
  kind: "number" | "percent" | "thousands" | "bonus";
  digits?: number;
  prefix?: string;
  suffix?: string;
  limit?: number;
  below1000?: number;
  gemWasterOffset?: boolean;
};

const EFFECT_DISPLAY: Record<
  RemixShopUpgradeGroup,
  Record<string, EffectDisplay>
> = {
  money: {
    blacksmith: { kind: "number", digits: 2, below1000: 0 },
    blacksmithSkill: {
      kind: "percent",
      digits: 2,
      limit: 1e6,
      below1000: 0,
    },
    blacksmithBonus: { kind: "bonus" },
    gemChance: { kind: "percent", digits: 1 },
    activePower: { kind: "number", digits: 2, prefix: "x", below1000: 2 },
    idlePower: { kind: "number", digits: 2, prefix: "x", below1000: 2 },
    idleSpeed: {
      kind: "number",
      digits: 2,
      suffix: "/s",
      below1000: 2,
    },
    gemWaster: { kind: "thousands", gemWasterOffset: true },
  },
  gems: {
    blacksmith: {
      kind: "number",
      digits: 2,
      prefix: "x",
      below1000: 2,
    },
    blacksmithSkill: { kind: "percent", digits: 1 },
    idlePower: { kind: "percent", digits: 1 },
    gemWaster: { kind: "thousands", prefix: "+", suffix: " Level(s)" },
    gemChance: { kind: "percent", digits: 2, prefix: "+" },
    gemMultiply: {
      kind: "number",
      digits: 2,
      suffix: " each",
      limit: 1e12,
      below1000: 0,
    },
    offlineGems: { kind: "percent", digits: 0 },
  },
  planetCoins: {
    activePower: { kind: "percent", digits: 0 },
    gemMultiply: {
      kind: "number",
      digits: 2,
      prefix: "x",
      limit: 1e12,
      below1000: 1,
    },
    lastObjGems: {
      kind: "number",
      digits: 2,
      prefix: "x",
      limit: 1e12,
      below1000: 1,
    },
    gemChance: { kind: "percent", digits: 2, prefix: "+" },
    offlinePC: { kind: "percent", digits: 0 },
    offlineTime: { kind: "number", digits: 0, prefix: "+", suffix: "h" },
    bulkCraft: {
      kind: "number",
      digits: 0,
      suffix: " at once",
      below1000: 0,
    },
  },
};

function upgradeContext(state: RemixSimulationState): RemixUpgradeContext {
  return {
    levels: state.upgrades,
    powers: {
      craftsmanship: state.powers.craftsmanship,
      expertise: state.powers.expertise,
      exquisity: state.powers.exquisity,
    },
    highestMineObjectLevel: state.highestMineObjectLevel,
  };
}

function effectAt(
  group: RemixShopUpgradeGroup,
  key: string,
  level: number,
  state: RemixSimulationState,
  context: RemixUpgradeContext,
): Decimal {
  return calculateRemixUpgradeEffect(group, key as never, level, context);
}

function displayEffectValue(
  value: Decimal,
  spec: EffectDisplay,
  formatter: NotationFormatter,
): string {
  if (spec.kind === "thousands") {
    return `${spec.prefix ?? ""}${formatThousands(value, formatter)}${spec.suffix ?? ""}`;
  }
  if (spec.kind === "percent") {
    return `${spec.prefix ?? ""}${formatNumber(
      value.mul(100),
      formatter,
      spec.digits,
      spec.limit ?? 1e9,
      spec.below1000 ?? spec.digits,
    )}%`;
  }
  return `${spec.prefix ?? ""}${formatNumber(
    value,
    formatter,
    spec.digits,
    spec.limit ?? 1e9,
    spec.below1000 ?? spec.digits,
  )}${spec.suffix ?? ""}`;
}

/** Formats the pinned shop card/detail values for a Money/Gem/PC upgrade. */
export function getRemixShopUpgradeDisplay(input: {
  group: RemixShopUpgradeGroup;
  key: string;
  level: number;
  state: RemixSimulationState;
  formatter: NotationFormatter;
}) {
  const { group, key, level, state, formatter } = input;
  const context = upgradeContext(state);
  const maxLevel = getRemixUpgradeMaxLevel(group, key as never);
  const atMaxLevel = level === maxLevel;
  const belowMaxLevel = level < maxLevel;
  const spec = EFFECT_DISPLAY[group][key];
  if (!spec)
    throw new RangeError(`Unknown Remix upgrade display: ${group}.${key}`);

  let effectDisplay: string;
  if (spec.kind === "bonus") {
    effectDisplay = atMaxLevel ? `+${level}` : `+${level} → +${level + 1}`;
  } else {
    const offset = spec.gemWasterOffset
      ? effectAt(
          "gems",
          "gemWaster",
          state.upgrades.gems.gemWaster,
          state,
          context,
        ).toNumber()
      : 0;
    const current = effectAt(group, key, level + offset, state, context);
    const next = effectAt(group, key, level + offset + 1, state, context);
    const currentDisplay = displayEffectValue(current, spec, formatter);
    effectDisplay = atMaxLevel
      ? currentDisplay
      : `${currentDisplay} → ${displayEffectValue(next, spec, formatter)}`;
  }

  const price = calculateRemixUpgradePrice(group, key as never, level);
  const resource = state.resources[group];
  const priceDisplay = belowMaxLevel
    ? group === "money"
      ? `$ ${formatNumber(price, formatter, 2, 1e12, 0)} `
      : `${formatNumber(price, formatter, 2, 1e12, 0)} ${group === "gems" ? "Gems" : "Planet Coins"}`
    : "Max";

  return {
    affordable: !atMaxLevel && new Decimal(resource).gte(price),
    levelDisplay:
      maxLevel === Infinity ? String(level) : `${level}/${maxLevel}`,
    effectDisplay,
    price,
    priceDisplay,
  };
}
