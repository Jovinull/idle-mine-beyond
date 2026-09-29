import { readFile } from "node:fs/promises";
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
        alertCount: number;
        alertHasDecodeErrorPrefix: boolean;
        thrownErrorName: string | null;
        money: { decimal: string };
        mineObjectLevel: number;
      }[];
    };
  };
};

const save = fixture.data.saveSemantics;

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
      expect(result.value).toEqual({ money: "5", story: { page: 3 } });
    }
    expect(variant).toMatchObject({
      alertCount: 0,
      thrownErrorName: null,
      money: { decimal: "5" },
      storyPage: 3,
    });
  }
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
