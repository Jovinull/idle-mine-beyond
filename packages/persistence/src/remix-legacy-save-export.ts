import type { RemixLegacySaveApplicationState } from "./remix-legacy-save-application.js";
import type { RemixLegacySaveData } from "./remix-legacy-save-application.js";

export type RemixLegacySaveTemplate = Readonly<Record<string, unknown>>;

export type RemixLegacySaveLogMessage = Readonly<{
  message: string;
  color: string;
}>;

type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, path: string): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Remix save template is missing object ${path}.`);
  }
  return value as JsonObject;
}

function decimalJson(value: { toString(): string }): string {
  return value.toString();
}

function setUpgradeLevels(target: JsonObject, levels: Record<string, number>) {
  for (const [key, level] of Object.entries(levels)) {
    const upgrade = objectAt(target[key], `upgrade ${key}`);
    upgrade["level"] = level;
  }
}

function serializeCurrentObject(
  object: RemixLegacySaveApplicationState["simulation"]["currentObject"],
): JsonObject {
  const drops = Object.fromEntries(
    Object.entries(object.drops).map(([key, drop]) => [
      key,
      {
        chance: drop.chance,
        amount:
          typeof drop.amount === "object"
            ? decimalJson(drop.amount)
            : drop.amount,
      },
    ]),
  );
  const serialized: JsonObject = {
    name: object.name,
    hp: decimalJson(object.hp),
    totalHp: decimalJson(object.totalHp),
    def: decimalJson(object.defense),
    value: decimalJson(object.value),
    colors: [...object.colors],
    skin: object.skin,
  };
  if (Object.keys(drops).length > 0) serialized["cfg"] = { drops };
  serialized["drops"] = drops;
  return serialized;
}

/**
 * Rebuilds the complete JSON-serializable `game` object that Remix exports.
 * The caller supplies the pinned fresh-game data template; dynamic fields are
 * overlaid without changing the source's root, group, or field order.
 */
export function createRemixLegacySaveExportData(
  state: RemixLegacySaveApplicationState,
  lastActiveMs: number,
  sourceTemplate: RemixLegacySaveTemplate,
  messageLog: readonly RemixLegacySaveLogMessage[] = [],
): RemixLegacySaveData {
  const cloned = JSON.parse(JSON.stringify(sourceTemplate)) as unknown;
  const game = objectAt(cloned, "game");
  const { simulation, settings } = state;
  const resources = simulation.resources;

  game["timer"] = {
    autoPickaxe: simulation.autoPickaxeTimer,
    save: simulation.saveTimer,
  };
  game["lastActive"] = lastActiveMs;
  game["money"] = decimalJson(resources.money);
  game["highestMoney"] = decimalJson(resources.highestMoney);
  game["gems"] = decimalJson(resources.gems);
  game["usedGemsLevel"] = simulation.usedGemsLevel;
  game["pickaxe"] = {
    name: simulation.pickaxe.name,
    pow: decimalJson(simulation.pickaxe.power),
    quality: decimalJson(simulation.pickaxe.quality),
  };
  game["messageLog"] = messageLog.map(({ message, color }) => ({
    message,
    color,
  }));
  game["currentMineObject"] = serializeCurrentObject(simulation.currentObject);
  game["mineObjectLevel"] = simulation.mineObjectLevel;
  game["highestMineObjectLevel"] = simulation.highestMineObjectLevel;
  game["planetCoins"] = decimalJson(resources.planetCoins);
  game["maxPlanetCoins"] = decimalJson(resources.maxPlanetCoins);
  game["wisdom"] = decimalJson(resources.wisdom);
  game["maxWisdom"] = decimalJson(resources.maxWisdom);

  setUpgradeLevels(
    objectAt(game["upgrades"], "upgrades"),
    simulation.upgrades.money,
  );
  setUpgradeLevels(
    objectAt(game["gemUpgrades"], "gemUpgrades"),
    simulation.upgrades.gems,
  );
  setUpgradeLevels(
    objectAt(game["planetCoinUpgrades"], "planetCoinUpgrades"),
    simulation.upgrades.planetCoins,
  );

  const powers = objectAt(game["powers"], "powers");
  const powerData = objectAt(powers["data"], "powers.data");
  powerData["values"] = [
    simulation.powers.mining,
    simulation.powers.craftsmanship,
    simulation.powers.expertise,
    simulation.powers.wisdom,
    simulation.powers.exquisity,
    ...state.powerValueExtras,
  ].map(decimalJson);
  setUpgradeLevels(
    objectAt(powers["upgrades"], "powers.upgrades"),
    simulation.upgrades.wisdom,
  );

  const story = objectAt(game["story"], "story");
  story["page"] = simulation.story.page;
  story["scrollY"] = state.storyScrollY;
  story["highestUnlocked"] = simulation.story.highestUnlocked;
  story["notifications"] = simulation.story.notifications;

  const serializedSettings = objectAt(game["settings"], "settings");
  serializedSettings["theme"] = settings.theme;
  serializedSettings["tab"] = settings.tab;
  serializedSettings["upgradeTab"] = settings.upgradeTab;
  serializedSettings["numberFormatterIndex"] = settings.numberFormatterIndex;
  serializedSettings["exportFieldString"] = settings.exportFieldString;
  serializedSettings["showMineObjLevel"] = settings.showMineObjLevel;
  serializedSettings["showMinCraftDamage"] = settings.showMinCraftDamage;
  const formatters = game["numberFormatters"];
  if (!Array.isArray(formatters)) {
    throw new TypeError("Remix save template is missing numberFormatters.");
  }
  game["numberFormatter"] = formatters[settings.numberFormatterIndex];

  return game as RemixLegacySaveData;
}
