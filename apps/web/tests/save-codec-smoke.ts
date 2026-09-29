import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../../packages/persistence/src/index.js";

type CodecVector = {
  name: string;
  json: string;
  encoded: string;
  decodedJson: string;
};

type LoadErrorInput = { name: string; encoded: string };
type Base64Variant = {
  name: string;
  encoded: string;
  expectedJson: string;
};

type ProbeInput = {
  codecVectors: CodecVector[];
  base64Variants: Base64Variant[];
  loadErrors: LoadErrorInput[];
};

function evaluate(input: ProbeInput) {
  return {
    codecVectors: input.codecVectors.map((vector) => {
      const result = decodeRemixLegacySave(vector.encoded);
      return {
        name: vector.name,
        encoded: encodeRemixLegacySave(JSON.parse(vector.json) as object),
        decodedJson: result.status === "success" ? result.json : null,
        value: result.status === "success" ? result.value : null,
      };
    }),
    base64Variants: input.base64Variants.map((variant) => {
      const result = decodeRemixLegacySave(variant.encoded);
      return {
        name: variant.name,
        status: result.status,
        json: result.status === "success" ? result.json : null,
      };
    }),
    loadErrors: input.loadErrors.map(({ name, encoded }) => {
      const result = decodeRemixLegacySave(encoded);
      return {
        name,
        status: result.status,
        decodeErrorName:
          result.status === "invalidEncoding" ? result.decodeError.name : null,
        parseErrorName:
          result.status === "invalidEncoding" || result.status === "invalidJson"
            ? result.parseError.name
            : null,
        effects: result.effects.map((effect) => effect.type),
      };
    }),
  };
}

const output = document.querySelector<HTMLPreElement>("#result");
if (!output) throw new Error("Save codec probe output is missing.");

(
  window as Window & {
    __idleMineSaveCodecProbe?: (input: ProbeInput) => unknown;
  }
).__idleMineSaveCodecProbe = evaluate;
output.textContent = "Save codec parity probe ready";
output.dataset.ready = "true";
