import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";
import type { RemixLegacySaveData } from "./remix-legacy-save-application.js";

function exportUpgradeLevels(levels: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(levels).map(([key, level]) => [key, { level }]),
  );
}

/**
 * Projects app state onto the fields consumed by the pinned Remix loader.
 * The caller supplies the source `lastActive` value so this remains clock-free.
 */
export function createRemixLegacySaveExportData(
  state: RemixLegacySaveApplicationState,
  lastActiveMs: number,
): RemixLegacySaveData {
  const { simulation, settings } = state;
  return {
    money: simulation.resources.money.toString(),
    highestMoney: simulation.resources.highestMoney.toString(),
    gems: simulation.resources.gems.toString(),
    planetCoins: simulation.resources.planetCoins.toString(),
    maxPlanetCoins: simulation.resources.maxPlanetCoins.toString(),
    wisdom: simulation.resources.wisdom.toString(),
    maxWisdom: simulation.resources.maxWisdom.toString(),
    mineObjectLevel: simulation.mineObjectLevel,
    highestMineObjectLevel: simulation.highestMineObjectLevel,
    lastActive: lastActiveMs,
    story: {
      page: simulation.story.page,
      notifications: simulation.story.notifications,
      highestUnlocked: simulation.story.highestUnlocked,
      scrollY: state.storyScrollY,
    },
    settings: {
      tab: settings.tab,
      upgradeTab: settings.upgradeTab,
      exportFieldString: settings.exportFieldString,
      numberFormatterIndex: settings.numberFormatterIndex,
      theme: settings.theme,
      showMineObjLevel: settings.showMineObjLevel,
      showMinCraftDamage: settings.showMinCraftDamage,
    },
    upgrades: exportUpgradeLevels(simulation.upgrades.money),
    gemUpgrades: exportUpgradeLevels(simulation.upgrades.gems),
    planetCoinUpgrades: exportUpgradeLevels(simulation.upgrades.planetCoins),
    powers: {
      data: {
        values: [
          simulation.powers.mining,
          simulation.powers.craftsmanship,
          simulation.powers.expertise,
          simulation.powers.wisdom,
          simulation.powers.exquisity,
          ...state.powerValueExtras,
        ].map((value) => value.toString()),
      },
      upgrades: exportUpgradeLevels(simulation.upgrades.wisdom),
    },
    pickaxe: {
      name: simulation.pickaxe.name,
      pow: simulation.pickaxe.power.toString(),
      quality: simulation.pickaxe.quality.toString(),
    },
  };
}
