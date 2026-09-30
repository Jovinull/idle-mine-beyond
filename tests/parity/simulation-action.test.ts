import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  getRemixCraftGemSelectionControls,
  performRemixSimulationAction,
  type RemixMineObjectCatalog,
  type RemixStoryMilestone,
  type RemixUpgradeGroup,
  type RemixUpgradeKey,
  type RemixUpgradePurchaseOperation,
  type RemixUpgradePurchaseSimulationAction,
} from "../../packages/core/src/index.js";

type DecimalSnapshot = { decimal: string };
type StoryProgress = {
  page: number;
  highestUnlocked: number;
  notifications: number;
};
type SimulationFrameCase = {
  name: string;
  input: {
    action: "activeClick" | "idleFrame";
    currentHp: string;
    elapsedMilliseconds: number;
    autoPickaxeTimer: number;
    saveTimer: number;
    story: StoryProgress;
    randomValues: number[];
  };
  result: {
    hitOccurred: boolean;
    hitDamage: DecimalSnapshot;
    damagedObjectHp: DecimalSnapshot;
    currentObjectHp: DecimalSnapshot;
    currentObjectWasReplaced: boolean;
    resources: Record<string, DecimalSnapshot>;
    highestMineObjectLevel: number;
    miningPower: DecimalSnapshot;
    autoPickaxeTimer: number;
    saveTimer: number;
    story: StoryProgress;
    randomCalls: number;
    frameEvents: ("save" | "refreshStoryNotifications")[];
    savedSnapshot: null | {
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      currentObjectHp: DecimalSnapshot;
      resources: Record<string, DecimalSnapshot>;
      miningPower: DecimalSnapshot;
      timer: { autoPickaxe: number; save: number };
      story: StoryProgress;
    };
  };
};
type UpgradePurchaseCase = {
  name: string;
  group: RemixUpgradeGroup;
  key: string;
  startingLevel: number;
  startingResources: Record<string, DecimalSnapshot>;
  operation: RemixUpgradePurchaseOperation;
  operationResult: boolean | null;
  endingLevel: number;
  purchases: number;
  endingResources: Record<string, DecimalSnapshot>;
};
type PickaxeSnapshot = {
  name: string;
  power: DecimalSnapshot;
  quality: DecimalSnapshot;
  damage: DecimalSnapshot;
};
type PickaxeCraftAttemptCase = {
  name: string;
  input: {
    gems: string;
    craftGems: DecimalSnapshot;
    usedGemsLevel: number;
    equippedPickaxe: { name: string; power: string; quality: string };
    highestMineObjectLevel: number;
    powers: string[];
    upgradeLevels: Record<string, Record<string, number>>;
    shiftHeld: boolean;
    randomValues: number[];
  };
  randomCalls: number;
  saveCalls: number;
  saveSnapshots: {
    gems: DecimalSnapshot;
    pickaxe: {
      name: string;
      power: DecimalSnapshot;
      quality: DecimalSnapshot;
    };
  }[];
  eventOrder: string[];
  result: { gems: DecimalSnapshot; pickaxe: PickaxeSnapshot };
};
type PickaxeCraftControlCase = {
  name: string;
  input: {
    usedGemsLevel: number;
    moneyGemWasterLevel: number;
    gemUpgradeWasterLevel: number;
  };
  displayedGemCost: string;
  gemCost: DecimalSnapshot;
  buttons: { disabled: boolean; image: string | null }[];
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    mineObjectCatalog: RemixMineObjectCatalog;
    simulationFrameSemantics: {
      sourcePaths: string[];
      randomSource: string;
      cases: SimulationFrameCase[];
    };
    upgradeSemantics: { purchaseSemantics: UpgradePurchaseCase[] };
    pickaxeCraftingSemantics: {
      attempts: PickaxeCraftAttemptCase[];
      craftControls: {
        controlSourcePaths: string[];
        controls: PickaxeCraftControlCase[];
        transitions: {
          direction: "increase" | "decrease";
          usedGemsLevel: number;
          gemCost: DecimalSnapshot;
        }[];
      };
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
) as { milestones: RemixStoryMilestone[] };

function stateSnapshot(
  state: ReturnType<typeof createInitialRemixSimulationState>,
) {
  return {
    mineObjectLevel: state.mineObjectLevel,
    highestMineObjectLevel: state.highestMineObjectLevel,
    currentObjectHp: state.currentObject.hp.toString(),
    resources: Object.fromEntries(
      Object.entries(state.resources).map(([key, value]) => [
        key,
        value.toString(),
      ]),
    ),
    miningPower: state.powers.mining.toString(),
    timer: {
      autoPickaxe: state.autoPickaxeTimer,
      save: state.saveTimer,
    },
    story: state.story,
  };
}

function expectedSnapshot(
  snapshot: NonNullable<SimulationFrameCase["result"]["savedSnapshot"]>,
) {
  return {
    mineObjectLevel: snapshot.mineObjectLevel,
    highestMineObjectLevel: snapshot.highestMineObjectLevel,
    currentObjectHp: snapshot.currentObjectHp.decimal,
    resources: Object.fromEntries(
      Object.entries(snapshot.resources).map(([key, value]) => [
        key,
        value.decimal,
      ]),
    ),
    miningPower: snapshot.miningPower.decimal,
    timer: snapshot.timer,
    story: snapshot.story,
  };
}

function completeStateSnapshot(
  state: ReturnType<typeof createInitialRemixSimulationState>,
) {
  return {
    ...stateSnapshot(state),
    powers: Object.fromEntries(
      Object.entries(state.powers).map(([key, value]) => [
        key,
        value.toString(),
      ]),
    ),
    pickaxe: {
      name: state.pickaxe.name,
      power: state.pickaxe.power.toString(),
      quality: state.pickaxe.quality.toString(),
    },
    upgrades: Object.fromEntries(
      Object.entries(state.upgrades).map(([group, levels]) => [
        group,
        { ...levels },
      ]),
    ),
    powersUnlocked: state.powersUnlocked,
    usedGemsLevel: state.usedGemsLevel,
  };
}

it("composes Remix clicks, idle frames, saves, and Story notifications", () => {
  const semantics = corpus.data.simulationFrameSemantics;
  expect(corpus.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(semantics.sourcePaths).toEqual([
    "Scripts/main.js",
    "Scripts/Define/game.js",
    "Scripts/Define/functions.js",
    "Scripts/mineobject.js",
  ]);
  expect(semantics.randomSource).toBe("Math.random");
  expect(semantics.cases).toHaveLength(3);

  for (const scenario of semantics.cases) {
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    state.currentObject = {
      ...state.currentObject,
      hp: new Decimal(scenario.input.currentHp),
    };
    state.autoPickaxeTimer = scenario.input.autoPickaxeTimer;
    state.saveTimer = scenario.input.saveTimer;
    state.story = { ...scenario.input.story };
    const initialSnapshot = stateSnapshot(state);

    let randomCalls = 0;
    const result = performRemixSimulationAction({
      state,
      action:
        scenario.input.action === "activeClick"
          ? { type: "activeClick" }
          : {
              type: "idleFrame",
              deltaSeconds: scenario.input.elapsedMilliseconds / 1000,
            },
      catalog: corpus.data.mineObjectCatalog,
      storyMilestones: storyContent.milestones,
      random: {
        nextDouble() {
          const value = scenario.input.randomValues[randomCalls];
          if (value === undefined) {
            throw new Error(`${scenario.name} exhausted its RNG fixture.`);
          }
          randomCalls++;
          return value;
        },
      },
    });
    if (result.type !== "mining") {
      throw new Error(`${scenario.name}: expected a mining action result.`);
    }

    expect(
      stateSnapshot(state),
      `${scenario.name}: input remains unchanged`,
    ).toEqual(initialSnapshot);

    expect(
      {
        hitOccurred: result.hitOccurred,
        hitDamage: result.hitDamage.toString(),
        damagedObjectHp: result.damagedObjectHp.toString(),
        currentObjectHp: result.state.currentObject.hp.toString(),
        objectBroken: result.objectBroken,
        resources: Object.fromEntries(
          Object.entries(result.state.resources).map(([key, value]) => [
            key,
            value.toString(),
          ]),
        ),
        highestMineObjectLevel: result.state.highestMineObjectLevel,
        miningPower: result.state.powers.mining.toString(),
        autoPickaxeTimer: result.state.autoPickaxeTimer,
        saveTimer: result.state.saveTimer,
        story: result.state.story,
        randomCalls,
        frameEvents: result.frameEvents,
        savedSnapshots: result.effects.flatMap((effect) =>
          effect.type === "save" ? [stateSnapshot(effect.state)] : [],
        ),
      },
      scenario.name,
    ).toEqual({
      hitOccurred: scenario.result.hitOccurred,
      hitDamage: scenario.result.hitDamage.decimal,
      damagedObjectHp: scenario.result.damagedObjectHp.decimal,
      currentObjectHp: scenario.result.currentObjectHp.decimal,
      objectBroken: scenario.result.currentObjectWasReplaced,
      resources: Object.fromEntries(
        Object.entries(scenario.result.resources).map(([key, value]) => [
          key,
          value.decimal,
        ]),
      ),
      highestMineObjectLevel: scenario.result.highestMineObjectLevel,
      miningPower: scenario.result.miningPower.decimal,
      autoPickaxeTimer: scenario.result.autoPickaxeTimer,
      saveTimer: scenario.result.saveTimer,
      story: scenario.result.story,
      randomCalls: scenario.result.randomCalls,
      frameEvents: scenario.result.frameEvents,
      savedSnapshots:
        scenario.result.savedSnapshot === null
          ? []
          : [expectedSnapshot(scenario.result.savedSnapshot)],
    });
  }

  expect(semantics.cases[0]!.result.savedSnapshot!.story).toEqual({
    page: 0,
    highestUnlocked: -1,
    notifications: 0,
  });
  expect(semantics.cases[0]!.result.story).toEqual({
    page: 0,
    highestUnlocked: 1,
    notifications: 2,
  });
});

it("composes all captured Remix upgrade purchases into full simulation state", () => {
  const scenarios = corpus.data.upgradeSemantics.purchaseSemantics;
  expect(scenarios).toHaveLength(14);

  for (const scenario of scenarios) {
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    const key = scenario.key as RemixUpgradeKey<typeof scenario.group>;
    (state.upgrades[scenario.group] as Record<string, number>)[key] =
      scenario.startingLevel;
    state.resources = {
      ...state.resources,
      money: new Decimal(scenario.startingResources["money"]!.decimal),
      gems: new Decimal(scenario.startingResources["gems"]!.decimal),
      planetCoins: new Decimal(
        scenario.startingResources["planetCoins"]!.decimal,
      ),
      wisdom: new Decimal(scenario.startingResources["wisdom"]!.decimal),
    };
    const before = completeStateSnapshot(state);
    const expectedUpgrades = structuredClone(before.upgrades) as Record<
      string,
      Record<string, number>
    >;
    expectedUpgrades[scenario.group]![key] = scenario.endingLevel;
    const expectedResources = structuredClone(before.resources) as Record<
      string,
      string
    >;
    for (const [resource, value] of Object.entries(scenario.endingResources)) {
      expectedResources[resource] = value.decimal;
    }

    const result = performRemixSimulationAction({
      state,
      action: {
        type: "upgradePurchase",
        group: scenario.group,
        key,
        operation: scenario.operation,
      } as RemixUpgradePurchaseSimulationAction,
    });
    if (result.type !== "upgradePurchase") {
      throw new Error(`${scenario.name}: expected an upgrade purchase result.`);
    }
    const after = completeStateSnapshot(result.state);

    expect(
      {
        purchases: result.purchases,
        operationResult: result.operationResult,
        endingLevel: (
          result.state.upgrades[scenario.group] as Record<string, number>
        )[key],
        resources: after.resources,
        effects: result.effects,
        unchangedState: {
          mineObjectLevel: after.mineObjectLevel,
          currentObjectHp: after.currentObjectHp,
          highestMineObjectLevel: after.highestMineObjectLevel,
          powers: after.powers,
          pickaxe: after.pickaxe,
          upgrades: after.upgrades,
          powersUnlocked: after.powersUnlocked,
          usedGemsLevel: after.usedGemsLevel,
          timer: after.timer,
          story: after.story,
        },
      },
      scenario.name,
    ).toEqual({
      purchases: scenario.purchases,
      operationResult: scenario.operationResult,
      endingLevel: scenario.endingLevel,
      resources: expectedResources,
      effects: [],
      unchangedState: {
        mineObjectLevel: before.mineObjectLevel,
        currentObjectHp: before.currentObjectHp,
        highestMineObjectLevel: before.highestMineObjectLevel,
        powers: before.powers,
        pickaxe: before.pickaxe,
        upgrades: expectedUpgrades,
        powersUnlocked: before.powersUnlocked,
        usedGemsLevel: before.usedGemsLevel,
        timer: before.timer,
        story: before.story,
      },
    });
    expect(
      completeStateSnapshot(state),
      `${scenario.name}: input unchanged`,
    ).toEqual(before);
  }
});

it("composes source pickaxe crafts and each intermediate save snapshot", () => {
  const scenarios = corpus.data.pickaxeCraftingSemantics.attempts;
  expect(scenarios).toHaveLength(7);

  for (const scenario of scenarios) {
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    state.resources.gems = new Decimal(scenario.input.gems);
    state.usedGemsLevel = scenario.input.usedGemsLevel;
    state.highestMineObjectLevel = scenario.input.highestMineObjectLevel;
    state.powers = {
      mining: new Decimal(scenario.input.powers[0]!),
      craftsmanship: new Decimal(scenario.input.powers[1]!),
      expertise: new Decimal(scenario.input.powers[2]!),
      wisdom: new Decimal(scenario.input.powers[3]!),
      exquisity: new Decimal(scenario.input.powers[4]!),
    };
    for (const [group, levels] of Object.entries(
      scenario.input.upgradeLevels,
    )) {
      Object.assign(
        state.upgrades[group as keyof typeof state.upgrades],
        levels,
      );
    }
    state.pickaxe = {
      name: scenario.input.equippedPickaxe.name,
      power: new Decimal(scenario.input.equippedPickaxe.power),
      quality: new Decimal(scenario.input.equippedPickaxe.quality),
    };
    const before = completeStateSnapshot(state);
    let randomCalls = 0;

    const result = performRemixSimulationAction({
      state,
      action: { type: "craftPickaxe", shiftHeld: scenario.input.shiftHeld },
      catalog: corpus.data.mineObjectCatalog,
      random: {
        nextDouble() {
          const value = scenario.input.randomValues[randomCalls];
          if (value === undefined) {
            throw new Error(
              `${scenario.name} consumed an uncaptured pickaxe RNG draw.`,
            );
          }
          randomCalls++;
          return value;
        },
      },
    });
    if (result.type !== "craftPickaxe") {
      throw new Error(`${scenario.name}: expected a pickaxe craft result.`);
    }

    const expectedAfter = structuredClone(before);
    expectedAfter.resources["gems"] = scenario.result.gems.decimal;
    expectedAfter.pickaxe = {
      name: scenario.result.pickaxe.name,
      power: scenario.result.pickaxe.power.decimal,
      quality: scenario.result.pickaxe.quality.decimal,
    };
    const expectedSaves = scenario.saveSnapshots.map((snapshot) => {
      const expected = structuredClone(before);
      expected.resources["gems"] = snapshot.gems.decimal;
      expected.pickaxe = {
        name: snapshot.pickaxe.name,
        power: snapshot.pickaxe.power.decimal,
        quality: snapshot.pickaxe.quality.decimal,
      };
      return expected;
    });
    const expectedEventTypes = scenario.eventOrder.map((event) =>
      event === "save"
        ? "save"
        : event.includes("Got a new Pickaxe!")
          ? "pickaxe-replaced"
          : event.includes("crafted a dud!")
            ? "dud"
            : "insufficient-gems",
    );

    expect(randomCalls, `${scenario.name}: RNG draw count`).toBe(
      scenario.randomCalls,
    );
    expect(
      result.events.map(({ type }) => type),
      `${scenario.name}: ordered source events`,
    ).toEqual(expectedEventTypes);
    expect(
      result.effects.flatMap((effect) =>
        effect.type === "save" ? [completeStateSnapshot(effect.state)] : [],
      ),
      `${scenario.name}: exact state captured at each save`,
    ).toEqual(expectedSaves);
    expect(
      completeStateSnapshot(result.state),
      `${scenario.name}: final state`,
    ).toEqual(expectedAfter);
    expect(
      completeStateSnapshot(state),
      `${scenario.name}: input unchanged`,
    ).toEqual(before);
  }

  const bulkReplacement = scenarios.find(
    ({ name }) => name === "bulk-replacements-save-each-intermediate-state",
  );
  expect(
    bulkReplacement?.saveSnapshots.map(({ gems }) => gems.decimal),
  ).toEqual(["3", "0"]);
  expect(
    bulkReplacement?.saveSnapshots.map(({ pickaxe }) => pickaxe.name),
  ).toEqual(["Bad Mud Pick", "Sturdy Mud Pick"]);
});

it("matches source Gem Waster craft controls and click transitions", () => {
  const reference = corpus.data.pickaxeCraftingSemantics.craftControls;
  expect(reference.controlSourcePaths).toEqual([
    "index.html",
    "Scripts/Define/functions.js",
    "Scripts/Define/game.js",
  ]);

  for (const scenario of reference.controls) {
    const state = createInitialRemixSimulationState(
      corpus.data.mineObjectCatalog,
    );
    state.usedGemsLevel = scenario.input.usedGemsLevel;
    state.upgrades.money.gemWaster = scenario.input.moneyGemWasterLevel;
    state.upgrades.gems.gemWaster = scenario.input.gemUpgradeWasterLevel;
    const controls = getRemixCraftGemSelectionControls(state);
    const buttons = controls.visible
      ? [
          {
            disabled: controls.decreaseDisabled,
            image: controls.showDecreaseIcon ? "Images/btn_left.png" : null,
          },
          {
            disabled: controls.increaseDisabled,
            image: controls.showIncreaseIcon ? "Images/btn_right.png" : null,
          },
        ]
      : [];

    expect(
      {
        displayedGemCost: controls.gemCost.toNumber().toLocaleString("en-us"),
        gemCost: controls.gemCost.toString(),
        buttons,
      },
      scenario.name,
    ).toEqual({
      displayedGemCost: scenario.displayedGemCost,
      gemCost: scenario.gemCost.decimal,
      buttons: scenario.buttons,
    });
  }

  const state = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  state.upgrades.money.gemWaster = 1;
  state.upgrades.gems.gemWaster = 2;
  state.usedGemsLevel = 1;

  for (const scenario of reference.transitions) {
    const result = performRemixSimulationAction({
      state,
      action: {
        type: "changeCraftGemLevel",
        direction: scenario.direction,
      },
    });
    expect(result.type).toBe("changeCraftGemLevel");
    expect(result.state.usedGemsLevel).toBe(scenario.usedGemsLevel);
    expect(
      getRemixCraftGemSelectionControls(result.state).gemCost.toString(),
    ).toBe(scenario.gemCost.decimal);
    expect(result.effects).toEqual([]);
    Object.assign(state, result.state);
  }
});
