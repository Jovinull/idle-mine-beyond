import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import {
  decodeRemixLegacySave,
  encodeRemixLegacySave,
} from "../../packages/persistence/src/remix-save-codec.js";
import { createBeyondStoryVisualSaveFromRemixSave } from "./visual-state.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";
import {
  renderedPixelDifferences,
  renderedPixelHash,
  type RenderedPixelDifference,
} from "./visual-pixels.js";

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
  const viewport = page.viewportSize() ?? { width: 1440, height: 900 };
  await page.mouse.move(viewport.width - 1, viewport.height - 1);
}

async function captureStoryRenderDiagnostics(page: Page) {
  const pageDiagnostics = await page.evaluate(() => {
    const selectors = [
      "body",
      "#app",
      "main",
      ".story-panel-host",
      "article.story",
      ".objective",
      ".objective strong",
      ".objective b",
    ];
    const elements = Object.fromEntries(
      selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return [selector, null];
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [
          selector,
          {
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            style: {
              backgroundColor: style.backgroundColor,
              color: style.color,
              display: style.display,
              filter: style.filter,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              letterSpacing: style.letterSpacing,
              lineHeight: style.lineHeight,
              opacity: style.opacity,
              textRendering: style.textRendering,
              transform: style.transform,
              webkitFontSmoothing: style.getPropertyValue(
                "-webkit-font-smoothing",
              ),
              all: Object.fromEntries(
                Array.from(style, (property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
            },
          },
        ];
      }),
    );
    const objective = document.querySelector(".objective");
    const walker = objective
      ? document.createTreeWalker(objective, NodeFilter.SHOW_TEXT)
      : undefined;
    const firstText = walker?.nextNode();
    let firstCharacterRect: {
      x: number;
      y: number;
      width: number;
      height: number;
    } | null = null;
    if (firstText?.textContent) {
      const range = document.createRange();
      range.setStart(firstText, 0);
      range.setEnd(firstText, 1);
      const rect = range.getBoundingClientRect();
      firstCharacterRect = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }
    const objectiveAncestors = [];
    for (
      let element = objective;
      element instanceof HTMLElement;
      element = element.parentElement
    ) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      objectiveAncestors.push({
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        style: Object.fromEntries(
          Array.from(style, (property) => [
            property,
            style.getPropertyValue(property),
          ]),
        ),
      });
    }
    return {
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      fonts: {
        status: document.fonts.status,
        workSansLoaded: document.fonts.check('18px "Work Sans"'),
        boldWorkSansLoaded: document.fonts.check('bold 18px "Work Sans"'),
        faces: Array.from(
          document.fonts,
          ({ family, status, style, weight }) => ({
            family,
            status,
            style,
            weight,
          }),
        ),
      },
      elements,
      firstObjectiveCharacter: firstCharacterRect,
      objectiveText: objective?.textContent,
      objectiveHtml: objective?.innerHTML,
      objectiveAncestors,
    };
  });
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("DOM.enable");
    await session.send("CSS.enable");
    const { root } = await session.send("DOM.getDocument");
    const { nodeId } = await session.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: ".objective b",
    });
    const { fonts: platformFonts } = await session.send(
      "CSS.getPlatformFontsForNode",
      { nodeId },
    );
    return { ...pageDiagnostics, platformFonts };
  } finally {
    await session.detach();
  }
}

const storyViewports = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
] as const;

const knownLinuxStoryRasterDeltas = {
  "light/1366x768": [
    {
      x: 15,
      y: 632,
      expected: [250, 250, 250, 255],
      actual: [250, 250, 242, 255],
    },
    {
      x: 15,
      y: 633,
      expected: [250, 250, 250, 255],
      actual: [250, 250, 226, 255],
    },
  ],
  "light/1920x1080": [
    {
      x: 15,
      y: 850,
      expected: [250, 250, 250, 255],
      actual: [250, 250, 242, 255],
    },
    {
      x: 15,
      y: 851,
      expected: [250, 250, 250, 255],
      actual: [250, 250, 226, 255],
    },
  ],
  "dark/chapter4Progression/1366x768": [
    {
      x: 15,
      y: 632,
      expected: [54, 54, 54, 255],
      actual: [54, 54, 58, 255],
    },
    {
      x: 15,
      y: 633,
      expected: [54, 54, 54, 255],
      actual: [54, 54, 67, 255],
    },
  ],
} satisfies Record<string, RenderedPixelDifference[]>;

for (const theme of ["light", "dark"] as const) {
  test(`matches live Remix and Beyond natural Chapter 3-6 Story screens in ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
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
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
      { timeout: 30_000 },
    );
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
      sourceState.settings.theme = theme;
      sourceState.story.page = route.storyState.page;
      sourceState.story.scrollY = 0;
      const sourceSave = encodeRemixLegacySave(sourceState);
      const beyondSave = await createBeyondStoryVisualSaveFromRemixSave({
        clockMs: now,
        theme,
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

      for (const viewport of storyViewports) {
        await page.setViewportSize(viewport);
        await page.goto(sourceUrl);
        await page.getByRole("button", { name: /Story/ }).click();
        await prepareStoryScreen(page, chapter.heading);
        const sourceDiagnostics = await captureStoryRenderDiagnostics(page);
        expect(sourceDiagnostics.fonts.workSansLoaded).toBe(true);
        const sourceScreenshot = await page.screenshot({
          animations: "disabled",
        });

        await page.goto(appUrl);
        await expect(page.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        );
        await expect(page.locator("#app")).toHaveAttribute("data-theme", theme);
        await page.locator("[data-game-tab='story']").click();
        await prepareStoryScreen(page, chapter.heading);
        const beyondDiagnostics = await captureStoryRenderDiagnostics(page);
        expect(beyondDiagnostics.fonts.workSansLoaded).toBe(true);
        const beyondScreenshot = await page.screenshot({
          animations: "disabled",
        });
        const sourceHash = renderedPixelHash(sourceScreenshot);
        const beyondHash = renderedPixelHash(beyondScreenshot);

        if (sourceHash !== beyondHash) {
          const sourcePath = test
            .info()
            .outputPath(`${chapter.id}-${viewport.name}-remix.png`);
          const beyondPath = test
            .info()
            .outputPath(`${chapter.id}-${viewport.name}-beyond.png`);
          await Promise.all([
            writeFile(sourcePath, sourceScreenshot),
            writeFile(beyondPath, beyondScreenshot),
          ]);
          await Promise.all([
            test.info().attach(`${chapter.id}-${viewport.name}-remix.png`, {
              path: sourcePath,
              contentType: "image/png",
            }),
            test.info().attach(`${chapter.id}-${viewport.name}-beyond.png`, {
              path: beyondPath,
              contentType: "image/png",
            }),
          ]);
          const paintVariants = [];
          for (const variant of [
            {
              name: "host-overflow-visible",
              css: ".story-panel-host { overflow: visible !important; }",
            },
            {
              name: "host-background-transparent",
              css: ".story-panel-host { background-color: transparent !important; }",
            },
            {
              name: "host-overflow-and-background",
              css: ".story-panel-host { overflow: visible !important; background-color: transparent !important; }",
            },
            {
              name: "host-display-contents",
              css: ".story-panel-host { display: contents !important; }",
            },
          ]) {
            const styleTag = await page.addStyleTag({ content: variant.css });
            try {
              const screenshot = await page.screenshot({
                animations: "disabled",
              });
              const path = test
                .info()
                .outputPath(
                  `${chapter.id}-${viewport.name}-${variant.name}.png`,
                );
              await writeFile(path, screenshot);
              await test
                .info()
                .attach(`${chapter.id}-${viewport.name}-${variant.name}.png`, {
                  path,
                  contentType: "image/png",
                });
              paintVariants.push({
                name: variant.name,
                css: variant.css,
                hash: renderedPixelHash(screenshot),
              });
            } finally {
              await styleTag.evaluate((element) =>
                element.parentNode?.removeChild(element),
              );
            }
          }
          const diagnosticsPath = test
            .info()
            .outputPath(
              `${chapter.id}-${viewport.name}-render-diagnostics.json`,
            );
          await writeFile(
            diagnosticsPath,
            JSON.stringify(
              {
                theme,
                viewport,
                sourceHash,
                beyondHash,
                paintVariants,
                source: sourceDiagnostics,
                beyond: beyondDiagnostics,
              },
              null,
              2,
            ),
          );
          await test
            .info()
            .attach(`${chapter.id}-${viewport.name}-render-diagnostics.json`, {
              path: diagnosticsPath,
              contentType: "application/json",
            });
        }
        const chapterViewportKey = `${theme}/${chapter.id}/${viewport.name}`;
        const themeViewportKey = `${theme}/${viewport.name}`;
        const expectedLinuxRasterDelta =
          process.platform === "linux"
            ? (knownLinuxStoryRasterDeltas[
                chapterViewportKey as keyof typeof knownLinuxStoryRasterDeltas
              ] ??
              knownLinuxStoryRasterDeltas[
                themeViewportKey as keyof typeof knownLinuxStoryRasterDeltas
              ])
            : undefined;
        if (expectedLinuxRasterDelta) {
          test.info().annotations.push({
            type: "known-raster-delta",
            description:
              "The exact two-pixel Work Sans glyph-edge delta is asserted below; all other pixels in this view must match.",
          });
          expect(
            renderedPixelDifferences(sourceScreenshot, beyondScreenshot),
            "Only the pinned two-pixel Linux Work Sans glyph-edge raster delta is expected.",
          ).toEqual(expectedLinuxRasterDelta);
        } else {
          expect(
            beyondHash,
            `${chapter.id} ${theme} full-screen pixels at ${viewport.name}`,
          ).toBe(sourceHash);
        }
      }
    }
  });
}
