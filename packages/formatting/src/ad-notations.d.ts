declare module "@antimatter-dimensions/notations/dist/ad-notations.esm.js" {
  import type { DecimalSource } from "@idle-mine-beyond/core";

  export interface NotationFormatter {
    readonly name: string;
    format(
      value: DecimalSource,
      places?: number,
      placesUnder1000?: number,
    ): string;
    formatExponent(exponent: number): string;
  }

  export const StandardNotation: { new (): NotationFormatter };
  export const ScientificNotation: { new (): NotationFormatter };
  export const EngineeringNotation: { new (): NotationFormatter };
  export const LettersNotation: { new (): NotationFormatter };
  export const LogarithmNotation: { new (): NotationFormatter };
  export const CancerNotation: { new (): NotationFormatter };
}
