import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  expect,
  test,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type ShopGroup = "money" | "gems" | "planetCoins";
type LevelSample = {
  level: number;
  levelDisplay: string;
  effectDisplay: string;
  priceDisplay: string;
};
type CappedUpgrade = {
  image: string;
  maxLevel: number;
  samples: LevelSample[];
};
type CappedUpgradeFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      groups: Record<ShopGroup, Record<string, CappedUpgrade>>;
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
    theme: string;
    tab: string;
    upgradeTab: string;
    [key: string]: unknown;
  };
  upgrades: Record<string, { level: number }>;
  gemUpgrades: Record<string, { level: number }>;
  planetCoinUpgrades: Record<string, { level: number }>;
};

const fixedTime = 1_700_000_000_000;
const groups: readonly ShopGroup[] = ["money", "gems", "planetCoins"];
const tabLabels: Record<ShopGroup, string> = {
  money: "Money Upgrades",
  gems: "Gem Upgrades",
  planetCoins: "PC Upgrades",
};

function makeCapSave(
  input: LegacySave,
  fixtureGroups: CappedUpgradeFixture["data"]["upgradeSemantics"]["groups"],
  scenario: {
    group: ShopGroup;
    key: string;
    level: number;
    theme: "light" | "dark";
  },
): string {
  const save = structuredClone(input);
  save.money = "1e1000";
  save.gems = "1e1000";
  save.planetCoins = "1e1000";
  save.highestMineObjectLevel = 90;
  save.mineObjectLevel = 1;
  save.lastActive = fixedTime;
  save.settings.tab = "main";
  save.settings.theme = scenario.theme;
  save.settings.upgradeTab = scenario.group;
  // The pinned upgrade display strings in the corpus use Standard notation.
  save.settings["numberFormatterIndex"] = 0;
  const initialLevels = (group: ShopGroup) =>
    Object.fromEntries(
      Object.keys(fixtureGroups[group]).map((key) => [key, { level: 0 }]),
    );
  save.upgrades = initialLevels("money");
  save.gemUpgrades = initialLevels("gems");
  save.planetCoinUpgrades = initialLevels("planetCoins");
  const targetLevels =
    scenario.group === "money"
      ? save.upgrades
      : scenario.group === "gems"
        ? save.gemUpgrades
        : save.planetCoinUpgrades;
  targetLevels[scenario.key] = { level: scenario.level };
  return encodeRemixLegacySave(save);
}

function seedPage({ encoded, time }: { encoded: string; time: number }): void {
  if (sessionStorage.getItem("upgrade-all-caps-seeded") !== "true") {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    sessionStorage.setItem("upgrade-all-caps-seeded", "true");
  }
  Date.now = () => time;
}

async function waitForVisualPaint(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => {})),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

type ScreenshotClip = { x: number; y: number; width: number; height: number };

async function locatorClip(
  locator: Locator,
  inset = 0,
): Promise<ScreenshotClip> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("The source-paired visual element is hidden.");
  const x = Math.floor(bounds.x) + inset;
  const y = Math.floor(bounds.y) + inset;
  const right = Math.ceil(bounds.x + bounds.width) - inset;
  const bottom = Math.ceil(bounds.y + bounds.height) - inset;
  return { x, y, width: right - x, height: bottom - y };
}

async function stableClipScreenshotHash(
  page: Page,
  clip: ScreenshotClip,
): Promise<{ hash: string; png: Buffer }> {
  let previous: string | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const screenshot = await page.screenshot({
      clip,
      animations: "disabled",
      caret: "hide",
    });
    const current = createHash("sha256").update(screenshot).digest("hex");
    if (current === previous) return { hash: current, png: screenshot };
    previous = current;
    await waitForVisualPaint(page);
  }
  throw new Error("The source-paired upgrade screenshot did not stabilize.");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function compareFiniteCapBoundaries(
  context: BrowserContext,
  theme: "light" | "dark",
  testInfo: TestInfo,
): Promise<void> {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as CappedUpgradeFixture;
  const fixtureGroups = fixture.data.upgradeSemantics.groups;
  const representativeCapKeys = Object.fromEntries(
    groups.map((group) => [
      group,
      Object.keys(fixtureGroups[group]).find((key) =>
        Number.isFinite(fixtureGroups[group][key]!.maxLevel),
      ),
    ]),
  ) as Record<ShopGroup, string | undefined>;
  const input = JSON.parse(
    fixture.data.saveApplicationSemantics.inputJson,
  ) as LegacySave;
  const initialSave = makeCapSave(input, fixtureGroups, {
    group: "money",
    key: "blacksmithBonus",
    level: 0,
    theme,
  });
  const [page, sourcePage] = await Promise.all([
    context.newPage(),
    context.newPage(),
  ]);
  // Route the oracle on its Page only so Beyond's local origin is unaffected.
  const sourceUrl = await routePinnedRemixOracle(sourcePage);
  const initialize = async (encoded: string) => {
    await Promise.all([
      page.addInitScript(seedPage, { encoded, time: fixedTime }),
      sourcePage.addInitScript(seedPage, { encoded, time: fixedTime }),
    ]);
  };

  try {
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await initialize(initialSave);
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

    for (const group of groups) {
      for (const [key, upgrade] of Object.entries(fixtureGroups[group])) {
        if (!Number.isFinite(upgrade.maxLevel)) continue;
        const cap = upgrade.maxLevel;
        const iconName = upgrade.image.split("/").at(-1)!;
        const beyondCard = page.locator(
          `[data-upgrade-group="${group}"][data-upgrade-key="${key}"]`,
        );
        const sourceCard = sourcePage.locator(".upgradelist .upgrade").filter({
          has: sourcePage.locator(`img[src$="${iconName}"]`),
        });

        for (const level of [cap - 1, cap, cap + 1]) {
          const sample = upgrade.samples.find((item) => item.level === level);
          if (!sample) {
            throw new Error(
              `Pinned ${group}.${key} level ${level} is missing.`,
            );
          }
          const encoded = makeCapSave(input, fixtureGroups, {
            group,
            key,
            level,
            theme,
          });
          await Promise.all([
            page.evaluate((save) => {
              localStorage.clear();
              localStorage.setItem("IdleMine", save);
            }, encoded),
            sourcePage.evaluate((save) => {
              localStorage.clear();
              localStorage.setItem("IdleMine", save);
            }, encoded),
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
          await expect(beyondCard).toHaveAttribute(
            "data-upgrade-level",
            String(level),
          );
          await expect(beyondCard.locator(".lvl")).toHaveText(
            sample.levelDisplay,
          );
          await expect(sourceCard).toHaveCount(1);
          await expect(sourceCard.locator(".lvl")).toHaveText(
            sample.levelDisplay,
          );

          await Promise.all([beyondCard.hover(), sourceCard.hover()]);
          await Promise.all([
            waitForVisualPaint(page),
            waitForVisualPaint(sourcePage),
          ]);
          const beyondDetails = page.locator(`[data-upgrade-details="${key}"]`);
          const sourceDetails = sourcePage.locator(".highlightedupgrade");
          await expect(beyondDetails).toBeVisible();
          await expect(sourceDetails).toBeVisible();
          const beyondText = normalizeText(await beyondDetails.innerText());
          const sourceText = normalizeText(await sourceDetails.innerText());
          expect(
            sourceText,
            `${group}.${key} level ${level} source text`,
          ).toContain(normalizeText(sample.effectDisplay));
          expect(
            sourceText,
            `${group}.${key} level ${level} source price`,
          ).toContain(normalizeText(sample.priceDisplay));
          expect(beyondText, `${group}.${key} level ${level} detail text`).toBe(
            sourceText,
          );

          const [
            beyondCardClip,
            sourceCardClip,
            beyondDetailsClip,
            sourceDetailsClip,
          ] = await Promise.all([
            locatorClip(beyondCard, 1),
            locatorClip(sourceCard, 1),
            locatorClip(beyondDetails),
            locatorClip(sourceDetails),
          ]);
          expect(
            sourceCardClip,
            `${theme} ${group}.${key} level ${level} card geometry`,
          ).toEqual(beyondCardClip);
          expect(
            sourceDetailsClip,
            `${theme} ${group}.${key} level ${level} detail geometry`,
          ).toEqual(beyondDetailsClip);
          const [
            beyondCardVisual,
            sourceCardVisual,
            beyondDetailsVisual,
            sourceDetailsVisual,
          ] = await Promise.all([
            stableClipScreenshotHash(page, beyondCardClip),
            stableClipScreenshotHash(sourcePage, sourceCardClip),
            stableClipScreenshotHash(page, beyondDetailsClip),
            stableClipScreenshotHash(sourcePage, sourceDetailsClip),
          ]);
          if (
            beyondCardVisual.hash !== sourceCardVisual.hash ||
            beyondDetailsVisual.hash !== sourceDetailsVisual.hash
          ) {
            await Promise.all([
              testInfo.attach(
                `${theme}-${group}-${key}-${level}-beyond-card.png`,
                {
                  body: beyondCardVisual.png,
                  contentType: "image/png",
                },
              ),
              testInfo.attach(
                `${theme}-${group}-${key}-${level}-source-card.png`,
                {
                  body: sourceCardVisual.png,
                  contentType: "image/png",
                },
              ),
              testInfo.attach(
                `${theme}-${group}-${key}-${level}-beyond-detail.png`,
                {
                  body: beyondDetailsVisual.png,
                  contentType: "image/png",
                },
              ),
              testInfo.attach(
                `${theme}-${group}-${key}-${level}-source-detail.png`,
                {
                  body: sourceDetailsVisual.png,
                  contentType: "image/png",
                },
              ),
            ]);
          }
          expect(
            beyondCardVisual.hash,
            `${theme} ${group}.${key} level ${level} card pixels`,
          ).toBe(sourceCardVisual.hash);
          expect(
            beyondDetailsVisual.hash,
            `${theme} ${group}.${key} level ${level} detail pixels`,
          ).toBe(sourceDetailsVisual.hash);

          if (level === cap && representativeCapKeys[group] === key) {
            const fullScreenClip = { x: 0, y: 0, width: 1440, height: 900 };
            const [beyondFullScreen, sourceFullScreen] = await Promise.all([
              stableClipScreenshotHash(page, fullScreenClip),
              stableClipScreenshotHash(sourcePage, fullScreenClip),
            ]);
            if (beyondFullScreen.hash !== sourceFullScreen.hash) {
              await Promise.all([
                testInfo.attach(
                  `${theme}-${group}-cap-beyond-full-screen.png`,
                  {
                    body: beyondFullScreen.png,
                    contentType: "image/png",
                  },
                ),
                testInfo.attach(
                  `${theme}-${group}-cap-source-full-screen.png`,
                  {
                    body: sourceFullScreen.png,
                    contentType: "image/png",
                  },
                ),
              ]);
            }
            expect(
              beyondFullScreen.hash,
              `${theme} ${group}.${key} full-screen at cap`,
            ).toBe(sourceFullScreen.hash);
          }

          const [beyondStyle, sourceStyle] = await Promise.all([
            beyondCard.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                classes: [...element.classList]
                  .filter((name) =>
                    ["upgrade", "gem", "pc", "cantafford"].includes(name),
                  )
                  .sort(),
                opacity: style.opacity,
                cursor: style.cursor,
                backgroundColor: style.backgroundColor,
              };
            }),
            sourceCard.evaluate((element) => {
              const style = getComputedStyle(element);
              return {
                classes: [...element.classList]
                  .filter((name) =>
                    ["upgrade", "gem", "pc", "cantafford"].includes(name),
                  )
                  .sort(),
                opacity: style.opacity,
                cursor: style.cursor,
                backgroundColor: style.backgroundColor,
              };
            }),
          ]);
          expect(
            beyondStyle,
            `${group}.${key} level ${level} affordance`,
          ).toEqual(sourceStyle);
          expect(sourceStyle.classes.includes("cantafford")).toBe(
            level === cap,
          );
        }
      }
    }
  } finally {
    await Promise.all([
      page.close().catch(() => undefined),
      sourcePage.close().catch(() => undefined),
    ]);
  }
}

for (const theme of ["light", "dark"] as const) {
  // Several minutes per theme: excluded from `pnpm test:e2e`; run `pnpm test:e2e:slow`.
  test(
    `matches every finite Money, Gem, and Planet Coin shop cap boundary (${theme})`,
    { tag: "@slow" },
    async ({ browser }, testInfo) => {
      test.setTimeout(600_000);
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL as string,
        colorScheme: theme,
        locale: "en-US",
        timezoneId: "UTC",
        viewport: { width: 1440, height: 900 },
      });
      try {
        await compareFiniteCapBoundaries(context, theme, testInfo);
      } finally {
        await context.close();
      }
    },
  );
}
