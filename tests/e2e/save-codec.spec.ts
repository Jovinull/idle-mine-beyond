import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { decodeRemixLegacySave } from "../../packages/persistence/src/index.js";

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

test("matches Chromium's Remix decoder for percent-encoded UTF-8 byte boundaries", async ({
  page,
}) => {
  await page.goto("/__test__/save-codec");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const percentBytes = new Set<string>();
  const percent = (bytes: number[]) =>
    bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  for (let byte = 0x80; byte <= 0xff; byte += 1) {
    percentBytes.add(percent([byte]));
  }

  const leads = [
    0xc0, 0xc1, 0xc2, 0xdf, 0xe0, 0xe1, 0xed, 0xef, 0xf0, 0xf1, 0xf4, 0xf5,
    0xff,
  ];
  const tails = [0x00, 0x7f, 0x80, 0x8f, 0x90, 0xbf, 0xc0, 0xff];
  for (const lead of leads) {
    for (const tail of tails) percentBytes.add(percent([lead, tail]));
  }

  for (const bytes of [
    [0xe0, 0xa0],
    [0xed, 0x9f],
    [0xf0, 0x90],
    [0xf0, 0x90, 0x80],
    [0xf4, 0x8f, 0xbf],
    [0xf4, 0x90, 0x80],
  ]) {
    percentBytes.add(percent(bytes));
  }

  const encodedInputs = [...percentBytes].map((value) =>
    Buffer.from(value, "ascii").toString("base64"),
  );
  expect(encodedInputs).toHaveLength(237);
  const sourceResults = await page.evaluate((encoded) => {
    const errorShape = (error: unknown) =>
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Error", message: String(error) };

    return encoded.map((input) => {
      let decoded: string | undefined;
      let decodeError: ReturnType<typeof errorShape> | null = null;
      try {
        decoded = unescape(decodeURIComponent(atob(input)));
      } catch (error) {
        decodeError = errorShape(error);
      }

      try {
        return {
          status: "success" as const,
          json: decoded,
          value: JSON.parse(decoded as string) as unknown,
        };
      } catch (error) {
        return {
          status: decodeError
            ? ("invalidEncoding" as const)
            : ("invalidJson" as const),
          decodeError,
          parseError: errorShape(error),
        };
      }
    });
  }, encodedInputs);

  expect(sourceResults).toHaveLength(encodedInputs.length);
  for (const [index, encoded] of encodedInputs.entries()) {
    const beyondResult = decodeRemixLegacySave(encoded);
    const sourceResult = sourceResults[index];
    expect(sourceResult, `source byte-sequence case ${index}`).toBeDefined();
    expect(beyondResult.status, `byte-sequence status ${index}`).toBe(
      sourceResult?.status,
    );

    if (beyondResult.status === "invalidEncoding") {
      expect(beyondResult.decodeError, `decode error ${index}`).toEqual(
        sourceResult?.decodeError,
      );
      expect(
        beyondResult.parseError,
        `post-decode parse error ${index}`,
      ).toEqual(sourceResult?.parseError);
    } else if (beyondResult.status === "invalidJson") {
      expect(beyondResult.parseError, `JSON parse error ${index}`).toEqual(
        sourceResult?.parseError,
      );
    } else {
      expect(beyondResult.json, `decoded JSON ${index}`).toBe(
        sourceResult?.json,
      );
      expect(beyondResult.value, `parsed value ${index}`).toEqual(
        sourceResult?.value,
      );
    }
  }
});
