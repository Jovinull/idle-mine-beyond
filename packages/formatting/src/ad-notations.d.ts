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
  export const AllNotation: { new (): NotationFormatter };
  export const BlindNotation: { new (): NotationFormatter };
  export const BracketsNotation: { new (): NotationFormatter };
  export const ClockNotation: { new (): NotationFormatter };
  export const DotsNotation: { new (): NotationFormatter };
  export const HexNotation: { new (): NotationFormatter };
  export const ImperialNotation: { new (): NotationFormatter };
  export const InfinityNotation: { new (): NotationFormatter };
  export const MixedEngineeringNotation: { new (): NotationFormatter };
  export const MixedScientificNotation: { new (): NotationFormatter };
  export const PrimeNotation: { new (): NotationFormatter };
  export const RomanNotation: { new (): NotationFormatter };
  export const ShiNotation: { new (): NotationFormatter };
  export const ZalgoNotation: { new (): NotationFormatter };
}
