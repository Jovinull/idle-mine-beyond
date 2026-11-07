import { createHash } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { Decimal } from "../../packages/core/src/decimal.js";
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
const pendingSavePrefix = "__idle-mine-affordability-save__:";
const groups = ["money", "gems", "planetCoins"] as const;
const modifierChecks = [
  { name: "Shift", keys: ["Shift"], active: [true, false] },
  { name: "Control", keys: ["Control"], active: [false, true] },
  {
    name: "Shift+Control",
    keys: ["Shift", "Control"],
    active: [false, true],
  },
] as const;
type ModifierCheck = (typeof modifierChecks)[number];
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

function seedPendingSaveAtNavigation({
  prefix,
  time,
}: {
  prefix: string;
  time: number;
}) {
  Date.now = () => time;
  if (window.name.startsWith(prefix)) {
    localStorage.clear();
    localStorage.setItem("IdleMine", window.name.slice(prefix.length));
    window.name = "";
  }
}

function configuredAppOrigin(): string {
  const baseURL = test.info().project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright baseURL is required for same-page comparison.");
  }
  return new URL(baseURL).origin;
}

async function navigateWithLegacySave(
  page: Page,
  url: string,
  encodedSave: string,
): Promise<void> {
  await page.evaluate(
    ({ prefix, encoded }) => {
      window.name = `${prefix}${encoded}`;
    },
    { prefix: pendingSavePrefix, encoded: encodedSave },
  );
  await page.goto(new URL(url, `${configuredAppOrigin()}/`).toString());
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
              display: imageStyle.display,
              verticalAlign: imageStyle.verticalAlign,
              objectFit: imageStyle.objectFit,
              objectPosition: imageStyle.objectPosition,
              imageRendering: imageStyle.imageRendering,
              filter: imageStyle.filter,
              transform: imageStyle.transform,
              opacity: imageStyle.opacity,
              mixBlendMode: imageStyle.mixBlendMode,
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

async function readShopRasterDiagnostics(page: Page) {
  return page.locator(".upgradelist .upgrade").evaluateAll((cards) => {
    const styleProperties = (element: Element, pseudo?: string) => {
      const style = getComputedStyle(element, pseudo);
      return Array.from({ length: style.length }, (_, index) => {
        const property = style.item(index);
        return [property, style.getPropertyValue(property)] as const;
      });
    };
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    };
    const selector = (element: Element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}`;
    const ancestors = (() => {
      const result = [];
      let element: Element | null = cards[0] ?? null;
      while (element && result.length < 10) {
        result.push({
          selector: selector(element),
          box: box(element),
          style: styleProperties(element),
          before: styleProperties(element, "::before"),
          after: styleProperties(element, "::after"),
        });
        element = element.parentElement;
      }
      return result;
    })();
    return {
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      cards: cards.map((card, index) => {
        const image = card.querySelector<HTMLImageElement>("img");
        return {
          index,
          key: card.getAttribute("data-upgrade-key"),
          selector: selector(card),
          outerHTML: card.outerHTML,
          box: box(card),
          style: styleProperties(card),
          before: styleProperties(card, "::before"),
          after: styleProperties(card, "::after"),
          image: image
            ? {
                src: image.currentSrc,
                naturalWidth: image.naturalWidth,
                naturalHeight: image.naturalHeight,
                box: box(image),
                style: styleProperties(image),
              }
            : null,
        };
      }),
      ancestors,
    };
  });
}

type ModifierScreenSequence = {
  immediate: Buffer;
  refreshed: Buffer;
  immediatePresentation: Awaited<ReturnType<typeof readCardPresentation>>;
  refreshedPresentation: Awaited<ReturnType<typeof readCardPresentation>>;
};

async function screenshotHash(locator: Locator): Promise<string> {
  const screenshot = await locator.screenshot({ animations: "disabled" });
  return createHash("sha256").update(screenshot).digest("hex");
}

async function stableAppScreenshot(
  page: Page,
  expectedViewport = { width: 1440, height: 900 },
): Promise<Buffer> {
  const viewport = page.viewportSize();
  if (
    !viewport ||
    viewport.width !== expectedViewport.width ||
    viewport.height !== expectedViewport.height
  ) {
    throw new Error(
      `The browser viewport does not match the expected ${expectedViewport.width}x${expectedViewport.height} size.`,
    );
  }
  let previous: string | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const screenshot = await page.screenshot({ animations: "disabled" });
    const current = createHash("sha256").update(screenshot).digest("hex");
    if (current === previous) return screenshot;
    previous = current;
  }
  throw new Error("The app-root screenshot did not stabilize.");
}

async function expectPairedPagesFullViewportMatch(
  page: Page,
  sourcePage: Page,
  sourceUrl: string,
  encodedSave: string,
  group: ShopGroup,
  theme: "light" | "dark",
  description: string,
  hoverImageName: string,
): Promise<void> {
  const viewport = { width: 1366, height: 768 };
  await Promise.all([
    page.setViewportSize(viewport),
    sourcePage.setViewportSize(viewport),
    navigateWithLegacySave(page, "/", encodedSave),
    navigateWithLegacySave(sourcePage, sourceUrl, encodedSave),
  ]);
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await Promise.all([
    sourcePage.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    ),
    expect(page.locator("body")).toHaveAttribute("data-theme", theme),
  ]);
  await sourcePage.waitForFunction(
    (selectedTheme) =>
      document.querySelector("#css_theme")?.getAttribute("href") ===
        `Themes/${selectedTheme}.css` &&
      document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !== null,
    theme,
  );
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
  const card = page
    .locator(`[data-upgrade-group="${group}"][data-upgrade-key]`)
    .filter({ has: page.locator(`img[src$="${hoverImageName}"]`) })
    .first();
  const sourceCard = sourcePage
    .locator(".upgradelist .upgrade")
    .filter({ has: sourcePage.locator(`img[src$="${hoverImageName}"]`) })
    .first();
  await Promise.all([card.hover(), sourceCard.hover()]);
  await Promise.all([
    page.evaluate(() => document.fonts.ready),
    sourcePage.evaluate(() => document.fonts.ready),
    waitForNextTwoFrames(page),
    waitForNextTwoFrames(sourcePage),
  ]);
  const [beyondScreenshot, sourceScreenshot] = await Promise.all([
    stableAppScreenshot(page, viewport),
    stableAppScreenshot(sourcePage, viewport),
  ]);
  const beyondHash = createHash("sha256")
    .update(beyondScreenshot)
    .digest("hex");
  const sourceHash = createHash("sha256")
    .update(sourceScreenshot)
    .digest("hex");
  if (beyondHash !== sourceHash) {
    await Promise.all([
      test.info().attach(`${description}-beyond.png`, {
        body: beyondScreenshot,
        contentType: "image/png",
      }),
      test.info().attach(`${description}-remix.png`, {
        body: sourceScreenshot,
        contentType: "image/png",
      }),
    ]);
  }
  expect(beyondHash, description).toBe(sourceHash);
}

async function prepareBeyondScreenshot(
  page: Page,
  encodedSave: string,
  group: ShopGroup,
  theme: "light" | "dark",
  hoverImageName?: string,
): Promise<void> {
  await navigateWithLegacySave(page, "/", encodedSave);
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await expect(page.locator("body")).toHaveAttribute("data-theme", theme);
  await page.locator(`[data-upgrade-tab="${group}"]`).click();
  await waitForUpgradeImages(page);
  if (hoverImageName) {
    const card = page
      .locator(`[data-upgrade-group="${group}"][data-upgrade-key]`)
      .filter({ has: page.locator(`img[src$="${hoverImageName}"]`) })
      .first();
    await card.hover();
  } else {
    await page.mouse.move(1438, 800);
  }
  await page.evaluate(() => document.fonts.ready);
  await waitForNextTwoFrames(page);
}

async function expectSinglePageFullViewportMatch(
  page: Page,
  sourceUrl: string,
  encodedSave: string,
  group: ShopGroup,
  theme: "light" | "dark",
  description: string,
  hoverImageName?: string,
  modifier?: ModifierCheck,
): Promise<void> {
  await prepareBeyondScreenshot(
    page,
    encodedSave,
    group,
    theme,
    hoverImageName,
  );
  if (modifier && !hoverImageName) {
    throw new Error("A hovered upgrade image is required for modifier parity.");
  }
  const beyondModifierScreens = modifier
    ? await captureModifierScreenSequence(
        page,
        "beyond",
        hoverImageName!,
        modifier,
      )
    : undefined;
  const expectedViewport = page.viewportSize() ?? {
    width: 1440,
    height: 900,
  };
  const beyondScreenshot = beyondModifierScreens
    ? beyondModifierScreens.refreshed
    : await stableAppScreenshot(page, expectedViewport);
  const beyondState = await page.evaluate(() => {
    const card = document.querySelector<HTMLElement>(".upgradelist .upgrade");
    const bounds = card?.getBoundingClientRect();
    const style = card ? getComputedStyle(card) : null;
    const layoutChain = (() => {
      const result: Array<Record<string, unknown>> = [];
      let element = card ?? null;
      while (element && result.length < 10) {
        const rect = element.getBoundingClientRect();
        const computed = getComputedStyle(element);
        result.push({
          node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}`,
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          display: computed.display,
          position: computed.position,
          transform: computed.transform,
          transformOrigin: computed.transformOrigin,
          zoom: computed.zoom,
          borderRadius: computed.borderRadius,
          border: computed.border,
          background: computed.backgroundColor,
          overflow: computed.overflow,
          clipPath: computed.clipPath,
          filter: computed.filter,
          opacity: computed.opacity,
        });
        element = element.parentElement;
      }
      return result;
    })();
    return {
      header:
        document.querySelector<HTMLElement>("#app header")?.innerText ?? null,
      devicePixelRatio: window.devicePixelRatio,
      scrollY: window.scrollY,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      card:
        bounds && style
          ? {
              x: bounds.x,
              y: bounds.y,
              width: bounds.width,
              height: bounds.height,
              background: style.backgroundColor,
              border: style.border,
              borderRadius: style.borderRadius,
            }
          : null,
      layoutChain,
    };
  });
  const beyondRasterDiagnostics = await readShopRasterDiagnostics(page);

  let sourceScreenshot: Buffer;
  let sourceState: unknown;
  try {
    await navigateWithLegacySave(page, sourceUrl, encodedSave);
    await page.waitForFunction(() =>
      Boolean(
        (window as Window & { game?: unknown }).game &&
        document.querySelector("#app > footer"),
      ),
    );
    await page.waitForFunction(
      (selectedTheme) =>
        document.querySelector("#css_theme")?.getAttribute("href") ===
          `Themes/${selectedTheme}.css` &&
        document.querySelector<HTMLLinkElement>("#css_theme")?.sheet !== null &&
        getComputedStyle(document.body).backgroundColor ===
          (selectedTheme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)"),
      theme,
    );
    await page
      .locator(".upg-tabs button")
      .filter({ hasText: tabLabels[group] })
      .click();
    await waitForUpgradeImages(page);
    if (hoverImageName) {
      const sourceCard = page
        .locator(".upgradelist .upgrade")
        .filter({ has: page.locator(`img[src$="${hoverImageName}"]`) })
        .first();
      await sourceCard.hover();
    } else {
      await page.mouse.move(1438, 800);
    }
    await page.evaluate(() => document.fonts.ready);
    await waitForNextTwoFrames(page);
    const sourceModifierScreens = modifier
      ? await captureModifierScreenSequence(
          page,
          "remix",
          hoverImageName!,
          modifier,
        )
      : undefined;
    sourceScreenshot = sourceModifierScreens
      ? sourceModifierScreens.refreshed
      : await stableAppScreenshot(page, expectedViewport);
    sourceState = await page.evaluate(() => {
      const sourceGame = (
        window as Window & {
          game?: {
            planetCoins?: { toString(): string };
            maxPlanetCoins?: { toString(): string };
          };
        }
      ).game;
      const card = document.querySelector<HTMLElement>(".upgradelist .upgrade");
      const bounds = card?.getBoundingClientRect();
      const style = card ? getComputedStyle(card) : null;
      const layoutChain = (() => {
        const result: Array<Record<string, unknown>> = [];
        let element = card ?? null;
        while (element && result.length < 10) {
          const rect = element.getBoundingClientRect();
          const computed = getComputedStyle(element);
          result.push({
            node: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.className ? `.${String(element.className).trim().replace(/\s+/g, ".")}` : ""}`,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            display: computed.display,
            position: computed.position,
            transform: computed.transform,
            transformOrigin: computed.transformOrigin,
            zoom: computed.zoom,
            borderRadius: computed.borderRadius,
            border: computed.border,
            background: computed.backgroundColor,
            overflow: computed.overflow,
            clipPath: computed.clipPath,
            filter: computed.filter,
            opacity: computed.opacity,
          });
          element = element.parentElement;
        }
        return result;
      })();
      return {
        header: document.querySelector("header")?.textContent?.trim() ?? null,
        planetCoins: sourceGame?.planetCoins?.toString() ?? null,
        maxPlanetCoins: sourceGame?.maxPlanetCoins?.toString() ?? null,
        devicePixelRatio: window.devicePixelRatio,
        scrollY: window.scrollY,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        card:
          bounds && style
            ? {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
                background: style.backgroundColor,
                border: style.border,
                borderRadius: style.borderRadius,
              }
            : null,
        layoutChain,
      };
    });
    const sourceRasterDiagnostics = await readShopRasterDiagnostics(page);

    if (modifier && beyondModifierScreens && sourceModifierScreens) {
      expect(
        beyondModifierScreens.immediatePresentation,
        `${description}; immediate modifier presentation`,
      ).toEqual(sourceModifierScreens.immediatePresentation);
      expect(
        beyondModifierScreens.refreshedPresentation,
        `${description}; refreshed modifier presentation`,
      ).toEqual(sourceModifierScreens.refreshedPresentation);
      const beyondImmediateHash = createHash("sha256")
        .update(beyondModifierScreens.immediate)
        .digest("hex");
      const sourceImmediateHash = createHash("sha256")
        .update(sourceModifierScreens.immediate)
        .digest("hex");
      expect(
        beyondImmediateHash,
        `${description}; full-screen pixels before reactive refresh`,
      ).toBe(sourceImmediateHash);
    }

    const beyondHash = createHash("sha256")
      .update(beyondScreenshot)
      .digest("hex");
    const sourceHash = createHash("sha256")
      .update(sourceScreenshot)
      .digest("hex");
    const stateDetails = JSON.stringify({
      beyond: beyondState,
      beyondRasterDiagnostics,
      remix: sourceState,
      remixRasterDiagnostics: sourceRasterDiagnostics,
    });
    if (beyondHash !== sourceHash) {
      const beyondPath = test.info().outputPath(`${description}-beyond.png`);
      const sourcePath = test.info().outputPath(`${description}-remix.png`);
      await Promise.all([
        writeFile(beyondPath, beyondScreenshot),
        writeFile(sourcePath, sourceScreenshot),
      ]);
      await Promise.all([
        test.info().attach(`${description}-beyond.png`, {
          path: beyondPath,
          contentType: "image/png",
        }),
        test.info().attach(`${description}-remix.png`, {
          path: sourcePath,
          contentType: "image/png",
        }),
        test.info().attach(`${description}-state.json`, {
          body: Buffer.from(JSON.stringify(JSON.parse(stateDetails), null, 2)),
          contentType: "application/json",
        }),
      ]);
    }
    // Continue through the remaining resource tabs to expose every mismatch
    // in this controlled state; Playwright still fails the test on any delta.
    expect.soft(beyondHash, description).toBe(sourceHash);
  } finally {
    await navigateWithLegacySave(page, "/", encodedSave).catch(() => undefined);
    await page
      .waitForFunction(
        () =>
          document.querySelector("#app")?.getAttribute("data-app-state") ===
          "ready",
        null,
        { timeout: 15_000 },
      )
      .catch(() => undefined);
    if (
      (await page
        .locator("#app")
        .getAttribute("data-app-state")
        .catch(() => null)) === "ready"
    ) {
      await page
        .locator(`[data-upgrade-tab="${group}"]`)
        .click()
        .catch(() => undefined);
      await waitForUpgradeImages(page).catch(() => undefined);
      if (hoverImageName) {
        await page
          .locator(
            `[data-upgrade-group="${group}"] img[src$="${hoverImageName}"]`,
          )
          .first()
          .hover()
          .catch(() => undefined);
      } else {
        await page.mouse.move(1438, 800).catch(() => undefined);
      }
    }
  }
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

async function captureModifierScreenSequence(
  page: Page,
  runtime: "remix" | "beyond",
  imageName: string,
  modifier: ModifierCheck,
): Promise<ModifierScreenSequence> {
  const cards =
    runtime === "remix"
      ? page.locator(".upgradelist .upgrade")
      : page.locator('[data-upgrade-group="money"][data-upgrade-key]');
  const image = page.locator(`img[src$="${imageName}"]`);
  const targetCard = cards.filter({ has: image }).first();
  let otherCard = cards.first();
  if ((await otherCard.locator(`img[src$="${imageName}"]`).count()) > 0) {
    otherCard = cards.nth(1);
  }
  await expect(targetCard).toBeVisible();
  await expect(otherCard).toBeVisible();

  if (runtime === "remix") {
    await dispatchRemixKeyboard(page, "keydown", modifier.keys);
  } else {
    for (const key of modifier.keys) await page.keyboard.down(key);
  }

  try {
    await waitForNextTwoFrames(page);
    const immediatePresentation = await readCardPresentation(targetCard);
    expect(
      immediatePresentation.multibuy.map(({ active }) => active),
      `${modifier.name} remains stale until a reactive render`,
    ).toEqual([false, false]);
    const immediate = await stableAppScreenshot(page);

    await otherCard.hover();
    await targetCard.hover();
    await waitForNextTwoFrames(page);
    const refreshedPresentation = await readCardPresentation(targetCard);
    expect(
      refreshedPresentation.multibuy.map(({ active }) => active),
      `${modifier.name} labels after the reactive render`,
    ).toEqual(modifier.active);
    const refreshed = await stableAppScreenshot(page);

    return {
      immediate,
      refreshed,
      immediatePresentation,
      refreshedPresentation,
    };
  } finally {
    const released = [...modifier.keys].reverse();
    if (runtime === "remix") {
      await dispatchRemixKeyboard(page, "keyup", released);
    } else {
      for (const key of released) await page.keyboard.up(key);
    }
  }
}

for (const theme of ["light", "dark"] as const) {
  test(
    `matches Remix shop affordability boundaries in ${theme} theme`,
    { tag: "@slow" },
    async ({ browser }) => {
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
      const moneyBelowPrice = belowMoney.startingResources["money"]!.decimal;
      const derivedMoneyBelowPrice = new Decimal(
        exactScenarios[0]!.currentPrice.decimal,
      )
        .sub("0.01")
        .toString();
      if (!new Decimal(moneyBelowPrice).eq(derivedMoneyBelowPrice)) {
        throw new Error(
          "The captured Money affordability boundary is not one cent below its source price.",
        );
      }
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
          resource: moneyBelowPrice,
          affordable: false,
        },
        ...exactScenarios
          .filter((scenario) => scenario.group !== "money")
          .map((scenario) => ({
            name: `${scenario.group} immediately-below-price boundary`,
            group: scenario.group,
            key: scenario.key,
            level: scenario.startingLevel,
            resource: new Decimal(scenario.currentPrice.decimal)
              .sub("0.01")
              .toString(),
            affordable: false,
          })),
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
      const context = await browser.newContext({
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1440, height: 900 },
      });
      // Source and app have separate origins. Stage each save for the next
      // document so an old game's autosave timer cannot overwrite the fixture.
      const sourcePage = await context.newPage();
      const page = await context.newPage();

      try {
        const sourceUrl = await routePinnedRemixOracle(sourcePage);
        let samePageOracleReady = false;
        await Promise.all([
          page.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
          sourcePage.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
        ]);
        await page.setViewportSize({ width: 1440, height: 900 });
        await Promise.all([
          navigateWithLegacySave(page, "/", firstSave),
          navigateWithLegacySave(sourcePage, sourceUrl, firstSave),
        ]);

        for (const scenario of cases) {
          const encodedSave = makeScenarioSave(originalSave, {
            group: scenario.group,
            key: scenario.key,
            level: scenario.level,
            resource: scenario.resource,
            theme,
          });
          await Promise.all([
            navigateWithLegacySave(page, "/", encodedSave),
            navigateWithLegacySave(sourcePage, sourceUrl, encodedSave),
          ]);
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
          await expect(page.locator("body")).toHaveAttribute(
            "data-theme",
            theme,
          );
          await expect
            .poll(() =>
              page
                .locator("body")
                .evaluate(
                  (element) => getComputedStyle(element).backgroundColor,
                ),
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
          expect(
            beyondTabBackground,
            `${scenario.name} hovered tab style`,
          ).toBe(sourceTabBackground);
          const image =
            fixture.data.upgradeSemantics.groups[scenario.group][scenario.key]
              ?.image;
          if (!image) {
            throw new Error(
              `Missing pinned upgrade image ${scenario.group}.${scenario.key}.`,
            );
          }
          const imageName = image.split("/").at(-1);
          if (!imageName) {
            throw new Error(
              `Missing pinned upgrade image name for ${scenario.group}.${scenario.key}.`,
            );
          }
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
          if (!samePageOracleReady) {
            const samePageSourceUrl = await routePinnedRemixOracle(page, {
              passThroughOrigins: [configuredAppOrigin()],
            });
            expect(samePageSourceUrl).toBe(sourceUrl);
            samePageOracleReady = true;
          }
          await expectSinglePageFullViewportMatch(
            page,
            sourceUrl,
            encodedSave,
            scenario.group,
            theme,
            `${scenario.name} full viewport pixels`,
            imageName,
          );
          if (scenario.name === "gems exact-price boundary") {
            await page.setViewportSize({ width: 1366, height: 768 });
            await expectSinglePageFullViewportMatch(
              page,
              sourceUrl,
              encodedSave,
              scenario.group,
              theme,
              `${scenario.name} full viewport at 1366x768`,
              imageName,
            );
            await page.setViewportSize({ width: 1440, height: 900 });
          }
          if (scenario.group === "money" && scenario.affordable) {
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
              const [sourceAfterRelease, beyondAfterRelease] =
                await Promise.all([
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
              expect(
                beyondReleased.multibuy.map(({ active }) => active),
              ).toEqual([false, false]);
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
        await context.close().catch(() => undefined);
      }
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  test(
    `matches exact-price shop screens at 1366x768 in ${theme} theme`,
    { tag: "@slow" },
    async ({ browser }) => {
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
      const originalSave = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      const purchases = fixture.data.upgradeSemantics.purchaseSemantics;
      const exactScenarios = [
        purchases.find(({ name }) => name === "buy-exact-affordability"),
        purchases.find(({ name }) => name === "buy-uses-gem-resource"),
        purchases.find(({ name }) => name === "buy-uses-planet-coin-resource"),
      ];
      if (exactScenarios.some((scenario) => !scenario)) {
        throw new Error("Pinned exact-price shop cases are incomplete.");
      }
      const context = await browser.newContext({
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1366, height: 768 },
      });
      const sourcePage = await context.newPage();
      const page = await context.newPage();
      try {
        const sourceUrl = await routePinnedRemixOracle(sourcePage);
        await Promise.all([
          page.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
          sourcePage.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
        ]);
        for (const scenario of exactScenarios) {
          if (!scenario)
            throw new Error("A pinned exact-price case is missing.");
          const encodedViewportSave = makeScenarioSave(originalSave, {
            group: scenario.group,
            key: scenario.key,
            level: scenario.startingLevel,
            resource: scenario.startingResources[scenario.group]!.decimal,
            theme,
          });
          const upgrade =
            fixture.data.upgradeSemantics.groups[scenario.group][scenario.key];
          const hoverImageName = upgrade?.image.split("/").at(-1);
          if (!hoverImageName) {
            throw new Error(
              `Missing image for ${scenario.group}.${scenario.key}.`,
            );
          }
          await expectPairedPagesFullViewportMatch(
            page,
            sourcePage,
            sourceUrl,
            encodedViewportSave,
            scenario.group,
            theme,
            `${scenario.group} exact-price boundary full viewport at 1366x768`,
            hoverImageName,
          );
        }
      } finally {
        await context.close().catch(() => undefined);
      }
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  test(
    `matches zero-resource shop screens at 1366x768 in ${theme} theme`,
    { tag: "@slow" },
    async ({ browser }) => {
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
      const originalSave = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      const purchases = fixture.data.upgradeSemantics.purchaseSemantics;
      const groupScenarios = [
        purchases.find(({ name }) => name === "buy-exact-affordability"),
        purchases.find(({ name }) => name === "buy-uses-gem-resource"),
        purchases.find(({ name }) => name === "buy-uses-planet-coin-resource"),
      ];
      if (groupScenarios.some((scenario) => !scenario)) {
        throw new Error("Pinned resource-group shop cases are incomplete.");
      }
      const context = await browser.newContext({
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1366, height: 768 },
      });
      const sourcePage = await context.newPage();
      const page = await context.newPage();
      try {
        const sourceUrl = await routePinnedRemixOracle(sourcePage);
        await Promise.all([
          page.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
          sourcePage.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
        ]);
        for (const scenario of groupScenarios) {
          if (!scenario)
            throw new Error("A pinned resource-group case is missing.");
          const encodedViewportSave = makeScenarioSave(originalSave, {
            group: scenario.group,
            key: scenario.key,
            level: scenario.startingLevel,
            resource: "0",
            theme,
          });
          const upgrade =
            fixture.data.upgradeSemantics.groups[scenario.group][scenario.key];
          const hoverImageName = upgrade?.image.split("/").at(-1);
          if (!hoverImageName) {
            throw new Error(
              `Missing image for ${scenario.group}.${scenario.key}.`,
            );
          }
          await expectPairedPagesFullViewportMatch(
            page,
            sourcePage,
            sourceUrl,
            encodedViewportSave,
            scenario.group,
            theme,
            `${scenario.group} zero-resource boundary full viewport at 1366x768`,
            hoverImageName,
          );
        }
      } finally {
        await context.close().catch(() => undefined);
      }
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  test(
    `matches level-one shop catalog screens at 1366x768 in ${theme} theme`,
    { tag: "@slow" },
    async ({ browser }) => {
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
      const upgradeGroups = fixture.data.upgradeSemantics.groups;
      const originalSave = JSON.parse(
        fixture.data.saveApplicationSemantics.inputJson,
      ) as LegacySave;
      const encodedViewportSave = makeAllAffordableSave(
        originalSave,
        upgradeGroups,
        theme,
        1,
      );
      const context = await browser.newContext({
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1366, height: 768 },
      });
      const sourcePage = await context.newPage();
      const page = await context.newPage();
      try {
        const sourceUrl = await routePinnedRemixOracle(sourcePage);
        await Promise.all([
          page.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
          sourcePage.addInitScript(seedPendingSaveAtNavigation, {
            prefix: pendingSavePrefix,
            time: fixedTime,
          }),
        ]);
        for (const group of groups) {
          const [key, upgrade] = Object.entries(upgradeGroups[group])[0] ?? [];
          const hoverImageName = upgrade?.image.split("/").at(-1);
          if (!key || !hoverImageName) {
            throw new Error(`Missing level-one shop card for ${group}.`);
          }
          await expectPairedPagesFullViewportMatch(
            page,
            sourcePage,
            sourceUrl,
            encodedViewportSave,
            group,
            theme,
            `${group} level-one catalog full viewport at 1366x768`,
            hoverImageName,
          );
        }
      } finally {
        await context.close().catch(() => undefined);
      }
    },
  );
}

for (const theme of ["light", "dark"] as const) {
  for (const startingLevel of [0, 1] as const) {
    test(
      `matches shop cards, details, and full screens against Remix at level ${startingLevel} in ${theme} theme`,
      { tag: "@slow" },
      async ({ page, browser }) => {
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
          let samePageOracleReady = false;
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
              await expect(
                sourceCard,
                `${group}.${key} source card`,
              ).toHaveCount(1);
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
                `${group}.${key} presentation`,
              ).toEqual(sourcePresentation);
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
              expect(
                beyondCardHash,
                `${group}.${key} resting card pixels`,
              ).toBe(sourceCardHash);
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
            if (!samePageOracleReady) {
              const samePageSourceUrl = await routePinnedRemixOracle(page, {
                passThroughOrigins: [configuredAppOrigin()],
              });
              expect(samePageSourceUrl).toBe(sourceUrl);
              samePageOracleReady = true;
            }
            await expectSinglePageFullViewportMatch(
              page,
              sourceUrl,
              encoded,
              group,
              theme,
              `${group} full-screen image at upgrade level ${startingLevel}`,
            );
            fullScreensCompared += 1;
          }
          expect(compared).toBe(22);
          expect(fullScreensCompared).toBe(groups.length);
        } finally {
          await sourceContext.close().catch(() => undefined);
        }
      },
    );
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`matches full-screen shop modifier hints in ${theme} theme`, async ({
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
    const originalSave = JSON.parse(
      fixture.data.saveApplicationSemantics.inputJson,
    ) as LegacySave;
    const encodedSave = makeAllAffordableSave(
      originalSave,
      fixture.data.upgradeSemantics.groups,
      theme,
      0,
    );
    const activePowerImage =
      fixture.data.upgradeSemantics.groups.money["activePower"]?.image;
    if (!activePowerImage) {
      throw new Error("The pinned Money activePower image is missing.");
    }
    const imageName = activePowerImage.split("/").at(-1);
    if (!imageName) {
      throw new Error("The pinned Money activePower image name is missing.");
    }

    const context = await browser.newContext({
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    try {
      await page.addInitScript(seedPendingSaveAtNavigation, {
        prefix: pendingSavePrefix,
        time: fixedTime,
      });
      const sourceUrl = await routePinnedRemixOracle(page, {
        passThroughOrigins: [configuredAppOrigin()],
      });
      await page.setViewportSize({ width: 1440, height: 900 });

      for (const modifier of modifierChecks) {
        await expectSinglePageFullViewportMatch(
          page,
          sourceUrl,
          encodedSave,
          "money",
          theme,
          `${modifier.name} full-screen modifier hints`,
          imageName,
          modifier,
        );
      }
    } finally {
      await context.close().catch(() => undefined);
    }
  });
}

// Several minutes: excluded from `pnpm test:e2e`; run `pnpm test:e2e:slow`.
test(
  "routes single, Shift, Control, and Shift+Control purchases like Remix",
  { tag: "@slow" },
  async ({ page, browser }) => {
    test.setTimeout(600_000);
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
        { name: "single", keys: [] as const, maximum: 1 },
        { name: "Shift", keys: ["Shift"] as const, maximum: 10 },
        { name: "Control", keys: ["Control"] as const, maximum: 100 },
        {
          name: "Shift+Control",
          keys: ["Shift", "Control"] as const,
          maximum: 100,
        },
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

              for (const key of mode.keys) {
                await Promise.all([
                  page.keyboard.down(key),
                  sourcePage.keyboard.down(key),
                ]);
              }
              try {
                await Promise.all([card.click(), sourceCard.click()]);
              } finally {
                for (const key of [...mode.keys].reverse()) {
                  await Promise.all([
                    page.keyboard.up(key),
                    sourcePage.keyboard.up(key),
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
      expect(compared).toBe(88);
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  },
);
