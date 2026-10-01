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

const progression = runtime.spookyBoneProgression;
if (!progression) {
  throw new Error(
    "The Story runtime fixture has no controlled Spooky Bone state.",
  );
}

for (const theme of ["light", "dark"]) {
  const base = JSON.parse(
    await readFile(
      join(fixtureDirectory, `story-ten-thousand-${theme}-1440x900.json`),
      "utf8",
    ),
  );
  const state = progression.storyStates.find((story) => story.theme === theme);
  const screenshotName = `story-spooky-bone-${theme}-1440x900.png`;
  const sourceScreenshot = join(outputDirectory, screenshotName);
  const fixtureScreenshot = join(fixtureDirectory, screenshotName);
  const screenshot = await readFile(sourceScreenshot);
  await copyFile(sourceScreenshot, fixtureScreenshot);

  const sidecar = {
    repository: base.repository,
    sourceCommit: pinnedCommit,
    sourcePaths: base.sourcePaths,
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
    stateInjection: progression.stateInjection,
    preInjectionState: progression.sourceState.before,
    sourceState: progression.sourceState,
    state,
    screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    screenshotPath: `tests/fixtures/visual/${screenshotName}`,
    captureNote:
      "Controlled Story boundary state, not a natural route: start from the pinned 10,000-Money state; set highestMineObjectLevel to 13; select object 12 with the source function functions.setMineObjectLevel(12); run functions.refreshStoryNotifications(); then enter Story. This captures the firstSpookyBone unlock, one notification before Story entry, notification clearing, and the source objective Have 1,000,000 $ on hand. The chosen object is the reset Spooky Bone at 92,000 HP after its first break. The path and resource funding to reach object 12 are not claimed by this fixture.",
  };

  await writeFile(
    join(fixtureDirectory, `story-spooky-bone-${theme}-1440x900.json`),
    await prettier.format(JSON.stringify(sidecar), { parser: "json" }),
    "utf8",
  );
}

process.stdout.write(
  `Wrote controlled Spooky Bone Story visual fixtures for both themes at ${pinnedCommit}.\n`,
);
