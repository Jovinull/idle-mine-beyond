import { Decimal } from "@idle-mine-beyond/core";
import { Notation } from "@antimatter-dimensions/notations/dist/ad-notations.community.esm.js";

const LOG_69 = Math.log(69);

/**
 * The pinned Remix community UMD includes this class, but AD Notations 1.6.0's
 * ESM entry omits its export. Keep the source-derived class local and golden-
 * tested instead of changing the canonical reference or vendoring its bundle.
 */
export class RemixHahaFunnyNotation extends Notation {
  override readonly name = "Haha Funny";

  override get infinite(): string {
    return "69420";
  }

  override formatUnder1000(value: number): string {
    return this.formatDecimal(new Decimal(value));
  }

  override formatDecimal(value: Decimal): string {
    if (value.eq(0)) return "42069";
    if (value.lt(1)) {
      return this.formatDecimal(value.pow(-1)).split("").reverse().join("");
    }

    let remainder = Math.floor(
      (Math.LN10 / LOG_69) * value.log10() * Math.pow(69, 2),
    );
    const digits: string[] = [];
    while (remainder > 0 || digits.length < 3) {
      digits.push(String((remainder % 69) + 1));
      remainder = Math.floor(remainder / 69);
    }
    return digits.join("");
  }
}
