import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  createRemixLegacySaveExportData,
  encodeRemixLegacySave,
  loadRemixLegacySaveIntoState,
  type RemixLegacySaveData,
} from "../../packages/persistence/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: { mineObjectCatalog: RemixMineObjectCatalog };
};
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../fixtures/parity/remix-historical-save-shape.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  reference: {
    sourceCommit: string;
    nowMs: number;
    inputEncodedBytes: number;
    inputEncodedSha256: string;
    loadedGameJsonSha256: string;
    reexportEncodedSha256: string;
  };
  input: RemixLegacySaveData;
};
const templatePackage = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-legacy-save-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  source: { commit: string };
  template: Readonly<Record<string, unknown>>;
};

function sha256(value: string, encoding: BufferEncoding = "utf8") {
  return createHash("sha256").update(value, encoding).digest("hex");
}

it("matches pinned Remix for a minimized historical-shaped save", () => {
  expect(corpus.metadata.sourceCommit).toBe(fixture.reference.sourceCommit);
  expect(templatePackage.source.commit).toBe(fixture.reference.sourceCommit);
  expect(fixture.input).not.toHaveProperty("planetCoins");
  expect(fixture.input).not.toHaveProperty("maxPlanetCoins");
  expect(fixture.input).not.toHaveProperty("wisdom");
  expect(fixture.input).not.toHaveProperty("maxWisdom");
  expect(fixture.input).not.toHaveProperty("planetCoinUpgrades");
  expect(fixture.input).not.toHaveProperty("powers");

  const encoded = encodeRemixLegacySave(fixture.input);
  expect(Buffer.byteLength(encoded, "ascii")).toBe(
    fixture.reference.inputEncodedBytes,
  );
  expect(sha256(encoded, "ascii")).toBe(fixture.reference.inputEncodedSha256);

  const initial = createInitialRemixLegacySaveApplicationState(
    createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
  );
  const result = loadRemixLegacySaveIntoState({
    state: initial,
    saveString: encoded,
    catalog: corpus.data.mineObjectCatalog,
    clock: { now: () => fixture.reference.nowMs },
    resolveNumberFormatter: () => () => "",
    noOffline: true,
  });
  expect(result.status).toBe("loaded");
  if (result.status !== "loaded") {
    throw new Error("The minimized historical-shaped save did not load.");
  }
  expect(result.applied).toBe(false);

  const exported = createRemixLegacySaveExportData(
    result.state,
    result.state.simulation.lastActiveMs ?? 0,
    templatePackage.template,
    [],
  );
  const exportedJson = JSON.stringify(exported);
  const reexported = encodeRemixLegacySave(exported);
  expect(sha256(exportedJson)).toBe(fixture.reference.loadedGameJsonSha256);
  expect(sha256(reexported, "ascii")).toBe(
    fixture.reference.reexportEncodedSha256,
  );
});
