import { Decimal } from "@idle-mine-beyond/core";
import {
  createRemixFormatters,
  formatNumber,
  formatPercent,
  formatThousands,
} from "@idle-mine-beyond/formatting";

type Output = string | { error: string };
type FormatValue = { input: string; output: Output };
type ImperialNotationReference = {
  sourcePath: string;
  constants: {
    volumeUnits: [number, string, number][];
    adjectives: string[];
    maxVolume: number;
    logMaxVolume: number;
    reduceRatio: number;
  };
  findVolumeUnit: {
    label: string;
    value: number;
    expectedIndex: number;
    output: number | { error: string };
  }[];
  formatMetric: { input: number; output: Output }[];
  checkSmallUnits: {
    label: string;
    adjective: string;
    value: number;
    volumeIndex: number;
    output: Output | null;
  }[];
  checkAlmost: {
    label: string;
    adjective: string;
    value: number;
    numBig: number;
    bigIndex: number;
    output: Output | null;
  }[];
  convertToVolume: {
    label: string;
    value: number;
    volumeIndex: number;
    output: Output;
  }[];
  formatUnder1000: { input: number; output: Output }[];
  formatDecimal: FormatValue[];
  maxFiniteFormatDecimal: Output;
  formattedValues: FormatValue[];
  phrases: {
    method: "pluralOrArticle" | "addArticle";
    num?: number;
    value: string;
    output: Output;
  }[];
  infinite: string;
};
type NotationReference = {
  formatterRegistry: { name: string }[];
  directFormatterOutputs: {
    notation: string;
    values: FormatValue[];
  }[];
  formatNumberScenarios: {
    notation: string;
    scenarios: {
      name: string;
      values: { input: string; output: Output }[];
    }[];
  }[];
  formatThousands: {
    notation: string;
    values: {
      input: string;
      default: Output;
      precisionTwo: Output;
    }[];
  }[];
  formatPercent: {
    notation: string;
    values: FormatValue[];
  }[];
  adMethodOutputs: {
    imperialNotation: ImperialNotationReference;
  };
  communityMethodOutputs: {
    japaneseFormatter: {
      sourcePath: string;
      values: FormatValue[];
    };
    omegaNotations: {
      sourcePath: string;
      formatters: {
        notation: string;
        values: FormatValue[];
      }[];
    };
    tritetratedNotation: {
      sourcePath: string;
      values: FormatValue[];
    };
    flagsNotation: {
      sourcePath: string;
      base: number;
      letters: string[];
      transcriptionBoundaries: {
        engineeringExponent: number;
        output: (string | null)[] | { error: string };
      }[];
      values: FormatValue[];
    };
    elementalNotation: {
      sourcePath: string;
      listLengths: number[];
      lookups: {
        listIndex: number;
        elementIndex: number;
        input: number;
        output: [string, number] | { error: string };
      }[];
      partFormatting: {
        abbreviation: string;
        amount: number;
        output: Output;
      }[];
      methodValues: FormatValue[];
      formattedValues: FormatValue[];
      infinite: string;
    };
    precisePrimeNotation: {
      sourcePath: string;
      constants: {
        maxSafeInteger: number;
        maxFactor: number;
        maxSafeIntegerLog10: number;
        decimalMaxMantissa: number;
        decimalMaxExponent: number;
        decimalMaxLog10: number;
        decimalMaxTowerExponent: number;
      };
      primeFactorizations: {
        input: number;
        output: number[] | { error: string };
      }[];
      factorListFormatting: {
        factors: number[];
        output: Output;
      }[];
      parenthesization: {
        value: string;
        parenthesize: boolean;
        output: Output;
      }[];
      powerTowers: {
        exponents: number[];
        output: Output;
      }[];
      primifyValues: FormatValue[];
      maxFinitePrimify: Output;
      maxFiniteFormatted: Output;
      formatUnder1000Values: {
        input: number;
        output: Output;
      }[];
      formattedValues: FormatValue[];
      infinite: string;
    };
  };
  exponentFormatterInputs: number[];
  exponentFormatterOutputs: {
    notation: string;
    values: { input: number; output: Output }[];
  }[];
};

function captureOutput(operation: () => string): Output {
  try {
    return operation();
  } catch (error) {
    return { error: String(error) };
  }
}

function captureValue<T>(operation: () => T): T | { error: string } {
  try {
    return operation();
  } catch (error) {
    return { error: String(error) };
  }
}

function captureOptionalOutput(
  operation: () => string | undefined,
): Output | null {
  try {
    return operation() ?? null;
  } catch (error) {
    return { error: String(error) };
  }
}

const formatters = createRemixFormatters();
const standard = formatters.find((formatter) => formatter.name === "Standard");
const idleMine = formatters.find(
  (formatter) => formatter.name === "Idle Mine Notation",
);
const output = document.querySelector<HTMLPreElement>("#result");

if (!standard || !idleMine || !output) {
  throw new Error("Formatting smoke page failed to initialize.");
}

const formattersByName = new Map(
  formatters.map((formatter) => [formatter.name, formatter]),
);
const browserWindow = window as Window & {
  __idleMineFormattingProbe?: (reference: NotationReference) => unknown;
};

browserWindow.__idleMineFormattingProbe = (reference) => {
  const formatterFor = (name: string) => {
    const formatter = formattersByName.get(name);
    if (!formatter) throw new Error(`Missing formatter: ${name}`);
    return formatter;
  };

  const directFormatterOutputs = reference.directFormatterOutputs.map(
    ({ notation, values }) => {
      const formatter = formatterFor(notation);
      return {
        notation,
        values: values.map(({ input }) => ({
          input,
          output: captureOutput(() => formatter.format(input, 2, 0)),
        })),
      };
    },
  );
  const formatNumberScenarios = reference.formatNumberScenarios.map(
    ({ notation, scenarios }) => {
      const formatter = formatterFor(notation);
      return {
        notation,
        scenarios: scenarios.map(({ name, values }) => ({
          name,
          values: values.map(({ input }) => ({
            input,
            output: captureOutput(() => {
              switch (name) {
                case "defaults":
                  return formatNumber(input, formatter);
                case "precision-two":
                  return formatNumber(input, formatter, 2);
                case "limit-1000":
                  return formatNumber(input, formatter, 2, 1000, 0);
                case "limit-1e12":
                  return formatNumber(input, formatter, 2, "1e12", 0);
                default:
                  throw new Error(`Unknown formatNumber scenario: ${name}`);
              }
            }),
          })),
        })),
      };
    },
  );
  const formatThousandsOutputs = reference.formatThousands.map(
    ({ notation, values }) => {
      const formatter = formatterFor(notation);
      return {
        notation,
        values: values.map(({ input }) => ({
          input,
          default: captureOutput(() => formatThousands(input, formatter)),
          precisionTwo: captureOutput(() =>
            formatThousands(input, formatter, Infinity, 2),
          ),
        })),
      };
    },
  );
  const formatPercentOutputs = reference.formatPercent.map(
    ({ notation, values }) => {
      const formatter = formatterFor(notation);
      return {
        notation,
        values: values.map(({ input }) => ({
          input,
          output: captureOutput(() => formatPercent(input, formatter)),
        })),
      };
    },
  );
  const exponentFormatterOutputs = reference.exponentFormatterOutputs.map(
    ({ notation }) => {
      const formatter = formatterFor(notation);
      return {
        notation,
        values: reference.exponentFormatterInputs.map((input) => ({
          input,
          output: captureOutput(() => formatter.formatExponent(input)),
        })),
      };
    },
  );
  const japaneseFormatter = formatterFor("Japanese");
  const japaneseFormatterOutputs = {
    sourcePath: reference.communityMethodOutputs.japaneseFormatter.sourcePath,
    values: reference.communityMethodOutputs.japaneseFormatter.values.map(
      ({ input }) => ({
        input,
        output: captureOutput(() => japaneseFormatter.format(input, 2, 0)),
      }),
    ),
  };
  const omegaNotationOutputs = {
    sourcePath: reference.communityMethodOutputs.omegaNotations.sourcePath,
    formatters: reference.communityMethodOutputs.omegaNotations.formatters.map(
      ({ notation, values }) => {
        const formatter = formatterFor(notation);
        return {
          notation,
          values: values.map(({ input }) => ({
            input,
            output: captureOutput(() => formatter.format(input, 2, 0)),
          })),
        };
      },
    ),
  };
  const tritetratedFormatter = formatterFor("Tritetrated") as unknown as {
    tritetrated(value: Decimal): string;
  };
  const tritetratedNotationOutputs = {
    sourcePath: reference.communityMethodOutputs.tritetratedNotation.sourcePath,
    values: reference.communityMethodOutputs.tritetratedNotation.values.map(
      ({ input }) => ({
        input,
        output: captureOutput(() =>
          tritetratedFormatter.tritetrated(new Decimal(input)),
        ),
      }),
    ),
  };
  const flagsFormatter = formatterFor("Flags") as unknown as {
    letters: string[];
    transcribe(engineeringExponent: number): string[];
    format(value: Decimal, places: number, placesUnder1000: number): string;
  };
  const flagsNotationOutputs = {
    sourcePath: reference.communityMethodOutputs.flagsNotation.sourcePath,
    base: flagsFormatter.letters.length,
    letters: [...flagsFormatter.letters],
    transcriptionBoundaries:
      reference.communityMethodOutputs.flagsNotation.transcriptionBoundaries.map(
        ({ engineeringExponent }) => ({
          engineeringExponent,
          output: flagsFormatter
            .transcribe(engineeringExponent)
            .map((letter) => letter ?? null),
        }),
      ),
    values: reference.communityMethodOutputs.flagsNotation.values.map(
      ({ input }) => ({
        input,
        output: captureOutput(() =>
          flagsFormatter.format(new Decimal(input), 2, 0),
        ),
      }),
    ),
  };
  const elementalFormatter = formatterFor("Elemental") as unknown as {
    getAbbreviationAndValue(value: number): [string, number];
    formatElementalPart(abbreviation: string, amount: number): string;
    elemental(value: Decimal, places: number): string;
    infinite: string;
    format(value: Decimal, places: number, placesUnder1000: number): string;
  };
  const elementalNotationOutputs = {
    sourcePath: reference.communityMethodOutputs.elementalNotation.sourcePath,
    listLengths: [
      ...reference.communityMethodOutputs.elementalNotation.listLengths,
    ],
    lookups: reference.communityMethodOutputs.elementalNotation.lookups.map(
      ({ listIndex, elementIndex, input }) => ({
        listIndex,
        elementIndex,
        input,
        output: captureValue(() =>
          elementalFormatter.getAbbreviationAndValue(input),
        ),
      }),
    ),
    partFormatting:
      reference.communityMethodOutputs.elementalNotation.partFormatting.map(
        ({ abbreviation, amount }) => ({
          abbreviation,
          amount,
          output: captureOutput(() =>
            elementalFormatter.formatElementalPart(abbreviation, amount),
          ),
        }),
      ),
    methodValues:
      reference.communityMethodOutputs.elementalNotation.methodValues.map(
        ({ input }) => ({
          input,
          output: captureOutput(() =>
            elementalFormatter.elemental(new Decimal(input), 2),
          ),
        }),
      ),
    formattedValues:
      reference.communityMethodOutputs.elementalNotation.formattedValues.map(
        ({ input }) => ({
          input,
          output: captureOutput(() =>
            elementalFormatter.format(new Decimal(input), 2, 0),
          ),
        }),
      ),
    infinite: elementalFormatter.infinite,
  };
  const precisePrimeFormatter = formatterFor("Precise Prime") as unknown as {
    primify(value: Decimal): string;
    maybeParenthesize(value: string, parenthesize: boolean): string;
    formatPowerTower(exponents: number[]): string;
    formatFromList(factors: number[]): string;
    primesFromInt(value: number): number[];
    formatUnder1000(value: number): string;
    format(value: Decimal, places: number, placesUnder1000: number): string;
    infinite: string;
  };
  const precisePrimeNotationOutputs = {
    sourcePath:
      reference.communityMethodOutputs.precisePrimeNotation.sourcePath,
    constants: {
      maxSafeInteger: Number.MAX_SAFE_INTEGER,
      maxFactor: 10_000,
      maxSafeIntegerLog10: Math.log10(Number.MAX_SAFE_INTEGER),
      decimalMaxMantissa: Decimal.MAX_VALUE.m,
      decimalMaxExponent: Decimal.MAX_VALUE.e,
      decimalMaxLog10: Decimal.MAX_VALUE.log10(),
      decimalMaxTowerExponent:
        Decimal.MAX_VALUE.log10() / Math.log10(Number.MAX_SAFE_INTEGER),
    },
    primeFactorizations:
      reference.communityMethodOutputs.precisePrimeNotation.primeFactorizations.map(
        ({ input }) => ({
          input,
          output: captureValue(() =>
            precisePrimeFormatter.primesFromInt(input),
          ),
        }),
      ),
    factorListFormatting:
      reference.communityMethodOutputs.precisePrimeNotation.factorListFormatting.map(
        ({ factors }) => ({
          factors,
          output: captureOutput(() =>
            precisePrimeFormatter.formatFromList(factors),
          ),
        }),
      ),
    parenthesization:
      reference.communityMethodOutputs.precisePrimeNotation.parenthesization.map(
        ({ value, parenthesize }) => ({
          value,
          parenthesize,
          output: captureOutput(() =>
            precisePrimeFormatter.maybeParenthesize(value, parenthesize),
          ),
        }),
      ),
    powerTowers:
      reference.communityMethodOutputs.precisePrimeNotation.powerTowers.map(
        ({ exponents }) => ({
          exponents,
          output: captureOutput(() =>
            precisePrimeFormatter.formatPowerTower(exponents),
          ),
        }),
      ),
    primifyValues:
      reference.communityMethodOutputs.precisePrimeNotation.primifyValues.map(
        ({ input }) => ({
          input,
          output: captureOutput(() =>
            precisePrimeFormatter.primify(new Decimal(input)),
          ),
        }),
      ),
    maxFinitePrimify: captureOutput(() =>
      precisePrimeFormatter.primify(Decimal.MAX_VALUE),
    ),
    maxFiniteFormatted: captureOutput(() =>
      precisePrimeFormatter.format(Decimal.MAX_VALUE, 2, 0),
    ),
    formatUnder1000Values:
      reference.communityMethodOutputs.precisePrimeNotation.formatUnder1000Values.map(
        ({ input }) => ({
          input,
          output: captureOutput(() =>
            precisePrimeFormatter.formatUnder1000(input),
          ),
        }),
      ),
    formattedValues:
      reference.communityMethodOutputs.precisePrimeNotation.formattedValues.map(
        ({ input }) => ({
          input,
          output: captureOutput(() =>
            precisePrimeFormatter.format(new Decimal(input), 2, 0),
          ),
        }),
      ),
    infinite: precisePrimeFormatter.infinite,
  };
  const imperial = formatterFor("Imperial") as unknown as {
    formatUnder1000(value: number): string;
    formatDecimal(value: Decimal): string;
    convertToVolume(value: number, adjective: string): string;
    formatMetric(value: number): string;
    checkSmallUnits(
      adjective: string,
      value: number,
      volumeIndex: number,
    ): string | undefined;
    findVolumeUnit(value: number): number;
    checkAlmost(
      adjective: string,
      value: number,
      numBig: number,
      bigIndex: number,
    ): string | undefined;
    pluralOrArticle(num: number, value: string): string;
    addArticle(value: string): string;
    infinite: string;
    format(value: Decimal, places: number, placesUnder1000: number): string;
  };
  const imperialSource = reference.adMethodOutputs.imperialNotation;
  const imperialNotationOutputs: ImperialNotationReference = {
    sourcePath: imperialSource.sourcePath,
    constants: imperialSource.constants,
    findVolumeUnit: imperialSource.findVolumeUnit.map(
      ({ label, value, expectedIndex }) => ({
        label,
        value,
        expectedIndex,
        output: captureValue(() => imperial.findVolumeUnit(value)),
      }),
    ),
    formatMetric: imperialSource.formatMetric.map(({ input }) => ({
      input,
      output: captureOutput(() => imperial.formatMetric(input)),
    })),
    checkSmallUnits: imperialSource.checkSmallUnits.map(
      ({ label, adjective, value, volumeIndex }) => ({
        label,
        adjective,
        value,
        volumeIndex,
        output: captureOptionalOutput(() =>
          imperial.checkSmallUnits(adjective, value, volumeIndex),
        ),
      }),
    ),
    checkAlmost: imperialSource.checkAlmost.map(
      ({ label, adjective, value, numBig, bigIndex }) => ({
        label,
        adjective,
        value,
        numBig,
        bigIndex,
        output: captureOptionalOutput(() =>
          imperial.checkAlmost(adjective, value, numBig, bigIndex),
        ),
      }),
    ),
    convertToVolume: imperialSource.convertToVolume.map(({ label, value }) => ({
      label,
      value,
      volumeIndex: imperial.findVolumeUnit(value),
      output: captureOutput(() => imperial.convertToVolume(value, "minute ")),
    })),
    formatUnder1000: imperialSource.formatUnder1000.map(({ input }) => ({
      input,
      output: captureOutput(() => imperial.formatUnder1000(input)),
    })),
    formatDecimal: imperialSource.formatDecimal.map(({ input }) => ({
      input,
      output: captureOutput(() => imperial.formatDecimal(new Decimal(input))),
    })),
    maxFiniteFormatDecimal: captureOutput(() =>
      imperial.formatDecimal(Decimal.MAX_VALUE),
    ),
    formattedValues: imperialSource.formattedValues.map(({ input }) => ({
      input,
      output: captureOutput(() => imperial.format(new Decimal(input), 2, 0)),
    })),
    phrases: imperialSource.phrases.map(({ method, num, value }) => ({
      method,
      ...(num === undefined ? {} : { num }),
      value,
      output:
        method === "addArticle"
          ? imperial.addArticle(value)
          : imperial.pluralOrArticle(num ?? 0, value),
    })),
    infinite: imperial.infinite,
  };

  return {
    formatterNames: formatters.map(({ name }) => name),
    directFormatterOutputs,
    formatNumberScenarios,
    formatThousands: formatThousandsOutputs,
    formatPercent: formatPercentOutputs,
    exponentFormatterOutputs,
    adMethodOutputs: {
      imperialNotation: imperialNotationOutputs,
    },
    communityMethodOutputs: {
      japaneseFormatter: japaneseFormatterOutputs,
      omegaNotations: omegaNotationOutputs,
      tritetratedNotation: tritetratedNotationOutputs,
      flagsNotation: flagsNotationOutputs,
      elementalNotation: elementalNotationOutputs,
      precisePrimeNotation: precisePrimeNotationOutputs,
    },
  };
};

output.textContent = JSON.stringify({
  names: formatters.map(({ name }) => name),
  grouped: formatNumber("1000", standard),
  percent: formatPercent("0.005", standard),
  idleMineHalfBoundary: idleMine.format("999.5", 2, 0),
});
output.dataset.ready = "true";
