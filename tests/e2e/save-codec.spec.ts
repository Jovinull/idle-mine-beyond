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
        base64Variants: {
          name: string;
          encoded: string;
          expectedJson: string;
        }[];
        loadErrors: {
          name: string;
          encoded: string;
          decodeErrorName: string | null;
          decodeErrorMessage: string | null;
          alertMessages: string[];
          alertHasDecodeErrorPrefix: boolean;
          thrownErrorName: string | null;
          thrownErrorMessage: string | null;
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
  const semantics = corpus.data.saveSemantics;
  for (const vector of semantics.codecBoundaryVectors) {
    expect(vector.importedNameCodeUnits, vector.name).toEqual(
      vector.decodedNameCodeUnits,
    );
  }
  const observed = await page.evaluate(
    (input) => {
      const probe = (
        window as Window & {
          __idleMineSaveCodecProbe?: (value: typeof input) => unknown;
        }
      ).__idleMineSaveCodecProbe;
      if (!probe) throw new Error("Save codec probe did not initialize.");
      return probe(input);
    },
    {
      ...semantics,
      codecBoundarySourceSave: corpus.data.saveExportSemantics.fresh.object,
    },
  );

  expect(observed).toEqual({
    codecVectors: semantics.codecVectors.map((vector) => ({
      name: vector.name,
      encoded: vector.encoded,
      decodedJson: vector.decodedJson,
      value: JSON.parse(vector.decodedJson) as unknown,
    })),
    codecBoundaryVectors: semantics.codecBoundaryVectors.map((vector) => ({
      name: vector.name,
      wrapper: vector.wrapper,
      sourceSaveSha256: vector.sourceSaveSha256,
      sourceDecodedSha256: vector.sourceDecodedSha256,
      sourceNameCodeUnits: vector.sourceNameCodeUnits,
      decodedNameCodeUnits: vector.decodedNameCodeUnits,
      base64InputRemainder: vector.base64InputRemainder,
    })),
    base64Variants: semantics.base64Variants.map((variant) => ({
      name: variant.name,
      status: "success",
      json: variant.expectedJson,
    })),
    loadErrors: semantics.loadErrors.map((scenario) => {
      const status = scenario.decodeErrorName
        ? "invalidEncoding"
        : scenario.thrownErrorName === "TypeError"
          ? "success"
          : "invalidJson";
      return {
        name: scenario.name,
        status,
        decodeErrorName: scenario.decodeErrorName,
        decodeErrorMessage: scenario.decodeErrorMessage,
        parseErrorName: status === "success" ? null : "SyntaxError",
        parseErrorMessage:
          status === "success" ? null : scenario.thrownErrorMessage,
        effects: scenario.alertHasDecodeErrorPrefix ? ["alertDecodeError"] : [],
        alertMessages: scenario.alertMessages,
      };
    }),
  });
});
