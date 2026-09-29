import { Decimal, type DecimalSource } from "./decimal.js";
import { RemixRandom } from "./remix-random.js";

export type NormalizedDecimal = {
  decimal: string;
  mantissa: number | string;
  exponent: number | string;
};

type SerializedDropAmount = number | string | NormalizedDecimal;

type SerializedDrop = {
  chance: number;
  amount: SerializedDropAmount;
};

export type RemixMineObjectDefinition = {
  id: number;
  name: string;
  hp: NormalizedDecimal;
  totalHp: NormalizedDecimal;
  defense: NormalizedDecimal;
  value: NormalizedDecimal;
  colors: string[];
  skin: number;
  drops: Record<string, SerializedDrop>;
};

export type RemixMineObjectCatalog = {
  base: RemixMineObjectDefinition[];
  special: RemixMineObjectDefinition[];
  skinLayerAmounts: number[];
  dictionaryEnglish: string[];
};

export type MineObject = {
  id: number;
  name: string;
  hp: Decimal;
  totalHp: Decimal;
  defense: Decimal;
  value: Decimal;
  colors: string[];
  skin: number;
  drops: Record<string, { chance: number; amount: number | string | Decimal }>;
};

const MINE_OBJECT_NAMES = [
  "",
  "Salt",
  "Bone",
  "Bone",
  "Essence",
  "Orb",
  "Crystal",
  "",
  "",
  "",
  "",
  "",
  "",
  "Paper",
  "Gem",
  "Fractal",
];

const POST_UNIVERSE_NAMES = [
  "Cookie",
  "cook1ee",
  "Fish",
  "Pizza",
  "Math",
  "Fractal",
  "Idle",
  "Mine",
  "Remix",
  "Inverse",
  "Debug",
  "Reverse",
  "Î±",
  "Î²",
  "Î»",
];

function isNormalizedDecimal(value: unknown): value is NormalizedDecimal {
  return (
    typeof value === "object" &&
    value !== null &&
    "mantissa" in value &&
    "exponent" in value
  );
}

function decimalFromSnapshot(value: NormalizedDecimal): Decimal {
  return Decimal.fromMantissaExponent(
    Number(value.mantissa),
    Number(value.exponent),
  );
}

function decimalFromSerializedAmount(value: SerializedDropAmount): Decimal {
  return isNormalizedDecimal(value)
    ? decimalFromSnapshot(value)
    : new Decimal(value as DecimalSource);
}

function materialize(definition: RemixMineObjectDefinition): MineObject {
  const drops = Object.fromEntries(
    Object.entries(definition.drops).map(([name, drop]) => [
      name,
      {
        chance: drop.chance,
        amount: isNormalizedDecimal(drop.amount)
          ? decimalFromSnapshot(drop.amount)
          : drop.amount,
      },
    ]),
  );

  return {
    id: definition.id,
    name: definition.name,
    hp: decimalFromSnapshot(definition.hp),
    totalHp: decimalFromSnapshot(definition.totalHp),
    defense: decimalFromSnapshot(definition.defense),
    value: decimalFromSnapshot(definition.value),
    colors: [...definition.colors],
    skin: definition.skin,
    drops,
  };
}

function generateWord(seed: number, length: number): string {
  const vowels = "aeiou".split("");
  const consonants = "bcdfghjklmnpqrstvwxyz".split("");
  let result = "";

  for (let index = 0; index < length; index++) {
    const frequency = Math.sin(20000 * seed) > 0 ? 3 : 2;
    const collection = index % frequency === 0 ? vowels : consonants;
    const selected = Math.floor(
      (0.5 + 0.5 * Math.sin(seed * 5172 + 13451 * seed * index * index)) *
        collection.length,
    );
    result += collection[selected] as string;
  }

  return result[0]!.toUpperCase() + result.slice(1);
}

function generateMineObjectName(seed: number, length: number): string {
  let result = generateWord(seed, length);
  result +=
    Math.sin(45123 * seed) > -0.5
      ? "ium"
      : Math.sin(254235 * seed) > -0.5
        ? "lite"
        : "";
  return result;
}

function generateColor(seed: number): string {
  return (
    "#" +
    [51321, 45218, 94125]
      .map((factor) => {
        const value = 128 + 128 * Math.sin(seed * factor);
        return ("0" + Math.floor(value).toString(16)).slice(-2);
      })
      .join("")
  );
}

function seededChoose(seed: number, options: string[]): string {
  const selected = Math.floor(
    options.length / 2 + (options.length / 2) * Math.sin(seed * 123 + 175),
  );
  return options[selected] as string;
}

function roundBase(value: Decimal, digits: number): Decimal {
  const scale = Math.pow(10, digits);
  value.mantissa = Math.round(value.mantissa * scale) / scale;
  return value;
}

function createObject(
  id: number,
  name: string,
  hp: Decimal,
  defense: Decimal,
  value: Decimal,
  colors: string[],
  skin: number,
  drops: MineObject["drops"] = {},
): MineObject {
  const materializedColors =
    colors.length === 0
      ? ["white", "black"]
      : colors.length === 1
        ? [colors[0]!, "black"]
        : colors;
  const copiedHp = new Decimal(hp);

  return {
    id,
    name,
    hp: copiedHp,
    totalHp: new Decimal(copiedHp),
    defense: new Decimal(defense),
    value: new Decimal(value),
    colors: [...materializedColors],
    skin: skin || 0,
    drops,
  };
}

function generateMineObject(
  id: number,
  catalog: RemixMineObjectCatalog,
): MineObject {
  let lastDefinition = catalog.base[catalog.base.length - 1]!;
  let lastId = catalog.base.length;
  for (const entry of catalog.special) {
    if (entry.id < id) {
      lastDefinition = entry;
      lastId = entry.id + 1;
    }
  }
  const lastObject = materialize(lastDefinition);

  let d = id - lastId + 1;
  const d2 = Math.max(id - lastId - 30, 0);
  let skinId: number;
  let name: string;
  let colorAmount: number | undefined;
  let drops: MineObject["drops"] = {};

  if (lastId < 115) {
    const maxSkinId = 16;
    skinId = Math.floor(
      maxSkinId / 2 + (maxSkinId / 2) * Math.sin(id * 751641),
    );
    name = generateMineObjectName(id, 8);
    colorAmount = catalog.skinLayerAmounts[skinId];
    name +=
      MINE_OBJECT_NAMES[skinId]!.length > 0
        ? ` ${MINE_OBJECT_NAMES[skinId]!}`
        : "";
  } else if (lastId < 214) {
    const lastPlanetCoin = lastObject.drops["planetcoin"];
    if (lastPlanetCoin !== undefined) {
      const lastDrop = decimalFromSerializedAmount(
        lastPlanetCoin.amount as SerializedDropAmount,
      ).mul(lastPlanetCoin.chance);
      const newDrop = lastDrop.mul(Decimal.pow(1.45, d + d2 / 3));
      const chance = 0.2 + 0.199 * Math.sin(id * 236454);
      const amount = Decimal.round(newDrop.div(chance));
      drops = { planetcoin: { chance, amount } };
    }

    const skinIdMin = 20;
    const skinIdMax = 25;
    const idDelta = skinIdMax - skinIdMin;
    skinId =
      skinIdMin +
      Math.floor(idDelta / 2 + (idDelta / 2) * Math.sin(id * 458612));
    colorAmount = catalog.skinLayerAmounts[skinId];
    name = `${seededChoose(7514 * id, ["HD", "HR"])} ${Math.floor(5000 + 4000 * Math.sin(id * 489621))}-${seededChoose(4851 * id, ["a", "b", "c", "d", "e", "f"])}`;
  } else {
    skinId = 35;
    colorAmount = 4;
    const random = new RemixRandom(id);
    if (random.nextDouble() < 0.3) {
      name = `${POST_UNIVERSE_NAMES[random.nextInt(POST_UNIVERSE_NAMES.length)]}-Verse #${random.nextInt(10000)}`;
    } else {
      const wordIndex = Math.floor(
        random.nextDouble() * catalog.dictionaryEnglish.length,
      );
      name = `${catalog.dictionaryEnglish[wordIndex]}-Verse #${random.nextInt(10000)}`;
    }

    const basePlanetCoins = new Decimal(1e20);
    const baseWisdom = new Decimal(1e15);
    const dropChance = random.nextDouble();
    const dropDelta = Math.pow(id - 214, 1.1);
    if (id % 5 === 0) {
      const wisdom = baseWisdom.mul(Decimal.pow(1.7, dropDelta));
      drops = {
        wisdom: { chance: dropChance, amount: wisdom.div(dropChance) },
      };
    } else {
      let planetCoins = basePlanetCoins.mul(Decimal.pow(1.5, dropDelta));
      if (id % 4 === 0) planetCoins = planetCoins.mul(2);
      drops = {
        planetcoin: {
          chance: dropChance,
          amount: planetCoins.div(dropChance),
        },
      };
    }
  }

  const colors: string[] = [];
  for (let index = 0; index < (colorAmount as number); index++) {
    colors.push(
      index === 0
        ? Math.sin(id * 75124) > -0.5
          ? "black"
          : generateColor(id * 2 + 100)
        : generateColor(id * index * index + 100),
    );
  }

  let defenseDivisor = lastId < 114 ? 3.5 : 1;
  let worthIncrease = lastId < 140 ? 20 : 19;
  if (lastId > 214) {
    defenseDivisor = 10;
    worthIncrease = 9;
    d = Math.pow(d, 1.15);
  }

  const scaleExponent = d + d2 / 2;
  const mult = 1.5 + 0.5 * Math.sin(id * 21324);
  const worthMult = Math.pow(mult, Math.log(worthIncrease) / Math.log(7));
  return createObject(
    id,
    name,
    roundBase(lastObject.hp.mul(Decimal.pow(7, scaleExponent)).mul(mult), 1),
    roundBase(
      lastObject.defense
        .mul(Decimal.pow(7, scaleExponent))
        .div(defenseDivisor)
        .mul(mult),
      1,
    ),
    roundBase(
      lastObject.value
        .mul(Decimal.pow(worthIncrease, scaleExponent))
        .mul(worthMult),
      1,
    ),
    colors,
    skinId,
    drops,
  );
}

/** Returns an independent copy of a fixed object or a generated mine object. */
export function getRemixMineObject(
  id: number,
  catalog: RemixMineObjectCatalog,
): MineObject {
  const special = catalog.special.find((entry) => entry.id === id);
  if (special) return materialize(special);
  if (id < catalog.base.length) return materialize(catalog.base[id]!);
  return generateMineObject(id, catalog);
}
