import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = fileURLToPath(new URL("..", import.meta.url));
const corpusPath = path.join(
  root,
  "tests/fixtures/parity/remix-reference-corpus.json",
);
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const targetPath = path.join(
  root,
  "packages/content/src/remix-legacy-save-template.json",
);

const [corpus, manifest] = await Promise.all([
  readFile(corpusPath, "utf8").then(JSON.parse),
  readFile(manifestPath, "utf8").then(JSON.parse),
]);
const reference = manifest.references.find(
  ({ name }) => name === "Idle Mine: Remix",
);
const capture = corpus.data.saveExportSemantics?.fresh;
const template = capture?.object;
const templateJson = JSON.stringify(template);
const sourceCommit = reference?.pinnedCommit;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

if (
  sourceCommit !== corpus.metadata.sourceCommit ||
  template === null ||
  typeof template !== "object" ||
  Array.isArray(template) ||
  sha256(templateJson) !== capture.jsonSha256 ||
  Object.keys(template).length !== 27 ||
  !Array.isArray(template.messageLog) ||
  !Array.isArray(template.mineObjects) ||
  !Array.isArray(template.specialMineObjects) ||
  !template.settings ||
  !template.story
) {
  throw new Error(
    "The full legacy save template does not match the pinned corpus shape and hash.",
  );
}

const output = await format(
  JSON.stringify({
    source: {
      name: reference.name,
      url: reference.canonicalUrl,
      commit: sourceCommit,
      capturedOn: corpus.metadata.capturedOn,
      files: corpus.data.saveExportSemantics.sourcePaths,
      licenseNotice: corpus.metadata.licenseNotice,
    },
    template,
  }),
  { parser: "json" },
);

if (process.argv[2] === "--write") {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, output, "utf8");
  process.stdout.write("Wrote the pinned Remix legacy save template.\n");
} else if (process.argv.length > 2 && process.argv[2] !== "--check") {
  throw new Error("Use --check or --write.");
} else {
  const current = await readFile(targetPath, "utf8").catch(() => "");
  if (current !== output) {
    throw new Error(
      "Legacy save template is stale versus the pinned full-save fixture.",
    );
  }
  process.stdout.write(
    "Verified the full Remix legacy save template against its pinned capture.\n",
  );
}
