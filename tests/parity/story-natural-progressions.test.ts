import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

const runtime = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
    "utf8",
  ),
) as {
  source: { commit: string };
  tenThousandProgression: {
    miningSetup: { money: string; gems: string };
    rockFarming: { endingMoney: string; endingGems: string };
  };
  spookyBoneProgression: {
    millionaireProgression: {
      scenario: string;
      miningSetup: {
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        money: string;
        gems: string;
      };
      hitsPerRock: number;
      breaksToThreshold: number;
      rockFarming: {
        activeHits: number;
        endingMoney: string;
        highestMoney: string;
        endingGems: string;
        totalGemDrops: number;
        firstGemDropBreaks: number[];
        lastGemDropBreaks: number[];
        finalBreak: {
          breakNumber: number;
          storyHighestUnlocked: number;
          storyNotifications: number;
          firstSpookyBoneUnlocked: boolean;
          millionaireUnlocked: boolean;
          nextObjective: string;
        };
      };
      nextObjectProbe: {
        millionaireState: {
          mineObjectLevel: number;
          highestMineObjectLevel: number;
          money: string;
          gems: string;
          powerMining: string;
          pickaxeDamage: string;
          activeDamage: string;
        };
        nextSelectableObject: {
          mineObjectLevel: number;
          highestMineObjectLevel: number;
          name: string;
          hp: string;
          defense: string;
          value: string;
          activeDamage: string;
          idleDamage: string;
        };
        restoredMineObjectLevel: number;
        restoredObjectName: string;
      };
      sourceInteractionProgression: {
        scenario: string;
        startingState: Record<string, string | number>;
        upgradePurchases: Record<string, string | number>;
        crafting: Record<string, string | number | boolean>;
        minedObjects: {
          id: number;
          name: string;
          breakClicks: number;
          reached: boolean;
          highestMineObjectLevel: number;
          firstSpookyBoneUnlocked: boolean;
        }[];
        storyEntry: Record<string, string | number | boolean | string[]>;
        endingState: Record<string, string | number | boolean>;
      };
      storyStates: {
        tab: string;
        theme: string;
        page: number;
        notifications: number;
        highestUnlocked: number;
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        currentObjectName: string;
        money: string;
        highestMoney: string;
        gems: string;
        visibleMilestones: string[];
        firstSpookyBoneUnlocked: boolean;
        millionaireUnlocked: boolean;
        nextObjective: string;
      }[];
      restoredState: {
        mineObjectLevel: number;
        highestMineObjectLevel: number;
        money: string;
        highestMoney: string;
        gems: string;
        storyHighestUnlocked: number;
        storyNotifications: number;
        tab: string;
      };
    };
  };
};

const progression = runtime.spookyBoneProgression.millionaireProgression;

it("captures natural Rock progress to the independent millionaire Story milestone", () => {
  expect(runtime.source.commit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(progression.scenario).toBe(
    "10,000-Money-Rock-plus-8,250-natural-breaks-to-1,000,000-Money",
  );
  expect(progression.miningSetup).toMatchObject({
    mineObjectLevel: 4,
    highestMineObjectLevel: 5,
    money: "10053",
    gems: runtime.tenThousandProgression.rockFarming.endingGems,
  });
  expect(progression).toMatchObject({
    hitsPerRock: 257,
    breaksToThreshold: 8250,
  });
  expect(progression.rockFarming).toMatchObject({
    activeHits: 2_120_250,
    endingMoney: "1000053.0000000001",
    highestMoney: "1000053.0000000001",
    endingGems: "182",
    totalGemDrops: 175,
    firstGemDropBreaks: [18, 39, 63, 84, 141],
    lastGemDropBreaks: [7952, 8049, 8079, 8099, 8107],
    finalBreak: {
      breakNumber: 8250,
      storyHighestUnlocked: 9,
      storyNotifications: 1,
      firstSpookyBoneUnlocked: false,
      millionaireUnlocked: true,
      nextObjective:
        "Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)",
    },
  });
  expect(progression.nextObjectProbe).toEqual({
    millionaireState: {
      mineObjectLevel: 4,
      highestMineObjectLevel: 5,
      money: "1000053.0000000001",
      gems: "182",
      powerMining: "1",
      pickaxeDamage: "98.58821575844182",
      activeDamage: "8.5882157584418",
    },
    nextSelectableObject: {
      mineObjectLevel: 5,
      highestMineObjectLevel: 5,
      name: "Coal",
      hp: "4000",
      defense: "200",
      value: "275",
      activeDamage: "0",
      idleDamage: "0",
    },
    restoredMineObjectLevel: 4,
    restoredObjectName: "Rock",
  });
  const sourceInteraction = progression.sourceInteractionProgression;
  expect(sourceInteraction).toMatchObject({
    scenario:
      "millionaire-save-with-source-upgrades-single-gem-crafting-and-active-mining",
    startingState: {
      mineObjectLevel: 5,
      highestMineObjectLevel: 5,
      currentObjectName: "Coal",
      money: "1000053.0000000001",
      gems: "182",
      pickaxeDamage: "98.58821575844182",
      blacksmithLevel: 2,
      activePowerLevel: 0,
    },
    upgradePurchases: {
      blacksmithPurchases: 45,
      blacksmithStartLevel: 2,
      blacksmithLevel: 47,
      activePowerPurchases: 7,
      activePowerStartLevel: 0,
      activePowerLevel: 7,
      moneyAfterPurchases: "2300.410590093",
    },
    crafting: {
      startingGems: "182",
      usedGemsPerCraft: "1",
      attempts: 1,
      improvedPickaxes: 1,
      remainingGems: "181",
      pickaxeName: 'Normal Pick "Igico"',
      pickaxePower: "2843.350920445769",
      pickaxeQuality: "1.114461284604624",
      pickaxeDamage: "3168.8045193817316",
      activeDamageOnSpookyBone: "2589.32121920701",
      targetReached: true,
    },
    minedObjects: [
      { id: 5, name: "Coal", breakClicks: 1, highestMineObjectLevel: 6 },
      { id: 6, name: "Bone", breakClicks: 1, highestMineObjectLevel: 7 },
      { id: 7, name: "Lead", breakClicks: 2, highestMineObjectLevel: 8 },
      { id: 8, name: "Iron", breakClicks: 3, highestMineObjectLevel: 9 },
      { id: 9, name: "Copper", breakClicks: 4, highestMineObjectLevel: 10 },
      { id: 10, name: "Carbonite", breakClicks: 8, highestMineObjectLevel: 11 },
      { id: 11, name: "Quartz", breakClicks: 16, highestMineObjectLevel: 12 },
      {
        id: 12,
        name: "Spooky Bone",
        breakClicks: 36,
        highestMineObjectLevel: 13,
        firstSpookyBoneUnlocked: true,
      },
    ],
    storyEntry: {
      tab: "story",
      page: 1,
      notificationsBeforeEntry: 0,
      notificationsAfterEntry: 0,
      highestUnlocked: 9,
      maxStoryPage: 1,
      visibleMilestones: [
        "firstStone",
        "tenThousand",
        "firstSpookyBone",
        "millionaire",
      ],
      firstSpookyBoneUnlocked: true,
      nextObjective: "Reach Emerald",
    },
    endingState: {
      mineObjectLevel: 12,
      highestMineObjectLevel: 13,
      currentObjectName: "Spooky Bone",
      money: "37105.410590093",
      gems: "181",
      firstSpookyBoneUnlocked: true,
    },
  });
  expect(sourceInteraction.minedObjects.every((object) => object.reached)).toBe(
    true,
  );
  expect(
    sourceInteraction.minedObjects
      .slice(0, -1)
      .every((object) => !object.firstSpookyBoneUnlocked),
  ).toBe(true);
  expect(progression.storyStates).toHaveLength(2);
  for (const state of progression.storyStates) {
    expect(state).toMatchObject({
      tab: "story",
      page: 1,
      notifications: 0,
      highestUnlocked: 9,
      mineObjectLevel: 4,
      highestMineObjectLevel: 5,
      currentObjectName: "Rock",
      money: "1000053.0000000001",
      highestMoney: "1000053.0000000001",
      gems: "182",
      visibleMilestones: ["firstStone", "tenThousand", "millionaire"],
      firstSpookyBoneUnlocked: false,
      millionaireUnlocked: true,
      nextObjective:
        "Mine a Spooky Bone (6 / 14) (Reach Mineral number 13 and break it to reach mineral number 14)",
    });
  }
  expect(progression.restoredState).toMatchObject({
    mineObjectLevel: 4,
    highestMineObjectLevel: 5,
    money: "10053",
    highestMoney: "10053",
    gems: "7",
    storyHighestUnlocked: 7,
    storyNotifications: 0,
    tab: "main",
  });
});
