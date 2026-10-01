import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createBrotliDecompress } from "node:zlib";
import { expect, it } from "vitest";
import {
  Decimal,
  changeRemixCraftGemSelection,
  createInitialRemixSimulationState,
  getRemixStoryMaximumPage,
  increaseRemixStoryPage,
  performRemixSimulationAction,
  performRemixSimulationActiveClickBatch,
  selectRemixMineObject,
  transitionRemixStoryTab,
  type RemixMineObjectCatalog,
  type RemixSimulationState,
  type RemixStoryMilestone,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  loadRemixLegacySaveIntoState,
} from "../../packages/persistence/src/index.js";

type RandomCursor = { seed: number; draws: number; state: number };
type DropSnapshot = { chance: number; amount: string };
type UpgradeLevelsSnapshot = Record<string, number>;
type SimulationSnapshot = {
  mineObjectLevel: number;
  highestMineObjectLevel: number;
  currentObject: {
    id: number;
    name: string;
    hp: string;
    totalHp: string;
    defense: string;
    value: string;
    colors: string[];
    skin: number;
    drops: Record<string, DropSnapshot>;
  };
  resources: Record<
    | "money"
    | "highestMoney"
    | "gems"
    | "planetCoins"
    | "maxPlanetCoins"
    | "wisdom"
    | "maxWisdom",
    string
  >;
  powers: Record<
    "mining" | "craftsmanship" | "expertise" | "wisdom" | "exquisity",
    string
  >;
  upgrades: Record<
    "money" | "gems" | "planetCoins" | "wisdom",
    UpgradeLevelsSnapshot
  >;
  pickaxe: { name: string; power: string; quality: string };
  autoPickaxeTimer: number;
  saveTimer: number;
  powersUnlocked: boolean;
  usedGemsLevel: number;
  lastActiveMs: number | undefined;
  story: { page: number; highestUnlocked: number; notifications: number };
};
type RouteStart = {
  saveString: string;
  state: SimulationSnapshot;
  random: RandomCursor;
};
type RouteCheckpoint = {
  label: string;
  state: SimulationSnapshot;
  random: RandomCursor;
};
type StoryRouteEvent =
  | {
      type: "select";
      id: number;
      purpose: "progress" | "farm";
      label: string;
    }
  | {
      type: "purchase";
      key: keyof RemixSimulationState["upgrades"]["money"];
      level: number;
      label: string;
    }
  | {
      type: "gemUpgradePurchase";
      key: keyof RemixSimulationState["upgrades"]["gems"];
      level: number;
      label: string;
    }
  | { type: "craft"; attempt: number; label: string }
  | {
      type: "craftLevel";
      direction: "increase" | "decrease";
      level: number;
      label: string;
    }
  | {
      type: "mine";
      id: number;
      purpose: "progress" | "farm";
      clicks: number;
      label: string;
    }
  | { type: "storyEntry"; label: string }
  | { type: "storyPage"; page: number; label: string };
type Chapter3Progression = {
  replayRouteStart: RouteStart;
  events: StoryRouteEvent[];
  replayCheckpoints: RouteCheckpoint[];
  routeIterations: number;
  totalActiveClicks: number;
  craftAttempts: number;
  farmBreaks: number;
  storyState: {
    tab: string;
    page: number;
    highestMineObjectLevel: number;
    money: string;
    highestMoney: string;
    gems: string;
    highestUnlocked: number;
    notifications: number;
    maxStoryPage: number;
    visibleMilestones: string[];
    nextObjective: string;
    chapterHeading: string | null;
  };
  saveString: string;
  screenshotState: {
    tab: string;
    theme: string;
    page: number;
    highestMineObjectLevel: number;
    money: string;
    gems: string;
    highestUnlocked: number;
    notifications: number;
    maxStoryPage: number;
    visibleMilestones: string[];
    nextObjective: string;
    chapterHeading: string | null;
    scrollTop: number;
    bodyBackground: string;
  };
  screenshot: string;
};
type StreamedStoryProgression = Omit<
  Chapter3Progression,
  "events" | "replayCheckpoints"
> & {
  trace: {
    file: string;
    records: number;
    rawSha256: string;
  };
};

type StoryRuntime = {
  source: { commit: string };
  firstStoneProgression: {
    replayRouteStart: RouteStart;
    replayCheckpoints: RouteCheckpoint[];
    gemFarm: { breaks: number; activeHitsPerClay: number };
    activeCanvasClicks: number;
  };
  tenThousandProgression: {
    replayRouteStart: RouteStart;
    rockFarming: {
      hitsPerRock: number;
      breaksToThreshold: number;
      replayCheckpoints: RouteCheckpoint[];
    };
  };
  spookyBoneProgression: {
    millionaireProgression: {
      replayRouteStart: RouteStart;
      rockFarming: {
        hitsPerRock: number;
        breaksToThreshold: number;
        replayCheckpoints: RouteCheckpoint[];
      };
      sourceInteractionProgression: {
        replayRouteStart: RouteStart;
        replayCheckpoints: RouteCheckpoint[];
        upgradePurchases: {
          blacksmithPurchases: number;
          activePowerPurchases: number;
        };
        crafting: { attempts: number };
        minedObjects: { id: number; breakClicks: number; reached: boolean }[];
      };
      chapter3Progression: Chapter3Progression;
      chapter4Progression: Chapter3Progression;
      chapter5Progression: StreamedStoryProgression;
    };
  };
};

const runtime = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
    "utf8",
  ),
) as StoryRuntime;
const reference = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: { mineObjectCatalog: RemixMineObjectCatalog };
};
const storyMilestones = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-milestones.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { milestones: RemixStoryMilestone[] };
const catalog = reference.data.mineObjectCatalog;
const fixedClock = 1_704_067_200_000;

async function* streamStoryRouteTrace(
  trace: StreamedStoryProgression["trace"],
) {
  const rawHash = createHash("sha256");
  const lines = createInterface({
    input: createReadStream(
      new URL(`../fixtures/parity/${trace.file}`, import.meta.url),
    ).pipe(createBrotliDecompress()),
    crlfDelay: Infinity,
  });
  let count = 0;
  for await (const line of lines) {
    rawHash.update(`${line}\n`);
    count++;
    yield JSON.parse(line) as {
      event: StoryRouteEvent;
      checkpoint: RouteCheckpoint;
    };
  }
  expect(count, `${trace.file} source checkpoint count`).toBe(trace.records);
  expect(rawHash.digest("hex"), `${trace.file} source trace hash`).toBe(
    trace.rawSha256,
  );
}

it("pins the shared RNG seed and intermediate checkpoint coverage", () => {
  const routes = [
    {
      start: runtime.firstStoneProgression.replayRouteStart,
      checkpoints: runtime.firstStoneProgression.replayCheckpoints,
    },
    {
      start: runtime.tenThousandProgression.replayRouteStart,
      checkpoints: runtime.tenThousandProgression.rockFarming.replayCheckpoints,
    },
    {
      start:
        runtime.spookyBoneProgression.millionaireProgression.replayRouteStart,
      checkpoints:
        runtime.spookyBoneProgression.millionaireProgression.rockFarming
          .replayCheckpoints,
    },
    {
      start:
        runtime.spookyBoneProgression.millionaireProgression
          .sourceInteractionProgression.replayRouteStart,
      checkpoints:
        runtime.spookyBoneProgression.millionaireProgression
          .sourceInteractionProgression.replayCheckpoints,
    },
    {
      start:
        runtime.spookyBoneProgression.millionaireProgression.chapter3Progression
          .replayRouteStart,
      checkpoints:
        runtime.spookyBoneProgression.millionaireProgression.chapter3Progression
          .replayCheckpoints,
    },
    {
      start:
        runtime.spookyBoneProgression.millionaireProgression.chapter4Progression
          .replayRouteStart,
      checkpoints:
        runtime.spookyBoneProgression.millionaireProgression.chapter4Progression
          .replayCheckpoints,
    },
  ];
  const chapter5 =
    runtime.spookyBoneProgression.millionaireProgression.chapter5Progression;

  expect(routes.map(({ start }) => start.random.seed)).toEqual([
    7454, 7454, 7454, 7454, 7454, 7454,
  ]);
  expect(chapter5.replayRouteStart.random.seed).toBe(7454);
  expect(routes.map(({ start }) => start.random.draws)).toEqual([
    24, 160, 192, 8442, 8461, 8922,
  ]);
  expect(chapter5.replayRouteStart.random.draws).toBe(9697);
  expect(routes.map(({ checkpoints }) => checkpoints.length)).toEqual([
    127, 32, 208, 71, 212, 1689,
  ]);
  expect(routes.map(({ checkpoints }) => checkpoints[0]?.label)).toEqual([
    "clay-break-1",
    "rock-break-1",
    "rock-break-1",
    "select-coal",
    "select-progress-13",
    "purchase-gemWaster-1",
  ]);
  expect(routes.map(({ checkpoints }) => checkpoints.at(-1)?.label)).toEqual([
    "first-rock-break",
    "rock-break-32",
    "rock-break-8250",
    "story-entry",
    "story-page-3",
    "story-page-4",
  ]);
  expect(chapter5.replayRouteStart.random).toEqual({
    seed: 7454,
    draws: 9697,
    state: expect.any(Number),
  });
  expect(chapter5.trace).toMatchObject({
    file: "story-natural-chapter-5-route.jsonl.br",
    records: 80316,
    rawSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
  });
  expect(chapter5.storyState).toMatchObject({
    page: 4,
    highestMineObjectLevel: 71,
    visibleMilestones: ["reachPortal"],
    nextObjective: "Break through THE PORTAL",
    chapterHeading: "Chapter 5: New Dimensions",
  });
});

class SourceMathRandom {
  private state: number;
  private draws = 0;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  nextDouble() {
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    this.draws++;
    return this.state / 0x1_0000_0000;
  }

  cursor(): RandomCursor {
    return { seed: this.seed, draws: this.draws, state: this.state };
  }

  private seed = 0;

  static at(cursor: RandomCursor) {
    const random = new SourceMathRandom(cursor.seed);
    random.seed = cursor.seed;
    for (let draw = 0; draw < cursor.draws; draw++) random.nextDouble();
    expect(random.cursor()).toEqual(cursor);
    return random;
  }
}

function simulationSnapshot(state: RemixSimulationState): SimulationSnapshot {
  const decimal = (value: Decimal | string | number) =>
    new Decimal(value).toString();
  return {
    mineObjectLevel: state.mineObjectLevel,
    highestMineObjectLevel: state.highestMineObjectLevel,
    currentObject: {
      id: state.currentObject.id,
      name: state.currentObject.name,
      hp: decimal(state.currentObject.hp),
      totalHp: decimal(state.currentObject.totalHp),
      defense: decimal(state.currentObject.defense),
      value: decimal(state.currentObject.value),
      colors: [...state.currentObject.colors],
      skin: state.currentObject.skin,
      drops: Object.fromEntries(
        Object.entries(state.currentObject.drops).map(([key, drop]) => [
          key,
          { chance: drop.chance, amount: decimal(drop.amount) },
        ]),
      ),
    },
    resources: {
      money: decimal(state.resources.money),
      highestMoney: decimal(state.resources.highestMoney),
      gems: decimal(state.resources.gems),
      planetCoins: decimal(state.resources.planetCoins),
      maxPlanetCoins: decimal(state.resources.maxPlanetCoins),
      wisdom: decimal(state.resources.wisdom),
      maxWisdom: decimal(state.resources.maxWisdom),
    },
    powers: {
      mining: decimal(state.powers.mining),
      craftsmanship: decimal(state.powers.craftsmanship),
      expertise: decimal(state.powers.expertise),
      wisdom: decimal(state.powers.wisdom),
      exquisity: decimal(state.powers.exquisity),
    },
    upgrades: {
      money: { ...state.upgrades.money },
      gems: { ...state.upgrades.gems },
      planetCoins: { ...state.upgrades.planetCoins },
      wisdom: { ...state.upgrades.wisdom },
    },
    pickaxe: {
      name: state.pickaxe.name,
      power: decimal(state.pickaxe.power),
      quality: decimal(state.pickaxe.quality),
    },
    autoPickaxeTimer: state.autoPickaxeTimer,
    saveTimer: state.saveTimer,
    powersUnlocked: state.powersUnlocked,
    usedGemsLevel: state.usedGemsLevel,
    lastActiveMs: state.lastActiveMs,
    story: { ...state.story },
  };
}

function loadRouteStart(start: RouteStart) {
  const loaded = loadRemixLegacySaveIntoState({
    state: createInitialRemixLegacySaveApplicationState(
      createInitialRemixSimulationState(catalog),
    ),
    saveString: start.saveString,
    catalog,
    clock: { now: () => fixedClock },
    resolveNumberFormatter: () => () => "",
    noOffline: true,
  });
  if (loaded.status !== "loaded") {
    throw new Error(
      `Captured Remix route start failed to load: ${loaded.status}`,
    );
  }
  let state = loaded.state.simulation;
  const loadedSnapshot = simulationSnapshot(state);
  expect(
    { ...loadedSnapshot, usedGemsLevel: start.state.usedGemsLevel },
    "loaded persisted route start (excluding Remix's non-restored craft selector)",
  ).toEqual(start.state);
  // Remix serializes the game object but loadGame manually restores fields and
  // does not reapply usedGemsLevel; reconstruct that carried session control.
  while (state.usedGemsLevel < start.state.usedGemsLevel) {
    state = changeRemixCraftGemSelection(state, "increase");
  }
  while (state.usedGemsLevel > start.state.usedGemsLevel) {
    state = changeRemixCraftGemSelection(state, "decrease");
  }
  expect(simulationSnapshot(state), "loaded route start").toEqual(start.state);
  const random = SourceMathRandom.at(start.random);
  return { state, random };
}

function assertCheckpoint(
  state: RemixSimulationState,
  random: SourceMathRandom,
  expected: RouteCheckpoint,
) {
  expect(simulationSnapshot(state), `${expected.label} core state`).toEqual(
    expected.state,
  );
  expect(random.cursor(), `${expected.label} RNG cursor`).toEqual(
    expected.random,
  );
}

function mineAction(
  state: RemixSimulationState,
  random: SourceMathRandom,
  action: { type: "activeClick" } | { type: "idleFrame"; deltaSeconds: number },
) {
  const result = performRemixSimulationAction({
    state,
    action,
    catalog,
    storyMilestones: storyMilestones.milestones,
    random,
  });
  if (result.type !== "mining") {
    throw new Error(`Expected a mining action, got ${result.type}.`);
  }
  return result;
}

function buyBlacksmith(state: RemixSimulationState) {
  const result = performRemixSimulationAction({
    state,
    action: {
      type: "upgradePurchase",
      group: "money",
      key: "blacksmith",
      operation: { method: "buy" },
    },
  });
  if (result.type !== "upgradePurchase") {
    throw new Error(`Expected an upgrade purchase, got ${result.type}.`);
  }
  expect(result.purchases).toBe(1);
  return result.state;
}

function buyActivePower(state: RemixSimulationState) {
  const result = performRemixSimulationAction({
    state,
    action: {
      type: "upgradePurchase",
      group: "money",
      key: "activePower",
      operation: { method: "buy" },
    },
  });
  if (result.type !== "upgradePurchase") {
    throw new Error(`Expected an upgrade purchase, got ${result.type}.`);
  }
  expect(result.purchases).toBe(1);
  return result.state;
}

function buyMoneyUpgrade(
  state: RemixSimulationState,
  key: keyof RemixSimulationState["upgrades"]["money"],
) {
  const result = performRemixSimulationAction({
    state,
    action: {
      type: "upgradePurchase",
      group: "money",
      key,
      operation: { method: "buy" },
    },
  });
  if (result.type !== "upgradePurchase") {
    throw new Error(`Expected an upgrade purchase, got ${result.type}.`);
  }
  expect(result.purchases).toBe(1);
  return result.state;
}

function buyGemUpgrade(
  state: RemixSimulationState,
  key: keyof RemixSimulationState["upgrades"]["gems"],
) {
  const result = performRemixSimulationAction({
    state,
    action: {
      type: "upgradePurchase",
      group: "gems",
      key,
      operation: { method: "buy" },
    },
  });
  if (result.type !== "upgradePurchase") {
    throw new Error(`Expected a Gem upgrade purchase, got ${result.type}.`);
  }
  expect(result.purchases).toBe(1);
  return result.state;
}

function craftPickaxe(state: RemixSimulationState, random: SourceMathRandom) {
  const result = performRemixSimulationAction({
    state,
    action: { type: "craftPickaxe", shiftHeld: false },
    catalog,
    random,
  });
  if (result.type !== "craftPickaxe") {
    throw new Error(`Expected a pickaxe craft, got ${result.type}.`);
  }
  return result;
}

function selectObject(state: RemixSimulationState, id: number) {
  const selected = selectRemixMineObject(state, id, catalog);
  expect(selected.mineObjectLevel).toBe(id);
  return selected;
}

function breakCurrentObject(
  inputState: RemixSimulationState,
  random: SourceMathRandom,
  clicks: number,
) {
  const mined = performRemixSimulationActiveClickBatch({
    state: inputState,
    clicks,
    catalog,
    storyMilestones: storyMilestones.milestones,
    random,
  });
  expect(mined.objectBroken).toBe(true);
  const state = mined.state;
  return mineAction(state, random, {
    type: "idleFrame",
    deltaSeconds: 0,
  }).state;
}

function damageCurrentObjectOnce(
  state: RemixSimulationState,
  random: SourceMathRandom,
) {
  return mineAction(state, random, { type: "activeClick" }).state;
}

it("replays first Stone from the captured Clay save and compares every break checkpoint", () => {
  expect(runtime.source.commit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  const route = runtime.firstStoneProgression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  let checkpointIndex = 0;

  for (
    let breakNumber = 1;
    breakNumber <= route.gemFarm.breaks;
    breakNumber++
  ) {
    state = breakCurrentObject(state, random, route.gemFarm.activeHitsPerClay);
    assertCheckpoint(
      state,
      random,
      route.replayCheckpoints[checkpointIndex++]!,
    );
  }

  state = selectObject(state, 4);
  state = buyBlacksmith(state);
  state = mineAction(state, random, {
    type: "idleFrame",
    deltaSeconds: 0,
  }).state;
  assertCheckpoint(state, random, route.replayCheckpoints[checkpointIndex++]!);

  const craft = craftPickaxe(state, random);
  state = craft.state;
  assertCheckpoint(state, random, route.replayCheckpoints[checkpointIndex++]!);
  state = damageCurrentObjectOnce(state, random);
  assertCheckpoint(state, random, route.replayCheckpoints[checkpointIndex++]!);
  state = breakCurrentObject(state, random, route.activeCanvasClicks - 1);
  assertCheckpoint(state, random, route.replayCheckpoints[checkpointIndex++]!);
  expect(checkpointIndex).toBe(route.replayCheckpoints.length);
});

it("replays the 10,000-Money Rock route and compares all 32 break checkpoints", () => {
  const route = runtime.tenThousandProgression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;

  for (let index = 0; index < route.rockFarming.breaksToThreshold; index++) {
    state = breakCurrentObject(state, random, route.rockFarming.hitsPerRock);
    assertCheckpoint(
      state,
      random,
      route.rockFarming.replayCheckpoints[index]!,
    );
  }
});

it("replays the natural millionaire Rock route and compares seeded intermediate checkpoints", () => {
  const route = runtime.spookyBoneProgression.millionaireProgression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  const expected = new Map(
    route.rockFarming.replayCheckpoints.map((checkpoint) => [
      Number(checkpoint.label.slice("rock-break-".length)),
      checkpoint,
    ]),
  );

  for (
    let breakNumber = 1;
    breakNumber <= route.rockFarming.breaksToThreshold;
    breakNumber++
  ) {
    state = breakCurrentObject(state, random, route.rockFarming.hitsPerRock);
    const checkpoint = expected.get(breakNumber);
    if (checkpoint) assertCheckpoint(state, random, checkpoint);
  }
}, 1_800_000);

it("replays millionaire-to-Spooky-Bone purchases, crafting, and all object breaks", () => {
  const route =
    runtime.spookyBoneProgression.millionaireProgression
      .sourceInteractionProgression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  let checkpointIndex = 0;
  const check = () =>
    assertCheckpoint(
      state,
      random,
      route.replayCheckpoints[checkpointIndex++]!,
    );

  state = selectObject(state, 5);
  check();
  for (
    let count = 0;
    count < route.upgradePurchases.blacksmithPurchases;
    count++
  ) {
    state = buyBlacksmith(state);
    check();
  }
  for (
    let count = 0;
    count < route.upgradePurchases.activePowerPurchases;
    count++
  ) {
    state = buyActivePower(state);
    check();
  }
  for (let attempt = 0; attempt < route.crafting.attempts; attempt++) {
    state = craftPickaxe(state, random).state;
    check();
  }
  for (const object of route.minedObjects) {
    expect(object.reached, `Remix reached object ${object.id}`).toBe(true);
    state = selectObject(state, object.id);
    check();
    state = breakCurrentObject(state, random, object.breakClicks);
    check();
  }

  const storyTransition = transitionRemixStoryTab({
    currentTab: "main",
    targetTab: "story",
    currentScrollTop: 0,
    scrollY: 0,
    notifications: state.story.notifications,
  });
  state = {
    ...state,
    story: {
      ...state.story,
      notifications: storyTransition.state.notifications,
    },
  };
  check();

  expect(checkpointIndex).toBe(route.replayCheckpoints.length);
});

it("replays the natural Spooky Bone-to-Chapter-3 route at every source checkpoint", () => {
  const route =
    runtime.spookyBoneProgression.millionaireProgression.chapter3Progression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  let checkpointIndex = 0;

  for (const event of route.events) {
    switch (event.type) {
      case "select":
        state = selectObject(state, event.id);
        break;
      case "purchase":
        state = buyMoneyUpgrade(state, event.key);
        break;
      case "gemUpgradePurchase":
        state = buyGemUpgrade(state, event.key);
        break;
      case "craft":
        state = craftPickaxe(state, random).state;
        break;
      case "craftLevel":
        state = changeRemixCraftGemSelection(state, event.direction);
        expect(state.usedGemsLevel).toBe(event.level);
        break;
      case "mine":
        state = breakCurrentObject(state, random, event.clicks);
        break;
      case "storyEntry": {
        const transition = transitionRemixStoryTab({
          currentTab: "main",
          targetTab: "story",
          currentScrollTop: 0,
          scrollY: 0,
          notifications: state.story.notifications,
        });
        state = {
          ...state,
          story: {
            ...state.story,
            notifications: transition.state.notifications,
          },
        };
        break;
      }
      case "storyPage": {
        const maximumPage = getRemixStoryMaximumPage(
          storyMilestones.milestones,
          {
            highestMineObjectLevel: state.highestMineObjectLevel,
            highestMoney: state.resources.highestMoney,
            maxPlanetCoins: state.resources.maxPlanetCoins,
            moneyUpgradeLevels: state.upgrades.money,
            wisdomUpgradeLevels: state.upgrades.wisdom,
          },
        );
        state = {
          ...state,
          story: {
            ...state.story,
            page: increaseRemixStoryPage(state.story.page, maximumPage),
          },
        };
        expect(state.story.page).toBe(event.page);
        break;
      }
    }

    const checkpoint = route.replayCheckpoints[checkpointIndex++]!;
    expect(checkpoint.label).toBe(event.label);
    assertCheckpoint(state, random, checkpoint);
  }

  expect(checkpointIndex).toBe(route.replayCheckpoints.length);
  expect(state.highestMineObjectLevel).toBe(27);
  expect(state.story.page).toBe(2);
  expect(state.story.highestUnlocked).toBe(route.storyState.highestUnlocked);
  expect(state.story.notifications).toBe(0);
  expect(route.storyState.visibleMilestones).toEqual(["unrealStones"]);
  expect(route.storyState.nextObjective).toBe("Upgrade Gem Waster to Level 1");
  expect(route.screenshotState.chapterHeading).toBe(
    "Chapter 3: Mysterious Materials",
  );
  expect(route.screenshotState.page).toBe(2);
}, 1_800_000);

it("replays the natural Chapter 3-to-Chapter-4 route at every source checkpoint", () => {
  const route =
    runtime.spookyBoneProgression.millionaireProgression.chapter4Progression;
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  let checkpointIndex = 0;

  for (const event of route.events) {
    switch (event.type) {
      case "select":
        state = selectObject(state, event.id);
        break;
      case "purchase":
        state = buyMoneyUpgrade(state, event.key);
        expect(state.upgrades.money[event.key]).toBe(event.level);
        break;
      case "gemUpgradePurchase":
        state = buyGemUpgrade(state, event.key);
        expect(state.upgrades.gems[event.key]).toBe(event.level);
        break;
      case "craftLevel":
        state = changeRemixCraftGemSelection(state, event.direction);
        expect(state.usedGemsLevel).toBe(event.level);
        break;
      case "craft":
        state = craftPickaxe(state, random).state;
        break;
      case "mine":
        state = breakCurrentObject(state, random, event.clicks);
        break;
      case "storyEntry": {
        const transition = transitionRemixStoryTab({
          currentTab: "main",
          targetTab: "story",
          currentScrollTop: 0,
          scrollY: 0,
          notifications: state.story.notifications,
        });
        state = {
          ...state,
          story: {
            ...state.story,
            notifications: transition.state.notifications,
          },
        };
        break;
      }
      case "storyPage": {
        const maximumPage = getRemixStoryMaximumPage(
          storyMilestones.milestones,
          {
            highestMineObjectLevel: state.highestMineObjectLevel,
            highestMoney: state.resources.highestMoney,
            maxPlanetCoins: state.resources.maxPlanetCoins,
            moneyUpgradeLevels: state.upgrades.money,
            wisdomUpgradeLevels: state.upgrades.wisdom,
          },
        );
        state = {
          ...state,
          story: {
            ...state.story,
            page: increaseRemixStoryPage(state.story.page, maximumPage),
          },
        };
        expect(state.story.page).toBe(event.page);
        break;
      }
    }

    const checkpoint = route.replayCheckpoints[checkpointIndex++]!;
    expect(checkpoint.label).toBe(event.label);
    assertCheckpoint(state, random, checkpoint);
  }

  expect(checkpointIndex).toBe(route.replayCheckpoints.length);
  expect(state.highestMineObjectLevel).toBe(55);
  expect(state.story.page).toBe(3);
  expect(state.story.highestUnlocked).toBe(19);
  expect(state.story.notifications).toBe(0);
  expect(route.storyState.visibleMilestones).toEqual(["infinitum"]);
  expect(route.storyState.nextObjective).toBe("Reach THE GEM (56 / 61)");
  expect(route.screenshotState.chapterHeading).toBe("Chapter 4: It's NOT over");
  expect(route.screenshotState.page).toBe(3);
}, 1_800_000);

async function replayStreamedStoryRoute(
  route: StreamedStoryProgression,
  expected: {
    file: string;
    chapter: number;
    objectLevel: number;
    visibleMilestone: string;
    nextObjective: string;
    heading: string;
  },
) {
  expect(route.trace.file).toBe(expected.file);
  const { state: startingState, random } = loadRouteStart(
    route.replayRouteStart,
  );
  let state = startingState;
  let checkpointIndex = 0;

  for await (const { event, checkpoint } of streamStoryRouteTrace(
    route.trace,
  )) {
    switch (event.type) {
      case "select":
        state = selectObject(state, event.id);
        break;
      case "purchase":
        state = buyMoneyUpgrade(state, event.key);
        expect(state.upgrades.money[event.key]).toBe(event.level);
        break;
      case "gemUpgradePurchase":
        state = buyGemUpgrade(state, event.key);
        expect(state.upgrades.gems[event.key]).toBe(event.level);
        break;
      case "craftLevel":
        state = changeRemixCraftGemSelection(state, event.direction);
        expect(state.usedGemsLevel).toBe(event.level);
        break;
      case "craft":
        state = craftPickaxe(state, random).state;
        break;
      case "mine":
        state = breakCurrentObject(state, random, event.clicks);
        break;
      case "storyEntry": {
        const transition = transitionRemixStoryTab({
          currentTab: "main",
          targetTab: "story",
          currentScrollTop: 0,
          scrollY: 0,
          notifications: state.story.notifications,
        });
        state = {
          ...state,
          story: {
            ...state.story,
            notifications: transition.state.notifications,
          },
        };
        break;
      }
      case "storyPage": {
        const maximumPage = getRemixStoryMaximumPage(
          storyMilestones.milestones,
          {
            highestMineObjectLevel: state.highestMineObjectLevel,
            highestMoney: state.resources.highestMoney,
            maxPlanetCoins: state.resources.maxPlanetCoins,
            moneyUpgradeLevels: state.upgrades.money,
            wisdomUpgradeLevels: state.upgrades.wisdom,
          },
        );
        state = {
          ...state,
          story: {
            ...state.story,
            page: increaseRemixStoryPage(state.story.page, maximumPage),
          },
        };
        expect(state.story.page).toBe(event.page);
        break;
      }
    }

    expect(checkpoint.label).toBe(event.label);
    assertCheckpoint(state, random, checkpoint);
    checkpointIndex++;
  }

  expect(checkpointIndex).toBe(route.trace.records);
  expect(state.highestMineObjectLevel).toBe(expected.objectLevel);
  expect(state.story.page).toBe(expected.chapter - 1);
  expect(state.story.notifications).toBe(0);
  expect(route.storyState.visibleMilestones).toEqual([
    expected.visibleMilestone,
  ]);
  expect(route.storyState.nextObjective).toBe(expected.nextObjective);
  expect(route.storyState.chapterHeading).toBe(expected.heading);
  expect(route.screenshotState.chapterHeading).toBe(expected.heading);
  expect(route.screenshotState.page).toBe(expected.chapter - 1);
}

it("streams and replays the natural Chapter 4-to-Chapter 5 route at every source checkpoint", async () => {
  await replayStreamedStoryRoute(
    runtime.spookyBoneProgression.millionaireProgression.chapter5Progression,
    {
      file: "story-natural-chapter-5-route.jsonl.br",
      chapter: 5,
      objectLevel: 71,
      visibleMilestone: "reachPortal",
      nextObjective: "Break through THE PORTAL",
      heading: "Chapter 5: New Dimensions",
    },
  );
}, 3_600_000);
