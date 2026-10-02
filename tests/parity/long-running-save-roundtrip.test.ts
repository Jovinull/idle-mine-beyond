import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  createInitialRemixSimulationState,
  type RemixMineObjectCatalog,
} from "../../packages/core/src/index.js";
import {
  createInitialRemixLegacySaveApplicationState,
  createRemixLegacySaveExportData,
  decodeRemixBeyondSave,
  decodeRemixLegacySave,
  encodeRemixBeyondSave,
  encodeRemixLegacySave,
  loadRemixLegacySaveIntoState,
  restoreRemixBeyondSave,
} from "../../packages/persistence/src/index.js";

const legacyTemplatePackage = JSON.parse(
  await readFile(
    new URL(
      "../../packages/content/src/remix-legacy-save-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { template: Record<string, unknown> };

type LongRunningRouteCapture = {
  saveString: string;
  routeIterations: number;
  totalActiveClicks: number;
  craftAttempts: number;
  farmBreaks: number;
  storyState: {
    page: number;
    highestMineObjectLevel: number;
    highestUnlocked: number;
    notifications: number;
  };
};

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as { data: { mineObjectCatalog: RemixMineObjectCatalog } };

const storyRuntime = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
    "utf8",
  ),
) as {
  source: { commit: string };
  spookyBoneProgression: {
    millionaireProgression: {
      chapter3Progression: LongRunningRouteCapture;
      chapter4Progression: LongRunningRouteCapture;
      chapter5Progression: LongRunningRouteCapture;
      chapter6Progression: LongRunningRouteCapture;
    };
  };
};

const chapterSaves = [
  {
    chapter: "3",
    capture:
      storyRuntime.spookyBoneProgression.millionaireProgression
        .chapter3Progression,
  },
  {
    chapter: "4",
    capture:
      storyRuntime.spookyBoneProgression.millionaireProgression
        .chapter4Progression,
  },
  {
    chapter: "5",
    capture:
      storyRuntime.spookyBoneProgression.millionaireProgression
        .chapter5Progression,
  },
  {
    chapter: "6",
    capture:
      storyRuntime.spookyBoneProgression.millionaireProgression
        .chapter6Progression,
  },
];

function decodeOriginalSavedJson(saveString: string) {
  const encodedJson = Buffer.from(saveString, "base64").toString("latin1");
  return JSON.parse(
    decodeURIComponent(decodeURIComponent(encodedJson)),
  ) as Record<string, unknown>;
}

it.each(chapterSaves)(
  "imports and reloads the gameplay-generated Chapter $chapter save",
  ({ capture }) => {
    expect(storyRuntime.source.commit).toBe(
      "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
    );
    expect(capture.routeIterations).toBeGreaterThan(0);
    expect(capture.totalActiveClicks).toBeGreaterThan(0);
    expect(capture.saveString.length).toBeGreaterThan(160_000);

    const importedDecode = decodeRemixLegacySave(capture.saveString);
    expect(importedDecode.status).toBe("success");
    if (importedDecode.status !== "success") {
      throw new Error(`Chapter save decode failed: ${importedDecode.status}.`);
    }
    const sourceSave = decodeOriginalSavedJson(capture.saveString);
    expect(encodeRemixLegacySave(sourceSave)).toBe(capture.saveString);

    const sourceSettings = sourceSave["settings"] as Record<string, unknown>;
    const freshState = createInitialRemixLegacySaveApplicationState(
      createInitialRemixSimulationState(corpus.data.mineObjectCatalog),
    );
    const loaded = loadRemixLegacySaveIntoState({
      state: {
        ...freshState,
        simulation: {
          ...freshState.simulation,
          // Remix keeps this session selector outside loadGame's field application.
          usedGemsLevel: sourceSave["usedGemsLevel"] as number,
        },
        settings: {
          ...freshState.settings,
          tab: sourceSettings["tab"] as string,
          upgradeTab: sourceSettings["upgradeTab"] as string,
          exportFieldString: sourceSettings["exportFieldString"] as string,
        },
      },
      saveString: capture.saveString,
      catalog: corpus.data.mineObjectCatalog,
      clock: { now: () => 1_704_067_200_000 },
      resolveNumberFormatter: () => () => "",
      noOffline: true,
    });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") {
      throw new Error(`Chapter save import failed: ${loaded.status}.`);
    }

    const sourceMessageLog = sourceSave["messageLog"] as {
      message: string;
      color: string;
    }[];
    const sourceLastActive = sourceSave["lastActive"] as number;
    const exportedLegacy = createRemixLegacySaveExportData(
      loaded.state,
      sourceLastActive,
      legacyTemplatePackage.template,
      sourceMessageLog,
    );
    const sourceMismatches = Object.keys(sourceSave).filter(
      (key) =>
        JSON.stringify(exportedLegacy[key]) !== JSON.stringify(sourceSave[key]),
    );
    expect(sourceMismatches, "complete legacy export fields").toEqual([]);
    expect(encodeRemixLegacySave(exportedLegacy)).toBe(capture.saveString);

    const { simulation } = loaded.state;
    expect(simulation.mineObjectLevel).toBe(sourceSave["mineObjectLevel"]);
    expect(simulation.highestMineObjectLevel).toBe(
      sourceSave["highestMineObjectLevel"],
    );
    expect(simulation.currentObject.name).toBe(
      (sourceSave["currentMineObject"] as { name: string }).name,
    );
    expect({
      money: simulation.resources.money.toString(),
      highestMoney: simulation.resources.highestMoney.toString(),
      gems: simulation.resources.gems.toString(),
      planetCoins: simulation.resources.planetCoins.toString(),
      maxPlanetCoins: simulation.resources.maxPlanetCoins.toString(),
      wisdom: simulation.resources.wisdom.toString(),
      maxWisdom: simulation.resources.maxWisdom.toString(),
    }).toEqual(
      Object.fromEntries(
        [
          "money",
          "highestMoney",
          "gems",
          "planetCoins",
          "maxPlanetCoins",
          "wisdom",
          "maxWisdom",
        ].map((field) => [field, sourceSave[field]]),
      ),
    );
    expect(simulation.story).toEqual({
      page: capture.storyState.page,
      highestUnlocked: capture.storyState.highestUnlocked,
      notifications: capture.storyState.notifications,
    });
    expect(simulation.highestMineObjectLevel).toBe(
      capture.storyState.highestMineObjectLevel,
    );

    const serializedBeyond = encodeRemixBeyondSave(loaded.state);
    const decodedBeyond = decodeRemixBeyondSave(serializedBeyond);
    expect(decodedBeyond.status).toBe("valid");
    if (decodedBeyond.status !== "valid") {
      throw new Error(
        `Beyond save validation failed: ${decodedBeyond.status}.`,
      );
    }
    const reloadedBeyond = restoreRemixBeyondSave(
      decodedBeyond.save,
      corpus.data.mineObjectCatalog,
    );
    expect(encodeRemixBeyondSave(reloadedBeyond)).toBe(serializedBeyond);
  },
);
