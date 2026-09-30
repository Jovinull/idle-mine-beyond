import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";

const visualDirectory = new URL("../fixtures/visual/", import.meta.url);
const pinnedRemixCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";

it("pins every tracked screenshot to its source metadata and PNG hash", async () => {
  const sidecars = (await readdir(visualDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort();
  expect(sidecars).toHaveLength(23);

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
});
