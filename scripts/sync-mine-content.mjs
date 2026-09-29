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
const storyTargetPath = fileURLToPath(
  new URL(
    "../packages/content/src/remix-story-milestones.json",
    import.meta.url,
  ),
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

const storySemantics = corpus.data.storySemantics;
if (
  storySemantics.chapters.length !== 9 ||
  storySemantics.milestones.length !== 61
) {
  throw new Error("The captured story catalog has an unexpected shape.");
}

function parseStoryCondition(source) {
  if (source === "true") return { kind: "always" };

  let match = source.match(/^game\.highestMineObjectLevel >= (\d+)$/);
  if (match) {
    return {
      kind: "highestMineObjectLevelAtLeast",
      level: Number(match[1]),
    };
  }

  match = source.match(/^game\.highestMoney\.gte\(([^)]+)\)$/);
  if (match) return { kind: "highestMoneyAtLeast", amount: match[1] };

  match = source.match(/^game\.maxPlanetCoins\.gt\(([^)]+)\)$/);
  if (match) return { kind: "maxPlanetCoinsGreaterThan", amount: match[1] };

  match = source.match(
    /^game\.upgrades\.([A-Za-z_$][\w$]*)\.level (>|>=) (\d+)$/,
  );
  if (match) {
    return {
      kind: "upgradeLevel",
      family: "money",
      key: match[1],
      comparison: match[2] === ">" ? "greaterThan" : "atLeast",
      level: Number(match[3]),
    };
  }

  match = source.match(
    /^functions\.getBoughtUpgrades\(game\.powers\.upgrades\) >= (\d+)$/,
  );
  if (match) {
    return {
      kind: "totalWisdomUpgradeLevelsAtLeast",
      level: Number(match[1]),
    };
  }

  throw new Error(`Unrecognized pinned Remix story condition: ${source}`);
}

function parseStoryObjective(source) {
  if (source.kind === "literal") {
    return { kind: "literal", sourceKind: "literal", text: source.value };
  }

  const constant = source.source.match(/^\(\) => ("(?:\\.|[^"\\])*")$/);
  if (constant) {
    return {
      kind: "literal",
      sourceKind: "function",
      text: JSON.parse(constant[1]),
    };
  }

  const mineLevelTemplate = source.source.match(
    /^\(\) => ("(?:\\.|[^"\\])*") \+ \(game\.highestMineObjectLevel \+ 1\) \+ ("(?:\\.|[^"\\])*")$/,
  );
  if (mineLevelTemplate) {
    return {
      kind: "mineLevelTemplate",
      prefix: JSON.parse(mineLevelTemplate[1]),
      suffix: JSON.parse(mineLevelTemplate[2]),
    };
  }

  const formattedNumberTemplate = source.source.match(
    /^\(\) => ("(?:\\.|[^"\\])*") \+ (functions\.formatThousands|game\.numberFormatter\.format)\(([^)]+)\) \+ ("(?:\\.|[^"\\])*")$/,
  );
  if (formattedNumberTemplate) {
    return {
      kind: "formattedNumberTemplate",
      formatter:
        formattedNumberTemplate[2] === "functions.formatThousands"
          ? "formatThousands"
          : "selectedNotation",
      amount: formattedNumberTemplate[3],
      prefix: JSON.parse(formattedNumberTemplate[1]),
      suffix: JSON.parse(formattedNumberTemplate[4]),
    };
  }

  throw new Error(
    `Unrecognized pinned Remix story objective: ${source.source}`,
  );
}

const storyOutput = {
  source: {
    name: "Idle Mine: Remix",
    url: corpus.metadata.sourceUrl,
    commit: corpus.metadata.sourceCommit,
    capturedOn: corpus.metadata.capturedOn,
    files: storySemantics.sourcePaths,
    licenseNotice: corpus.metadata.licenseNotice,
  },
  chapters: storySemantics.chapters,
  milestones: storySemantics.milestones.map((milestone) => ({
    index: milestone.index,
    key: milestone.key,
    page: milestone.page,
    sourceCondition: milestone.condition,
    condition: parseStoryCondition(milestone.condition),
    objective: parseStoryObjective(milestone.objective),
  })),
};

const rendered = await format(JSON.stringify(output, null, 2), {
  parser: "json",
});
const renderedStory = await format(JSON.stringify(storyOutput, null, 2), {
  parser: "json",
});
if (process.argv[2] === "--check") {
  const [existing, existingStory] = await Promise.all([
    readFile(targetPath, "utf8"),
    readFile(storyTargetPath, "utf8"),
  ]);
  if (existing !== rendered || existingStory !== renderedStory) {
    throw new Error(
      "The tracked mine/story content catalogs are stale. Review `pnpm content:sync` output before committing them.",
    );
  }
  process.stdout.write("Verified the tracked mine/story content catalogs.\n");
} else {
  await Promise.all([
    mkdir(path.dirname(targetPath), { recursive: true }),
    mkdir(path.dirname(storyTargetPath), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(targetPath, rendered),
    writeFile(storyTargetPath, renderedStory),
  ]);
  process.stdout.write("Wrote the tracked mine and story content catalogs.\n");
}
