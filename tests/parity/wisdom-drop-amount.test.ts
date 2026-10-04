import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  calculateRemixWisdomDropAmount,
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: { mineObjectCatalog: RemixMineObjectCatalog };
};

it("scales the captured Wisdom drop by current Power, including zero", () => {
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  const object = getRemixMineObject(169, corpus.data.mineObjectCatalog);
  const drop = object.drops["wisdom"];
  if (drop === undefined)
    throw new Error("The pinned object has no Wisdom drop.");
  expect(drop.amount).toBe(1);
  expect(calculateRemixWisdomDropAmount(drop.amount, 5).toString()).toBe("5");
  expect(calculateRemixWisdomDropAmount(drop.amount, 0).toString()).toBe("0");
});
