import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

type SaveCodecCorpus = {
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
      loadErrors: { name: string; encoded: string }[];
    };
    saveExportSemantics: {
      fresh: { object: { [key: string]: unknown } };
    };
  };
};

type SaveCodecProbeResult = {
  codecVectors: {
    name: string;
    encoded: string;
    decodedJson: string | null;
    value: unknown;
  }[];
  codecBoundaryVectors: {
    name: string;
    wrapper: "canonical" | "single-uri-encoded";
    sourceSaveSha256: string;
    sourceDecodedSha256: string | null;
    sourceNameCodeUnits: number[];
    decodedNameCodeUnits: number[] | null;
    base64InputRemainder: number;
  }[];
  base64Variants: {
    name: string;
    status: string;
    json: string | null;
  }[];
};

test("matches valid pinned Remix save codec outputs in this browser", async ({
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
  ) as SaveCodecCorpus;
  const semantics = corpus.data.saveSemantics;
  const observed = (await page.evaluate(
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
  )) as SaveCodecProbeResult;

  expect(observed.codecVectors).toEqual(
    semantics.codecVectors.map((vector) => ({
      name: vector.name,
      encoded: vector.encoded,
      decodedJson: vector.decodedJson,
      value: JSON.parse(vector.decodedJson) as unknown,
    })),
  );
  expect(observed.codecBoundaryVectors).toEqual(
    semantics.codecBoundaryVectors.map((vector) => ({
      name: vector.name,
      wrapper: vector.wrapper,
      sourceSaveSha256: vector.sourceSaveSha256,
      sourceDecodedSha256: vector.sourceDecodedSha256,
      sourceNameCodeUnits: vector.sourceNameCodeUnits,
      decodedNameCodeUnits: vector.decodedNameCodeUnits,
      base64InputRemainder: vector.base64InputRemainder,
    })),
  );
  expect(observed.base64Variants).toEqual(
    semantics.base64Variants.map((variant) => ({
      name: variant.name,
      status: "success",
      json: variant.expectedJson,
    })),
  );
});
