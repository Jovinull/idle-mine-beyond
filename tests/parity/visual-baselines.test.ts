import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";

const visualDirectory = new URL("../fixtures/visual/", import.meta.url);
const pinnedRemixCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";

it("pins every tracked screenshot to its source metadata and PNG hash", async () => {
  const sidecars = (await readdir(visualDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort();
  // Story captures without Linux baselines are tracked as explicit gaps below.
  const windowsSidecars = sidecars.filter(
    (name) => !name.endsWith("-linux.json"),
  );
  expect(windowsSidecars).toHaveLength(45);
  const linuxSidecars = sidecars.filter((name) => name.endsWith("-linux.json"));
  const missingLinuxBaselines = windowsSidecars
    .filter(
      (name) => !sidecars.includes(name.replace(/\.json$/, "-linux.json")),
    )
    .sort();
  expect(missingLinuxBaselines).toEqual(
    [
      "story-first-mud-dark-1440x900.json",
      "story-first-mud-light-1440x900.json",
      "story-first-blacksmith-dark-1440x900.json",
      "story-first-blacksmith-light-1440x900.json",
      "story-first-clay-dark-1440x900.json",
      "story-first-clay-light-1440x900.json",
      "story-first-stone-dark-1440x900.json",
      "story-first-stone-light-1440x900.json",
      "story-ten-thousand-dark-1440x900.json",
      "story-ten-thousand-light-1440x900.json",
      "story-millionaire-dark-1440x900.json",
      "story-millionaire-light-1440x900.json",
      "story-millionaire-scrolled-dark-1440x900.json",
      "story-millionaire-scrolled-light-1440x900.json",
      "story-spooky-bone-dark-1440x900.json",
      "story-spooky-bone-light-1440x900.json",
      "story-natural-spooky-bone-dark-1440x900.json",
      "story-natural-spooky-bone-light-1440x900.json",
      "story-first-paper-dark-1440x900.json",
      "story-first-paper-light-1440x900.json",
      "story-fresh-dark-1440x900.json",
      "story-fresh-light-1440x900.json",
    ].sort(),
  );
  expect(linuxSidecars).toHaveLength(23);

  for (const sidecarName of sidecars) {
    const metadata = JSON.parse(
      await readFile(new URL(sidecarName, visualDirectory), "utf8"),
    ) as {
      sourceCommit?: string;
      source?: { commit?: string };
      screenshotPath?: string;
      screenshotSha256?: string;
      referenceScreenshot?: { path: string; sha256: string };
      beyondScreenshotSha256?: string;
    };
    const screenshotPath =
      metadata.screenshotPath ?? metadata.referenceScreenshot?.path;
    const expectedSha256 =
      metadata.screenshotSha256 ?? metadata.referenceScreenshot?.sha256;

    expect(
      metadata.sourceCommit ?? metadata.source?.commit,
      `${sidecarName} source revision`,
    ).toBe(pinnedRemixCommit);
    expect(screenshotPath, `${sidecarName} screenshot path`).toBeDefined();
    expect(expectedSha256, `${sidecarName} screenshot hash`).toMatch(
      /^[a-f0-9]{64}$/,
    );

    const screenshot = await readFile(
      new URL(screenshotPath!.split(/[\\/]/).at(-1)!, visualDirectory),
    );
    const actualSha256 = createHash("sha256").update(screenshot).digest("hex");
    expect(actualSha256, `${sidecarName} PNG SHA-256`).toBe(expectedSha256);
    if (metadata.beyondScreenshotSha256 !== undefined) {
      expect(metadata.beyondScreenshotSha256).toBe(expectedSha256);
    }
  }

  // Linux captures must come from the same source state; only rendered
  // measurements may differ with the platform's text rasterization.
  const readState = async (name: string) => {
    const { state } = JSON.parse(
      await readFile(new URL(name, visualDirectory), "utf8"),
    ) as { state?: Record<string, unknown> };
    const sourceState = { ...state };
    delete sourceState["measurements"];
    return sourceState;
  };
  for (const windowsName of windowsSidecars) {
    const linuxName = windowsName.replace(/\.json$/, "-linux.json");
    if (!sidecars.includes(linuxName)) continue;
    expect(await readState(linuxName), `${linuxName} source state`).toEqual(
      await readState(windowsName),
    );
  }
});
