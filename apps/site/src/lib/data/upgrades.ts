import presentation from "@idle-mine-beyond/content/remix-upgrade-presentation";
import {
  Decimal,
  REMIX_UPGRADE_KEYS,
  calculateRemixUpgradePrice,
  createInitialRemixSimulationState,
  getRemixUpgradeMaxLevel,
  type RemixSimulationState,
  type RemixUpgradeGroup,
} from "@idle-mine-beyond/core";
import type { NotationFormatter } from "@idle-mine-beyond/formatting";
import {
  getRemixShopUpgradeDisplay,
  getRemixWisdomUpgradeDisplay,
} from "$game/remix-upgrade-display";
import { catalog, objectAt } from "./objects";

type PresentationEntry = {
  name: string;
  description: string;
  image: string;
};

const groups = presentation.groups as unknown as Record<
  RemixUpgradeGroup,
  Record<string, PresentationEntry>
>;

export type Upgrade = {
  group: RemixUpgradeGroup;
  key: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number;
};

export type UpgradeGroupInfo = {
  id: RemixUpgradeGroup;
  slug: string;
  label: string;
  resourceIcon: "money" | "gems" | "planetcoin" | "wisdom";
  summary: string;
  upgrades: Upgrade[];
};

const groupInfo: Record<
  RemixUpgradeGroup,
  Omit<UpgradeGroupInfo, "id" | "upgrades">
> = {
  money: {
    slug: "money",
    label: "Money",
    resourceIcon: "money",
    summary:
      "Bought with the Money you earn by breaking objects. The first shop you see.",
  },
  gems: {
    slug: "gems",
    label: "Gem",
    resourceIcon: "gems",
    summary: `Bought with Gems. The shop opens once you break ${objectAt(60).name} (object #61).`,
  },
  planetCoins: {
    slug: "planet-coins",
    label: "Planet Coin",
    resourceIcon: "planetcoin",
    summary: `Bought with Planet Coins. The shop opens once you break ${objectAt(89).name} (object #90); the asteroids and planets after it drop the coins.`,
  },
  wisdom: {
    slug: "wisdom",
    label: "Wisdom",
    resourceIcon: "wisdom",
    summary: `Bought with Wisdom on the Powers tab, which opens once you break ${objectAt(169).name} (object #170).`,
  },
};

function iconFor(group: RemixUpgradeGroup, image: string): string {
  // Wisdom upgrades use a placeholder image the game never shipped.
  if (group === "wisdom" || image === "upg_placeholder.png") {
    return "/Images/wisdom.png";
  }
  return `/Images/${image}`;
}

export const upgradeGroups: UpgradeGroupInfo[] = (
  Object.keys(REMIX_UPGRADE_KEYS) as RemixUpgradeGroup[]
).map((id) => ({
  id,
  ...groupInfo[id],
  upgrades: REMIX_UPGRADE_KEYS[id].map((key) => {
    const entry = groups[id][key]!;
    return {
      group: id,
      key,
      name: entry.name,
      description: entry.description,
      icon: iconFor(id, entry.image),
      maxLevel: getRemixUpgradeMaxLevel(id, key as never),
    };
  }),
}));

export const upgradeCount = upgradeGroups.reduce(
  (sum, group) => sum + group.upgrades.length,
  0,
);

export function groupBySlug(slug: string): UpgradeGroupInfo | undefined {
  return upgradeGroups.find((group) => group.slug === slug);
}

/**
 * Tables use the state Remix's upgrade captures use: every other upgrade at 0,
 * every Power at 1, and highest object level 171 (object #172), just past the
 * Powers unlock. Only Increasing Damage Boost reads that level.
 */
export const TABLE_HIGHEST_LEVEL = 171;

function stateAtLevel(upgrade: Upgrade, level: number): RemixSimulationState {
  const state = createInitialRemixSimulationState(catalog);
  state.highestMineObjectLevel = TABLE_HIGHEST_LEVEL;
  (state.upgrades[upgrade.group] as Record<string, number>)[upgrade.key] =
    level;
  return state;
}

export type UpgradeRow = {
  level: number;
  levelDisplay: string;
  effectDisplay: string;
  priceDisplay: string;
};

function pick(level: number, display: Omit<UpgradeRow, "level">): UpgradeRow {
  const { levelDisplay, effectDisplay, priceDisplay } = display;
  return { level, levelDisplay, effectDisplay, priceDisplay };
}

/** The game's own card text for this upgrade at `level`, fresh game otherwise. */
export function upgradeRow(
  upgrade: Upgrade,
  level: number,
  formatter: NotationFormatter,
): UpgradeRow {
  const state = stateAtLevel(upgrade, level);
  if (upgrade.group === "wisdom") {
    const display = getRemixWisdomUpgradeDisplay({
      key: upgrade.key as never,
      state,
      formatter,
    });
    return pick(level, display);
  }
  const display = getRemixShopUpgradeDisplay({
    group: upgrade.group,
    key: upgrade.key,
    level,
    state,
    formatter,
  });
  return pick(level, display);
}

export function sampleLevels(upgrade: Upgrade): number[] {
  if (upgrade.maxLevel <= 12) {
    return Array.from({ length: upgrade.maxLevel + 1 }, (_, level) => level);
  }
  const levels = [0, 1, 2, 3, 5, 10, 25, 50, 100, 250, 500, 1000].filter(
    (level) => level <= upgrade.maxLevel,
  );
  if (Number.isFinite(upgrade.maxLevel) && !levels.includes(upgrade.maxLevel)) {
    levels.push(upgrade.maxLevel);
  }
  return levels;
}

/** Total price of levels 0 to `level - 1`, i.e. buying up to `level`. */
export function cumulativePrice(upgrade: Upgrade, level: number): Decimal {
  let total = new Decimal(0);
  for (let current = 0; current < level; current += 1) {
    total = total.add(
      calculateRemixUpgradePrice(upgrade.group, upgrade.key as never, current),
    );
  }
  return total;
}
