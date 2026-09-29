import {
  createRemixFormatters,
  formatNumber,
  formatPercent,
  formatThousands,
} from "@idle-mine-beyond/formatting";

type Output = string | { error: string };
type FormatValue = { input: string; output: Output };
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
    return { error: error instanceof Error ? error.message : String(error) };
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

  return {
    formatterNames: formatters.map(({ name }) => name),
    directFormatterOutputs,
    formatNumberScenarios,
    formatThousands: formatThousandsOutputs,
    formatPercent: formatPercentOutputs,
    exponentFormatterOutputs,
  };
};

output.textContent = JSON.stringify({
  names: formatters.map(({ name }) => name),
  grouped: formatNumber("1000", standard),
  percent: formatPercent("0.005", standard),
  idleMineHalfBoundary: idleMine.format("999.5", 2, 0),
});
output.dataset.ready = "true";
