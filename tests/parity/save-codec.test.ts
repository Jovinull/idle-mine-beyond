import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/index.js";

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    saveSemantics: {
      codecVectors: {
        name: string;
        json: string;
        encoded: string;
        decodedJson: string;
      }[];
      codecBoundaryVectors: {
        name: string;
        wrapper: "canonical" | "single-uri-encoded";
        sourceSaveSha256: string;
        sourceDecodedSha256: string;
        sourceNameCodeUnits: number[];
        decodedNameCodeUnits: number[];
        importedNameCodeUnits: number[];
        base64InputRemainder: number;
      }[];
      missingOptionalGroups: { inputJson: string; encoded: string };
      emptyPresentGroups: { inputJson: string; encoded: string };
      base64Variants: {
        name: string;
        encoded: string;
        expectedJson: string;
        alertCount: number;
        thrownErrorName: string | null;
        money: { decimal: string };
        storyPage: number;
      }[];
      loadErrors: {
        name: string;
        encoded: string;
        decodeErrorName: string | null;
        decodeErrorMessage: string | null;
        alertMessages: string[];
        alertCount: number;
        alertHasDecodeErrorPrefix: boolean;
        thrownErrorName: string | null;
        thrownErrorMessage: string | null;
        money: { decimal: string };
        mineObjectLevel: number;
      }[];
    };
    saveExportSemantics: {
      fresh: {
        object: {
          settings: { tab: string };
          pickaxe: { name: string };
          [key: string]: unknown;
        };
      };
    };
  };
};

const save = fixture.data.saveSemantics;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

it("encodes and decodes the pinned Remix ASCII and Unicode codec vectors", () => {
  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );

  for (const vector of save.codecVectors) {
    expect(encodeRemixLegacySave(JSON.parse(vector.json) as object)).toBe(
      vector.encoded,
    );
    expect(decodeRemixLegacySave(vector.encoded)).toEqual({
      status: "success",
      json: vector.decodedJson,
      value: JSON.parse(vector.decodedJson) as unknown,
      effects: [],
    });
  }

  expect(
    [
      ...new Set(
        save.codecVectors.map(
          ({ encoded }) => Buffer.from(encoded, "base64").length % 3,
        ),
      ),
    ].sort(),
  ).toEqual([0, 1, 2]);

  const unicodeVector = save.codecVectors.find(
    ({ name }) => name === "unicode-json",
  );
  expect(unicodeVector).toBeDefined();
  const decoded = decodeRemixLegacySave(unicodeVector?.encoded ?? "");
  expect(decoded.status).toBe("success");
  if (decoded.status === "success") {
    expect(decoded.value).toMatchObject({
      pickaxe: {
        name: "Probe \u00e2\u0080\u0094 \u00c3\u0085 \u00ce\u00a9 \u00e2\u0086\u0092",
      },
    });
  }
});

it("matches live Remix save bytes at UTF-8, escape, JSON, and Base64 boundaries", () => {
  const names = save.codecBoundaryVectors.map(({ name }) => name);
  expect(names).toEqual([
    "legacy-escape-safe-set-and-punctuation",
    "utf8-two-byte-limits",
    "utf8-three-byte-limits",
    "utf8-four-byte-limits",
    "json-escaped-lone-surrogates",
    "json-string-control-escapes",
    "legacy-unescape-lowercase-u",
    "legacy-unescape-uppercase-u-remains-literal",
    "legacy-unescape-uppercase-hex",
    "legacy-unescape-uppercase-byte",
    "legacy-unescape-invalid-hex-remains-literal",
    "legacy-unescape-literal-percent",
    "legacy-unescape-short-byte-token",
    "legacy-unescape-short-unicode-token",
    "legacy-unescape-byte-token-trailing-char",
    "legacy-unescape-unicode-token-trailing-char",
    "legacy-unescape-surrogate-pair",
  ]);

  for (const vector of save.codecBoundaryVectors) {
    const sourceValue = structuredClone(
      fixture.data.saveExportSemantics.fresh.object,
    );
    sourceValue.settings.tab = "settings";
    sourceValue.pickaxe.name = String.fromCharCode(
      ...vector.sourceNameCodeUnits,
    );
    const encoded =
      vector.wrapper === "canonical"
        ? encodeRemixLegacySave(sourceValue)
        : Buffer.from(
            encodeURIComponent(JSON.stringify(sourceValue)),
            "latin1",
          ).toString("base64");
    expect(sha256(encoded), vector.name).toBe(vector.sourceSaveSha256);

    const decoded = decodeRemixLegacySave(encoded);
    expect(decoded.status, vector.name).toBe("success");
    if (decoded.status !== "success") continue;

    expect(sha256(decoded.json), vector.name).toBe(vector.sourceDecodedSha256);
    const importedName = (decoded.value as typeof sourceValue).pickaxe.name;
    const importedNameCodeUnits = Array.from(
      { length: importedName.length },
      (_, index) => importedName.charCodeAt(index),
    );
    expect(importedNameCodeUnits, vector.name).toEqual(
      vector.decodedNameCodeUnits,
    );
    expect(vector.importedNameCodeUnits, vector.name).toEqual(
      vector.decodedNameCodeUnits,
    );
    expect(
      Array.from({ length: sourceValue.pickaxe.name.length }, (_, index) =>
        sourceValue.pickaxe.name.charCodeAt(index),
      ),
      vector.name,
    ).toEqual(vector.sourceNameCodeUnits);

    if (vector.name.startsWith("utf8-")) {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([
        ...Buffer.from(sourceValue.pickaxe.name, "utf8"),
      ]);
    } else if (vector.name === "legacy-unescape-lowercase-u") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0x41]);
    } else if (vector.name === "legacy-unescape-uppercase-hex") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0xaf]);
    } else if (vector.name === "legacy-unescape-uppercase-byte") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0xab]);
    } else if (vector.name === "legacy-unescape-literal-percent") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0x25]);
    } else if (vector.name === "legacy-unescape-short-byte-token") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0x25, 0x41]);
    } else if (vector.name === "legacy-unescape-short-unicode-token") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([
        0x25, 0x75, 0x30, 0x30, 0x33,
      ]);
    } else if (vector.name === "legacy-unescape-byte-token-trailing-char") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0xab, 0x46]);
    } else if (vector.name === "legacy-unescape-unicode-token-trailing-char") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([0x41, 0x42]);
    } else if (vector.name === "legacy-unescape-surrogate-pair") {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual([
        0xd83d, 0xde00,
      ]);
    } else {
      expect(vector.decodedNameCodeUnits, vector.name).toEqual(
        vector.sourceNameCodeUnits,
      );
    }

    expect(Buffer.from(encoded, "base64").length % 3, vector.name).toBe(
      vector.base64InputRemainder,
    );
  }

  expect(
    [
      ...new Set(save.codecBoundaryVectors.map((v) => v.base64InputRemainder)),
    ].sort(),
  ).toEqual([0, 1, 2]);
});

it("decodes long save strings without argument-stack limits", () => {
  const value = { payload: "a".repeat(80_000) };
  const result = decodeRemixLegacySave(encodeRemixLegacySave(value));

  expect(result.status).toBe("success");
  if (result.status === "success") expect(result.value).toEqual(value);
});

it("accepts source-supported whitespace and unpadded Base64 variants", () => {
  for (const variant of save.base64Variants) {
    const result = decodeRemixLegacySave(variant.encoded);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.json).toBe(variant.expectedJson);
      expect(result.value).toEqual(JSON.parse(variant.expectedJson) as unknown);
    }
    expect(variant).toMatchObject({
      alertCount: 0,
      thrownErrorName: null,
      money: { decimal: "5" },
      storyPage: 3,
    });
  }

  expect(
    save.base64Variants
      .filter(({ name }) => name.startsWith("unpadded-remainder-"))
      .map(({ encoded }) => encoded.length % 4)
      .sort(),
  ).toEqual([0, 2, 3]);
});

it("decodes the source's absent-group and empty-group partial saves", () => {
  for (const partial of [save.missingOptionalGroups, save.emptyPresentGroups]) {
    const result = decodeRemixLegacySave(partial.encoded);
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.json).toBe(partial.inputJson);
      expect(result.value).toEqual(JSON.parse(partial.inputJson) as unknown);
    }
  }
});

it("models the source's malformed encoding and JSON parse outcomes", () => {
  const emptyBase64 = save.loadErrors.find(
    ({ name }) => name === "empty-base64",
  );
  const invalidBase64 = save.loadErrors.find(
    ({ name }) => name === "invalid-base64",
  );
  const invalidUri = save.loadErrors.find(
    ({ name }) => name === "invalid-uri-escape",
  );
  const invalidJson = save.loadErrors.find(
    ({ name }) => name === "valid-base64-invalid-json",
  );
  const missingStory = save.loadErrors.find(
    ({ name }) => name === "missing-story-after-resource-fields",
  );

  expect(emptyBase64).toBeDefined();
  expect(invalidBase64).toBeDefined();
  expect(invalidUri).toBeDefined();
  expect(invalidJson).toBeDefined();
  expect(missingStory).toBeDefined();

  const decodeFailures = save.loadErrors.filter(
    ({ decodeErrorName }) => decodeErrorName !== null,
  );
  expect(decodeFailures.map(({ name }) => name)).toEqual([
    "invalid-base64",
    "invalid-base64-remainder-one",
    "invalid-base64-padding-too-long",
    "invalid-base64-padding-interior",
    "invalid-base64-trailing-after-padding",
    "invalid-non-ascii-whitespace",
    "invalid-uri-escape",
    "invalid-uri-utf8",
  ]);
  for (const scenario of decodeFailures) {
    const result = decodeRemixLegacySave(scenario.encoded);
    expect(result.status, scenario.name).toBe("invalidEncoding");
    if (result.status === "invalidEncoding") {
      expect(result.decodeError.name, scenario.name).toBe(
        scenario.decodeErrorName,
      );
      expect(result.decodeError.message, scenario.name).toBe(
        scenario.decodeErrorMessage,
      );
      expect(scenario.alertMessages, scenario.name).toEqual([
        `Error loading Game: ${scenario.decodeErrorName}: ${scenario.decodeErrorMessage}`,
      ]);
      expect(result.parseError.name, scenario.name).toBe("SyntaxError");
      expect(result.effects, scenario.name).toEqual([
        { type: "alertDecodeError" },
      ]);
    }
    expect(scenario, scenario.name).toMatchObject({
      alertCount: 1,
      alertHasDecodeErrorPrefix: true,
      thrownErrorName: "SyntaxError",
      money: { decimal: "77" },
    });
    expect(scenario.thrownErrorMessage, scenario.name).toEqual(
      expect.any(String),
    );
  }

  const emptyResult = decodeRemixLegacySave(emptyBase64?.encoded ?? "");
  expect(emptyResult).toMatchObject({
    status: "invalidJson",
    parseError: { name: "SyntaxError" },
    effects: [],
  });

  const invalidEncodingResult = decodeRemixLegacySave(
    invalidBase64?.encoded ?? "",
  );
  expect(invalidEncodingResult).toMatchObject({
    status: "invalidEncoding",
    decodeError: { name: "InvalidCharacterError" },
    parseError: { name: "SyntaxError" },
    effects: [{ type: "alertDecodeError" }],
  });
  expect(invalidBase64).toMatchObject({
    decodeErrorMessage:
      "Failed to execute 'atob' on 'Window': The string to be decoded is not correctly encoded.",
    alertCount: 1,
    alertHasDecodeErrorPrefix: true,
    thrownErrorName: "SyntaxError",
    money: { decimal: "77" },
  });

  const invalidUriResult = decodeRemixLegacySave(invalidUri?.encoded ?? "");
  expect(invalidUriResult).toMatchObject({
    status: "invalidEncoding",
    decodeError: { name: "URIError" },
    parseError: { name: "SyntaxError" },
    effects: [{ type: "alertDecodeError" }],
  });
  expect(invalidUri).toMatchObject({
    decodeErrorMessage: "URI malformed",
    alertCount: 1,
    alertHasDecodeErrorPrefix: true,
    thrownErrorName: "SyntaxError",
    money: { decimal: "77" },
  });

  const invalidJsonResult = decodeRemixLegacySave(invalidJson?.encoded ?? "");
  expect(invalidJsonResult).toMatchObject({
    status: "invalidJson",
    parseError: { name: "SyntaxError" },
    effects: [],
  });
  expect(invalidJson).toMatchObject({
    alertCount: 0,
    thrownErrorName: "SyntaxError",
    money: { decimal: "77" },
  });

  const missingStoryResult = decodeRemixLegacySave(missingStory?.encoded ?? "");
  expect(missingStoryResult.status).toBe("success");
  expect(missingStory).toMatchObject({
    alertCount: 0,
    thrownErrorName: "TypeError",
    money: { decimal: "123" },
    mineObjectLevel: 0,
  });
});
