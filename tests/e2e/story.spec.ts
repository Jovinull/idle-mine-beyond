import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("matches captured Remix story conditions and notification transitions in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/story");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      storySemantics: {
        chapters: string[];
        milestones: {
          index: number;
          key: string;
          condition: string;
          page: number;
          objective: unknown;
        }[];
        conditionBoundaries: {
          condition: string;
          key: string;
          samples: { name: string; input: object; unlocked: boolean }[];
        }[];
        objectiveSamples: {
          functionObjectiveCount: number;
          mineLevels: {
            highestMineObjectLevel: number;
            values: { key: string; output: string }[];
          }[];
          notationFormats: {
            notation: string;
            values: { key: string; output: string }[];
          }[];
        };
        notificationScenarios: {
          name: string;
          input: object & {
            page: number;
            highestUnlocked: number;
            notifications: number;
          };
          conditionResults: { key: string; unlocked: boolean }[];
          maxPage: number;
          pageNavigation: {
            page: number;
            afterIncrease: number;
            afterDecrease: number;
          };
          visibleMilestonesByPage: Record<string, string[]>;
          nextObjective: string | null;
          before: { highestUnlocked: number; notifications: number };
          after: { highestUnlocked: number; notifications: number };
        }[];
        notificationSequence: {
          name: string;
          input: object & { page: number };
          before: { highestUnlocked: number; notifications: number };
          firstMudUnlocked: boolean;
          firstMudDisplayed: boolean;
          after: { highestUnlocked: number; notifications: number };
        }[];
      };
      payUSDebtSemantics: {
        buttonLabel: string;
        scenarios: {
          name: string;
          money: string;
          events: { type: string; message: string; color?: string }[];
        }[];
      };
      storyTabSemantics: {
        scenarios: {
          name: string;
          input: {
            currentTab: string;
            targetTab: string;
            scrollTop: number;
            savedScrollY: number;
            notifications: number;
            selectedNumberFormatterIndex: number;
          };
          afterTransition: unknown;
          afterTimers: unknown;
        }[];
      };
    };
  };
  const content = JSON.parse(
    await readFile(
      new URL(
        "../../packages/content/src/remix-story-milestones.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    milestones: {
      index: number;
      key: string;
      page: number;
      condition: unknown;
      objective: unknown;
    }[];
  };
  const story = corpus.data.storySemantics;
  const observed = await page.evaluate(
    (input) => {
      const probe = (
        window as Window & {
          __idleMineStoryProbe?: (value: typeof input) => unknown;
        }
      ).__idleMineStoryProbe;
      if (!probe) throw new Error("Story browser probe did not initialize.");
      return probe(input);
    },
    {
      chapterCount: story.chapters.length,
      milestones: content.milestones,
      objectiveSamples: story.objectiveSamples,
      conditionBoundaries: story.conditionBoundaries,
      notificationScenarios: story.notificationScenarios,
      notificationSequence: story.notificationSequence,
      payUSDebtSemantics: corpus.data.payUSDebtSemantics,
      storyTabSemantics: corpus.data.storyTabSemantics,
    },
  );

  expect(
    (observed as { conditionBoundaries: unknown }).conditionBoundaries,
  ).toEqual(
    story.conditionBoundaries.map((boundary) => ({
      condition: boundary.condition,
      samples: boundary.samples.map((sample) => ({
        name: sample.name,
        unlocked: sample.unlocked,
      })),
    })),
  );
  expect(
    (observed as { notificationScenarios: unknown }).notificationScenarios,
  ).toEqual(
    story.notificationScenarios.map((scenario) => {
      const next = scenario.conditionResults.findIndex(
        ({ unlocked }) => !unlocked,
      );
      return {
        name: scenario.name,
        conditionResults: scenario.conditionResults,
        maxPage: scenario.maxPage,
        pageNavigation: scenario.pageNavigation,
        visibleMilestonesByPage: scenario.visibleMilestonesByPage,
        nextMilestone:
          next < 0
            ? null
            : {
                index: next,
                key: scenario.conditionResults[next]!.key,
              },
        nextObjective: scenario.nextObjective,
        after: scenario.after,
      };
    }),
  );
  expect((observed as { objectiveSamples: unknown }).objectiveSamples).toEqual({
    mineLevels: story.objectiveSamples.mineLevels.map((sample) => ({
      highestMineObjectLevel: sample.highestMineObjectLevel,
      values: sample.values,
    })),
    notationFormats: story.objectiveSamples.notationFormats.map((sample) => ({
      notation: sample.notation,
      values: sample.values,
    })),
  });
  expect(
    (observed as { notificationSequence: unknown }).notificationSequence,
  ).toEqual(
    story.notificationSequence.map((stage) => ({
      name: stage.name,
      firstMudUnlocked: stage.firstMudUnlocked,
      firstMudDisplayed: stage.firstMudDisplayed,
      after: stage.after,
    })),
  );
  expect((observed as { payUSDebt: unknown }).payUSDebt).toEqual({
    buttonLabel: `PAY ($ ${corpus.data.payUSDebtSemantics.buttonLabel})`,
    scenarios: corpus.data.payUSDebtSemantics.scenarios.map((scenario) => ({
      name: scenario.name,
      effects: scenario.events,
    })),
  });
  expect((observed as { storyTabs: unknown }).storyTabs).toEqual(
    corpus.data.storyTabSemantics.scenarios.map((scenario) => ({
      name: scenario.name,
      afterTransition: scenario.afterTransition,
      afterTimers: scenario.afterTimers,
    })),
  );
});
