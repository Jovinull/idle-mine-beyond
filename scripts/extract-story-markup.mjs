import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const fixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-story-markup.json",
);
const milestoneCatalogPath = path.join(
  root,
  "packages/content/src/remix-story-milestones.json",
);

function getGitOutput(repositoryPath, ...args) {
  return execFileSync("git", ["-C", repositoryPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function extractStoryArticle(source) {
  const articleOpen = source.match(
    /<article\b(?=[^>]*\bv-if="settings\.tab === 'story'")(?=[^>]*\bclass="story")[^>]*>/,
  );

  if (!articleOpen || articleOpen.index === undefined) {
    throw new Error(
      "Could not locate the Story article in the Remix template.",
    );
  }

  const closingStart = source.indexOf(
    "</article>",
    articleOpen.index + articleOpen[0].length,
  );
  if (closingStart < 0) {
    throw new Error("Could not locate the end of the Story article.");
  }

  const template = source.slice(
    articleOpen.index,
    closingStart + "</article>".length,
  );
  const divTokens = /<div\b[^>]*>|<\/div\s*>/gi;
  const openDivs = [];
  const nodes = [];
  let token;

  while ((token = divTokens.exec(template)) !== null) {
    if (/^<\/div/i.test(token[0])) {
      const node = openDivs.pop();
      if (!node) {
        throw new Error(
          "Encountered an unmatched closing div in the Story article.",
        );
      }
      node.contentEnd = token.index;
      node.end = divTokens.lastIndex;
      continue;
    }

    const condition = token[0].match(/\bv-if\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const conditionExpression = condition?.[1] ?? condition?.[2] ?? null;
    const storyMatch = conditionExpression?.match(
      /^storyDisplayed\(['"]([^'"]+)['"]\)$/,
    );
    const parent = openDivs.at(-1) ?? null;
    const node = {
      start: token.index,
      openEnd: divTokens.lastIndex,
      contentEnd: null,
      end: null,
      parent,
      conditionExpression,
      storyKey: storyMatch?.[1] ?? null,
    };

    if (node.storyKey !== null) nodes.push(node);
    openDivs.push(node);
  }

  if (openDivs.length > 0) {
    throw new Error("Story article contains an unclosed div.");
  }

  const occurrences = new Map();
  const blocks = nodes.map((node, sourceOrder) => {
    const occurrence = (occurrences.get(node.storyKey) ?? 0) + 1;
    occurrences.set(node.storyKey, occurrence);

    const conditionalAncestors = [];
    let ancestor = node.parent;
    while (ancestor) {
      if (ancestor.storyKey !== null) {
        conditionalAncestors.unshift(ancestor.storyKey);
      }
      ancestor = ancestor.parent;
    }

    const markup = template.slice(node.start, node.end);
    const mineObjects = [...markup.matchAll(/<mine-object\b([^>]*)>/gi)].map(
      ([, attributes]) => attributes.trim(),
    );
    const images = [
      ...markup.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi),
    ].map(([, , src]) => src);

    return {
      sourceOrder,
      key: node.storyKey,
      occurrence,
      conditionalAncestors,
      conditionExpression: node.conditionExpression,
      templateOffsets: { start: node.start, end: node.end },
      embeddedMineObjectAttributes: mineObjects,
      imageSources: images,
    };
  });

  return { template, blocks };
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "--write" && mode !== "--check") {
    throw new Error(
      "Use --write to capture the pinned Story template or --check to verify the fixture.",
    );
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const reference = manifest.references.find(
    (entry) => entry.name === "Idle Mine: Remix",
  );
  if (!reference)
    throw new Error(
      "The canonical Remix reference is missing from the manifest.",
    );

  const repositoryPath = path.resolve(root, reference.researchCheckout);
  const actualCommit = getGitOutput(repositoryPath, "rev-parse", "HEAD");
  if (actualCommit !== reference.pinnedCommit) {
    throw new Error(
      `Remix checkout is at ${actualCommit}; expected pinned commit ${reference.pinnedCommit}.`,
    );
  }
  const dirty = getGitOutput(
    repositoryPath,
    "status",
    "--porcelain",
    "--untracked-files=all",
  );
  if (dirty)
    throw new Error(
      "The canonical Remix checkout is dirty; refusing to capture it.",
    );

  const sourcePath = path.join(repositoryPath, "index.html");
  const source = await readFile(sourcePath, "utf8");
  const { template, blocks } = extractStoryArticle(source);
  const milestoneCatalog = JSON.parse(
    await readFile(milestoneCatalogPath, "utf8"),
  );
  const capturedKeys = [...new Set(blocks.map((block) => block.key))];
  const catalogKeys = milestoneCatalog.milestones.map(
    (milestone) => milestone.key,
  );
  if (JSON.stringify(capturedKeys) !== JSON.stringify(catalogKeys)) {
    throw new Error(
      "Story template condition keys do not match the pinned ordered milestone catalog.",
    );
  }

  const generated = {
    source: {
      repository: reference.canonicalUrl,
      commit: reference.pinnedCommit,
      path: "index.html",
      license: reference.licenseDetected,
      copyrightNotice: reference.copyrightNotice,
      capturedOn: new Date().toISOString().slice(0, 10),
    },
    template,
    blocks,
  };

  if (mode === "--write") {
    await writeFile(
      fixturePath,
      `${JSON.stringify(generated, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `Captured ${blocks.length} ordered Story template blocks from ${reference.pinnedCommit}.\n`,
    );
    return;
  }

  const expected = JSON.parse(await readFile(fixturePath, "utf8"));
  generated.source.capturedOn = expected.source.capturedOn;
  if (JSON.stringify(generated) !== JSON.stringify(expected)) {
    throw new Error(
      "The Story markup fixture differs from the pinned source. Inspect the change before updating the fixture.",
    );
  }
  process.stdout.write(
    `Verified ${blocks.length} ordered Story template blocks against ${reference.pinnedCommit}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
