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

const progression = runtime.tenThousandProgression;
if (!progression) {
  throw new Error("The Story runtime fixture has no 10,000-Money progression.");
}

for (const theme of ["light", "dark"]) {
  const stoneSidecar = JSON.parse(
    await readFile(
      join(fixtureDirectory, `story-first-stone-${theme}-1440x900.json`),
      "utf8",
    ),
  );
  const story = progression.storyStates.find((state) => state.theme === theme);
  const screenshotName = `story-ten-thousand-${theme}-1440x900.png`;
  const screenshotSource = join(outputDirectory, screenshotName);
  const screenshotTarget = join(fixtureDirectory, screenshotName);
  const screenshot = await readFile(screenshotSource);
  await copyFile(screenshotSource, screenshotTarget);

  const sidecar = {
    repository: stoneSidecar.repository,
    sourceCommit: pinnedCommit,
    sourcePaths: stoneSidecar.sourcePaths,
    browserName: runtime.source.browser.name,
    browserVersion: runtime.source.browser.version,
    playwrightVersion: runtime.source.playwrightVersion,
    viewport: runtime.source.viewport,
    deviceScaleFactor: stoneSidecar.deviceScaleFactor,
    browserColorScheme: runtime.source.colorScheme,
    gameTheme: theme,
    locale: runtime.source.locale,
    timezoneId: runtime.source.timezone,
    clockMs: stoneSidecar.clockMs,
    randomSeed: runtime.source.randomSeed,
    state: {
      tab: story.tab,
      page: story.page,
      notifications: story.notifications,
      highestUnlocked: story.highestUnlocked,
      mineObjectLevel: story.mineObjectLevel,
      highestMineObjectLevel: story.highestMineObjectLevel,
      currentObjectName: story.currentObjectName,
      currentObjectHp: story.currentObjectHp,
      money: story.money,
      gems: story.gems,
      pickaxeName: story.pickaxeName,
      pickaxePower: story.pickaxePower,
      pickaxeQuality: story.pickaxeQuality,
      pickaxeDamage: story.pickaxeDamage,
      blacksmithLevel: story.blacksmithLevel,
      scrollTop: story.scrollTop,
      visibleMilestones: story.visibleMilestones,
      nextObjective: story.nextObjective,
      chapterHeading: story.chapterHeading,
      scenario: progression.scenario,
    },
    miningSetup: progression.miningSetup,
    hitsPerRock: progression.hitsPerRock,
    breaksToThreshold: progression.breaksToThreshold,
    rockFarming: progression.rockFarming,
    screenshotSha256: createHash("sha256").update(screenshot).digest("hex"),
    screenshotPath: `tests/fixtures/visual/${screenshotName}`,
    captureNote:
      "Continue from the pinned first-Stone state at Rock with 6,213 Money, 5 Gems, Blacksmith level 2, and 8.5882157584418 active damage. Invoke the canonical active-click function 257 times per break for 32 Rock breaks, calling source update after each break. Gem drops occur on breaks 10 and 31; the last break raises Money/highestMoney from 9,933 to 10,053 and unlocks tenThousand. Enter Story and capture page 1 in both themes with firstStone and tenThousand visible and `Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)` as the next objective.",
  };

  await writeFile(
    join(fixtureDirectory, `story-ten-thousand-${theme}-1440x900.json`),
    await prettier.format(JSON.stringify(sidecar), { parser: "json" }),
    "utf8",
  );
}

process.stdout.write(
  `Wrote pinned 10,000-Money Story visual fixtures for both themes at ${pinnedCommit}.\n`,
);
