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
type ExternalByteInput = {
  name: string;
  encoded: string;
  expectedCodeUnits: number[] | null;
};

type ProbeInput = {
  codecVectors: CodecVector[];
  codecBoundaryVectors: CodecBoundaryVector[];
  codecBoundarySourceSave: CodecBoundarySourceSave;
  base64Variants: Base64Variant[];
  loadErrors: LoadErrorInput[];
  externalByteInputs?: ExternalByteInput[];
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

  const externalByteResults = input.externalByteInputs?.map((vector) => {
    const errorShape = (error: unknown) =>
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Error", message: String(error) };
    let sourceJson: string | undefined;
    let sourceDecodeError: ReturnType<typeof errorShape> | null = null;
    try {
      sourceJson = unescape(decodeURIComponent(atob(vector.encoded)));
    } catch (error) {
      sourceDecodeError = errorShape(error);
    }

    let sourceParseError: ReturnType<typeof errorShape> | null = null;
    let sourceValue: unknown;
    try {
      sourceValue = JSON.parse(sourceJson as string) as unknown;
    } catch (error) {
      sourceParseError = errorShape(error);
    }

    const beyond = decodeRemixLegacySave(vector.encoded);
    const codeUnits = (value: string) =>
      Array.from({ length: value.length }, (_, index) =>
        value.charCodeAt(index),
      );
    return {
      name: vector.name,
      source: {
        status: sourceDecodeError
          ? "invalidEncoding"
          : sourceParseError
            ? "invalidJson"
            : "success",
        json: sourceJson ?? null,
        value: sourceValue ?? null,
        valueCodeUnits:
          typeof sourceValue === "string" ? codeUnits(sourceValue) : null,
        decodeError: sourceDecodeError,
        parseError: sourceParseError,
      },
      beyond: {
        status: beyond.status,
        json: beyond.status === "invalidEncoding" ? null : beyond.json,
        value: beyond.status === "success" ? beyond.value : null,
        valueCodeUnits:
          beyond.status === "success" && typeof beyond.value === "string"
            ? codeUnits(beyond.value)
            : null,
        decodeError:
          beyond.status === "invalidEncoding" ? beyond.decodeError : null,
        parseError:
          beyond.status === "invalidEncoding" || beyond.status === "invalidJson"
            ? beyond.parseError
            : null,
      },
      expectedCodeUnits: vector.expectedCodeUnits,
    };
  });

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
    ...(externalByteResults ? { externalByteResults } : {}),
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
