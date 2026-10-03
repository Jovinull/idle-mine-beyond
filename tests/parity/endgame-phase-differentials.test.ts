import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createBrotliDecompress } from "node:zlib";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  performRemixSimulationAction,
  selectRemixMineObject,
  type RemixMineObjectCatalog,
  type RemixSimulationState,
  type RemixStoryMilestone,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  loadRemixLegacySaveIntoState,
} from "../../packages/persistence/src/index.js";

type RandomCursor = { seed: number; draws: number; state: number };
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
    drops: Record<string, { chance: number; amount: string }>;
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
    Record<string, number>
  >;
  pickaxe: { name: string; power: string; quality: string };
  autoPickaxeTimer: number;
  saveTimer: number;
  powersUnlocked: boolean;
  usedGemsLevel: number;
  lastActiveMs: number | undefined;
  story: { page: number; highestUnlocked: number; notifications: number };
};
type DifferentialAction =
  | { type: "activeClick" }
  | { type: "idleFrame"; deltaSeconds: number }
  | { type: "select"; level: number }
  | {
      type: "purchase";
      group: "money";
      key: keyof RemixSimulationState["upgrades"]["money"];
    }
  | {
      type: "purchase";
      group: "gems";
      key: keyof RemixSimulationState["upgrades"]["gems"];
    }
  | {
      type: "purchase";
      group: "planetCoins";
      key: keyof RemixSimulationState["upgrades"]["planetCoins"];
    }
  | {
      type: "purchase";
      group: "wisdom";
      key: keyof RemixSimulationState["upgrades"]["wisdom"];
    }
  | { type: "craftPickaxe"; shiftHeld: false };
type DifferentialCheckpoint = {
  label: string;
  state: SimulationSnapshot;
  random: RandomCursor;
};
type PhaseDifferential = {
  id: string;
  heading: string;
  storyPage: number;
  mineObjectLevel: number;
  milestone: string;
  milestoneUnlocked: boolean;
  nextObjective: string;
  saveString: string;
  start: { state: SimulationSnapshot; random: RandomCursor };
  traces: {
    id: string;
    rngSeed: number;
    sequenceSeed: number;
    trace: { file: string; records: number; rawSha256: string };
  }[];
};
type PhaseFixture = {
  source: {
    repository: string;
    commit: string;
    browser: { name: string; version: string };
    capturedOn: string;
    captureKind: string;
    actionCountPerTrace: number;
    rngSeeds: number[];
    sequenceSeeds: number[];
    traceNote: string;
  };
  phases: PhaseDifferential[];
};

const fixture = JSON.parse(
  await readFile(
    new URL(
      "../fixtures/parity/remix-phase-differentials.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as PhaseFixture;
const reference = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as { data: { mineObjectCatalog: RemixMineObjectCatalog } };
const storyMilestones = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-story-milestones.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { milestones: RemixStoryMilestone[] };
const manifest = JSON.parse(
  await readFile(
    new URL(
      "../../docs/knowledge/sources/reference-manifest.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { references: { name: string; pinnedCommit: string }[] };
const catalog = reference.data.mineObjectCatalog;
const fixedClock = 1_704_067_200_000;

class SourceMathRandom {
  private state: number;
  private draws: number;

  constructor(cursor: RandomCursor) {
    this.state = cursor.state >>> 0;
    this.draws = cursor.draws;
    this.seed = cursor.seed;
  }

  private seed: number;

  nextDouble() {
    this.state = (Math.imul(this.state, 1_664_525) + 1_013_904_223) >>> 0;
    this.draws++;
    return this.state / 0x1_0000_0000;
  }

  cursor(): RandomCursor {
    return { seed: this.seed, draws: this.draws, state: this.state };
  }
}

class DifferentialClock {
  constructor(private currentTimeMs: number) {}

  advance(seconds: number) {
    this.currentTimeMs += seconds * 1000;
  }

  now() {
    return this.currentTimeMs;
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

function loadPhaseStart(phase: PhaseDifferential) {
  const loaded = loadRemixLegacySaveIntoState({
    state: createInitialRemixLegacySaveApplicationState(
      createInitialRemixSimulationState(catalog),
    ),
    saveString: phase.saveString,
    catalog,
    clock: { now: () => fixedClock },
    resolveNumberFormatter: () => () => "",
    noOffline: true,
  });
  expect(loaded.status, `${phase.id} Remix save loads`).toBe("loaded");
  if (loaded.status !== "loaded") {
    throw new Error(`${phase.id} Remix save failed to load: ${loaded.status}`);
  }
  const state = loaded.state.simulation;
  expect(simulationSnapshot(state), `${phase.id} saved starting state`).toEqual(
    phase.start.state,
  );
  expect(state.mineObjectLevel).toBe(phase.mineObjectLevel);
  expect(state.story.page).toBe(phase.storyPage);
  expect(phase.milestoneUnlocked).toBe(true);
  return state;
}

function applyDifferentialAction(
  state: RemixSimulationState,
  random: SourceMathRandom,
  event: DifferentialAction,
  clock: DifferentialClock,
) {
  if (event.type === "select") {
    return selectRemixMineObject(state, event.level, catalog);
  }
  if (event.type === "purchase") {
    if (event.group === "money") {
      return performRemixSimulationAction({
        state,
        action: {
          type: "upgradePurchase",
          group: event.group,
          key: event.key,
          operation: { method: "buy" },
        },
      }).state;
    }
    if (event.group === "gems") {
      return performRemixSimulationAction({
        state,
        action: {
          type: "upgradePurchase",
          group: event.group,
          key: event.key,
          operation: { method: "buy" },
        },
      }).state;
    }
    if (event.group === "planetCoins") {
      return performRemixSimulationAction({
        state,
        action: {
          type: "upgradePurchase",
          group: event.group,
          key: event.key,
          operation: { method: "buy" },
        },
      }).state;
    }
    return performRemixSimulationAction({
      state,
      action: {
        type: "upgradePurchase",
        group: event.group,
        key: event.key,
        operation: { method: "buy" },
      },
    }).state;
  }
  if (event.type === "craftPickaxe") {
    return performRemixSimulationAction({
      state,
      action: event,
      catalog,
      random,
    }).state;
  }
  if (event.type === "idleFrame") {
    clock.advance(event.deltaSeconds);
  }
  const result = performRemixSimulationAction({
    state,
    action: event,
    catalog,
    storyMilestones: storyMilestones.milestones,
    random,
  });
  return result.effects.some((effect) => effect.type === "save")
    ? { ...result.state, lastActiveMs: clock.now() }
    : result.state;
}

async function replayPhase(
  phase: PhaseDifferential,
  seedTrace: PhaseDifferential["traces"][number],
) {
  const initialState = loadPhaseStart(phase);
  const random = new SourceMathRandom({
    seed: seedTrace.rngSeed,
    draws: 0,
    state: seedTrace.rngSeed,
  });
  const clock = new DifferentialClock(fixedClock);
  let state = initialState;
  const filePath = new URL(
    `../fixtures/parity/${seedTrace.trace.file}`,
    import.meta.url,
  );
  const lines = createInterface({
    input: createReadStream(filePath).pipe(createBrotliDecompress()),
    crlfDelay: Infinity,
  });
  const rawHash = createHash("sha256");
  let count = 0;
  const actionTypes = new Set<DifferentialAction["type"]>();
  for await (const line of lines) {
    rawHash.update(`${line}\n`);
    const record = JSON.parse(line) as {
      event: DifferentialAction;
      checkpoint: DifferentialCheckpoint;
    };
    count++;
    actionTypes.add(record.event.type);
    expect(record.checkpoint.label).toBe(`phase-action-${count}`);
    state = applyDifferentialAction(state, random, record.event, clock);
    expect(
      simulationSnapshot(state),
      `${phase.id}/${seedTrace.id} state after action ${count} (${record.event.type})`,
    ).toEqual(record.checkpoint.state);
    expect(
      random.cursor(),
      `${phase.id}/${seedTrace.id} RNG after action ${count}`,
    ).toEqual(record.checkpoint.random);
  }
  expect(count, `${phase.id}/${seedTrace.id} action checkpoint count`).toBe(
    seedTrace.trace.records,
  );
  expect([...actionTypes].sort()).toEqual(
    ["activeClick", "craftPickaxe", "idleFrame", "purchase", "select"].sort(),
  );
  expect(
    rawHash.digest("hex"),
    `${phase.id}/${seedTrace.id} source action trace hash`,
  ).toBe(seedTrace.trace.rawSha256);
}

it("pins the controlled endgame phase starts to the Remix source", () => {
  expect(fixture.source.repository).toBe(
    "https://github.com/Jovinull/idle-mine-remix",
  );
  expect(fixture.source.commit).toBe(
    manifest.references.find(({ name }) => name === "Idle Mine: Remix")
      ?.pinnedCommit,
  );
  expect(fixture.source.captureKind).toBe(
    "controlled Remix runtime phase-start save",
  );
  expect(fixture.phases.map(({ id }) => id)).toEqual([
    "space",
    "wisdom-stars",
    "galaxies",
  ]);
  expect(fixture.source.rngSeeds).toEqual([7454, 2026, 0xdeadbeef]);
  expect(fixture.phases.every(({ traces }) => traces.length === 3)).toBe(true);
  for (const phase of fixture.phases) {
    expect(phase.traces.map(({ rngSeed }) => rngSeed)).toEqual(
      fixture.source.rngSeeds,
    );
    expect(phase.traces.map(({ sequenceSeed }) => sequenceSeed)).toEqual(
      fixture.source.sequenceSeeds,
    );
  }
  expect(
    fixture.phases.flatMap(({ traces }) =>
      traces.map(({ trace }) => trace.records),
    ),
  ).toEqual(Array(9).fill(fixture.source.actionCountPerTrace));
  expect(
    fixture.phases.every(({ milestoneUnlocked }) => milestoneUnlocked),
  ).toBe(true);
});

it.each(
  fixture.phases.flatMap((phase) =>
    phase.traces.map((seedTrace) => ({ phase, seedTrace })),
  ),
)(
  "replays $phase.id from its captured Remix save with $seedTrace.id after every randomized action",
  async ({ phase, seedTrace }) => replayPhase(phase, seedTrace),
  1_800_000,
);
