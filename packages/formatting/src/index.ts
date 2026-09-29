import {
  AllNotation,
  BlindNotation,
  BracketsNotation,
  CancerNotation,
  ClockNotation,
  DotsNotation,
  EngineeringNotation,
  HexNotation,
  ImperialNotation,
  InfinityNotation,
  LettersNotation,
  LogarithmNotation,
  MixedEngineeringNotation,
  MixedScientificNotation,
  PrimeNotation,
  RomanNotation,
  ScientificNotation,
  ShiNotation,
  StandardNotation,
  type NotationFormatter,
  ZalgoNotation,
} from "@antimatter-dimensions/notations/dist/ad-notations.esm.js";
import {
  BinaryNotation,
  ChineseNotation,
  CoronavirusNotation,
  ElementalNotation,
  EvilNotation,
  FlagsNotation,
  GreekLettersNotation,
  HexadecimalNotation,
  JapaneseNotation,
  MixedLogarithmSciNotation,
  OmegaNotation,
  OmegaShortNotation,
  PrecisePrimeNotation,
  TritetratedNotation,
  YesNoNotation,
} from "@antimatter-dimensions/notations/dist/ad-notations.community.esm.js";
import {
  Decimal,
  type DecimalSource,
  type RemixPickaxeCraftEvent,
} from "@idle-mine-beyond/core";
import { RemixHahaFunnyNotation } from "./haha-funny-notation.js";
import { RemixNiceNotation } from "./nice-notation.js";
import {
  IdleMineNotation,
  SINotationCurrent,
  SINotationNew,
} from "./remix-custom-notations.js";

export type { NotationFormatter };

const limitNotations = new Set(["Standard", "Scientific", "Engineering"]);

export function createADNotationFormatters(): NotationFormatter[] {
  return [
    new StandardNotation(),
    new ScientificNotation(),
    new EngineeringNotation(),
    new LettersNotation(),
    new LogarithmNotation(),
    new CancerNotation(),
    new AllNotation(),
    new BlindNotation(),
    new BracketsNotation(),
    new ClockNotation(),
    new DotsNotation(),
    new HexNotation(),
    new ImperialNotation(),
    new InfinityNotation(),
    new MixedEngineeringNotation(),
    new MixedScientificNotation(),
    new PrimeNotation(),
    new RomanNotation(),
    new ShiNotation(),
    new ZalgoNotation(),
  ];
}

export function createInitialFormatters(): NotationFormatter[] {
  return createADNotationFormatters().slice(0, 6);
}

export function createCommunityNotationFormatters(): NotationFormatter[] {
  return [
    new BinaryNotation(),
    new ChineseNotation(),
    new CoronavirusNotation(),
    new ElementalNotation(),
    new EvilNotation(),
    new FlagsNotation(),
    new GreekLettersNotation(),
    new RemixHahaFunnyNotation(),
    new HexadecimalNotation(),
    new JapaneseNotation(),
    new MixedLogarithmSciNotation(),
    new RemixNiceNotation(),
    new OmegaNotation(),
    new OmegaShortNotation(),
    new PrecisePrimeNotation(),
    new TritetratedNotation(),
    new YesNoNotation(),
  ];
}

export function createCustomFormatters(): NotationFormatter[] {
  return [new IdleMineNotation(), new SINotationCurrent(), new SINotationNew()];
}

export function createRemixFormatters(): NotationFormatter[] {
  return [
    ...createADNotationFormatters(),
    ...createCommunityNotationFormatters(),
    ...createCustomFormatters(),
  ];
}

/** Remix's formatThousands wrapper, with the selected formatter injected. */
export function formatThousands(
  value: DecimalSource,
  formatter: NotationFormatter,
  limit: DecimalSource = "1e12",
  precision = 0,
): string {
  const decimal = new Decimal(value);
  if (decimal.gte(limit)) return formatter.format(decimal);

  return decimal.toNumber().toLocaleString("en-us", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** Remix's formatNumber wrapper, including its notation-specific limit path. */
export function formatNumber(
  value: DecimalSource,
  formatter: NotationFormatter,
  precision?: number,
  limit?: DecimalSource,
  below1000?: number,
): string {
  const decimal = new Decimal(value);
  const places = precision ?? 0;
  const under1000 = below1000 ?? 0;
  const decimalLimit = new Decimal(limit ?? 1000);
  if (!limitNotations.has(formatter.name)) {
    return formatter.format(decimal, places, under1000);
  }

  if (decimal.gt(decimalLimit)) {
    return formatter.format(decimal, places, under1000);
  }

  return decimal.lt(1000)
    ? formatThousands(decimal, formatter, Infinity, under1000)
    : formatThousands(decimal, formatter, Infinity, 0);
}

/** Remix multiplies by 100 before invoking formatNumber and appends `%`. */
export function formatPercent(
  value: DecimalSource,
  formatter: NotationFormatter,
  digits?: number,
  limit?: DecimalSource,
): string {
  const precision = digits ?? 2;
  const decimalLimit = new Decimal(limit ?? "1e12");
  return `${formatNumber(
    new Decimal(value).mul(100),
    formatter,
    precision,
    decimalLimit,
    precision,
  )}%`;
}

/** Formats the exact player log feedback emitted by Remix pickaxe crafting. */
export function formatRemixPickaxeCraftFeedback(
  event: RemixPickaxeCraftEvent,
  formatter: NotationFormatter,
): { message: string; color: string } | null {
  switch (event.type) {
    case "pickaxe-replaced":
      return {
        message: `Got a new Pickaxe! "${event.pickaxe.name}"`,
        color: "#00b400",
      };
    case "dud":
      return {
        message: `Sorry, I crafted a dud! (P: ${formatter.format(event.pickaxe.power, 2)}, Q: ${formatPercent(event.pickaxe.quality, formatter, 0)}, Dmg: ${formatter.format(event.pickaxe.damage, 2)})`,
        color: "#ff0900",
      };
    case "insufficient-gems":
      return { message: "Not enough Gems!", color: "#ff0900" };
    case "save":
      return null;
  }
}
