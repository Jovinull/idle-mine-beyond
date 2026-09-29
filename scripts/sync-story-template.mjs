import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const manifestPath = fileURLToPath(
  new URL("../docs/knowledge/sources/reference-manifest.json", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("../tests/fixtures/parity/remix-story-markup.json", import.meta.url),
);
const runtimePath = fileURLToPath(
  new URL("../tests/fixtures/parity/remix-story-runtime.json", import.meta.url),
);
const targetPath = fileURLToPath(
  new URL("../packages/content/src/remix-story-template.json", import.meta.url),
);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const reference = manifest.references.find(
  ({ name }) => name === "Idle Mine: Remix",
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const runtime = JSON.parse(await readFile(runtimePath, "utf8"));
if (
  !reference ||
  fixture.source.commit !== reference.pinnedCommit ||
  runtime.source.commit !== reference.pinnedCommit
) {
  throw new Error("Story template and manifest use different Remix pins.");
}
if (fixture.blocks.length !== 62 || runtime.chapters.length !== 9) {
  throw new Error("Story template fixture has an unexpected structure.");
}

const output = await format(
  JSON.stringify({
    source: fixture.source,
    chapters: runtime.chapters,
    template: fixture.template,
    blocks: fixture.blocks,
  }),
  { parser: "json" },
);

if (process.argv[2] === "--write") {
  await writeFile(targetPath, output, "utf8");
  process.stdout.write(
    `Wrote the ${fixture.blocks.length}-block Story template from ${reference.pinnedCommit}.\n`,
  );
} else if (process.argv.length > 2 && process.argv[2] !== "--check") {
  throw new Error("Use --check or --write.");
} else {
  const current = await readFile(targetPath, "utf8").catch(() => "");
  if (current !== output) {
    throw new Error(
      "Generated Story content differs from the reviewed pinned markup fixture.",
    );
  }
  process.stdout.write(
    `Verified the ${fixture.blocks.length}-block Story content template.\n`,
  );
}
