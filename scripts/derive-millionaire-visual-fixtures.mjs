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

const progression = runtime.spookyBoneProgression?.millionaireProgression;
if (!progression) {
  throw new Error(
    "The Story runtime fixture has no natural millionaire progression.",
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
  if (!state) throw new Error(`Missing ${theme} millionaire Story state.`);
  const scrolledState = progression.millionaireScrolledScreenshots?.find(
    (capture) => capture.theme === theme,
  );
  if (!scrolledState) {
    throw new Error(`Missing ${theme} scrolled millionaire Story capture.`);
  }

  for (const capture of [
    { prefix: "story-millionaire", metrics: undefined },
    {
      prefix: "story-millionaire-scrolled",
      metrics: scrolledState,
    },
  ]) {
    const screenshotName = `${capture.prefix}-${theme}-1440x900.png`;
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
      miningSetup: progression.miningSetup,
      hitsPerRock: progression.hitsPerRock,
      breaksToThreshold: progression.breaksToThreshold,
      rockFarming: progression.rockFarming,
      state,
      ...(capture.metrics ? { scrollCapture: capture.metrics } : {}),
      screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
      screenshotPath: `tests/fixtures/visual/${screenshotName}`,
      captureNote: capture.metrics
        ? "Natural millionaire Story state after 8,250 Rock breaks. The source screenshot records the full millionaire milestone after scrolling the pinned Story container to its measured maximum; scroll position and target bounds are recorded in scrollCapture."
        : "Natural source route: continue from the verified 10,000-Money state with a full Rock, 10,053 Money, and 7 Gems. Call the canonical active-click function 257 times per Rock for 8,250 breaks and run source update after every break. This raises both Money and highestMoney to 1000053.0000000001. The ordered Story scan unlocks millionaire while firstSpookyBone is still locked; entering Story clears the one notification, shows firstStone, tenThousand, and millionaire, and leaves the earlier Spooky Bone objective active. No mine level or resource value was injected on this route.",
    };

    await writeFile(
      join(fixtureDirectory, `${capture.prefix}-${theme}-1440x900.json`),
      await prettier.format(JSON.stringify(sidecar), { parser: "json" }),
      "utf8",
    );
  }
}

process.stdout.write(
  `Wrote natural millionaire Story visual fixtures for both themes at ${pinnedCommit}.\n`,
);
