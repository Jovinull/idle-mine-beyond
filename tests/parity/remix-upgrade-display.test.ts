import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  Decimal,
  createInitialRemixSimulationState,
  type RemixSimulationState,
} from "../../packages/core/src/index.js";
import { createRemixFormatters } from "../../packages/formatting/src/index.js";
import {
  getRemixShopUpgradeDisplay,
  getRemixWisdomUpgradeDisplay,
} from "../../apps/web/src/lib/remix-upgrade-display.js";

const corpus = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  data: {
    mineObjectCatalog: Parameters<typeof createInitialRemixSimulationState>[0];
    upgradeSemantics: {
      groups: Record<
        string,
        Record<
          string,
          {
            name: string;
            description: string;
            samples: {
              level: number;
              levelDisplay: string;
              effectDisplay: string;
              priceDisplay: string;
            }[];
          }
        >
      >;
    };
  };
};

it("matches captured source labels and displays for every Money, Gem, and PC upgrade sample", () => {
  const formatter = createRemixFormatters()[0]!;
  const shopGroups = ["money", "gems", "planetCoins"] as const;

  for (const group of shopGroups) {
    for (const [key, upgrade] of Object.entries(
      corpus.data.upgradeSemantics.groups[group]!,
    )) {
      for (const sample of upgrade.samples) {
        const state: RemixSimulationState = createInitialRemixSimulationState(
          corpus.data.mineObjectCatalog,
        );
        state.highestMineObjectLevel = 171;
        (state.upgrades[group] as Record<string, number>)[key] = sample.level;

        const actual = getRemixShopUpgradeDisplay({
          group,
          key,
          level: sample.level,
          state,
          formatter,
        });
        expect(
          actual.levelDisplay,
          `${group}.${key} level ${sample.level}`,
        ).toBe(sample.levelDisplay);
        expect(
          actual.effectDisplay,
          `${group}.${key} level ${sample.level}`,
        ).toBe(sample.effectDisplay);
        expect(
          actual.priceDisplay,
          `${group}.${key} level ${sample.level}`,
        ).toBe(sample.priceDisplay);
      }
    }
  }
});

it("preserves source affordability styling when a saved level exceeds its cap", () => {
  const formatter = createRemixFormatters()[0]!;
  const state = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  state.resources.gems = new Decimal("1e100");
  state.upgrades.gems.blacksmithSkill = 50;

  const atCap = getRemixShopUpgradeDisplay({
    group: "gems",
    key: "blacksmithSkill",
    level: 50,
    state,
    formatter,
  });
  expect(atCap.affordable).toBe(false);
  expect(atCap.priceDisplay).toBe("Max");

  state.upgrades.gems.blacksmithSkill = 51;
  const aboveCap = getRemixShopUpgradeDisplay({
    group: "gems",
    key: "blacksmithSkill",
    level: 51,
    state,
    formatter,
  });
  expect(aboveCap.affordable).toBe(true);
  expect(aboveCap.priceDisplay).toBe("Max");
});

it("matches captured standalone Wisdom upgrade names and displays", () => {
  const formatter = createRemixFormatters()[0]!;
  const state = createInitialRemixSimulationState(
    corpus.data.mineObjectCatalog,
  );
  state.highestMineObjectLevel = 171;
  const sourceWisdom = corpus.data.upgradeSemantics.groups["wisdom"]!;

  for (const [key, upgrade] of Object.entries(sourceWisdom)) {
    for (const sample of upgrade.samples) {
      for (const upgradeKey of Object.keys(state.upgrades.wisdom)) {
        state.upgrades.wisdom[
          upgradeKey as keyof typeof state.upgrades.wisdom
        ] = 0;
      }
      state.upgrades.wisdom[key as keyof typeof state.upgrades.wisdom] =
        sample.level;
      const display = getRemixWisdomUpgradeDisplay({
        key: key as keyof typeof state.upgrades.wisdom,
        state,
        formatter,
      });
      expect(display.name, key).toBe(upgrade.name);
      expect(display.description, key).toBe(upgrade.description);
      expect(display.levelDisplay, `${key} level ${sample.level}`).toBe(
        sample.levelDisplay,
      );
      expect(display.effectDisplay, `${key} level ${sample.level}`).toBe(
        sample.effectDisplay,
      );
      expect(display.priceDisplay, `${key} level ${sample.level}`).toBe(
        sample.priceDisplay,
      );
    }
  }
});
