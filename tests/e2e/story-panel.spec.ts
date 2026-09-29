import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

type StoryStyleProperties = {
  fontFamily: string;
  fontSize: string;
  padding: string;
  zIndex: string;
  height: string;
  overflowY: string;
  overscrollBehaviorY: string;
  borderBottom: string;
  margin: string;
  color: string;
  fontStyle: string;
  marginLeft: string;
};

type PayDebtSemantics = {
  buttonLabel: string;
  scenarios: {
    name: string;
    money: string;
    events: { type: string; message: string; color?: string }[];
  }[];
};

type StoryRuntime = {
  storyNavigationScroll: {
    pageAfterNavigation: number;
    beforeScrollTop: number;
    afterScrollTop: number;
    containerReused: boolean;
  };
  freshGame: {
    page: number;
    chapterHeading: string;
    objectiveText: string;
    objectiveHtml: string;
    visibleBlocks: { key: string }[];
  };
  allUnlocked: {
    page: number;
    chapterHeading: string;
    computed: {
      article: { properties: StoryStyleProperties };
      scroller: { properties: StoryStyleProperties };
      chapterControl: { properties: StoryStyleProperties };
      chapterHeading: { properties: StoryStyleProperties };
      quoteText: { properties: StoryStyleProperties };
      mineObjectCanvas: { properties: StoryStyleProperties };
    };
    visibleBlocks: {
      key: string;
      innerText: string;
      imageSources: string[];
      mineObjectPreviews: { level: number }[];
    }[];
  }[];
};

test("renders captured fresh and fully unlocked Remix Story chapters", async ({
  page,
}) => {
  const runtime = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as StoryRuntime;
  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { data: { payUSDebtSemantics: PayDebtSemantics } };

  await page.goto("/__test__/story-panel");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");
  const configure = async (
    conditionState: {
      highestMineObjectLevel: number;
      highestMoney: string;
      maxPlanetCoins: string;
      moneyUpgradeLevels: Record<string, number>;
      wisdomUpgradeLevels: Record<string, number>;
    },
    storyPage: number,
  ) =>
    page.evaluate(
      async (scenario) => {
        const probe = (
          window as Window & {
            __idleMineStoryPanelConfigure?: (
              input: typeof scenario,
            ) => Promise<void>;
          }
        ).__idleMineStoryPanelConfigure;
        if (!probe) throw new Error("Story panel probe did not initialize.");
        await probe(scenario);
      },
      { conditionState, page: storyPage },
    );

  const fresh = {
    highestMineObjectLevel: 0,
    highestMoney: "0",
    maxPlanetCoins: "0",
    moneyUpgradeLevels: {},
    wisdomUpgradeLevels: {},
  };
  await configure(fresh, runtime.freshGame.page);
  await expect(page.locator(".chapter-control h3")).toHaveText(
    runtime.freshGame.chapterHeading,
  );
  await expect(
    page.locator(".story-milestones > div[data-story-milestone-key]"),
  ).toHaveAttribute(
    "data-story-milestone-key",
    runtime.freshGame.visibleBlocks[0]!.key,
  );
  expect(await page.locator(".objective").innerHTML()).toBe(
    runtime.freshGame.objectiveHtml,
  );

  const allUnlocked = {
    highestMineObjectLevel: 215,
    highestMoney: "5e13",
    maxPlanetCoins: "1",
    moneyUpgradeLevels: { blacksmith: 1, gemWaster: 1 },
    wisdomUpgradeLevels: { firstUpgrade: 1 },
  };
  await configure(allUnlocked, 0);

  const observedStyles = await page
    .locator("article.story")
    .evaluate((article) => {
      const styleOf = (selector: string) => {
        const element = article.querySelector(selector);
        if (!element) throw new Error(`Story element ${selector} is missing.`);
        const style = getComputedStyle(element);
        return {
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          height: style.height,
          margin: style.margin,
          marginLeft: style.marginLeft,
          overflowY: style.overflowY,
          overscrollBehaviorY: style.overscrollBehaviorY,
          padding: style.padding,
          borderBottom: style.borderBottom,
          color: style.color,
          fontStyle: style.fontStyle,
          zIndex: style.zIndex,
        };
      };
      return {
        article: {
          fontFamily: getComputedStyle(article).fontFamily,
          fontSize: getComputedStyle(article).fontSize,
          padding: getComputedStyle(article).padding,
          zIndex: getComputedStyle(article).zIndex,
        },
        scroller: styleOf(".story-milestones"),
        chapterControl: styleOf(".chapter-control"),
        chapterHeading: styleOf(".chapter-control h3"),
        quoteText: styleOf(".story-quote span"),
        mineObjectCanvas: styleOf("canvas.mine-object"),
      };
    });
  const referenceStyles = runtime.allUnlocked[0]!.computed;
  expect(observedStyles.article).toMatchObject({
    fontFamily: referenceStyles.article.properties.fontFamily,
    fontSize: referenceStyles.article.properties.fontSize,
    padding: referenceStyles.article.properties.padding,
    zIndex: referenceStyles.article.properties.zIndex,
  });
  expect(observedStyles.scroller).toMatchObject({
    height: referenceStyles.scroller.properties.height,
    overflowY: referenceStyles.scroller.properties.overflowY,
    overscrollBehaviorY:
      referenceStyles.scroller.properties.overscrollBehaviorY,
  });
  expect(observedStyles.chapterControl).toMatchObject({
    height: referenceStyles.chapterControl.properties.height,
    borderBottom: referenceStyles.chapterControl.properties.borderBottom,
  });
  expect(observedStyles.chapterHeading).toMatchObject({
    fontFamily: referenceStyles.chapterHeading.properties.fontFamily,
    fontSize: referenceStyles.chapterHeading.properties.fontSize,
    margin: referenceStyles.chapterHeading.properties.margin,
  });
  expect(observedStyles.quoteText).toMatchObject({
    color: referenceStyles.quoteText.properties.color,
    fontFamily: referenceStyles.quoteText.properties.fontFamily,
    fontSize: referenceStyles.quoteText.properties.fontSize,
    fontStyle: referenceStyles.quoteText.properties.fontStyle,
    marginLeft: referenceStyles.quoteText.properties.marginLeft,
  });
  expect(observedStyles.mineObjectCanvas.height).toBe(
    referenceStyles.mineObjectCanvas.properties.height,
  );

  for (const chapter of runtime.allUnlocked) {
    await expect(page.locator(".chapter-control h3")).toHaveText(
      chapter.chapterHeading,
    );
    const observedKeys = await page
      .locator(".story-milestones > div[data-story-milestone-key]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-story-milestone-key")),
      );
    expect(observedKeys).toEqual(chapter.visibleBlocks.map(({ key }) => key));
    const observedText = await page
      .locator(".story-milestones > div[data-story-milestone-key]")
      .evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).innerText),
      );
    expect(observedText).toEqual(
      chapter.visibleBlocks.map(({ innerText }) => innerText),
    );
    const observedContents = await page
      .locator(".story-milestones > div[data-story-milestone-key]")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          imageSources: [...node.querySelectorAll("img")].map((image) =>
            (image.getAttribute("src") ?? "").replace(/^\//, ""),
          ),
          canvasLevels: [...node.querySelectorAll("canvas.mine-object")].map(
            (canvas) => Number((canvas as HTMLCanvasElement).dataset["level"]),
          ),
        })),
      );
    expect(observedContents).toEqual(
      chapter.visibleBlocks.map((block) => ({
        imageSources: block.imageSources,
        canvasLevels: block.mineObjectPreviews.map(({ level }) => level),
      })),
    );
    if (chapter.page === 8) {
      expect(observedKeys.filter((key) => key === "mineUniverse")).toHaveLength(
        2,
      );
    }
    const expectedCanvasCount = chapter.visibleBlocks.reduce(
      (sum, block) => sum + block.mineObjectPreviews.length,
      0,
    );
    const canvases = page.locator(".story-milestones canvas.mine-object");
    await expect(canvases).toHaveCount(expectedCanvasCount);
    for (const canvas of await canvases.all()) {
      await expect(canvas).toHaveAttribute("data-rendered", "true");
    }

    if (chapter.page < runtime.allUnlocked.length - 1) {
      await page
        .locator('button[data-story-action="increaseStoryPage"]')
        .click();
    }
  }

  await page.locator('button[data-story-action="decreaseStoryPage"]').click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    runtime.allUnlocked[7]!.chapterHeading,
  );

  await configure(allUnlocked, 0);
  const scroller = page.locator(".story-milestones");
  await scroller.evaluate((element, scrollTop) => {
    element.scrollTop = scrollTop;
  }, runtime.storyNavigationScroll.beforeScrollTop);
  await page.locator('button[data-story-action="increaseStoryPage"]').click();
  await expect(page.locator(".chapter-control h3")).toHaveText(
    runtime.allUnlocked[runtime.storyNavigationScroll.pageAfterNavigation]!
      .chapterHeading,
  );
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(runtime.storyNavigationScroll.afterScrollTop);

  const debtCase = corpus.data.payUSDebtSemantics.scenarios.find(
    ({ name }) => name === "above-cost",
  );
  if (!debtCase) throw new Error("The captured Story debt case is missing.");
  await configure(allUnlocked, 2);
  await expect(
    page.locator('button[data-story-action="payUSDebt"]'),
  ).toHaveText(`PAY ($ ${corpus.data.payUSDebtSemantics.buttonLabel})`);
  await page.evaluate(() => {
    const browserWindow = window as Window & {
      __idleMineStoryLogs?: { message: string; color: string }[];
    };
    browserWindow.__idleMineStoryLogs = [];
    window.addEventListener("idle-mine-story-log", (event) => {
      const effect = (event as CustomEvent<{ message: string; color: string }>)
        .detail;
      browserWindow.__idleMineStoryLogs?.push(effect);
    });
  });
  const alertMessages: string[] = [];
  page.on("dialog", async (dialog) => {
    alertMessages.push(dialog.message());
    await dialog.accept();
  });
  await page.locator('button[data-story-action="payUSDebt"]').click();
  expect(alertMessages).toEqual(
    debtCase.events
      .filter(({ type }) => type === "alert")
      .map(({ message }) => message),
  );
  const loggedEffects = await page.evaluate(() => {
    const browserWindow = window as Window & {
      __idleMineStoryLogs?: { message: string; color: string }[];
    };
    return browserWindow.__idleMineStoryLogs;
  });
  expect(loggedEffects).toEqual(
    debtCase.events.filter(({ type }) => type === "logMessage"),
  );
});
