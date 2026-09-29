import { Decimal, type DecimalSource } from "./decimal.js";

export type RemixStoryCondition =
  | { kind: "always" }
  | { kind: "highestMineObjectLevelAtLeast"; level: number }
  | { kind: "highestMoneyAtLeast"; amount: DecimalSource }
  | { kind: "maxPlanetCoinsGreaterThan"; amount: DecimalSource }
  | {
      kind: "upgradeLevel";
      family: "money";
      key: string;
      comparison: "greaterThan" | "atLeast";
      level: number;
    }
  | { kind: "totalWisdomUpgradeLevelsAtLeast"; level: number };

export type RemixStoryObjective =
  | {
      kind: "literal";
      sourceKind: "literal" | "function";
      text: string;
    }
  | { kind: "mineLevelTemplate"; prefix: string; suffix: string }
  | {
      kind: "formattedNumberTemplate";
      formatter: "formatThousands" | "selectedNotation";
      amount: DecimalSource;
      prefix: string;
      suffix: string;
    };

export interface RemixStoryObjectiveFormatters {
  formatThousands(value: DecimalSource): string;
  formatSelectedNotation(value: DecimalSource): string;
}

export interface RemixStoryMilestone {
  index: number;
  key: string;
  page: number;
  condition: RemixStoryCondition;
  objective: RemixStoryObjective;
}

export interface RemixStoryConditionState {
  highestMineObjectLevel: number;
  highestMoney: DecimalSource;
  maxPlanetCoins: DecimalSource;
  moneyUpgradeLevels: Readonly<Record<string, number>>;
  wisdomUpgradeLevels: Readonly<Record<string, number>>;
}

export interface RemixStoryProgress {
  highestUnlocked: number;
  notifications: number;
}

export function isRemixStoryMilestoneUnlocked(
  milestone: RemixStoryMilestone,
  state: RemixStoryConditionState,
): boolean {
  const { condition } = milestone;

  switch (condition.kind) {
    case "always":
      return true;
    case "highestMineObjectLevelAtLeast":
      return state.highestMineObjectLevel >= condition.level;
    case "highestMoneyAtLeast":
      return new Decimal(state.highestMoney).gte(condition.amount);
    case "maxPlanetCoinsGreaterThan":
      return new Decimal(state.maxPlanetCoins).gt(condition.amount);
    case "upgradeLevel": {
      const level = state.moneyUpgradeLevels[condition.key] ?? 0;
      return condition.comparison === "greaterThan"
        ? level > condition.level
        : level >= condition.level;
    }
    case "totalWisdomUpgradeLevelsAtLeast": {
      let total = 0;
      for (const [key, level] of Object.entries(state.wisdomUpgradeLevels)) {
        if (Object.hasOwn(state.wisdomUpgradeLevels, key)) total += level;
      }
      return total >= condition.level;
    }
  }
}

export function refreshRemixStoryNotifications(
  progress: RemixStoryProgress,
  milestones: readonly RemixStoryMilestone[],
  state: RemixStoryConditionState,
): RemixStoryProgress {
  let highestUnlocked = progress.highestUnlocked;
  let notifications = progress.notifications;

  for (let index = highestUnlocked + 1; index < milestones.length; index += 1) {
    const milestone = milestones[index];
    if (milestone && isRemixStoryMilestoneUnlocked(milestone, state)) {
      highestUnlocked = index;
      notifications += 1;
    }
  }

  return { highestUnlocked, notifications };
}

export function getRemixStoryMaximumPage(
  milestones: readonly RemixStoryMilestone[],
  state: RemixStoryConditionState,
): number {
  let maxPage = 3;

  for (let index = milestones.length - 1; index >= 0; index -= 1) {
    const milestone = milestones[index];
    if (milestone && isRemixStoryMilestoneUnlocked(milestone, state)) {
      maxPage = milestone.page;
      break;
    }
  }

  return maxPage;
}

export function getRemixStoryDisplayedMilestones(
  milestones: readonly RemixStoryMilestone[],
  state: RemixStoryConditionState,
  page: number,
): string[] {
  return milestones
    .filter(
      (milestone) =>
        milestone.page === page &&
        isRemixStoryMilestoneUnlocked(milestone, state),
    )
    .map((milestone) => milestone.key);
}

export function getNextRemixStoryMilestone(
  milestones: readonly RemixStoryMilestone[],
  state: RemixStoryConditionState,
): Pick<RemixStoryMilestone, "index" | "key"> | null {
  const milestone = milestones.find(
    (candidate) => !isRemixStoryMilestoneUnlocked(candidate, state),
  );

  return milestone ? { index: milestone.index, key: milestone.key } : null;
}

export function formatRemixStoryObjectiveText(
  objective: RemixStoryObjective,
  state: RemixStoryConditionState,
  formatters: RemixStoryObjectiveFormatters,
): string {
  switch (objective.kind) {
    case "literal":
      return objective.text;
    case "mineLevelTemplate":
      return `${objective.prefix}${state.highestMineObjectLevel + 1}${objective.suffix}`;
    case "formattedNumberTemplate": {
      const format =
        objective.formatter === "formatThousands"
          ? formatters.formatThousands
          : formatters.formatSelectedNotation;
      return `${objective.prefix}${format(objective.amount)}${objective.suffix}`;
    }
  }
}

export function getNextRemixStoryObjectiveText(
  milestones: readonly RemixStoryMilestone[],
  state: RemixStoryConditionState,
  formatters: RemixStoryObjectiveFormatters,
): string | null {
  const milestone = milestones.find(
    (candidate) => !isRemixStoryMilestoneUnlocked(candidate, state),
  );
  return milestone
    ? formatRemixStoryObjectiveText(milestone.objective, state, formatters)
    : null;
}

export function increaseRemixStoryPage(page: number, maxPage: number): number {
  return Math.min(page + 1, maxPage);
}

export function decreaseRemixStoryPage(page: number): number {
  return Math.max(page - 1, 0);
}
