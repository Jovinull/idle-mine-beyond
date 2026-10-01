import { createHash } from "node:crypto";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import prettier from "prettier";

const root = process.cwd();
const outputDirectory = join(root, ".research", "outputs", "story-runtime");
const fixtureDirectory = join(root, "tests", "fixtures", "visual");
const runtime = JSON.parse(
  await readFile(
    join(root, "tests", "fixtures", "parity", "remix-story-runtime.json"),
    "utf8",
  ),
);
const pinnedCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";
if (runtime.source?.commit !== pinnedCommit) {
  throw new Error(
    "Story runtime fixture is not pinned to the expected Remix commit.",
  );
}

const progression =
  runtime.spookyBoneProgression?.millionaireProgression
    ?.sourceInteractionProgression;
if (!progression?.storyScreenshots) {
  throw new Error(
    "The Story runtime fixture has no natural post-Spooky-Bone screenshots.",
  );
}

for (const theme of ["light", "dark"]) {
  const base = JSON.parse(
    await readFile(
      join(fixtureDirectory, `story-spooky-bone-${theme}-1440x900.json`),
      "utf8",
    ),
  );
  const state = progression.storyScreenshots.find(
    (capture) => capture.theme === theme,
  );
  if (!state) throw new Error(`Missing natural Spooky Bone ${theme} capture.`);

  const screenshotName = `story-natural-spooky-bone-${theme}-1440x900.png`;
  const sourceScreenshot = join(outputDirectory, screenshotName);
  const fixtureScreenshot = join(fixtureDirectory, screenshotName);
  const screenshot = await readFile(sourceScreenshot);
  await copyFile(sourceScreenshot, fixtureScreenshot);

  const sidecar = {
    repository: base.repository,
    sourceCommit: pinnedCommit,
    sourcePaths: runtime.source.sourcePaths,
    browserName: runtime.source.browser.name,
    browserVersion: runtime.source.browser.version,
    playwrightVersion: runtime.source.playwrightVersion,
    viewport: runtime.source.viewport,
    deviceScaleFactor: base.deviceScaleFactor,
    browserColorScheme: runtime.source.colorScheme,
    gameTheme: theme,
    locale: runtime.source.locale,
    timezoneId: runtime.source.timezone,
    clockMs: base.clockMs,
    randomSeed: runtime.source.randomSeed,
    scenario: progression.scenario,
    startingState: progression.startingState,
    upgradePurchases: progression.upgradePurchases,
    crafting: progression.crafting,
    minedObjects: progression.minedObjects,
    state,
    screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    screenshotPath: `tests/fixtures/visual/${screenshotName}`,
    captureNote:
      "Natural seeded source-interaction route from the pinned millionaire save: buy source Blacksmith and Active Power upgrades, perform one single-Gem craft, then use legal mine-object navigation and active source clicks through Spooky Bone before entering Story. No progress or resources are injected. The source-ordered notification cursor remains at 9 even though firstSpookyBone becomes visible; see docs/knowledge/legacy-quirks.md.",
  };

  await writeFile(
    join(fixtureDirectory, `story-natural-spooky-bone-${theme}-1440x900.json`),
    await prettier.format(JSON.stringify(sidecar), { parser: "json" }),
    "utf8",
  );
}

process.stdout.write(
  `Wrote natural millionaire-to-Spooky-Bone Story visual fixtures for both themes at ${pinnedCommit}.\n`,
);
