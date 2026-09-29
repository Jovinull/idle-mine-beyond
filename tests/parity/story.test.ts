import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createRemixFormatters,
  formatThousands,
} from "../../packages/formatting/src/index.js";
import {
  attemptRemixPayUSDebt,
  decreaseRemixStoryPage,
  formatRemixStoryObjectiveText,
  getRemixPayUSDebtButtonLabel,
  getNextRemixStoryMilestone,
  getNextRemixStoryObjectiveText,
  getRemixStoryDisplayedMilestones,
  getRemixStoryMaximumPage,
  increaseRemixStoryPage,
  isRemixStoryMilestoneUnlocked,
  refreshRemixStoryNotifications,
  transitionRemixStoryTab,
  type RemixStoryConditionState,
  type RemixStoryMilestone,
  type DecimalSource,
} from "../../packages/core/src/index.js";

type StoryInputs = {
  highestMineObjectLevel: number;
  highestMoney: string;
  maxPlanetCoins: string;
  blacksmithLevel: number;
  gemWasterLevel: number;
  boughtWisdomUpgrades: number;
};

type PartialStoryInputs = Partial<StoryInputs>;

type CapturedStoryScenario = {
  name: string;
  input: StoryInputs & {
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
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    storySemantics: {
      sourcePaths: string[];
      chapters: string[];
      milestones: {
        index: number;
        key: string;
        condition: string;
        objective:
          | { kind: "literal"; value: string }
          | { kind: "function"; source: string; initialOutput: string };
        page: number;
      }[];
      initial: {
        page: number;
        highestUnlocked: number;
        notifications: number;
        nextObjective: string | null;
        maxPage: number;
        visibleMilestones: string[];
      };
      conditionBoundaries: {
        condition: string;
        key: string;
        samples: {
          name: string;
          input: PartialStoryInputs;
          unlocked: boolean;
        }[];
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
      notificationScenarios: CapturedStoryScenario[];
      notificationSequence: {
        name: string;
        input: StoryInputs & { page: number };
        before: { highestUnlocked: number; notifications: number };
        firstMudUnlocked: boolean;
        firstMudDisplayed: boolean;
        after: { highestUnlocked: number; notifications: number };
      }[];
    };
    payUSDebtSemantics: {
      cost: string;
      buttonLabel: string;
      scenarios: {
        name: string;
        money: string;
        events: {
          type: "alert" | "logMessage";
          message: string;
          color?: string;
        }[];
        moneyBefore: {
          decimal: string;
          mantissa: number | string;
          exponent: number | string;
        };
        moneyAfter: {
          decimal: string;
          mantissa: number | string;
          exponent: number | string;
        };
      }[];
    };
    storyTabSemantics: {
      sourcePaths: string[];
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
        afterTransition: {
          tab: string;
          scrollY: number;
          notifications: number;
          scrollTop: number;
          numberFormatSelectedIndex: number;
          scheduledEffects: {
            delayMs: number;
            type: string;
            scrollY?: number;
            selectedIndex?: number;
          }[];
        };
        afterTimers: {
          tab: string;
          scrollY: number;
          notifications: number;
          scrollTop: number;
          numberFormatSelectedIndex: number;
        };
      }[];
    };
  };
};
const storyContent = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-milestones.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  source: { commit: string; files: string[] };
  chapters: string[];
  milestones: (RemixStoryMilestone & { sourceCondition: string })[];
};

function conditionState(input: PartialStoryInputs): RemixStoryConditionState {
  return {
    highestMineObjectLevel: input.highestMineObjectLevel ?? 0,
    highestMoney: input.highestMoney ?? "0",
    maxPlanetCoins: input.maxPlanetCoins ?? "0",
    moneyUpgradeLevels: {
      blacksmith: input.blacksmithLevel ?? 0,
      gemWaster: input.gemWasterLevel ?? 0,
    },
    wisdomUpgradeLevels: {
      fixtureProbe: input.boughtWisdomUpgrades ?? 0,
    },
  };
}

it("extracts the pinned ordered story milestone and chapter catalog", () => {
  const story = corpus.data.storySemantics;
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(story.sourcePaths).toEqual([
    "Scripts/Define/game.js",
    "Scripts/Define/functions.js",
    "index.html",
  ]);
  expect(story.chapters).toHaveLength(9);
  expect(story.milestones).toHaveLength(61);
  expect(storyContent.source.commit).toBe(corpus.metadata.sourceCommit);
  expect(storyContent.chapters).toEqual(story.chapters);
  expect(storyContent.milestones).toHaveLength(story.milestones.length);

  expect(
    storyContent.milestones.map(({ index, key, page, sourceCondition }) => ({
      index,
      key,
      page,
      condition: sourceCondition,
    })),
  ).toEqual(
    story.milestones.map(({ index, key, page, condition }) => ({
      index,
      key,
      page,
      condition,
    })),
  );
  for (const milestone of story.milestones) {
    const content = storyContent.milestones[milestone.index]!;
    if (milestone.objective.kind === "literal") {
      expect(content.objective).toEqual({
        kind: "literal",
        sourceKind: "literal",
        text: milestone.objective.value,
      });
    } else if (milestone.objective.source.includes("highestMineObjectLevel")) {
      expect(content.objective.kind).toBe("mineLevelTemplate");
    } else if (
      milestone.objective.source.includes("formatThousands") ||
      milestone.objective.source.includes("numberFormatter.format")
    ) {
      expect(content.objective.kind).toBe("formattedNumberTemplate");
    } else {
      expect(content.objective).toEqual({
        kind: "literal",
        sourceKind: "function",
        text: milestone.objective.initialOutput,
      });
    }
  }
});

it("matches every captured story condition boundary", () => {
  const story = corpus.data.storySemantics;
  expect(story.conditionBoundaries).toHaveLength(61);

  for (const boundary of story.conditionBoundaries) {
    const milestone = storyContent.milestones.find(
      ({ key }) => key === boundary.key,
    );
    expect(milestone, boundary.condition).toBeDefined();
    expect(milestone?.sourceCondition, boundary.condition).toBe(
      boundary.condition,
    );

    for (const sample of boundary.samples) {
      expect(
        isRemixStoryMilestoneUnlocked(milestone!, conditionState(sample.input)),
        `${boundary.condition} ${sample.name}`,
      ).toBe(sample.unlocked);
    }
  }
});

it("matches source milestone visibility, page navigation, and notifications", () => {
  const story = corpus.data.storySemantics;
  const standard = createRemixFormatters().find(
    (formatter) => formatter.name === "Standard",
  );
  expect(standard).toBeDefined();
  const standardObjectiveFormatters = {
    formatThousands: (value: DecimalSource) =>
      formatThousands(value, standard!),
    formatSelectedNotation: (value: DecimalSource) =>
      standard!.format(Number(value)),
  };

  for (const scenario of story.notificationScenarios) {
    const state = conditionState(scenario.input);
    for (const expected of scenario.conditionResults) {
      const milestone = storyContent.milestones.find(
        ({ key }) => key === expected.key,
      );
      expect(milestone, `${scenario.name}: ${expected.key}`).toBeDefined();
      expect(
        isRemixStoryMilestoneUnlocked(milestone!, state),
        `${scenario.name}: ${expected.key}`,
      ).toBe(expected.unlocked);
    }

    expect(getRemixStoryMaximumPage(storyContent.milestones, state)).toBe(
      scenario.maxPage,
    );
    for (const [rawPage, expectedKeys] of Object.entries(
      scenario.visibleMilestonesByPage,
    )) {
      expect(
        getRemixStoryDisplayedMilestones(
          storyContent.milestones,
          state,
          Number(rawPage),
        ),
        `${scenario.name}: page ${rawPage}`,
      ).toEqual(expectedKeys);
    }

    const expectedNextKey =
      scenario.conditionResults.find(({ unlocked }) => !unlocked)?.key ?? null;
    expect(
      getNextRemixStoryMilestone(storyContent.milestones, state)?.key ?? null,
      `${scenario.name}: next milestone`,
    ).toBe(expectedNextKey);
    expect(
      getNextRemixStoryObjectiveText(
        storyContent.milestones,
        state,
        standardObjectiveFormatters,
      ),
      `${scenario.name}: next objective text`,
    ).toBe(scenario.nextObjective);
    expect(
      increaseRemixStoryPage(scenario.pageNavigation.page, scenario.maxPage),
      `${scenario.name}: increase page`,
    ).toBe(scenario.pageNavigation.afterIncrease);
    expect(
      decreaseRemixStoryPage(scenario.pageNavigation.page),
      `${scenario.name}: decrease page`,
    ).toBe(scenario.pageNavigation.afterDecrease);

    expect(
      refreshRemixStoryNotifications(
        scenario.before,
        storyContent.milestones,
        state,
      ),
      `${scenario.name}: refresh notifications`,
    ).toEqual(scenario.after);
  }
});

it("starts with the source first chapter, game-start milestone, and first objective", () => {
  const story = corpus.data.storySemantics;
  const initialState = conditionState({
    highestMineObjectLevel: 0,
    highestMoney: "0",
    maxPlanetCoins: "0",
    blacksmithLevel: 0,
    gemWasterLevel: 0,
    boughtWisdomUpgrades: 0,
  });

  expect(story.initial).toMatchObject({
    page: 0,
    highestUnlocked: -1,
    notifications: 0,
    nextObjective: "Mine your first piece of Mud",
    maxPage: 0,
    visibleMilestones: ["gameStart"],
  });
  expect(getRemixStoryMaximumPage(storyContent.milestones, initialState)).toBe(
    story.initial.maxPage,
  );
  expect(
    getRemixStoryDisplayedMilestones(
      storyContent.milestones,
      initialState,
      story.initial.page,
    ),
  ).toEqual(story.initial.visibleMilestones);
  expect(
    getNextRemixStoryMilestone(storyContent.milestones, initialState)?.key,
  ).toBe("firstMud");
  const standard = createRemixFormatters().find(
    (formatter) => formatter.name === "Standard",
  );
  expect(standard).toBeDefined();
  expect(
    getNextRemixStoryObjectiveText(storyContent.milestones, initialState, {
      formatThousands: (value: DecimalSource) =>
        formatThousands(value, standard!),
      formatSelectedNotation: (value: DecimalSource) =>
        standard!.format(Number(value)),
    }),
  ).toBe(story.initial.nextObjective);
});

it("preserves delayed visibility after a later condition advances the notification high-water mark", () => {
  const story = corpus.data.storySemantics;
  const firstMud = storyContent.milestones.find(
    ({ key }) => key === "firstMud",
  );
  expect(firstMud).toBeDefined();

  for (const stage of story.notificationSequence) {
    const state = conditionState(stage.input);
    expect(isRemixStoryMilestoneUnlocked(firstMud!, state), stage.name).toBe(
      stage.firstMudUnlocked,
    );
    expect(
      getRemixStoryDisplayedMilestones(
        storyContent.milestones,
        state,
        stage.input.page,
      ).includes("firstMud"),
      `${stage.name}: displayed`,
    ).toBe(stage.firstMudDisplayed);
    expect(
      refreshRemixStoryNotifications(
        stage.before,
        storyContent.milestones,
        state,
      ),
      `${stage.name}: progress`,
    ).toEqual(stage.after);
  }

  expect(story.notificationSequence[0]?.after).toEqual({
    highestUnlocked: 28,
    notifications: 2,
  });
  expect(story.notificationSequence[1]).toMatchObject({
    firstMudUnlocked: true,
    firstMudDisplayed: true,
    before: { highestUnlocked: 28, notifications: 2 },
    after: { highestUnlocked: 28, notifications: 2 },
  });
});

it("matches the story debt button label and non-purchasing alert interaction", () => {
  const debt = corpus.data.payUSDebtSemantics;
  const standard = createRemixFormatters().find(
    (formatter) => formatter.name === "Standard",
  );
  expect(standard).toBeDefined();
  expect(debt.cost).toBe("22000000000000");
  expect(
    getRemixPayUSDebtButtonLabel((value, limit) =>
      formatThousands(value, standard!, limit),
    ),
  ).toBe(`PAY ($ ${debt.buttonLabel})`);

  for (const scenario of debt.scenarios) {
    expect(attemptRemixPayUSDebt(scenario.money), scenario.name).toEqual(
      scenario.events,
    );
    expect(scenario.moneyAfter, `${scenario.name}: no charge`).toEqual(
      scenario.moneyBefore,
    );
  }
});

it("matches story tab notification, scroll, and delayed platform effects", () => {
  const storyTabs = corpus.data.storyTabSemantics;
  expect(storyTabs.sourcePaths).toEqual(["Scripts/Define/functions.js"]);

  for (const scenario of storyTabs.scenarios) {
    const { input } = scenario;
    const transition = transitionRemixStoryTab({
      currentTab: input.currentTab,
      targetTab: input.targetTab,
      currentScrollTop: input.scrollTop,
      scrollY: input.savedScrollY,
      notifications: input.notifications,
    });

    expect(transition.state, scenario.name).toEqual({
      tab: scenario.afterTransition.tab,
      scrollY: scenario.afterTransition.scrollY,
      notifications: scenario.afterTransition.notifications,
    });
    expect(
      transition.effects.map((effect) =>
        effect.type === "restore-story-scroll"
          ? effect
          : { type: effect.type, delayMs: effect.delayMs },
      ),
      `${scenario.name}: scheduled effects`,
    ).toEqual(
      scenario.afterTransition.scheduledEffects.map((effect) =>
        effect.type === "restore-story-scroll"
          ? {
              type: effect.type,
              delayMs: effect.delayMs,
              scrollY: effect.scrollY,
            }
          : { type: effect.type, delayMs: effect.delayMs },
      ),
    );

    let scrollTop = input.scrollTop;
    let numberFormatSelectedIndex = -1;
    for (const effect of transition.effects) {
      if (effect.type === "restore-story-scroll") {
        scrollTop = effect.scrollY;
      } else {
        numberFormatSelectedIndex = input.selectedNumberFormatterIndex;
      }
    }
    expect(
      {
        tab: transition.state.tab,
        scrollY: transition.state.scrollY,
        notifications: transition.state.notifications,
        scrollTop,
        numberFormatSelectedIndex,
      },
      `${scenario.name}: after scheduled effects`,
    ).toEqual(scenario.afterTimers);
  }
});

it("matches dynamic story objective text at mine levels and every notation", () => {
  const story = corpus.data.storySemantics;
  const formatters = createRemixFormatters();
  expect(story.objectiveSamples.functionObjectiveCount).toBe(38);

  for (const sample of story.objectiveSamples.mineLevels) {
    const standard = formatters.find(({ name }) => name === "Standard");
    expect(standard).toBeDefined();
    for (const expected of sample.values) {
      const milestone = storyContent.milestones.find(
        ({ key }) => key === expected.key,
      );
      expect(milestone, expected.key).toBeDefined();
      expect(
        formatRemixStoryObjectiveText(
          milestone!.objective,
          conditionState({
            highestMineObjectLevel: sample.highestMineObjectLevel,
          }),
          {
            formatThousands: (value: DecimalSource) =>
              formatThousands(value, standard!),
            formatSelectedNotation: (value: DecimalSource) =>
              standard!.format(Number(value)),
          },
        ),
        `${expected.key} at mine level ${sample.highestMineObjectLevel}`,
      ).toBe(expected.output);
    }
  }

  for (const sample of story.objectiveSamples.notationFormats) {
    const formatter = formatters.find(({ name }) => name === sample.notation);
    expect(formatter, sample.notation).toBeDefined();
    for (const expected of sample.values) {
      const milestone = storyContent.milestones.find(
        ({ key }) => key === expected.key,
      );
      expect(milestone, expected.key).toBeDefined();
      expect(
        formatRemixStoryObjectiveText(
          milestone!.objective,
          conditionState({ highestMineObjectLevel: 0 }),
          {
            formatThousands: (value: DecimalSource) =>
              formatThousands(value, formatter!),
            formatSelectedNotation: (value: DecimalSource) =>
              formatter!.format(Number(value)),
          },
        ),
        `${expected.key} with ${sample.notation}`,
      ).toBe(expected.output);
    }
  }
});
