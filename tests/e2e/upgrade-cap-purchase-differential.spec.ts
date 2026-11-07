import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type ShopGroup = "money" | "gems" | "planetCoins";
type LegacySave = {
  money: string;
  gems: string;
  planetCoins: string;
  highestMineObjectLevel: number;
  mineObjectLevel: number;
  lastActive: number;
  pickaxe: { name: string; pow: string; quality: string };
  settings: {
    tab: string;
    theme: string;
    upgradeTab?: string;
    [key: string]: unknown;
  };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
};
type Upgrade = {
  image: string;
  maxLevel: number | "Infinity";
  samples: { level: number; levelDisplay: string }[];
};
type Fixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      groups: Record<ShopGroup, Record<string, Upgrade>>;
    };
  };
};

const fixedTime = 1_700_000_000_000;
const groupLabels: Record<ShopGroup, string> = {
  money: "Money Upgrades",
  gems: "Gem Upgrades",
  planetCoins: "PC Upgrades",
};
const levelMaps = {
  money: "upgrades",
  gems: "gemUpgrades",
  planetCoins: "planetCoinUpgrades",
} as const;
const scenarios = [
  { group: "money", key: "gemChance" },
  { group: "gems", key: "offlineGems" },
  { group: "planetCoins", key: "activePower" },
] as const satisfies readonly { group: ShopGroup; key: string }[];

function makeSave(
  source: LegacySave,
  fixture: Fixture["data"]["upgradeSemantics"]["groups"],
  scenario: { group: ShopGroup; key: string; level: number },
): string {
  const save = structuredClone(source);
  save.money = "0";
  save.gems = "0";
  save.planetCoins = "0";
  save[scenario.group] = "1e1000";
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.theme = "light";
  save.settings.upgradeTab = scenario.group;
  save.upgrades = Object.fromEntries(
    Object.keys(fixture.money).map((key) => [key, { level: 0 }]),
  );
  save.gemUpgrades = Object.fromEntries(
    Object.keys(fixture.gems).map((key) => [key, { level: 0 }]),
  );
  save.planetCoinUpgrades = Object.fromEntries(
    Object.keys(fixture.planetCoins).map((key) => [key, { level: 0 }]),
  );
  save[levelMaps[scenario.group]][scenario.key] = { level: scenario.level };
  save.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  return encodeRemixLegacySave(save);
}

async function seedAndReload(
  page: Page,
  encoded: string,
  runtime: "beyond" | "remix",
): Promise<void> {
  await page.evaluate((save) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", save);
  }, encoded);
  await page.reload();
  if (runtime === "beyond") {
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );
  } else {
    await page.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );
  }
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

test("matches modifier purchases at and immediately below finite shop caps", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as Fixture;
  const sourceSave = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await page.addInitScript((time) => {
      Date.now = () => time;
    }, fixedTime);
    await sourcePage.addInitScript((time) => {
      Date.now = () => time;
    }, fixedTime);
    await Promise.all([
      page.emulateMedia({ colorScheme: "light" }),
      page.setViewportSize({ width: 1440, height: 900 }),
      page.goto("/"),
      sourcePage.goto(sourceUrl),
    ]);

    for (const { group, key } of scenarios) {
      const upgrade = fixture.data.upgradeSemantics.groups[group][key]!;
      const cap = upgrade.maxLevel;
      expect(
        Number.isFinite(cap),
        `${group}.${key} has a finite source cap`,
      ).toBe(true);
      const finiteCap = cap as number;
      const imageName = upgrade.image.split("/").at(-1)!;
      const card = page.locator(
        `[data-upgrade-group="${group}"][data-upgrade-key="${key}"]`,
      );
      const sourceCard = sourcePage
        .locator(".upgradelist .upgrade")
        .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
        .first();

      await test.step(`${group}.${key} Shift purchase reaches cap ${finiteCap}`, async () => {
        const encoded = makeSave(
          sourceSave,
          fixture.data.upgradeSemantics.groups,
          {
            group,
            key,
            level: finiteCap - 1,
          },
        );
        await Promise.all([
          seedAndReload(page, encoded, "beyond"),
          seedAndReload(sourcePage, encoded, "remix"),
        ]);
        await Promise.all([
          page.locator(`[data-upgrade-tab="${group}"]`).click(),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: groupLabels[group] })
            .click(),
        ]);
        const belowCap = upgrade.samples.find(
          (sample) => sample.level === finiteCap - 1,
        )!;
        await expect(card.locator(".lvl")).toHaveText(belowCap.levelDisplay);
        await expect(sourceCard.locator(".lvl")).toHaveText(
          belowCap.levelDisplay,
        );

        await Promise.all([
          page.keyboard.down("Shift"),
          sourcePage.keyboard.down("Shift"),
        ]);
        try {
          await Promise.all([card.click(), sourceCard.click()]);
        } finally {
          await Promise.all([
            page.keyboard.up("Shift"),
            sourcePage.keyboard.up("Shift"),
          ]);
        }

        const atCap = upgrade.samples.find(
          (sample) => sample.level === finiteCap,
        )!;
        await expect(card.locator(".lvl")).toHaveText(atCap.levelDisplay);
        await expect(sourceCard.locator(".lvl")).toHaveText(atCap.levelDisplay);
        expect(await card.getAttribute("data-upgrade-level")).toBe(
          String(finiteCap),
        );
        expect(
          await card.evaluate((element) =>
            element.classList.contains("cantafford"),
          ),
        ).toBe(
          await sourceCard.evaluate((element) =>
            element.classList.contains("cantafford"),
          ),
        );
        expect(normalizedText(await page.locator("header").innerText())).toBe(
          normalizedText(await sourcePage.locator("header").innerText()),
        );
      });

      await test.step(`${group}.${key} Control purchase is a no-op at cap ${finiteCap}`, async () => {
        const encoded = makeSave(
          sourceSave,
          fixture.data.upgradeSemantics.groups,
          {
            group,
            key,
            level: finiteCap,
          },
        );
        await Promise.all([
          seedAndReload(page, encoded, "beyond"),
          seedAndReload(sourcePage, encoded, "remix"),
        ]);
        await Promise.all([
          page.locator(`[data-upgrade-tab="${group}"]`).click(),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: groupLabels[group] })
            .click(),
        ]);
        const atCap = upgrade.samples.find(
          (sample) => sample.level === finiteCap,
        )!;
        await expect(card.locator(".lvl")).toHaveText(atCap.levelDisplay);
        await expect(sourceCard.locator(".lvl")).toHaveText(atCap.levelDisplay);
        const before = await page.locator("header").innerText();
        const sourceBefore = await sourcePage.locator("header").innerText();
        expect(before).toBe(sourceBefore);

        await Promise.all([
          page.keyboard.down("Control"),
          sourcePage.keyboard.down("Control"),
        ]);
        try {
          await Promise.all([card.click(), sourceCard.click()]);
        } finally {
          await Promise.all([
            page.keyboard.up("Control"),
            sourcePage.keyboard.up("Control"),
          ]);
        }

        await expect(card.locator(".lvl")).toHaveText(atCap.levelDisplay);
        await expect(sourceCard.locator(".lvl")).toHaveText(atCap.levelDisplay);
        expect(
          await card.evaluate((element) =>
            element.classList.contains("cantafford"),
          ),
        ).toBe(
          await sourceCard.evaluate((element) =>
            element.classList.contains("cantafford"),
          ),
        );
        expect(normalizedText(await page.locator("header").innerText())).toBe(
          normalizedText(before),
        );
        expect(
          normalizedText(await sourcePage.locator("header").innerText()),
        ).toBe(normalizedText(sourceBefore));
      });
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
