import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("matches captured Remix save codec vectors in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/save-codec");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      saveSemantics: {
        codecVectors: {
          name: string;
          json: string;
          encoded: string;
          decodedJson: string;
        }[];
        base64Variants: {
          name: string;
          encoded: string;
          expectedJson: string;
        }[];
        loadErrors: { name: string; encoded: string }[];
      };
    };
  };
  const semantics = corpus.data.saveSemantics;
  const observed = await page.evaluate((input) => {
    const probe = (
      window as Window & {
        __idleMineSaveCodecProbe?: (value: typeof input) => unknown;
      }
    ).__idleMineSaveCodecProbe;
    if (!probe) throw new Error("Save codec probe did not initialize.");
    return probe(input);
  }, semantics);

  expect(observed).toEqual({
    codecVectors: semantics.codecVectors.map((vector) => ({
      name: vector.name,
      encoded: vector.encoded,
      decodedJson: vector.decodedJson,
      value: JSON.parse(vector.decodedJson) as unknown,
    })),
    base64Variants: semantics.base64Variants.map((variant) => ({
      name: variant.name,
      status: "success",
      json: variant.expectedJson,
    })),
    loadErrors: [
      {
        name: "empty-base64",
        status: "invalidJson",
        decodeErrorName: null,
        parseErrorName: "SyntaxError",
        effects: [],
      },
      {
        name: "invalid-base64",
        status: "invalidEncoding",
        decodeErrorName: "InvalidCharacterError",
        parseErrorName: "SyntaxError",
        effects: ["alertDecodeError"],
      },
      {
        name: "invalid-uri-escape",
        status: "invalidEncoding",
        decodeErrorName: "URIError",
        parseErrorName: "SyntaxError",
        effects: ["alertDecodeError"],
      },
      {
        name: "valid-base64-invalid-json",
        status: "invalidJson",
        decodeErrorName: null,
        parseErrorName: "SyntaxError",
        effects: [],
      },
      {
        name: "missing-story-after-resource-fields",
        status: "success",
        decodeErrorName: null,
        parseErrorName: null,
        effects: [],
      },
    ],
  });
});
