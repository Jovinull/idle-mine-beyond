import {
  attemptRemixPayUSDebt,
  decreaseRemixStoryPage,
  formatRemixStoryObjectiveText,
  getNextRemixStoryMilestone,
  getNextRemixStoryObjectiveText,
  getRemixStoryDisplayedMilestones,
  getRemixStoryMaximumPage,
  getRemixPayUSDebtButtonLabel,
  increaseRemixStoryPage,
  isRemixStoryMilestoneUnlocked,
  refreshRemixStoryNotifications,
  transitionRemixStoryTab,
  type RemixStoryConditionState,
  type RemixStoryMilestone,
} from "@idle-mine-beyond/core";
import {
  createRemixFormatters,
  formatThousands,
} from "@idle-mine-beyond/formatting";

type CapturedInput = {
  highestMineObjectLevel?: number;
  highestMoney?: string;
  maxPlanetCoins?: string;
  blacksmithLevel?: number;
  gemWasterLevel?: number;
  boughtWisdomUpgrades?: number;
  page?: number;
  highestUnlocked?: number;
  notifications?: number;
};

type ProbeInput = {
  chapterCount: number;
  milestones: RemixStoryMilestone[];
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
  conditionBoundaries: {
    condition: string;
    key: string;
    samples: {
      name: string;
      input: CapturedInput;
      unlocked: boolean;
    }[];
  }[];
  notificationScenarios: {
    name: string;
    input: CapturedInput & {
      page: number;
      highestUnlocked: number;
      notifications: number;
    };
    before: { highestUnlocked: number; notifications: number };
    nextObjective: string | null;
  }[];
  notificationSequence: {
    name: string;
    input: CapturedInput & { page: number };
    before: { highestUnlocked: number; notifications: number };
    firstMudUnlocked: boolean;
    firstMudDisplayed: boolean;
  }[];
  payUSDebtSemantics: {
    buttonLabel: string;
    scenarios: { name: string; money: string }[];
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
    }[];
  };
};

function conditionState(input: CapturedInput): RemixStoryConditionState {
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

function evaluate(input: ProbeInput) {
  const formatters = createRemixFormatters();
  const standard = formatters.find(({ name }) => name === "Standard");
  if (!standard) throw new Error("Standard number formatter is missing.");
  const renderObjective = (
    key: string,
    highestMineObjectLevel: number,
    formatter: (typeof formatters)[number],
  ) => {
    const milestone = input.milestones.find(
      ({ key: itemKey }) => itemKey === key,
    );
    if (!milestone) throw new Error(`Missing story objective ${key}.`);
    return formatRemixStoryObjectiveText(
      milestone.objective,
      conditionState({ highestMineObjectLevel }),
      {
        formatThousands: (value) => formatThousands(value, formatter),
        formatSelectedNotation: (value) => formatter.format(Number(value)),
      },
    );
  };
  const conditionBoundaries = input.conditionBoundaries.map((boundary) => {
    const milestone = input.milestones.find(({ key }) => key === boundary.key);
    if (!milestone) throw new Error(`Missing milestone ${boundary.key}.`);

    return {
      condition: boundary.condition,
      samples: boundary.samples.map((sample) => ({
        name: sample.name,
        unlocked: isRemixStoryMilestoneUnlocked(
          milestone,
          conditionState(sample.input),
        ),
      })),
    };
  });
  const notificationScenarios = input.notificationScenarios.map((scenario) => {
    const state = conditionState(scenario.input);
    return {
      name: scenario.name,
      conditionResults: input.milestones.map((milestone) => ({
        key: milestone.key,
        unlocked: isRemixStoryMilestoneUnlocked(milestone, state),
      })),
      maxPage: getRemixStoryMaximumPage(input.milestones, state),
      pageNavigation: {
        page: scenario.input.page,
        afterIncrease: increaseRemixStoryPage(
          scenario.input.page,
          getRemixStoryMaximumPage(input.milestones, state),
        ),
        afterDecrease: decreaseRemixStoryPage(scenario.input.page),
      },
      visibleMilestonesByPage: Object.fromEntries(
        Array.from({ length: input.chapterCount }, (_, page) => [
          page,
          getRemixStoryDisplayedMilestones(input.milestones, state, page),
        ]),
      ),
      nextMilestone: getNextRemixStoryMilestone(input.milestones, state),
      nextObjective: getNextRemixStoryObjectiveText(input.milestones, state, {
        formatThousands: (value) => formatThousands(value, standard),
        formatSelectedNotation: (value) => standard.format(Number(value)),
      }),
      after: refreshRemixStoryNotifications(
        scenario.before,
        input.milestones,
        state,
      ),
    };
  });
  const firstMud = input.milestones.find(({ key }) => key === "firstMud");
  if (!firstMud) throw new Error("The firstMud milestone is missing.");
  const notificationSequence = input.notificationSequence.map((stage) => {
    const state = conditionState(stage.input);
    return {
      name: stage.name,
      firstMudUnlocked: isRemixStoryMilestoneUnlocked(firstMud, state),
      firstMudDisplayed: getRemixStoryDisplayedMilestones(
        input.milestones,
        state,
        stage.input.page,
      ).includes("firstMud"),
      after: refreshRemixStoryNotifications(
        stage.before,
        input.milestones,
        state,
      ),
    };
  });

  const objectiveSamples = {
    mineLevels: input.objectiveSamples.mineLevels.map((sample) => ({
      highestMineObjectLevel: sample.highestMineObjectLevel,
      values: sample.values.map(({ key }) => ({
        key,
        output: renderObjective(key, sample.highestMineObjectLevel, standard),
      })),
    })),
    notationFormats: input.objectiveSamples.notationFormats.map((sample) => {
      const formatter = formatters.find(({ name }) => name === sample.notation);
      if (!formatter) throw new Error(`Missing formatter ${sample.notation}.`);
      return {
        notation: sample.notation,
        values: sample.values.map(({ key }) => ({
          key,
          output: renderObjective(key, 0, formatter),
        })),
      };
    }),
  };

  const payUSDebt = {
    buttonLabel: getRemixPayUSDebtButtonLabel((value, limit) =>
      formatThousands(value, standard, limit),
    ),
    scenarios: input.payUSDebtSemantics.scenarios.map((scenario) => ({
      name: scenario.name,
      effects: attemptRemixPayUSDebt(scenario.money),
    })),
  };

  const storyTabs = input.storyTabSemantics.scenarios.map((scenario) => {
    const { input: scenarioInput } = scenario;
    const transition = transitionRemixStoryTab({
      currentTab: scenarioInput.currentTab,
      targetTab: scenarioInput.targetTab,
      currentScrollTop: scenarioInput.scrollTop,
      scrollY: scenarioInput.savedScrollY,
      notifications: scenarioInput.notifications,
    });
    const scheduledEffects = transition.effects.map((effect) =>
      effect.type === "refresh-number-select"
        ? {
            ...effect,
            selectedIndex: scenarioInput.selectedNumberFormatterIndex,
          }
        : effect,
    );
    let scrollTop = scenarioInput.scrollTop;
    let numberFormatSelectedIndex = -1;
    for (const effect of transition.effects) {
      if (effect.type === "restore-story-scroll") {
        scrollTop = effect.scrollY;
      } else {
        numberFormatSelectedIndex = scenarioInput.selectedNumberFormatterIndex;
      }
    }
    return {
      name: scenario.name,
      afterTransition: {
        tab: transition.state.tab,
        scrollY: transition.state.scrollY,
        notifications: transition.state.notifications,
        scrollTop: scenarioInput.scrollTop,
        numberFormatSelectedIndex: -1,
        scheduledEffects,
      },
      afterTimers: {
        tab: transition.state.tab,
        scrollY: transition.state.scrollY,
        notifications: transition.state.notifications,
        scrollTop,
        numberFormatSelectedIndex,
      },
    };
  });

  return {
    conditionBoundaries,
    notificationScenarios,
    notificationSequence,
    objectiveSamples,
    payUSDebt,
    storyTabs,
  };
}

const result = document.querySelector<HTMLPreElement>("#result");
if (!result) throw new Error("Story parity output element is missing.");

(
  window as Window & {
    __idleMineStoryProbe?: (input: ProbeInput) => unknown;
  }
).__idleMineStoryProbe = evaluate;
result.textContent = "Story parity probe ready";
result.dataset.ready = "true";
