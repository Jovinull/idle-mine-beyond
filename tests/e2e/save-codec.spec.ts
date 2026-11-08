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

test("matches Chromium's Remix decoder for all one- and two-byte sequences", async ({
  page,
}) => {
  test.setTimeout(10 * 60 * 1000);
  await page.goto("/__test__/save-codec");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const percentBytes = new Set<string>();
  const percent = (bytes: number[]) =>
    bytes.map((byte) => `%${byte.toString(16).padStart(2, "0")}`).join("");
  for (let byte = 0x00; byte <= 0xff; byte += 1) {
    percentBytes.add(percent([byte]));
  }
  for (let lead = 0x00; lead <= 0xff; lead += 1) {
    for (let tail = 0x00; tail <= 0xff; tail += 1) {
      percentBytes.add(percent([lead, tail]));
    }
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
  expect(encodedInputs).toHaveLength(65_795);
  for (let offset = 0; offset < encodedInputs.length; offset += 1024) {
    const encodedChunk = encodedInputs.slice(offset, offset + 1024);
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
          const parseError = errorShape(error);
          return decodeError
            ? { status: "invalidEncoding" as const, decodeError, parseError }
            : {
                status: "invalidJson" as const,
                json: decoded,
                decodeError: null,
                parseError,
              };
        }
      });
    }, encodedChunk);

    expect(sourceResults).toHaveLength(encodedChunk.length);
    const beyondResults = encodedChunk.map((encoded) => {
      const result = decodeRemixLegacySave(encoded);
      switch (result.status) {
        case "invalidEncoding":
          return {
            status: result.status,
            decodeError: result.decodeError,
            parseError: result.parseError,
          };
        case "invalidJson":
          return {
            status: result.status,
            json: result.json,
            decodeError: null,
            parseError: result.parseError,
          };
        case "success":
          return {
            status: result.status,
            json: result.json,
            value: result.value,
          };
      }
    });
    expect(
      beyondResults,
      `byte-sequence cases ${offset}–${offset + encodedChunk.length - 1}`,
    ).toEqual(sourceResults);
  }
});

test("matches Remix's three-byte UTF-8 scalar and invalid-sequence boundaries", async ({
  page,
}) => {
  await page.goto("/__test__/save-codec");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const cases = [
    { name: "minimum-three-byte-scalar", bytes: [0xe0, 0xa0, 0x80] },
    { name: "last-scalar-before-next-plane", bytes: [0xe0, 0xbf, 0xbf] },
    { name: "first-scalar-after-three-byte-floor", bytes: [0xe1, 0x80, 0x80] },
    { name: "last-scalar-before-surrogates", bytes: [0xed, 0x9f, 0xbf] },
    { name: "first-scalar-after-surrogates", bytes: [0xee, 0x80, 0x80] },
    { name: "maximum-three-byte-scalar", bytes: [0xef, 0xbf, 0xbf] },
    { name: "overlong-three-byte-sequence", bytes: [0xe0, 0x9f, 0xbf] },
    { name: "first-surrogate-code-point", bytes: [0xed, 0xa0, 0x80] },
    { name: "last-surrogate-code-point", bytes: [0xed, 0xbf, 0xbf] },
  ];
  const encodedInputs = cases.map(({ bytes }) =>
    Buffer.from(
      [0x22, ...bytes, 0x22]
        .map((byte) => `%${byte.toString(16).padStart(2, "0")}`)
        .join(""),
      "ascii",
    ).toString("base64"),
  );

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
        const parseError = errorShape(error);
        return decodeError
          ? { status: "invalidEncoding" as const, decodeError, parseError }
          : {
              status: "invalidJson" as const,
              json: decoded,
              decodeError: null,
              parseError,
            };
      }
    });
  }, encodedInputs);

  const beyondResults = encodedInputs.map((encoded) => {
    const result = decodeRemixLegacySave(encoded);
    switch (result.status) {
      case "invalidEncoding":
        return {
          status: result.status,
          decodeError: result.decodeError,
          parseError: result.parseError,
        };
      case "invalidJson":
        return {
          status: result.status,
          json: result.json,
          decodeError: null,
          parseError: result.parseError,
        };
      case "success":
        return {
          status: result.status,
          json: result.json,
          value: result.value,
        };
    }
  });

  expect(sourceResults, {
    message: `Source boundary vectors: ${cases.map(({ name }) => name).join(", ")}`,
  }).toHaveLength(cases.length);
  expect(beyondResults).toEqual(sourceResults);
  expect(sourceResults.slice(0, 6).map(({ status }) => status)).toEqual(
    Array(6).fill("success"),
  );
  expect(sourceResults.slice(6).map(({ status }) => status)).toEqual(
    Array(3).fill("invalidEncoding"),
  );
});
