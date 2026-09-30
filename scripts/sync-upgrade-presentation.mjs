import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const root = fileURLToPath(new URL("..", import.meta.url));
const corpusPath = path.join(
  root,
  "tests/fixtures/parity/remix-reference-corpus.json",
);
const targetPath = path.join(
  root,
  "packages/content/src/remix-upgrade-presentation.json",
);
const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
const semantics = corpus.data.upgradeSemantics;

if (
  corpus.metadata.sourceCommit !== "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21" ||
  Object.values(semantics.groups).reduce(
    (total, group) => total + Object.keys(group).length,
    0,
  ) !== 29
) {
  throw new Error(
    "The upgrade presentation corpus has an unexpected source or shape.",
  );
}

for (const [groupName, group] of Object.entries(semantics.groups)) {
  for (const [key, upgrade] of Object.entries(group)) {
    if (
      typeof upgrade.name !== "string" ||
      typeof upgrade.description !== "string" ||
      typeof upgrade.image !== "string" ||
      !upgrade.samples.some(
        ({ levelDisplay, effectDisplay, priceDisplay }) =>
          typeof levelDisplay === "string" &&
          typeof effectDisplay === "string" &&
          typeof priceDisplay === "string",
      )
    ) {
      throw new Error(`Incomplete source presentation: ${groupName}.${key}`);
    }
  }
}

const output = await format(
  JSON.stringify({
    source: {
      name: "Idle Mine: Remix",
      url: corpus.metadata.sourceUrl,
      commit: corpus.metadata.sourceCommit,
      capturedOn: corpus.metadata.capturedOn,
      files: semantics.sourcePaths,
      licenseNotice: corpus.metadata.licenseNotice,
    },
    groups: Object.fromEntries(
      Object.entries(semantics.groups).map(([groupName, group]) => [
        groupName,
        Object.fromEntries(
          Object.entries(group).map(([key, upgrade]) => [
            key,
            {
              name: upgrade.name,
              description: upgrade.description,
              image: upgrade.image,
              resource: upgrade.resource,
              maxLevel: upgrade.maxLevel,
              stochasticEffect: upgrade.stochasticEffect,
              samples: upgrade.samples,
            },
          ]),
        ),
      ]),
    ),
  }),
  { parser: "json" },
);

if (process.argv[2] === "--write") {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, output, "utf8");
  process.stdout.write(
    "Wrote source-backed Remix upgrade presentation data.\n",
  );
} else if (process.argv.length > 2 && process.argv[2] !== "--check") {
  throw new Error("Use --check or --write.");
} else {
  const current = await readFile(targetPath, "utf8").catch(() => "");
  if (current !== output) {
    throw new Error(
      "Upgrade presentation content is stale versus the pinned corpus.",
    );
  }
  process.stdout.write(
    "Verified source-backed Remix upgrade presentation data.\n",
  );
}
