import { Decimal } from "@idle-mine-beyond/core";
import { Notation } from "@antimatter-dimensions/notations/dist/ad-notations.community.esm.js";

export class RemixNiceNotation extends Notation {
  override readonly name = "Nice";

  override get infinite(): string {
    return "69420";
  }

  override formatDecimal(value: Decimal, places = 0): string {
    return value.log(69).toFixed(Math.max(2, places)).replace("-", "^");
  }

  override formatUnder1000(value: number, places = 0): string {
    return this.formatDecimal(new Decimal(value), places);
  }
}
