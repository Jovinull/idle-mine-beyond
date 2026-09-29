import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

type StoryRuntimeBlock = {
  sourceOrder: number;
  key: string;
  occurrence: number;
  innerText: string;
  outerHtml: string;
  mineObjectPreviews: { width: number; height: number }[];
};

type StoryRuntimePage = {
  page: number;
  chapterHeading: string;
  nextObjective: string | null;
  objectiveText: string | null;
  visibleBlocks: StoryRuntimeBlock[];
  computed: {
    article: { properties: Record<string, string> };
    scroller: { properties: Record<string, string> };
    objective: { properties: Record<string, string> } | null;
    milestone: { properties: Record<string, string> };
    chapterControl: { properties: Record<string, string> };
    chapterHeading: { properties: Record<string, string> };
    quoteText: { properties: Record<string, string> } | null;
  };
};

const runtime = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
    "utf8",
  ),
) as {
  source: {
    repository: string;
    commit: string;
    license: string;
    copyrightNotice: string;
    browser: { name: string; version: string };
    scenarios: {
      freshGame: string;
      allUnlocked: {
        highestMineObjectLevel: number;
        highestMoney: string;
        maxPlanetCoins: string;
        moneyUpgradeLevels: { blacksmith: number; gemWaster: number };
        wisdomUpgradeLevels: { firstUpgrade: number; remaining: number };
      };
    };
    viewport: { width: number; height: number };
    randomSeed: number;
    capturedOn: string;
  };
  chapters: string[];
  freshGame: StoryRuntimePage;
  allUnlocked: StoryRuntimePage[];
};
const markup = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-markup.json", import.meta.url),
    "utf8",
  ),
) as {
  source: { commit: string };
  blocks: {
    sourceOrder: number;
    key: string;
    occurrence: number;
    conditionalAncestors: string[];
    embeddedMineObjectAttributes: string[];
  }[];
};
const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: {
    storySemantics: {
      chapters: string[];
      initial: { nextObjective: string; visibleMilestones: string[] };
      milestones: { key: string; page: number }[];
    };
  };
};

it("captures fresh and fully unlocked Story rendering from the pinned Remix runtime", () => {
  expect(runtime.source.repository).toBe(
    "https://github.com/veprogames/idle-mine-remix",
  );
  expect(runtime.source.commit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(runtime.source.commit).toBe(markup.source.commit);
  expect(runtime.source.license).toBe("MIT");
  expect(runtime.source.copyrightNotice).toBe("Copyright (c) 2023 veprogames");
  expect(runtime.source.browser.name).toBe("Chromium");
  expect(runtime.source.browser.version).toMatch(/^\d+\./);
  expect(runtime.source.scenarios).toEqual({
    freshGame: "New browser context without a saved game in localStorage.",
    allUnlocked: {
      highestMineObjectLevel: 215,
      highestMoney: "5e13",
      maxPlanetCoins: "1",
      moneyUpgradeLevels: { blacksmith: 1, gemWaster: 1 },
      wisdomUpgradeLevels: { firstUpgrade: 1, remaining: 0 },
    },
  });
  expect(runtime.source.capturedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(runtime.source.viewport).toEqual({ width: 1440, height: 900 });
  expect(runtime.source.randomSeed).toBe(0x1d1e);
  expect(runtime.chapters).toEqual(corpus.data.storySemantics.chapters);

  expect(runtime.freshGame.page).toBe(0);
  expect(runtime.freshGame.chapterHeading).toBe(
    `Chapter 1: ${runtime.chapters[0]}`,
  );
  expect(runtime.freshGame.nextObjective).toBe(
    corpus.data.storySemantics.initial.nextObjective,
  );
  expect(runtime.freshGame.objectiveText).toContain(
    corpus.data.storySemantics.initial.nextObjective,
  );
  expect(runtime.freshGame.visibleBlocks.map(({ key }) => key)).toEqual(
    corpus.data.storySemantics.initial.visibleMilestones,
  );

  expect(runtime.allUnlocked).toHaveLength(runtime.chapters.length);
  for (const [page, renderedPage] of runtime.allUnlocked.entries()) {
    expect(renderedPage.page).toBe(page);
    expect(renderedPage.chapterHeading).toBe(
      `Chapter ${page + 1}: ${runtime.chapters[page]}`,
    );
    expect(renderedPage.nextObjective).toBeNull();
    expect(renderedPage.objectiveText).toBeNull();

    const expectedBlocks = markup.blocks.filter((block) => {
      if (block.conditionalAncestors.length > 0) return false;
      return (
        corpus.data.storySemantics.milestones.find(
          (milestone) => milestone.key === block.key,
        )?.page === page
      );
    });
    expect(
      renderedPage.visibleBlocks.map(({ sourceOrder, key, occurrence }) => ({
        sourceOrder,
        key,
        occurrence,
      })),
    ).toEqual(
      expectedBlocks.map(({ sourceOrder, key, occurrence }) => ({
        sourceOrder,
        key,
        occurrence,
      })),
    );

    for (const block of renderedPage.visibleBlocks) {
      const source = markup.blocks.find(
        ({ sourceOrder }) => sourceOrder === block.sourceOrder,
      );
      expect(source).toBeDefined();
      if (!source)
        throw new Error(`Missing source block ${block.sourceOrder}.`);
      expect(block.mineObjectPreviews).toHaveLength(
        source.embeddedMineObjectAttributes.length,
      );
      expect(
        block.mineObjectPreviews.every(
          ({ width, height }) => width === 256 && height === 224,
        ),
      ).toBe(true);
    }
  }

  expect(
    runtime.allUnlocked[8]?.visibleBlocks
      .filter(({ key }) => key === "mineUniverse")
      .map(({ occurrence }) => occurrence),
  ).toEqual([1, 2]);
});

it("records Story computed styles at the canonical 1440×900 light viewport", () => {
  const page = runtime.allUnlocked[0];
  expect(page).toBeDefined();
  expect(page?.computed.article.properties).toMatchObject({
    padding: "16px",
    zIndex: "-1",
  });
  expect(page?.computed.scroller.properties).toMatchObject({
    height: "558px",
    overflowY: "scroll",
    overscrollBehaviorY: "contain",
  });
  expect(page?.computed.milestone.properties).toMatchObject({
    padding: "16px 0px",
    borderBottom: "1px solid rgba(0, 0, 0, 0.4)",
  });
  expect(page?.computed.chapterControl.properties).toMatchObject({
    display: "flex",
    height: "64px",
    alignItems: "center",
  });
  expect(page?.computed.chapterHeading.properties["fontSize"]).toBe("32px");
  expect(page?.computed.quoteText?.properties).toMatchObject({
    color: "rgb(64, 64, 64)",
    fontSize: "48px",
    fontStyle: "italic",
    marginLeft: "32px",
  });
});
