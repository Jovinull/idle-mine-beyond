import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type UpgradeCapFixture = {
  data: {
    saveApplicationSemantics: { inputJson: string };
    upgradeSemantics: {
      groups: {
        gems: {
          blacksmithSkill: {
            maxLevel: number;
            samples: {
              level: number;
              levelDisplay: string;
              effectDisplay: string;
              priceDisplay: string;
            }[];
          };
        };
      };
    };
  };
};

async function compareUpgradeCapQuirk(
  page: Page,
  browser: Browser,
  theme: "light" | "dark",
): Promise<void> {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as UpgradeCapFixture;
  const upgrade = fixture.data.upgradeSemantics.groups.gems.blacksmithSkill;
  const cap = upgrade.maxLevel;
  const capSample = upgrade.samples.find(({ level }) => level === cap);
  const overCapSample = upgrade.samples.find(({ level }) => level === cap + 1);
  if (!capSample || !overCapSample) {
    throw new Error("Pinned Gem Blacksmith Skill cap cases are missing.");
  }

  const save = JSON.parse(fixture.data.saveApplicationSemantics.inputJson) as {
    gems: string;
    highestMineObjectLevel: number;
    lastActive: number;
    mineObjectLevel: number;
    gemUpgrades: Record<string, { level: number }>;
    settings: { theme: string; tab: string; upgradeTab: string };
  };
  save.settings.theme = theme;
  save.gems = "1e100";
  save.highestMineObjectLevel = 61;
  save.mineObjectLevel = 61;
  save.lastActive = 1_700_000_000_000;
  save.gemUpgrades["blacksmithSkill"] = { level: cap };
  save.settings.tab = "main";
  save.settings.upgradeTab = "gems";
  const encodedSave = encodeRemixLegacySave(save);

  const sourceContext = await browser.newContext({
    colorScheme: theme,
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = (encoded: string) => {
    if (sessionStorage.getItem("upgrade-cap-quirk-seeded") !== "true") {
      localStorage.clear();
      localStorage.setItem("IdleMine", encoded);
      sessionStorage.setItem("upgrade-cap-quirk-seeded", "true");
    }
    Date.now = () => 1_700_000_000_000;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await Promise.all([
      page.addInitScript(initializePage, encodedSave),
      sourcePage.addInitScript(initializePage, encodedSave),
    ]);
    await page.emulateMedia({ colorScheme: theme });
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

    const card = page.locator(
      '[data-upgrade-group="gems"][data-upgrade-key="blacksmithSkill"]',
    );
    const sourceCard = sourcePage
      .locator(".upgradelist .upgrade")
      .filter({ has: sourcePage.locator('img[src$="blacksmithskill.png"]') });

    for (const sample of [capSample, overCapSample]) {
      const level = sample.level;
      if (level !== cap) {
        save.gemUpgrades["blacksmithSkill"] = { level };
        const overCapSave = encodeRemixLegacySave(save);
        await Promise.all([
          page.evaluate((encoded) => {
            localStorage.clear();
            localStorage.setItem("IdleMine", encoded);
          }, overCapSave),
          sourcePage.evaluate((encoded) => {
            localStorage.clear();
            localStorage.setItem("IdleMine", encoded);
          }, overCapSave),
        ]);
        await Promise.all([page.reload(), sourcePage.reload()]);
        await expect(page.locator("#app")).toHaveAttribute(
          "data-app-state",
          "ready",
        );
        await sourcePage.waitForFunction(() =>
          Boolean((window as Window & { game?: unknown }).game),
        );
      }

      await Promise.all([
        page.locator('[data-upgrade-tab="gems"]').click(),
        sourcePage
          .locator(".upg-tabs button")
          .filter({ hasText: "Gem Upgrades" })
          .click(),
      ]);
      await expect(card).toHaveAttribute("data-upgrade-level", String(level));
      await expect(sourceCard).toBeVisible();
      await expect(sourceCard.locator(".lvl")).toHaveText(sample.levelDisplay);
      await expect(card.locator(".lvl")).toHaveText(sample.levelDisplay);

      await Promise.all([card.hover(), sourceCard.hover()]);
      await Promise.all([
        waitForVisualPaint(page),
        waitForVisualPaint(sourcePage),
      ]);
      const details = page.locator(".highlightedupgrade");
      const sourceDetails = sourcePage.locator(".highlightedupgrade");
      await expect(details).toBeVisible();
      await expect(sourceDetails).toBeVisible();
      const [cardHash, sourceCardHash, detailsHash, sourceDetailsHash] =
        await Promise.all([
          stableScreenshotHash(page, card, 1),
          stableScreenshotHash(sourcePage, sourceCard, 1),
          stableScreenshotHash(page, details),
          stableScreenshotHash(sourcePage, sourceDetails),
        ]);
      expect(cardHash, `${theme} level ${level} card pixels`).toBe(
        sourceCardHash,
      );
      expect(detailsHash, `${theme} level ${level} detail pixels`).toBe(
        sourceDetailsHash,
      );
      const [beyond, source] = await Promise.all([
        card.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            classes: [...element.classList]
              .filter((className) =>
                ["upgrade", "gem", "pc", "cantafford"].includes(className),
              )
              .sort(),
            opacity: style.opacity,
            cursor: style.cursor,
            backgroundColor: style.backgroundColor,
            details: document
              .querySelector(".highlightedupgrade")
              ?.textContent?.replace(/\s+/g, " ")
              .trim(),
          };
        }),
        sourceCard.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            classes: [...element.classList]
              .filter((className) =>
                ["upgrade", "gem", "pc", "cantafford"].includes(className),
              )
              .sort(),
            opacity: style.opacity,
            cursor: style.cursor,
            backgroundColor: style.backgroundColor,
            details: document
              .querySelector(".highlightedupgrade")
              ?.textContent?.replace(/\s+/g, " ")
              .trim(),
          };
        }),
      ]);
      expect(source.details).toContain(sample.effectDisplay);
      expect(source.details).toContain(sample.priceDisplay);
      expect(beyond).toEqual(source);

      if (level === cap) {
        expect(source.classes).toContain("cantafford");
        expect(source.opacity).toBe("0.3");
        expect(source.cursor).toBe("auto");
      } else {
        expect(source.classes).not.toContain("cantafford");
        expect(source.opacity).toBe("1");
        expect(source.cursor).toBe("pointer");
      }

      await Promise.all([card.click(), sourceCard.click()]);
      await expect(card).toHaveAttribute("data-upgrade-level", String(level));
      await expect(sourceCard.locator(".lvl")).toHaveText(sample.levelDisplay);
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
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

async function stableScreenshotHash(
  page: Page,
  locator: Locator,
  inset = 0,
): Promise<string> {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error("The rendered upgrade element is not visible.");
  const clip = {
    x: Math.floor(bounds.x) + inset,
    y: Math.floor(bounds.y) + inset,
    width:
      Math.ceil(bounds.x + bounds.width) - Math.floor(bounds.x) - inset * 2,
    height:
      Math.ceil(bounds.y + bounds.height) - Math.floor(bounds.y) - inset * 2,
  };
  let previous: string | undefined;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const screenshot = await page.screenshot({
      clip,
      animations: "disabled",
      caret: "hide",
    });
    const current = createHash("sha256").update(screenshot).digest("hex");
    if (current === previous) return current;
    previous = current;
    await waitForVisualPaint(page);
  }
  throw new Error("The upgrade cap screenshot did not stabilize.");
}

for (const theme of ["light", "dark"] as const) {
  test(`keeps Remix's capped and over-cap Gem card affordance quirk (${theme})`, async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const beyondContext = await browser.newContext({
      baseURL: testInfo.project.use.baseURL as string,
      colorScheme: theme,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    try {
      await compareUpgradeCapQuirk(
        await beyondContext.newPage(),
        browser,
        theme,
      );
    } finally {
      await beyondContext.close();
    }
  });
}
