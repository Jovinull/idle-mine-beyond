import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

type StoryMarkupFixture = {
  source: { commit: string; license: string };
  template: string;
  blocks: {
    sourceOrder: number;
    key: string;
    occurrence: number;
    conditionalAncestors: string[];
    templateOffsets: { start: number; end: number };
    embeddedMineObjectAttributes: string[];
    imageSources: string[];
  }[];
};

const markup = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-markup.json", import.meta.url),
    "utf8",
  ),
) as StoryMarkupFixture;
const milestoneCatalog = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-milestones.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { source: { commit: string }; milestones: { key: string }[] };

it("captures all ordered Remix Story template conditions and duplicate blocks", () => {
  expect(markup.source.commit).toBe("0e0f4bf5a9c66e5603cda2ce4bd54213023dae21");
  expect(markup.source.commit).toBe(milestoneCatalog.source.commit);
  expect(markup.source.license).toBe("MIT");

  const orderedUniqueKeys = [
    ...new Set(markup.blocks.map((block) => block.key)),
  ];
  expect(orderedUniqueKeys).toEqual(
    milestoneCatalog.milestones.map((milestone) => milestone.key),
  );
  expect(markup.blocks).toHaveLength(milestoneCatalog.milestones.length + 1);
  expect(
    markup.blocks
      .filter((block) => block.key === "mineUniverse")
      .map((block) => block.occurrence),
  ).toEqual([1, 2]);

  for (const [sourceOrder, block] of markup.blocks.entries()) {
    expect(block.sourceOrder).toBe(sourceOrder);
    const blockMarkup = markup.template.slice(
      block.templateOffsets.start,
      block.templateOffsets.end,
    );
    expect(
      blockMarkup.startsWith(`<div v-if="storyDisplayed('${block.key}')">`),
    ).toBe(true);
    expect(blockMarkup.endsWith("</div>")).toBe(true);
    expect(
      [...blockMarkup.matchAll(/<mine-object\b([^>]*)>/gi)].map(([, attrs]) =>
        (attrs ?? "").trim(),
      ),
    ).toEqual(block.embeddedMineObjectAttributes);
    expect(
      [
        ...blockMarkup.matchAll(/<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi),
      ].map(([, , src]) => src),
    ).toEqual(block.imageSources);
  }

  expect(markup.template).toContain(
    "{{numberFormatter.format(story.longGoal1)}}",
  );
  expect(markup.template).toContain(
    "{{numberFormatter.format(story.longGoal2)}}",
  );
  expect(markup.template).toContain('@click="payUSDebt()"');
  expect(
    markup.blocks
      .filter((block) => block.key === "giagantia")
      .every((block) => block.conditionalAncestors.includes("colossia")),
  ).toBe(true);
});
