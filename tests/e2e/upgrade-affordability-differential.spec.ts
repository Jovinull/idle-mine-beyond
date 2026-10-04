import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type ShopGroup = "money" | "gems" | "planetCoins";
type PurchaseScenario = {
  name: string;
  group: ShopGroup;
  key: string;
  startingLevel: number;
  startingResources: Record<string, { decimal: string }>;
  currentPrice: { decimal: string };
};
type UpgradeFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      groups: Record<
        ShopGroup,
        Record<
          string,
          {
            image: string;
            maxLevel: number | "Infinity";
            samples: { level: number; levelDisplay: string }[];
          }
        >
      >;
      purchaseSemantics: PurchaseScenario[];
    };
  };
};
type LegacySave = {
  money: string;
  gems: string;
  planetCoins: string;
  highestMineObjectLevel: number;
  mineObjectLevel: number;
  lastActive: number;
  settings: {
    tab: string;
    theme: string;
    upgradeTab?: string;
    [key: string]: unknown;
  };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
  pickaxe: { name: string; pow: string; quality: string };
};

const fixedTime = Date.now();
const groups = ["money", "gems", "planetCoins"] as const;
const levelMaps = {
  money: "upgrades",
  gems: "gemUpgrades",
  planetCoins: "planetCoinUpgrades",
} as const;
const tabLabels: Record<ShopGroup, string> = {
  money: "Money Upgrades",
  gems: "Gem Upgrades",
  planetCoins: "PC Upgrades",
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function makeScenarioSave(
  input: LegacySave,
  scenario: {
    group: ShopGroup;
    key: string;
    level: number;
    resource: string;
    theme: "light" | "dark";
  },
): string {
  const save = structuredClone(input);
  save.money = "0";
  save.gems = "0";
  save.planetCoins = "0";
  save[scenario.group] = scenario.resource;
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.theme = scenario.theme;
  save.settings.upgradeTab = "money";
  save.upgrades = { activePower: { level: 0 } };
  save.gemUpgrades = { offlineGems: { level: 0 } };
  save.planetCoinUpgrades = { activePower: { level: 0 } };
  save[levelMaps[scenario.group]][scenario.key] = { level: scenario.level };
  save.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  return encodeRemixLegacySave(save);
}

function makeAllAffordableSave(
  input: LegacySave,
  upgradeGroups: UpgradeFixture["data"]["upgradeSemantics"]["groups"],
  theme: "light" | "dark",
  startingLevel: number,
): string {
  const save = structuredClone(input);
  save.money = "1e100";
  save.gems = "1e100";
  save.planetCoins = "1e100";
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.theme = theme;
  save.settings.upgradeTab = "money";
  save.upgrades = Object.fromEntries(
    Object.keys(upgradeGroups.money).map((key) => [
      key,
      { level: startingLevel },
    ]),
  );
  save.gemUpgrades = Object.fromEntries(
    Object.keys(upgradeGroups.gems).map((key) => [
      key,
      { level: startingLevel },
    ]),
  );
  save.planetCoinUpgrades = Object.fromEntries(
    Object.keys(upgradeGroups.planetCoins).map((key) => [
      key,
      { level: startingLevel },
    ]),
  );
  save.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  return encodeRemixLegacySave(save);
}

function makeModifierPurchaseSave(
  input: LegacySave,
  upgradeGroups: UpgradeFixture["data"]["upgradeSemantics"]["groups"],
): string {
  const save = structuredClone(input);
  save.money = "1e1000";
  save.gems = "1e1000";
  save.planetCoins = "1e1000";
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.theme = "light";
  save.settings.upgradeTab = "money";
  save.settings["numberFormatterIndex"] = 0;
  const zeroLevels = (group: ShopGroup) =>
    Object.fromEntries(
      Object.keys(upgradeGroups[group]).map((key) => [key, { level: 0 }]),
    );
  save.upgrades = zeroLevels("money");
  save.gemUpgrades = zeroLevels("gems");
  save.planetCoinUpgrades = zeroLevels("planetCoins");
  save.pickaxe = { name: "Probe Pickaxe", pow: "0", quality: "0" };
  return encodeRemixLegacySave(save);
}

function seedPage({ encoded, time }: { encoded: string; time: number }) {
  if (sessionStorage.getItem("upgrade-affordability-seeded") !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem("upgrade-affordability-seeded", "true");
  }
  Date.now = () => time;
}

async function readCardPresentation(card: Locator) {
  return card.evaluate((element) => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const mainBounds = element.closest("article.main")?.getBoundingClientRect();
    const image = element.querySelector<HTMLImageElement>("img");
    const imageStyle = image ? getComputedStyle(image) : null;
    const imageBounds = image?.getBoundingClientRect();
    const level = element.querySelector<HTMLElement>(".lvl");
    const levelStyle = level ? getComputedStyle(level) : null;
    const levelBounds = level?.getBoundingClientRect();
    const details = document.querySelector<HTMLElement>(".highlightedupgrade");
    const detailsStyle = details ? getComputedStyle(details) : null;
    const detailsBounds = details?.getBoundingClientRect();
    return {
      classes: [...element.classList]
        .filter((name) => ["upgrade", "gem", "pc", "cantafford"].includes(name))
        .sort(),
      levelText: element.querySelector(".lvl")?.textContent?.trim() ?? "",
      card: {
        x: bounds.x,
        y: bounds.y,
        width: style.width,
        height: style.height,
        boundsWidth: bounds.width,
        boundsHeight: bounds.height,
        mainBounds: mainBounds
          ? {
              x: mainBounds.x,
              y: mainBounds.y,
              width: mainBounds.width,
              height: mainBounds.height,
            }
          : null,
        opacity: style.opacity,
        cursor: style.cursor,
        color: style.color,
        backgroundColor: style.backgroundColor,
        border: style.border,
        borderRadius: style.borderRadius,
        boxSizing: style.boxSizing,
        padding: style.padding,
        margin: style.margin,
      },
      image:
        image && imageStyle && imageBounds
          ? {
              src: image.getAttribute("src")?.replace(/^\/+/, ""),
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              x: imageBounds.x,
              y: imageBounds.y,
              width: imageBounds.width,
              height: imageBounds.height,
              computedWidth: imageStyle.width,
              computedHeight: imageStyle.height,
              objectFit: imageStyle.objectFit,
            }
          : null,
      details: details?.innerText.replace(/\s+/g, " ").trim() ?? null,
      detailsStyle: detailsStyle
        ? {
            color: detailsStyle.color,
            backgroundColor: detailsStyle.backgroundColor,
            display: detailsStyle.display,
            alignItems: detailsStyle.alignItems,
            justifyContent: detailsStyle.justifyContent,
            lineHeight: detailsStyle.lineHeight,
            padding: detailsStyle.padding,
          }
        : null,
      level:
        level && levelStyle && levelBounds
          ? {
              text: level.innerText.trim(),
              fontFamily: levelStyle.fontFamily,
              fontSize: levelStyle.fontSize,
              fontWeight: levelStyle.fontWeight,
              lineHeight: levelStyle.lineHeight,
              x: levelBounds.x,
              y: levelBounds.y,
              width: levelBounds.width,
              height: levelBounds.height,
            }
          : null,
      detailsBounds: detailsBounds
        ? {
            x: detailsBounds.x,
            y: detailsBounds.y,
            width: detailsBounds.width,
            height: detailsBounds.height,
          }
        : null,
      multibuy: [
        ...(details?.querySelectorAll<HTMLElement>(".multibuy") ?? []),
      ].map((entry) => ({
        active: entry.classList.contains("active"),
        color: getComputedStyle(entry).color,
      })),
    };
  });
}

async function screenshotHash(locator: Locator): Promise<string> {
  const screenshot = await locator.screenshot({ animations: "disabled" });
  return createHash("sha256").update(screenshot).digest("hex");
}

async function stableViewportScreenshotHash(page: Page): Promise<string> {
  let previous: string | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const screenshot = await page.screenshot({ animations: "disabled" });
    const current = createHash("sha256").update(screenshot).digest("hex");
    if (current === previous) return current;
    previous = current;
  }
  throw new Error("The full viewport screenshot did not stabilize.");
}

async function stableScreenshotHash(
  page: Page,
  locator: Locator,
  inset = 0,
): Promise<string> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("The rendered upgrade element is not visible.");
  const x = Math.floor(bounds.x) + inset;
  const y = Math.floor(bounds.y) + inset;
  const right = Math.ceil(bounds.x + bounds.width) - inset;
  const bottom = Math.ceil(bounds.y + bounds.height) - inset;
  const clip = {
    x,
    y,
    width: right - x,
    height: bottom - y,
  };
  let previous: string | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const screenshot = await page.screenshot({
      clip,
      animations: "disabled",
    });
    const current = createHash("sha256").update(screenshot).digest("hex");
    if (current === previous) return current;
    previous = current;
  }
  throw new Error("The rendered upgrade screenshot did not stabilize.");
}

async function dispatchRemixKeyboard(
  page: Page,
  type: "keydown" | "keyup",
  keys: readonly ("Shift" | "Control")[],
) {
  await page.evaluate(
    ({ eventType, pressed }) => {
      for (const key of pressed) {
        window.dispatchEvent(
          new KeyboardEvent(eventType, { bubbles: true, key }),
        );
      }
    },
    { eventType: type, pressed: [...keys] },
  );
}

async function waitForNextTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function waitForUpgradeImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>(".upgradelist img"),
        (image) => image.decode().catch(() => undefined),
      ),
    );
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`matches Remix shop affordability boundaries in ${theme} theme`, async ({
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
    ) as UpgradeFixture;
    const originalSave = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    const purchases = fixture.data.upgradeSemantics.purchaseSemantics;
    const exactPurchases = [
      purchases.find(({ name }) => name === "buy-exact-affordability"),
      purchases.find(({ name }) => name === "buy-uses-gem-resource"),
      purchases.find(({ name }) => name === "buy-uses-planet-coin-resource"),
    ];
    const belowMoney = purchases.find(
      ({ name }) => name === "buy-below-exact-affordability",
    );
    if (
      exactPurchases.some((scenario) => !scenario) ||
      !belowMoney ||
      exactPurchases.some(
        (scenario, index) => scenario?.group !== groups[index],
      )
    ) {
      throw new Error("Pinned exact-price shop cases are incomplete.");
    }

    const exactScenarios = [
      exactPurchases[0]!,
      exactPurchases[1]!,
      exactPurchases[2]!,
    ];
    const cases = [
      ...groups.map((group, index) => ({
        name: `${group} zero-resource boundary`,
        group,
        key: exactScenarios[index]!.key,
        level: exactScenarios[index]!.startingLevel,
        resource: "0",
        affordable: false,
      })),
      {
        name: "money immediately below exact price",
        group: "money" as const,
        key: belowMoney.key,
        level: belowMoney.startingLevel,
        resource: belowMoney.startingResources["money"]!.decimal,
        affordable: false,
      },
      ...exactScenarios.map((scenario) => ({
        name: `${scenario.group} exact-price boundary`,
        group: scenario.group,
        key: scenario.key,
        level: scenario.startingLevel,
        resource: scenario.startingResources[scenario.group]!.decimal,
        affordable: true,
      })),
    ];

    const first = cases[0]!;
    const firstSave = makeScenarioSave(originalSave, {
      group: first.group,
      key: first.key,
      level: first.level,
      resource: first.resource,
      theme,
    });
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const beyondContext = await browser.newContext({
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();
    const page = await beyondContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.addInitScript(seedPage, { encoded: firstSave, time: fixedTime }),
        sourcePage.addInitScript(seedPage, {
          encoded: firstSave,
          time: fixedTime,
        }),
      ]);
      await page.setViewportSize({ width: 1440, height: 900 });
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);

      for (const scenario of cases) {
        const encodedSave = makeScenarioSave(originalSave, {
          group: scenario.group,
          key: scenario.key,
          level: scenario.level,
          resource: scenario.resource,
          theme,
        });
        await Promise.all([
          page.evaluate((encoded) => {
            localStorage.clear();
            localStorage.setItem("IdleMine", encoded);
          }, encodedSave),
          sourcePage.evaluate((encoded) => {
            localStorage.clear();
            localStorage.setItem("IdleMine", encoded);
          }, encodedSave),
        ]);
        await Promise.all([page.reload(), sourcePage.reload()]);
        await expect(page.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        );
        await sourcePage.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        );
        await sourcePage.waitForFunction(
          (selectedTheme) =>
            document.querySelector("#css_theme")?.getAttribute("href") ===
              `Themes/${selectedTheme}.css` &&
            document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !==
              null &&
            getComputedStyle(document.body).backgroundColor ===
              (selectedTheme === "dark"
                ? "rgb(54, 54, 54)"
                : "rgb(250, 250, 250)"),
          theme,
        );
        await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
        await expect
          .poll(() =>
            page
              .locator("body")
              .evaluate((element) => getComputedStyle(element).backgroundColor),
          )
          .toBe(theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)");
        await Promise.all([
          waitForUpgradeImages(page),
          waitForUpgradeImages(sourcePage),
        ]);

        await Promise.all([
          page.locator(`[data-upgrade-tab="${scenario.group}"]`).click(),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: tabLabels[scenario.group] })
            .click(),
        ]);
        const [beyondTabBackground, sourceTabBackground] = await Promise.all([
          page
            .locator(`[data-upgrade-tab="${scenario.group}"]`)
            .evaluate((element) => getComputedStyle(element).backgroundColor),
          sourcePage
            .locator(".upg-tabs button")
            .filter({ hasText: tabLabels[scenario.group] })
            .evaluate((element) => getComputedStyle(element).backgroundColor),
        ]);
        expect(beyondTabBackground, `${scenario.name} hovered tab style`).toBe(
          sourceTabBackground,
        );
        const image =
          fixture.data.upgradeSemantics.groups[scenario.group][scenario.key]
            ?.image;
        if (!image) {
          throw new Error(
            `Missing pinned upgrade image ${scenario.group}.${scenario.key}.`,
          );
        }
        const imageName = image.split("/").at(-1);
        const card = page.locator(
          `[data-upgrade-group="${scenario.group}"][data-upgrade-key="${scenario.key}"]`,
        );
        const sourceCard = sourcePage
          .locator(".upgradelist .upgrade")
          .filter({ has: sourcePage.locator(`img[src$="${imageName}"]`) })
          .first();
        await expect(card).toBeVisible();
        await expect(sourceCard).toBeVisible();
        await Promise.all([card.hover(), sourceCard.hover()]);
        const upgrade =
          fixture.data.upgradeSemantics.groups[scenario.group][scenario.key];
        if (!upgrade) {
          throw new Error(
            `Missing pinned upgrade ${scenario.group}.${scenario.key}.`,
          );
        }
        const currentSample = upgrade.samples.find(
          ({ level }) => level === scenario.level,
        );
        const nextLevel = scenario.affordable
          ? scenario.level + 1
          : scenario.level;
        const resultSample = upgrade.samples.find(
          ({ level }) => level === nextLevel,
        );
        if (!currentSample || !resultSample) {
          throw new Error(
            `Pinned level display samples are missing for ${scenario.group}.${scenario.key}.`,
          );
        }
        expect(await card.getAttribute("data-upgrade-level")).toBe(
          String(scenario.level),
        );
        await expect(card.locator(".lvl")).toHaveText(
          currentSample.levelDisplay,
        );
        await expect(sourceCard.locator(".lvl")).toHaveText(
          currentSample.levelDisplay,
        );
        await expect(
          page.locator(`[data-upgrade-details="${scenario.key}"]`),
        ).toBeVisible();
        await expect(sourcePage.locator(".highlightedupgrade")).toBeVisible();

        const [beyondPresentation, sourcePresentation] = await Promise.all([
          readCardPresentation(card),
          readCardPresentation(sourceCard),
        ]);
        expect(beyondPresentation, scenario.name).toEqual(sourcePresentation);
        expect(beyondPresentation.classes.includes("cantafford")).toBe(
          !scenario.affordable,
        );

        const details = page.locator(
          `[data-upgrade-details="${scenario.key}"]`,
        );
        const sourceDetails = sourcePage.locator(".highlightedupgrade");
        const [beyondCardHash, sourceCardHash] = await Promise.all([
          stableScreenshotHash(page, card, 1),
          stableScreenshotHash(sourcePage, sourceCard, 1),
        ]);
        expect(beyondCardHash, `${scenario.name} card pixels`).toBe(
          sourceCardHash,
        );
        const [beyondDetailsHash, sourceDetailsHash] = await Promise.all([
          stableScreenshotHash(page, details),
          stableScreenshotHash(sourcePage, sourceDetails),
        ]);
        expect(beyondDetailsHash, `${scenario.name} detail pixels`).toBe(
          sourceDetailsHash,
        );

        await Promise.all([
          page.evaluate(() => document.fonts.ready),
          sourcePage.evaluate(() => document.fonts.ready),
          waitForNextTwoFrames(page),
          waitForNextTwoFrames(sourcePage),
        ]);
        const [beyondViewportHash, sourceViewportHash] = await Promise.all([
          stableViewportScreenshotHash(page),
          stableViewportScreenshotHash(sourcePage),
        ]);
        expect(
          beyondViewportHash,
          `${scenario.name} full viewport pixels`,
        ).toBe(sourceViewportHash);

        if (scenario.group === "money" && scenario.affordable) {
          const modifierChecks = [
            { name: "Shift", keys: ["Shift"] as const, active: [true, false] },
            {
              name: "Control",
              keys: ["Control"] as const,
              active: [false, true],
            },
            {
              name: "Shift+Control",
              keys: ["Shift", "Control"] as const,
              active: [false, true],
            },
          ];
          const otherCard = page
            .locator('[data-upgrade-group="money"][data-upgrade-key]')
            .first();
          const sourceOtherCard = sourcePage
            .locator(".upgradelist .upgrade")
            .first();
          for (const modifier of modifierChecks) {
            await dispatchRemixKeyboard(sourcePage, "keydown", modifier.keys);
            await page.bringToFront();
            for (const key of modifier.keys) await page.keyboard.down(key);
            await Promise.all([
              waitForNextTwoFrames(sourcePage),
              waitForNextTwoFrames(page),
            ]);
            const [sourceImmediate, beyondImmediate] = await Promise.all([
              readCardPresentation(sourceCard),
              readCardPresentation(card),
            ]);
            expect(beyondImmediate, `${modifier.name} immediate UI`).toEqual(
              sourceImmediate,
            );
            expect(
              beyondImmediate.multibuy.map(({ active }) => active),
            ).toEqual([false, false]);

            await Promise.all([sourceOtherCard.hover(), otherCard.hover()]);
            await Promise.all([
              waitForNextTwoFrames(sourcePage),
              waitForNextTwoFrames(page),
            ]);
            const [sourceRefreshed, beyondRefreshed] = await Promise.all([
              readCardPresentation(sourceCard),
              readCardPresentation(card),
            ]);
            expect(beyondRefreshed, `${modifier.name} refreshed UI`).toEqual(
              sourceRefreshed,
            );
            expect(
              beyondRefreshed.multibuy.map(({ active }) => active),
            ).toEqual(modifier.active);
            const [beyondRefreshedHash, sourceRefreshedHash] =
              await Promise.all([
                screenshotHash(page.locator(".highlightedupgrade")),
                screenshotHash(sourcePage.locator(".highlightedupgrade")),
              ]);
            expect(
              beyondRefreshedHash,
              `${modifier.name} refreshed detail pixels`,
            ).toBe(sourceRefreshedHash);

            await dispatchRemixKeyboard(
              sourcePage,
              "keyup",
              [...modifier.keys].reverse(),
            );
            for (const key of [...modifier.keys].reverse()) {
              await page.keyboard.up(key);
            }
            await Promise.all([
              waitForNextTwoFrames(sourcePage),
              waitForNextTwoFrames(page),
            ]);
            const [sourceAfterRelease, beyondAfterRelease] = await Promise.all([
              readCardPresentation(sourceCard),
              readCardPresentation(card),
            ]);
            expect(
              beyondAfterRelease,
              `${modifier.name} release before rerender`,
            ).toEqual(sourceAfterRelease);
            expect(
              beyondAfterRelease.multibuy.map(({ active }) => active),
            ).toEqual(modifier.active);

            await Promise.all([sourceCard.hover(), card.hover()]);
            await Promise.all([
              waitForNextTwoFrames(sourcePage),
              waitForNextTwoFrames(page),
            ]);
            const [sourceReleased, beyondReleased] = await Promise.all([
              readCardPresentation(sourceCard),
              readCardPresentation(card),
            ]);
            expect(
              beyondReleased,
              `${modifier.name} rerender after release`,
            ).toEqual(sourceReleased);
            expect(beyondReleased.multibuy.map(({ active }) => active)).toEqual(
              [false, false],
            );
          }
        }

        await Promise.all([card.click(), sourceCard.click()]);
        expect(await card.getAttribute("data-upgrade-level")).toBe(
          String(nextLevel),
        );
        await expect(card.locator(".lvl")).toHaveText(
          resultSample.levelDisplay,
        );
        await expect(sourceCard.locator(".lvl")).toHaveText(
          resultSample.levelDisplay,
        );
        expect(
          await Promise.all([
            card.getAttribute("data-upgrade-level"),
            sourceCard.locator(".lvl").textContent(),
          ]),
          `${scenario.name} purchase result`,
        ).toEqual([String(nextLevel), resultSample.levelDisplay]);
      }
    } finally {
      await sourceContext.close().catch(() => undefined);
      await beyondContext.close().catch(() => undefined);
    }
  });
}

for (const theme of ["light", "dark"] as const) {
  for (const startingLevel of [0, 1] as const) {
    test(`matches shop cards, details, and full screens against Remix at level ${startingLevel} in ${theme} theme`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(180_000);
      const fixture = JSON.parse(
        await readFile(
          new URL(
            "../fixtures/parity/remix-reference-corpus.json",
            import.meta.url,
          ),
          "utf8",
        ),
      ) as UpgradeFixture;
      const groupsData = fixture.data.upgradeSemantics.groups;
      const originalSave = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      const encoded = makeAllAffordableSave(
        originalSave,
        groupsData,
        theme,
        startingLevel,
      );
      const sourceContext = await browser.newContext({
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1440, height: 900 },
      });
      const sourcePage = await sourceContext.newPage();

      try {
        const sourceUrl = await routePinnedRemixOracle(sourceContext);
        await Promise.all([
          page.addInitScript(seedPage, { encoded, time: fixedTime }),
          sourcePage.addInitScript(seedPage, { encoded, time: fixedTime }),
        ]);
        await page.setViewportSize({ width: 1440, height: 900 });
        await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
        await expect(page.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        );
        await sourcePage.waitForFunction(() =>
          Boolean(
            (window as Window & { game?: unknown }).game &&
            document.querySelector("#app > footer"),
          ),
        );
        await Promise.all([
          page.evaluate(() => document.fonts.ready),
          sourcePage.evaluate(() => document.fonts.ready),
        ]);

        let compared = 0;
        let fullScreensCompared = 0;
        for (const group of groups) {
          await Promise.all([
            page.locator(`[data-upgrade-tab="${group}"]`).click(),
            sourcePage
              .locator(".upg-tabs button")
              .filter({ hasText: tabLabels[group] })
              .click(),
          ]);
          await Promise.all([
            waitForUpgradeImages(page),
            waitForUpgradeImages(sourcePage),
          ]);
          const beyondCards = page.locator(
            `[data-upgrade-group="${group}"][data-upgrade-key]`,
          );
          const sourceCards = sourcePage.locator(".upgradelist .upgrade");
          const entries = Object.entries(groupsData[group]);
          await expect(beyondCards).toHaveCount(entries.length);
          await expect(sourceCards).toHaveCount(entries.length);

          for (const [key, upgrade] of entries) {
            const imageName = upgrade.image.split("/").at(-1);
            if (!imageName) {
              throw new Error(`Missing image name for ${group}.${key}.`);
            }
            const card = page.locator(
              `[data-upgrade-group="${group}"][data-upgrade-key="${key}"]`,
            );
            const sourceCard = sourceCards.filter({
              has: sourcePage.locator(`img[src$="${imageName}"]`),
            });
            await expect(card, `${group}.${key} Beyond card`).toBeVisible();
            await expect(sourceCard, `${group}.${key} source card`).toHaveCount(
              1,
            );
            await Promise.all([card.hover(), sourceCard.hover()]);
            await Promise.all([
              waitForNextTwoFrames(page),
              waitForNextTwoFrames(sourcePage),
            ]);

            const [beyondPresentation, sourcePresentation] = await Promise.all([
              readCardPresentation(card),
              readCardPresentation(sourceCard),
            ]);
            expect(beyondPresentation, `${group}.${key} presentation`).toEqual(
              sourcePresentation,
            );
            const details = page.locator(`[data-upgrade-details="${key}"]`);
            const sourceDetails = sourcePage.locator(".highlightedupgrade");
            const [beyondDetailsHash, sourceDetailsHash] = await Promise.all([
              stableScreenshotHash(page, details),
              stableScreenshotHash(sourcePage, sourceDetails),
            ]);
            expect(beyondDetailsHash, `${group}.${key} detail pixels`).toBe(
              sourceDetailsHash,
            );
            await Promise.all([
              page.mouse.move(1438, 800),
              sourcePage.mouse.move(1438, 800),
            ]);
            await Promise.all([
              waitForNextTwoFrames(page),
              waitForNextTwoFrames(sourcePage),
            ]);
            const [beyondCardHash, sourceCardHash] = await Promise.all([
              stableScreenshotHash(page, card),
              stableScreenshotHash(sourcePage, sourceCard),
            ]);
            expect(beyondCardHash, `${group}.${key} resting card pixels`).toBe(
              sourceCardHash,
            );
            compared += 1;
          }
          await Promise.all([
            page.mouse.move(1438, 800),
            sourcePage.mouse.move(1438, 800),
          ]);
          await Promise.all([
            waitForNextTwoFrames(page),
            waitForNextTwoFrames(sourcePage),
          ]);
          const [beyondViewportHash, sourceViewportHash] = await Promise.all([
            stableViewportScreenshotHash(page),
            stableViewportScreenshotHash(sourcePage),
          ]);
          expect(
            beyondViewportHash,
            `${group} full-screen image at upgrade level ${startingLevel}`,
          ).toBe(sourceViewportHash);
          fullScreensCompared += 1;
        }
        expect(compared).toBe(22);
        expect(fullScreensCompared).toBe(groups.length);
      } finally {
        await sourceContext.close().catch(() => undefined);
      }
    });
  }
}

// Several minutes: excluded from `pnpm test:e2e`; run `pnpm test:e2e:slow`.
test(
  "routes single, Shift, and Control purchases for every shop card like Remix",
  { tag: "@slow" },
  async ({ page, browser }) => {
    test.setTimeout(360_000);
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as UpgradeFixture;
    const originalSave = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    const upgradeGroups = fixture.data.upgradeSemantics.groups;
    const encodedBase = makeModifierPurchaseSave(originalSave, upgradeGroups);
    const sourceContext = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.addInitScript(seedPage, { encoded: encodedBase, time: fixedTime }),
        sourcePage.addInitScript(seedPage, {
          encoded: encodedBase,
          time: fixedTime,
        }),
      ]);
      await page.emulateMedia({ colorScheme: "light" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
      await expect(page.locator("#app")).toHaveAttribute(
        "data-app-state",
        "ready",
      );
      await sourcePage.waitForFunction(() =>
        Boolean(
          (window as Window & { game?: unknown }).game &&
          document.querySelector("#app > footer"),
        ),
      );

      const modes = [
        { name: "single", key: undefined, maximum: 1 },
        { name: "Shift", key: "Shift", maximum: 10 },
        { name: "Control", key: "Control", maximum: 100 },
      ] as const;
      let compared = 0;

      for (const group of groups) {
        for (const [key, upgrade] of Object.entries(upgradeGroups[group])) {
          for (const mode of modes) {
            await test.step(`${group}.${key} with ${mode.name}`, async () => {
              await Promise.all([
                page.evaluate((encoded) => {
                  localStorage.clear();
                  localStorage.setItem("IdleMine", encoded);
                }, encodedBase),
                sourcePage.evaluate((encoded) => {
                  localStorage.clear();
                  localStorage.setItem("IdleMine", encoded);
                }, encodedBase),
              ]);
              await Promise.all([page.reload(), sourcePage.reload()]);
              await expect(page.locator("#app")).toHaveAttribute(
                "data-app-state",
                "ready",
              );
              await sourcePage.waitForFunction(() =>
                Boolean((window as Window & { game?: unknown }).game),
              );
              await Promise.all([
                page.locator(`[data-upgrade-tab="${group}"]`).click(),
                sourcePage
                  .locator(".upg-tabs button")
                  .filter({ hasText: tabLabels[group] })
                  .click(),
              ]);

              const imageName = upgrade.image.split("/").at(-1)!;
              const card = page.locator(
                `[data-upgrade-group="${group}"][data-upgrade-key="${key}"]`,
              );
              const sourceCard = sourcePage
                .locator(".upgradelist .upgrade")
                .filter({
                  has: sourcePage.locator(`img[src$="${imageName}"]`),
                })
                .first();
              await expect(card).toHaveAttribute("data-upgrade-level", "0");
              await expect(sourceCard).toBeVisible();

              if (mode.key) {
                await Promise.all([
                  page.keyboard.down(mode.key),
                  sourcePage.keyboard.down(mode.key),
                ]);
              }
              try {
                await Promise.all([card.click(), sourceCard.click()]);
              } finally {
                if (mode.key) {
                  await Promise.all([
                    page.keyboard.up(mode.key),
                    sourcePage.keyboard.up(mode.key),
                  ]);
                }
              }

              const cap =
                upgrade.maxLevel === "Infinity" ? Infinity : upgrade.maxLevel;
              const expectedLevel = Math.min(mode.maximum, cap);
              await expect(card).toHaveAttribute(
                "data-upgrade-level",
                String(expectedLevel),
              );
              const sourceLevelText = normalizeText(
                await sourceCard.locator(".lvl").innerText(),
              );
              const beyondLevelText = normalizeText(
                await card.locator(".lvl").innerText(),
              );
              expect(sourceLevelText, `${group}.${key} source level`).toMatch(
                new RegExp(`^${expectedLevel}(?:/|$)`),
              );
              expect(beyondLevelText, `${group}.${key} Beyond level`).toBe(
                sourceLevelText,
              );

              const refreshCard = page
                .locator(
                  `[data-upgrade-group="${group}"][data-upgrade-key]:not([data-upgrade-key="${key}"])`,
                )
                .first();
              const sourceRefreshCard = sourcePage
                .locator(".upgradelist .upgrade")
                .filter({
                  hasNot: sourcePage.locator(`img[src$="${imageName}"]`),
                })
                .first();
              await Promise.all([
                refreshCard.hover(),
                sourceRefreshCard.hover(),
              ]);
              await Promise.all([card.hover(), sourceCard.hover()]);
              await Promise.all([
                waitForNextTwoFrames(page),
                waitForNextTwoFrames(sourcePage),
              ]);

              const [beyondPresentation, sourcePresentation] =
                await Promise.all([
                  readCardPresentation(card),
                  readCardPresentation(sourceCard),
                ]);
              expect(
                beyondPresentation,
                `${group}.${key} ${mode.name} post-purchase presentation`,
              ).toEqual(sourcePresentation);
              const [beyondHeader, sourceHeader] = await Promise.all([
                page.locator("header").innerText(),
                sourcePage.locator("header").innerText(),
              ]);
              expect(normalizeText(beyondHeader)).toBe(
                normalizeText(sourceHeader),
              );
              compared += 1;
            });
          }
        }
      }
      expect(compared).toBe(66);
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  },
);
