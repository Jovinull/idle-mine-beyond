import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { createBeyondStoryVisualSaveFromRemixSave } from "./visual-state.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";
import { renderedPixelHash } from "./visual-pixels.js";

type NaturalChapterRoute = {
  saveString: string;
  storyState: { page: number };
};

type LegacyStorySave = {
  settings: { tab: string; theme: string };
  story: { page: number; scrollY: number };
};

type StoryRuntime = {
  spookyBoneProgression: {
    millionaireProgression: Record<string, NaturalChapterRoute>;
  };
};

async function prepareStoryScreen(page: Page, expectedHeading: string) {
  await expect(page.locator(".chapter-control h3")).toHaveText(expectedHeading);
  await expect(page.locator("article.story")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  await page.mouse.move(1439, 899);
}

test("matches live Remix and Beyond natural Chapter 3-6 Story screens", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const runtime = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as StoryRuntime;
  const chapters = [
    {
      id: "chapter3Progression",
      heading: "Chapter 3: Mysterious Materials",
    },
    { id: "chapter4Progression", heading: "Chapter 4: It's NOT over" },
    { id: "chapter5Progression", heading: "Chapter 5: New Dimensions" },
    { id: "chapter6Progression", heading: "Chapter 6: Gone to Space" },
  ] as const;
  const now = 1_704_067_200_000;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  const appOrigin = new URL(page.url()).origin;
  const appUrl = `${appOrigin}/`;
  const sourceUrl = await routePinnedRemixOracle(page, {
    passThroughOrigins: [appOrigin],
  });
  const sourceOrigin = new URL(sourceUrl).origin;

  for (const chapter of chapters) {
    const route =
      runtime.spookyBoneProgression.millionaireProgression[chapter.id];
    if (!route) throw new Error(`Missing pinned ${chapter.id} route.`);
    const decodedSourceSave = decodeRemixLegacySave(route.saveString);
    expect(decodedSourceSave.status).toBe("success");
    if (decodedSourceSave.status !== "success") {
      throw new Error(`Could not decode pinned ${chapter.id} save.`);
    }
    const sourceState = decodedSourceSave.value as LegacyStorySave;
    sourceState.settings.tab = "story";
    sourceState.settings.theme = "light";
    sourceState.story.page = route.storyState.page;
    sourceState.story.scrollY = 0;
    const sourceSave = encodeRemixLegacySave(sourceState);
    const beyondSave = await createBeyondStoryVisualSaveFromRemixSave({
      clockMs: now,
      theme: "light",
      saveString: sourceSave,
    });
    await page.addInitScript(
      ({ appOrigin, sourceOrigin, now, sourceSave, beyondSave }) => {
        if (location.origin === sourceOrigin) {
          localStorage.clear();
          localStorage.setItem("IdleMine", sourceSave);
        } else if (location.origin === appOrigin) {
          localStorage.clear();
          localStorage.setItem("IdleMineBeyond", beyondSave);
        }
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
        let randomState = 7454;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
      },
      {
        appOrigin,
        sourceOrigin,
        now,
        sourceSave,
        beyondSave,
      },
    );

    await page.goto(sourceUrl);
    await page.getByRole("button", { name: /Story/ }).click();
    await prepareStoryScreen(page, chapter.heading);
    const sourceScreenshot = await page.screenshot({ animations: "disabled" });

    await page.goto(appUrl);
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
    await expect(page.locator("#app")).toHaveAttribute("data-theme", "light");
    await page.locator("[data-game-tab='story']").click();
    await prepareStoryScreen(page, chapter.heading);
    const beyondScreenshot = await page.screenshot({ animations: "disabled" });
    const sourceHash = renderedPixelHash(sourceScreenshot);
    const beyondHash = renderedPixelHash(beyondScreenshot);

    if (sourceHash !== beyondHash) {
      const sourcePath = test.info().outputPath(`${chapter.id}-remix.png`);
      const beyondPath = test.info().outputPath(`${chapter.id}-beyond.png`);
      await Promise.all([
        writeFile(sourcePath, sourceScreenshot),
        writeFile(beyondPath, beyondScreenshot),
      ]);
      await Promise.all([
        test.info().attach(`${chapter.id}-remix.png`, {
          path: sourcePath,
          contentType: "image/png",
        }),
        test.info().attach(`${chapter.id}-beyond.png`, {
          path: beyondPath,
          contentType: "image/png",
        }),
      ]);
    }
    expect(beyondHash, `${chapter.id} full-screen pixels`).toBe(sourceHash);
  }
});
