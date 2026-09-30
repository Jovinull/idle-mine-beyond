import { describe, expect, it } from "vitest";
import mineContent from "@idle-mine-beyond/content/remix-mine-content";
import upgradePresentation from "@idle-mine-beyond/content/remix-upgrade-presentation";
import { createRemixFormatters } from "@idle-mine-beyond/formatting";
import storyMarkup from "../../../../../tests/fixtures/parity/remix-story-markup.json";
import {
  fixedLevels,
  fixedObjects,
  isFixed,
  levelFromNumber,
  objectAt,
  objectNumber,
} from "./objects";
import {
  chapterForLevel,
  chapterHtml,
  chapterMilestones,
  chapters,
  milestones,
  objectiveText,
  pageFromSlug,
  storyQuotes,
} from "./story";
import {
  cumulativePrice,
  sampleLevels,
  upgradeCount,
  upgradeGroups,
  upgradeRow,
} from "./upgrades";

const standard = createRemixFormatters()[0]!;

type Sample = {
  level: number;
  levelDisplay: string;
  effectDisplay: string;
  priceDisplay: string;
};
const presentation = upgradePresentation as unknown as {
  groups: Record<
    string,
    Record<string, { stochasticEffect: boolean; samples: Sample[] }>
  >;
};

describe("site object data", () => {
  it("lists every hand-made object once, in level order", () => {
    const expected = [
      ...mineContent.base.map((entry) => entry.id),
      ...mineContent.special.map((entry) => entry.id),
    ].sort((a, b) => a - b);
    expect(fixedLevels).toEqual(expected);
    expect(new Set(fixedLevels).size).toBe(150);
    expect(fixedObjects.map((object) => object.name)).toEqual(
      expected.map((level) => objectAt(level).name),
    );
  });

  it("uses the game's one-based object numbers", () => {
    expect(objectNumber(0)).toBe(1);
    expect(levelFromNumber(215)).toBe(214);
    expect(objectAt(levelFromNumber(215)).name).toBe("THE UNIVERSE");
    expect(isFixed(72)).toBe(false);
    expect(isFixed(89)).toBe(true);
  });

  it("places objects in the Story chapter where they are reached", () => {
    expect(chapterForLevel(0)).toBe(0);
    expect(chapterForLevel(4)).toBe(0);
    expect(chapterForLevel(5)).toBe(1);
    expect(chapterForLevel(71)).toBe(4);
    expect(chapterForLevel(80)).toBe(4);
    expect(chapterForLevel(90)).toBe(5);
    expect(chapterForLevel(214)).toBe(8);
    expect(chapterForLevel(5000)).toBe(8);
  });
});

describe("site Story data", () => {
  it("reads every captured mine-object preview with its caption", () => {
    // A parent block's attributes also list those of its nested blocks.
    const previews = storyMarkup.blocks
      .filter((block) => block.conditionalAncestors.length === 0)
      .reduce(
        (sum, block) => sum + block.embeddedMineObjectAttributes.length,
        0,
      );
    expect(previews).toBe(48);
    expect(storyQuotes).toHaveLength(previews);
    for (const quote of storyQuotes) {
      expect(quote.caption.length).toBeGreaterThan(0);
      expect(chapters[quote.page]).toBeDefined();
    }
    expect(storyQuotes.find((quote) => quote.level === 0)?.caption).toBe(
      "Just some ordinary Mud",
    );
  });

  it("renders each chapter with all of its milestones and no Vue syntax", () => {
    chapters.forEach((_, page) => {
      const html = chapterHtml(page, standard);
      for (const milestone of chapterMilestones(page)) {
        expect(html).toContain(`data-story-milestone-key="${milestone.key}"`);
      }
      expect(html).not.toMatch(/v-if=|@click=|\{\{/);
      expect(html).not.toContain("chapter-control");
    });
  });

  it("builds objectives the way the game shows the next goal", () => {
    expect(milestones).toHaveLength(61);
    for (const milestone of milestones) {
      const text = objectiveText(milestone, standard);
      if (milestone.key === "gameStart") continue;
      expect(text.length).toBeGreaterThan(0);
      if (
        milestone.objective.kind === "mineLevelTemplate" &&
        milestone.condition.kind === "highestMineObjectLevelAtLeast"
      ) {
        expect(text).toContain(String(milestone.condition.level));
      }
    }
    expect(pageFromSlug("chapter-9")).toBe(8);
    expect(pageFromSlug("chapter-10")).toBeUndefined();
  });
});

describe("site upgrade data", () => {
  it("covers all 29 upgrades", () => {
    expect(upgradeCount).toBe(29);
    expect(upgradeGroups.map((group) => group.upgrades.length)).toEqual([
      8, 7, 7, 7,
    ]);
  });

  it("matches the shop text captured from Remix at every sampled level", () => {
    let compared = 0;
    for (const group of upgradeGroups) {
      for (const upgrade of group.upgrades) {
        const entry = presentation.groups[group.id]![upgrade.key]!;
        if (entry.stochasticEffect) continue;
        for (const sample of entry.samples) {
          const row = upgradeRow(upgrade, sample.level, standard);
          expect(
            {
              levelDisplay: row.levelDisplay,
              effectDisplay: row.effectDisplay,
              priceDisplay: row.priceDisplay,
            },
            `${group.id}.${upgrade.key} at level ${sample.level}`,
          ).toEqual({
            levelDisplay: sample.levelDisplay,
            effectDisplay: sample.effectDisplay,
            priceDisplay: sample.priceDisplay,
          });
          compared += 1;
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  it("sums the price of every level below the target", () => {
    const blacksmith = upgradeGroups[0]!.upgrades[0]!;
    expect(cumulativePrice(blacksmith, 0).toNumber()).toBe(0);
    expect(cumulativePrice(blacksmith, 3).toNumber()).toBeCloseTo(
      30 + 111 + 193.2,
      6,
    );
    expect(sampleLevels(upgradeGroups[0]!.upgrades[2]!)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });
});
