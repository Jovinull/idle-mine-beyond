import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const corpusPath = fileURLToPath(
  new URL(
    "../tests/fixtures/parity/remix-reference-corpus.json",
    import.meta.url,
  ),
);
const targetPath = fileURLToPath(
  new URL("../packages/content/src/remix-mine-content.json", import.meta.url),
);
const expectedCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";

const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
if (corpus.metadata.sourceCommit !== expectedCommit) {
  throw new Error(
    `Unexpected Remix source pin: ${corpus.metadata.sourceCommit}`,
  );
}

const catalog = corpus.data.mineObjectCatalog;
if (
  catalog.base.length !== 72 ||
  catalog.special.length !== 78 ||
  catalog.skinLayerAmounts.length !== 25 ||
  catalog.dictionaryEnglish.length === 0
) {
  throw new Error("The captured mine content catalog has an unexpected shape.");
}

const output = {
  source: {
    name: "Idle Mine: Remix",
    url: corpus.metadata.sourceUrl,
    commit: corpus.metadata.sourceCommit,
    capturedOn: corpus.metadata.capturedOn,
    files: [
      "Scripts/Define/game.js",
      "Scripts/Define/functions.js",
      "Scripts/Define/dictionary.js",
      "Scripts/main.js",
    ],
    licenseNotice: corpus.metadata.licenseNotice,
  },
  ...catalog,
};

const rendered = await format(JSON.stringify(output, null, 2), {
  parser: "json",
});
if (process.argv[2] === "--check") {
  const existing = await readFile(targetPath, "utf8");
  if (existing !== rendered) {
    throw new Error(
      "The tracked mine content catalog is stale. Review `pnpm content:sync` output before committing it.",
    );
  }
  process.stdout.write("Verified the tracked mine content catalog.\n");
} else {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, rendered);
  process.stdout.write("Wrote packages/content/src/remix-mine-content.json.\n");
}
