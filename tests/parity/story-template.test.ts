import { readFile } from "node:fs/promises";
import {
  Decimal,
  getNextRemixStoryObjectiveText,
  getRemixStoryDisplayedMilestones,
  getRemixStoryMaximumPage,
  type DecimalSource,
  type RemixStoryConditionState,
} from "../../packages/core/src/index.js";
import {
  createInitialFormatters,
  formatThousands,
} from "../../packages/formatting/src/index.js";
import { expect, it } from "vitest";
import { extractStoryArticle } from "../../scripts/extract-story-markup.mjs";
import {
  renderRemixStoryTemplate,
  type RemixStoryTemplateContent,
} from "../../apps/web/src/lib/remix-story-template.js";

const template = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as RemixStoryTemplateContent;
const milestones = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-milestones.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  milestones: Parameters<typeof getRemixStoryDisplayedMilestones>[0];
};
const runtime = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
    "utf8",
  ),
) as {
  freshGame: { page: number; chapterHeading: string; objectiveText: string };
  allUnlocked: {
    page: number;
    chapterHeading: string;
    visibleBlocks: { key: string }[];
  }[];
};

it("extracts identical Story markup and offsets from LF and CRLF checkouts", () => {
  const fromLf = extractStoryArticle(template.template);
  const fromCrLf = extractStoryArticle(
    template.template.replaceAll("\n", "\r\n"),
  );

  expect(fromCrLf).toEqual(fromLf);
  for (const block of fromCrLf.blocks) {
    const sourceSlice = fromCrLf.template.slice(
      block.templateOffsets.start,
      block.templateOffsets.end,
    );
    expect(sourceSlice).toMatch(/^<div\b/);
  }
});

const standard = createInitialFormatters()[0]!;
const freshState: RemixStoryConditionState = {
  highestMineObjectLevel: 0,
  highestMoney: 0,
  maxPlanetCoins: 0,
  moneyUpgradeLevels: {},
  wisdomUpgradeLevels: {},
};
const unlockedState: RemixStoryConditionState = {
  highestMineObjectLevel: 215,
  highestMoney: "5e13",
  maxPlanetCoins: "1",
  moneyUpgradeLevels: { blacksmith: 1, gemWaster: 1 },
  wisdomUpgradeLevels: { firstUpgrade: 1 },
};

function render(state: RemixStoryConditionState, page: number): string {
  const formatThousandsValue = (value: DecimalSource, limit?: DecimalSource) =>
    formatThousands(value, standard, limit ?? "1e12");
  const objectiveText = getNextRemixStoryObjectiveText(
    milestones.milestones,
    state,
    {
      formatThousands: formatThousandsValue,
      formatSelectedNotation: (value) => standard.format(value),
    },
  );

  return renderRemixStoryTemplate(template, {
    page,
    maximumPage: getRemixStoryMaximumPage(milestones.milestones, state),
    displayedKeys: new Set(
      getRemixStoryDisplayedMilestones(milestones.milestones, state, page),
    ),
    objectiveText,
    longGoal1: standard.format(new Decimal(2).pow(1024)),
    longGoal2: standard.format(new Decimal(2).pow(4096)),
    formatThousands: formatThousandsValue,
    formatSelectedNotation: (value) => standard.format(value),
  });
}

it("renders the captured fresh chapter, objective, controls, and no Vue directives", () => {
  const html = render(freshState, runtime.freshGame.page);

  expect(html).toContain(`<h3>${runtime.freshGame.chapterHeading}</h3>`);
  expect(html).toContain(runtime.freshGame.objectiveText.split("\n")[1]);
  expect(html).toContain('data-story-milestone-key="gameStart"');
  expect(html).toContain('data-story-action="increaseStoryPage"');
  expect(html).toContain('data-story-action="decreaseStoryPage"');
  expect(html).not.toContain('class="left"');
  expect(html).not.toMatch(/\bv-if=|\bv-else=|@click=|\{\{/);
});

it("preserves all unlocked Story pages, duplicate blocks, and nested Colossia milestones", () => {
  for (const page of runtime.allUnlocked) {
    const html = render(unlockedState, page.page);
    expect(html).toContain(
      `<h3>${page.chapterHeading.replaceAll("'", "&#39;")}</h3>`,
    );
    const renderedKeys = [
      ...html.matchAll(/data-story-milestone-key="([^"]+)"/g),
    ].map(([, key]) => key);
    const expectedKeys = page.visibleBlocks.map(({ key }) => key);
    if (page.page === 6)
      expectedKeys.splice(3, 0, "giagantia", "garagantula", "planetOmega");
    expect(renderedKeys).toEqual(expectedKeys);
    expect(html).not.toMatch(/\bv-if=|\bv-else=|@click=|\{\{/);
    if (page.page === 8) {
      expect(renderedKeys.filter((key) => key === "mineUniverse")).toHaveLength(
        2,
      );
    }
  }
});

it("escapes dynamic Story strings before inserting them into source markup", () => {
  const html = renderRemixStoryTemplate(template, {
    page: 0,
    maximumPage: 3,
    displayedKeys: new Set(["gameStart"]),
    objectiveText: "<img src=x onerror=alert(1)>",
    longGoal1: "<unsafe>",
    longGoal2: "&unsafe",
    formatThousands: (value) => String(value),
    formatSelectedNotation: (value) => String(value),
  });

  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  expect(html).not.toContain("<img src=x onerror=alert(1)>");
});
