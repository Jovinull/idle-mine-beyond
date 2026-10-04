import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import {
  createBeyondVisualSaveFromRemixSave,
  createFreshBeyondVisualSave,
} from "./visual-state.js";

const fixedClock = 1_704_067_200_000;
// Windows and Linux each have pinned source screenshots (`-linux` on Linux).
const pixelComparison =
  process.platform === "win32" || process.platform === "linux";
const phaseFixtureUrl = new URL(
  "../fixtures/parity/remix-phase-differentials.json",
  import.meta.url,
);
const visualStatesUrl = new URL(
  "../fixtures/parity/remix-priority-visual-states.json",
  import.meta.url,
);

type PhaseFixture = {
  phases: Array<{
    id: string;
    saveString: string;
    start: { state: { currentObject: { name: string } } };
  }>;
};

type PriorityVisualStates = {
  powers: { saveString: string };
  captures: Array<{
    id: string;
    state: {
      currentObjectName: string;
      planetCoinTabVisible?: boolean;
    };
  }>;
};

type ReferenceCorpus = {
  data: { saveApplicationSemantics: { inputJson: string } };
};

type VisualCase = {
  readonly id: string;
  readonly family: "upgrades" | "powers" | "mining" | "primary" | "shop-gate";
  readonly viewport: { readonly width: number; readonly height: number };
  readonly theme: "light" | "dark";
  readonly gameTab: "main" | "story" | "settings" | "powers";
  readonly phaseId?: string;
  readonly upgradeTab?: "money" | "gems" | "planetcoins";
  readonly mineObjectLevel?: number;
  readonly highestMineObjectLevel?: number;
};

function getVisualCases(): VisualCase[] {
  const cases: VisualCase[] = [];
  for (const upgradeTab of ["money", "gems", "planetcoins"] as const) {
    for (const theme of ["light", "dark"] as const) {
      cases.push({
        id: `upgrades-space-${upgradeTab}-${theme}-1440x900`,
        family: "upgrades",
        viewport: { width: 1440, height: 900 },
        theme,
        gameTab: "main",
        upgradeTab,
        phaseId: "space",
      });
    }
  }
  for (const mineObjectLevel of [89, 90]) {
    for (const theme of ["light", "dark"] as const) {
      cases.push({
        id: `planetcoin-shop-gate-${mineObjectLevel}-${theme}-1440x900`,
        family: "shop-gate",
        viewport: { width: 1440, height: 900 },
        theme,
        gameTab: "main",
        mineObjectLevel,
        highestMineObjectLevel: mineObjectLevel,
      });
    }
  }
  for (const theme of ["light", "dark"] as const) {
    cases.push({
      id: `powers-wisdom-stars-${theme}-1440x900`,
      family: "powers",
      viewport: { width: 1440, height: 900 },
      theme,
      gameTab: "powers",
      phaseId: "wisdom-stars",
    });
  }
  for (const phaseId of ["space", "wisdom-stars", "galaxies"]) {
    for (const theme of ["light", "dark"] as const) {
      cases.push({
        id: `mining-${phaseId}-${theme}-1440x900`,
        family: "mining",
        viewport: { width: 1440, height: 900 },
        theme,
        gameTab: "main",
        phaseId,
      });
    }
  }
  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]) {
    const suffix = `${viewport.width}x${viewport.height}`;
    for (const gameTab of ["main", "story", "settings"] as const) {
      for (const theme of ["light", "dark"] as const) {
        cases.push({
          id: `primary-${gameTab}-${theme}-${suffix}`,
          family: "primary",
          viewport,
          theme,
          gameTab,
        });
      }
    }
  }
  return cases;
}

async function readSaveInputs() {
  const [phaseFixture, visualStates, referenceCorpus] = await Promise.all([
    readFile(phaseFixtureUrl, "utf8").then(JSON.parse) as Promise<PhaseFixture>,
    readFile(visualStatesUrl, "utf8").then(
      JSON.parse,
    ) as Promise<PriorityVisualStates>,
    readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ).then(JSON.parse) as Promise<ReferenceCorpus>,
  ]);
  return {
    phases: new Map(phaseFixture.phases.map((phase) => [phase.id, phase])),
    visualStates,
    referenceCorpus,
  };
}

async function prepareBeyondScreen(
  page: import("@playwright/test").Page,
  capture: VisualCase,
  saves: Awaited<ReturnType<typeof readSaveInputs>>,
) {
  await page.setViewportSize(capture.viewport);
  const sourceSave =
    capture.family === "shop-gate"
      ? (() => {
          const save = JSON.parse(
            saves.referenceCorpus.data.saveApplicationSemantics.inputJson,
          ) as {
            mineObjectLevel: number;
            highestMineObjectLevel: number;
            lastActive: number;
            settings: { theme: string; tab: string; upgradeTab: string };
          };
          save.mineObjectLevel = capture.mineObjectLevel!;
          save.highestMineObjectLevel = capture.highestMineObjectLevel!;
          save.lastActive = fixedClock;
          save.settings.theme = capture.theme;
          save.settings.tab = "main";
          save.settings.upgradeTab = "money";
          return encodeRemixLegacySave(save);
        })()
      : capture.family === "powers"
        ? saves.visualStates.powers.saveString
        : capture.phaseId
          ? saves.phases.get(capture.phaseId)?.saveString
          : undefined;
  const serialized = sourceSave
    ? await createBeyondVisualSaveFromRemixSave({
        clockMs: fixedClock,
        theme: capture.theme,
        tab: capture.gameTab,
        saveString: sourceSave,
      })
    : await createFreshBeyondVisualSave({
        clockMs: fixedClock,
        theme: capture.theme,
        tab: "main",
      });

  await page.addInitScript(
    ({ now, save }) => {
      localStorage.clear();
      localStorage.setItem("IdleMineBeyond", save);
      Object.defineProperty(Date, "now", {
        configurable: true,
        value: () => now,
      });
    },
    { now: fixedClock, save: serialized },
  );
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  if (capture.family === "upgrades" && capture.upgradeTab !== "money") {
    const beyondGroup =
      capture.upgradeTab === "planetcoins" ? "planetCoins" : capture.upgradeTab;
    await page.locator(`[data-upgrade-tab="${beyondGroup}"]`).click();
  }
  if (capture.family === "primary" && capture.gameTab !== "main") {
    await page.locator(`[data-game-tab="${capture.gameTab}"]`).click();
  }
  if (capture.family === "powers") {
    await expect(page.locator("[data-powers-panel]")).toBeVisible();
  }
  if (capture.family === "upgrades") {
    await expect(page.locator(".upgradelist-wrapper")).toBeVisible();
  }
  if (capture.family === "mining") {
    await expect(page.locator("canvas.mine-object")).toHaveAttribute(
      "data-rendered",
      "true",
    );
  }
  if (capture.family === "shop-gate") {
    const sourceState = saves.visualStates.captures.find(
      ({ id }) => id === capture.id,
    );
    if (!sourceState)
      throw new Error(`Missing source state for ${capture.id}.`);
    const planetCoinTab = page.locator("[data-upgrade-tab='planetCoins']");
    if (!sourceState.state.planetCoinTabVisible) {
      await expect(planetCoinTab).toHaveCount(0);
    } else {
      await expect(planetCoinTab).toBeVisible();
    }
    const zeroDamageLabels = page.locator(".stats .resources p.red");
    await expect(zeroDamageLabels).toHaveCount(2);
    await expect(zeroDamageLabels.first()).toHaveCSS(
      "color",
      capture.theme === "dark" ? "rgb(255, 108, 104)" : "rgb(169, 5, 0)",
    );
  }
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({
    content:
      'img[src$="wisdom.png"] { animation: none !important; transform: none !important; }',
  });
  await page.mouse.move(
    capture.viewport.width - 1,
    capture.viewport.height - 1,
  );
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
}

for (const capture of getVisualCases()) {
  test(`compares pinned Remix ${capture.id}`, async ({ page }) => {
    const saves = await readSaveInputs();
    await prepareBeyondScreen(page, capture, saves);

    if (capture.family === "upgrades") {
      const expectedCounts = { money: 8, gems: 7, planetcoins: 7 };
      const beyondGroup =
        capture.upgradeTab === "planetcoins"
          ? "planetCoins"
          : (capture.upgradeTab ?? "money");
      await expect(
        page.locator(`[data-upgrade-group="${beyondGroup}"]`),
      ).toHaveCount(expectedCounts[capture.upgradeTab ?? "money"]);
    } else if (capture.family === "powers") {
      await expect(page.locator(".powers-table")).toBeVisible();
      await expect(page.locator("[data-powers-panel]")).toContainText(
        "Craftsmenship",
      );
    } else if (capture.family === "mining") {
      const phase = saves.phases.get(capture.phaseId ?? "");
      if (!phase) throw new Error(`Missing phase ${capture.phaseId}.`);
      const sourceObject = phase.start.state.currentObject.name;
      await expect(page.locator(".mineobject h2")).toHaveText(sourceObject);
    } else if (capture.family === "shop-gate") {
      const sourceState = saves.visualStates.captures.find(
        ({ id }) => id === capture.id,
      );
      if (!sourceState)
        throw new Error(`Missing source state for ${capture.id}.`);
      await expect(page.locator(".mineobject h2")).toHaveText(
        sourceState.state.currentObjectName,
      );
    } else if (capture.gameTab === "story") {
      await expect(page.locator(".chapter-control h3")).toHaveText(
        "Chapter 1: Welcome to Idle Mine: Remix!",
      );
    } else if (capture.gameTab === "settings") {
      await expect(
        page.getByRole("heading", { name: "Settings" }),
      ).toBeVisible();
    } else {
      await expect(page.locator(".mineobject h2")).toHaveText("Mud");
    }

    // Shop-gate screenshots are Windows-only (see capture-remix-priority-visuals.mjs).
    const hasPixelBaseline =
      pixelComparison &&
      !(process.platform === "linux" && capture.family === "shop-gate");
    if (hasPixelBaseline) {
      await expect(page).toHaveScreenshot(`remix-${capture.id}.png`, {
        maxDiffPixels: 0,
      });
    }
  });
}
