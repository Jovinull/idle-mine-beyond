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
type CodecBoundaryVector = {
  name: string;
  wrapper: "canonical" | "single-uri-encoded";
  sourceSaveSha256: string;
  sourceDecodedSha256: string;
  sourceNameCodeUnits: number[];
  decodedNameCodeUnits: number[];
  importedNameCodeUnits: number[];
  base64InputRemainder: number;
};
type CodecBoundarySourceSave = {
  settings: { tab: string };
  pickaxe: { name: string };
  [key: string]: unknown;
};

type LoadErrorInput = { name: string; encoded: string };
type Base64Variant = {
  name: string;
  encoded: string;
  expectedJson: string;
};

type ProbeInput = {
  codecVectors: CodecVector[];
  codecBoundaryVectors: CodecBoundaryVector[];
  codecBoundarySourceSave: CodecBoundarySourceSave;
  base64Variants: Base64Variant[];
  loadErrors: LoadErrorInput[];
};

function codeUnits(value: string): number[] {
  return Array.from({ length: value.length }, (_, index) =>
    value.charCodeAt(index),
  );
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function evaluate(input: ProbeInput) {
  const codecBoundaryVectors = await Promise.all(
    input.codecBoundaryVectors.map(async (vector) => {
      const sourceValue = structuredClone(input.codecBoundarySourceSave);
      sourceValue.settings.tab = "settings";
      sourceValue.pickaxe.name = String.fromCharCode(
        ...vector.sourceNameCodeUnits,
      );
      const encoded =
        vector.wrapper === "canonical"
          ? encodeRemixLegacySave(sourceValue)
          : btoa(encodeURIComponent(JSON.stringify(sourceValue)));
      const decoded = decodeRemixLegacySave(encoded);
      const decodedValue =
        decoded.status === "success"
          ? (decoded.value as typeof sourceValue)
          : undefined;
      return {
        name: vector.name,
        wrapper: vector.wrapper,
        sourceSaveSha256: await sha256(encoded),
        sourceDecodedSha256:
          decoded.status === "success" ? await sha256(decoded.json) : null,
        sourceNameCodeUnits: codeUnits(sourceValue.pickaxe.name),
        decodedNameCodeUnits: decodedValue
          ? codeUnits(decodedValue.pickaxe.name)
          : null,
        base64InputRemainder: atob(encoded).length % 3,
      };
    }),
  );

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
    codecBoundaryVectors,
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
        decodeErrorMessage:
          result.status === "invalidEncoding"
            ? result.decodeError.message
            : null,
        parseErrorName:
          result.status === "invalidEncoding" || result.status === "invalidJson"
            ? result.parseError.name
            : null,
        parseErrorMessage:
          result.status === "invalidEncoding" || result.status === "invalidJson"
            ? result.parseError.message
            : null,
        effects: result.effects.map((effect) => effect.type),
        alertMessages:
          result.status === "invalidEncoding"
            ? result.effects.map(
                () =>
                  `Error loading Game: ${result.decodeError.name}: ${result.decodeError.message}`,
              )
            : [],
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
