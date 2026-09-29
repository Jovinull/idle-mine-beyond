import {
  Notation,
  StandardNotation,
} from "@antimatter-dimensions/notations/dist/ad-notations.esm.js";
import { Decimal, type DecimalSource } from "@idle-mine-beyond/core";

export class IdleMineNotation extends Notation {
  override readonly name = "Idle Mine Notation";

  get suffixes(): string[] {
    return ["", "b", "qt", "o", "ud", "qd", "sd", "v", "tv", "sv", "nv", "dt"];
  }

  override formatDecimal(value: DecimalSource, places?: number): string {
    return this.format(value, places, places);
  }

  override format(
    value: DecimalSource,
    places?: number,
    below1000?: number,
  ): string {
    const decimal = new Decimal(value);
    const logarithm = Decimal.log10(decimal);
    const order = Math.max(0, Math.floor((logarithm - 1) / 9));

    if (order < this.suffixes.length) {
      const suffix = this.suffixes[order]!;
      const digits = order > 0 ? places : below1000;
      return (
        Decimal.pow(10, (logarithm - 1) % 9)
          .mul(10)
          .toNumber()
          .toLocaleString("en-us", {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits,
          }) + suffix
      );
    }

    return new StandardNotation().formatDecimal(decimal, places);
  }
}

export class SINotationNew extends Notation {
  override readonly name: string = "SI Notation (2022)";

  get suffixesLong(): string[] {
    return [
      "",
      "Kilo",
      "Mega",
      "Giga",
      "Tera",
      "Peta",
      "Exa",
      "Zetta",
      "Yotta",
      "Ronna",
      "Quecca",
    ];
  }

  get suffixesShort(): string[] {
    return ["K", "M", "G", "T", "P", "E", "Z", "Y", "R", "Q"];
  }

  makeSuperScriptNumber(value: number): string {
    const digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
    let result = "";
    for (const digit of value.toFixed(0).toString()) {
      result += digits[Number.parseInt(digit)];
    }
    return result;
  }

  override formatDecimal(value: DecimalSource, places?: number): string {
    return this.format(value, places, places);
  }

  override format(
    value: DecimalSource,
    places?: number,
    below1000?: number,
  ): string {
    const decimal = new Decimal(value);
    if (decimal.lt(1000)) {
      return decimal.toFixed(below1000);
    }

    const mantissa = Decimal.pow(10, Decimal.log10(decimal) % 3);
    if (decimal.e < this.suffixesLong.length * 3) {
      return `${mantissa.toFixed(places)} ${this.suffixesLong[Math.floor(decimal.e / 3)]!}`;
    }

    const order = Math.floor((decimal.e - 3) / (3 * this.suffixesShort.length));
    let result = `${mantissa.toFixed(places)} ${this.suffixesShort[Math.floor(decimal.e / 3 - 1) % this.suffixesShort.length]!}`;
    if (order > 0) {
      const lastCharacter = this.suffixesShort[this.suffixesShort.length - 1]!;
      result +=
        order > 5
          ? `${lastCharacter}${this.makeSuperScriptNumber(order)}`
          : lastCharacter.repeat(order);
    }
    return result;
  }
}

export class SINotationCurrent extends SINotationNew {
  override readonly name = "SI Notation (Current)";

  override get suffixesLong(): string[] {
    return [
      "",
      "Kilo",
      "Mega",
      "Giga",
      "Tera",
      "Peta",
      "Exa",
      "Zetta",
      "Yotta",
    ];
  }

  override get suffixesShort(): string[] {
    return ["K", "M", "G", "T", "P", "E", "Z", "Y"];
  }
}
