import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type LegacySave = {
  lastActive: number;
  settings: {
    tab: string;
    theme: string;
    showMineObjLevel: boolean;
    showMinCraftDamage: boolean;
  };
};

type SettingsVisualFixture = {
  data: {
    saveExportSemantics: {
      fresh: { object: Record<string, unknown> };
    };
  };
};

const fixedClock = 1_704_067_200_000;

test.use({
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "UTC",
  viewport: { width: 1440, height: 900 },
});

function seedLegacySave({
  storageKey,
  encoded,
  now,
}: {
  storageKey: string;
  encoded: string;
  now: number;
}) {
  localStorage.clear();
  localStorage.setItem(storageKey, encoded);
  Object.defineProperty(Date, "now", { configurable: true, value: () => now });
}

async function waitForStableMiningScreenshot(
  page: Page,
  requireVisibleCanvas = true,
): Promise<Buffer> {
  if (requireVisibleCanvas) {
    await page.locator("canvas.mine-object").waitFor({ state: "visible" });
  }
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(1439, 899);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  return page.screenshot({ animations: "disabled" });
}

async function readMiningPixelStack(page: Page) {
  return page.evaluate(() => {
    const point = { x: 7.5, y: 209.5 };
    const styleProperties = [
      "backgroundColor",
      "backgroundAttachment",
      "backgroundClip",
      "backgroundImage",
      "backgroundOrigin",
      "borderTopColor",
      "borderTopStyle",
      "borderTopWidth",
      "borderRightColor",
      "borderRightStyle",
      "borderRightWidth",
      "borderBottomColor",
      "borderBottomStyle",
      "borderBottomWidth",
      "borderLeftColor",
      "borderLeftStyle",
      "borderLeftWidth",
      "boxShadow",
      "clipPath",
      "color",
      "display",
      "contain",
      "filter",
      "isolation",
      "mixBlendMode",
      "backdropFilter",
      "mask",
      "maskImage",
      "opacity",
      "outlineColor",
      "outlineStyle",
      "outlineWidth",
      "overflow",
      "pointerEvents",
      "position",
      "scrollbarColor",
      "scrollbarWidth",
      "transform",
      "visibility",
      "willChange",
      "zIndex",
    ] as const;
    const readStyle = (style: CSSStyleDeclaration) =>
      Object.fromEntries(
        styleProperties.map((property) => [property, style[property]]),
      );
    const describe = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tagName: element.tagName,
        id: element.id,
        className: String(element.className),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        style: readStyle(style),
        before: {
          content: getComputedStyle(element, "::before").content,
          ...readStyle(getComputedStyle(element, "::before")),
        },
        after: {
          content: getComputedStyle(element, "::after").content,
          ...readStyle(getComputedStyle(element, "::after")),
        },
      };
    };
    const stack = document.elementsFromPoint(point.x, point.y);
    const coveringElements = Array.from(document.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (
          point.x < rect.left ||
          point.x >= rect.right ||
          point.y < rect.top ||
          point.y >= rect.bottom
        ) {
          return null;
        }
        return describe(element);
      })
      .filter((element) => element !== null);
    const ancestry: Element[] = [];
    for (let element = document.elementFromPoint(point.x, point.y); element;) {
      ancestry.push(element);
      element = element.parentElement;
    }
    return {
      point,
      viewport: {
        width: innerWidth,
        height: innerHeight,
        devicePixelRatio,
        visualScale: visualViewport?.scale ?? null,
      },
      root: describe(document.documentElement),
      body: describe(document.body),
      stack: stack.map(describe),
      coveringElements,
      ancestry: ancestry.map(describe),
    };
  });
}

async function captureWithBodyChildrenHidden(page: Page) {
  const original = await page.evaluate(() =>
    Array.from(document.body.children).map((element) => {
      const style = (element as HTMLElement).style;
      return {
        value: style.getPropertyValue("display"),
        priority: style.getPropertyPriority("display"),
      };
    }),
  );
  try {
    await page.evaluate(() => {
      for (const element of document.body.children) {
        (element as HTMLElement).style.setProperty(
          "display",
          "none",
          "important",
        );
      }
    });
    return await waitForStableMiningScreenshot(page, false);
  } finally {
    await page.evaluate((styles) => {
      Array.from(document.body.children).forEach((element, index) => {
        const style = (element as HTMLElement).style;
        style.removeProperty("display");
        if (styles[index]?.value) {
          style.setProperty(
            "display",
            styles[index].value,
            styles[index].priority,
          );
        }
      });
    }, original);
  }
}

async function captureWithElementHidden(page: Page, selector: string) {
  const element = page.locator(selector);
  const original = await element.evaluate((node) => {
    const style = (node as HTMLElement).style;
    return {
      value: style.getPropertyValue("display"),
      priority: style.getPropertyPriority("display"),
    };
  });
  try {
    await element.evaluate((node) => {
      (node as HTMLElement).style.setProperty("display", "none", "important");
    });
    return await waitForStableMiningScreenshot(page, false);
  } finally {
    await element.evaluate((node, style) => {
      const inlineStyle = (node as HTMLElement).style;
      inlineStyle.removeProperty("display");
      if (style.value) {
        inlineStyle.setProperty("display", style.value, style.priority);
      }
    }, original);
  }
}

async function captureWithRootBackground(page: Page) {
  const original = await page.evaluate(() =>
    [document.documentElement, document.body].map((element) => ({
      value: element.style.getPropertyValue("background-color"),
      priority: element.style.getPropertyPriority("background-color"),
    })),
  );
  await page.evaluate(() => {
    document.documentElement.style.setProperty(
      "background-color",
      "rgb(54, 54, 54)",
      "important",
    );
    document.body.style.setProperty(
      "background-color",
      "transparent",
      "important",
    );
  });
  const screenshot = await waitForStableMiningScreenshot(page);
  await page.evaluate((styles) => {
    [document.documentElement, document.body].forEach((element, index) => {
      const style = element.style;
      style.removeProperty("background-color");
      if (styles[index]?.value) {
        style.setProperty(
          "background-color",
          styles[index].value,
          styles[index].priority,
        );
      }
    });
  }, original);
  return screenshot;
}

for (const theme of ["light", "dark"] as const) {
  test(`matches Remix Mining preference branches in ${theme} theme`, async ({
    browser,
    page,
  }) => {
    const fixture = JSON.parse(
      await readFile(
        new URL(
          "../fixtures/parity/remix-reference-corpus.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ) as SettingsVisualFixture;
    const save = structuredClone(
      fixture.data.saveExportSemantics.fresh.object,
    ) as LegacySave;
    save.lastActive = fixedClock;
    save.settings.tab = "settings";
    save.settings.theme = theme;
    save.settings.showMineObjLevel = false;
    save.settings.showMinCraftDamage = false;
    const encoded = encodeRemixLegacySave(save);
    const sourceContext = await browser.newContext({
      colorScheme: theme,
      deviceScaleFactor: 1,
      locale: "en-US",
      timezoneId: "UTC",
      viewport: { width: 1440, height: 900 },
    });
    const sourcePage = await sourceContext.newPage();

    try {
      const sourceUrl = await routePinnedRemixOracle(sourceContext);
      await Promise.all([
        page.emulateMedia({ colorScheme: theme }),
        page.addInitScript(seedLegacySave, {
          storageKey: "IdleMine",
          encoded,
          now: fixedClock,
        }),
        sourcePage.addInitScript(seedLegacySave, {
          storageKey: "IdleMine",
          encoded,
          now: fixedClock,
        }),
      ]);
      await Promise.all([page.goto("/"), sourcePage.goto(sourceUrl)]);
      await Promise.all([
        expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready"),
        sourcePage.waitForFunction(
          (selectedTheme) =>
            Boolean(
              (window as Window & { game?: unknown }).game &&
              document.querySelector("#app > footer") &&
              document.querySelector<HTMLLinkElement>("#css_theme")?.sheet &&
              document
                .querySelector<HTMLLinkElement>("#css_theme")
                ?.getAttribute("href") === `Themes/${selectedTheme}.css`,
            ),
          theme,
        ),
      ]);
      await Promise.all([
        page.locator("[data-game-tab='settings']").click(),
        sourcePage
          .locator("footer button")
          .filter({ hasText: "Settings" })
          .click(),
      ]);

      const beyondPreference = page.getByLabel(
        "Show minimum Base Damage for crafted Pickaxes",
      );
      const remixPreference = sourcePage.getByLabel(
        "Show minimum Base Damage for crafted Pickaxes",
      );
      const beyondLevelPreference = page.getByLabel("Show Mineral Level");
      const remixLevelPreference = sourcePage.getByLabel("Show Mineral Level");
      await Promise.all([
        expect(beyondPreference).not.toBeChecked(),
        expect(remixPreference).not.toBeChecked(),
        expect(beyondLevelPreference).not.toBeChecked(),
        expect(remixLevelPreference).not.toBeChecked(),
      ]);

      const compareMining = async ({
        minimumCraftDamage,
        mineObjectLevel,
      }: {
        minimumCraftDamage: boolean;
        mineObjectLevel: boolean;
      }) => {
        await Promise.all([
          page.locator("[data-game-tab='mining']").click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Mining" })
            .click(),
        ]);

        const beyondMinimumDamage = page.locator("[data-minimum-craft-damage]");
        const beyondMineObjectLevel = page.locator("[data-mine-object-level]");
        const remixCraftButton = sourcePage.locator(
          ".craft-pickaxe button:not(.level-change)",
        );
        const remixMineObjectLevel = sourcePage.locator("article.main h4");
        if (minimumCraftDamage) {
          await Promise.all([
            expect(beyondMinimumDamage).toBeVisible(),
            expect(remixCraftButton).toContainText("Minimum Base Damage:"),
          ]);
          const [beyondText, remixText] = await Promise.all([
            beyondMinimumDamage.innerText(),
            sourcePage
              .getByText("Minimum Base Damage:", { exact: false })
              .innerText(),
          ]);
          expect(beyondText.replace(/\s+/g, " ").trim()).toBe(
            remixText.replace(/\s+/g, " ").trim(),
          );
        } else {
          await Promise.all([
            expect(beyondMinimumDamage).toHaveCount(0),
            expect(remixCraftButton).not.toContainText("Minimum Base Damage:"),
          ]);
        }
        if (mineObjectLevel) {
          await Promise.all([
            expect(beyondMineObjectLevel).toHaveText("#1"),
            expect(remixMineObjectLevel).toHaveText("#1"),
          ]);
        } else {
          await Promise.all([
            expect(beyondMineObjectLevel).toHaveCount(0),
            expect(remixMineObjectLevel).toHaveCount(0),
          ]);
        }

        const [beyondPng, remixPng] = await Promise.all([
          waitForStableMiningScreenshot(page),
          waitForStableMiningScreenshot(sourcePage),
        ]);
        const beyondHash = createHash("sha256").update(beyondPng).digest("hex");
        const remixHash = createHash("sha256").update(remixPng).digest("hex");
        if (beyondHash !== remixHash) {
          const state = `craft-${minimumCraftDamage}-level-${mineObjectLevel}`;
          await Promise.all([
            test.info().attach(`mining-${theme}-${state}-beyond.png`, {
              body: beyondPng,
              contentType: "image/png",
            }),
            test.info().attach(`mining-${theme}-${state}-remix.png`, {
              body: remixPng,
              contentType: "image/png",
            }),
          ]);
          if (
            process.platform === "linux" &&
            theme === "dark" &&
            mineObjectLevel
          ) {
            const [beyondPaint, remixPaint] = await Promise.all([
              readMiningPixelStack(page),
              readMiningPixelStack(sourcePage),
            ]);
            const [beyondBackgroundPng, remixBackgroundPng] = await Promise.all(
              [
                captureWithBodyChildrenHidden(page),
                captureWithBodyChildrenHidden(sourcePage),
              ],
            );
            const beyondBackgroundHash = createHash("sha256")
              .update(beyondBackgroundPng)
              .digest("hex");
            const remixBackgroundHash = createHash("sha256")
              .update(remixBackgroundPng)
              .digest("hex");
            const [beyondRootPng, remixRootPng] = await Promise.all([
              captureWithRootBackground(page),
              captureWithRootBackground(sourcePage),
            ]);
            const beyondRootHash = createHash("sha256")
              .update(beyondRootPng)
              .digest("hex");
            const remixRootHash = createHash("sha256")
              .update(remixRootPng)
              .digest("hex");
            const [beyondArticleHiddenPng, remixArticleHiddenPng] =
              await Promise.all([
                captureWithElementHidden(page, "article.main"),
                captureWithElementHidden(sourcePage, "article.main"),
              ]);
            const beyondArticleHiddenHash = createHash("sha256")
              .update(beyondArticleHiddenPng)
              .digest("hex");
            const remixArticleHiddenHash = createHash("sha256")
              .update(remixArticleHiddenPng)
              .digest("hex");
            for (const [name, png] of [
              [
                "mining-dark-level-background-only-beyond.png",
                beyondBackgroundPng,
              ],
              [
                "mining-dark-level-background-only-remix.png",
                remixBackgroundPng,
              ],
              ["mining-dark-level-root-background-beyond.png", beyondRootPng],
              ["mining-dark-level-root-background-remix.png", remixRootPng],
              [
                "mining-dark-level-article-hidden-beyond.png",
                beyondArticleHiddenPng,
              ],
              [
                "mining-dark-level-article-hidden-remix.png",
                remixArticleHiddenPng,
              ],
            ] as const) {
              await test.info().attach(name, {
                body: png,
                contentType: "image/png",
              });
            }
            const wrapper = await page.evaluate(() => {
              const app = document.getElementById("app");
              const element = app?.parentElement;
              if (
                !app ||
                !element ||
                element === document.body ||
                element.parentElement !== document.body
              ) {
                return null;
              }
              const outerHTML = element.outerHTML;
              element.replaceWith(...Array.from(element.childNodes));
              return outerHTML;
            });
            const unwrappedPng = await waitForStableMiningScreenshot(page);
            const unwrappedHash = createHash("sha256")
              .update(unwrappedPng)
              .digest("hex");
            await test
              .info()
              .attach("mining-dark-level-beyond-without-body-wrapper.png", {
                body: unwrappedPng,
                contentType: "image/png",
              });
            await writeFile(
              test.info().outputPath("linux-dark-level-pixel-stack.json"),
              JSON.stringify(
                {
                  beforeWrapperRemoval: {
                    beyond: beyondPaint,
                    remix: remixPaint,
                  },
                  backgroundOnly: {
                    beyondHash: beyondBackgroundHash,
                    remixHash: remixBackgroundHash,
                    matchesRemix: beyondBackgroundHash === remixBackgroundHash,
                  },
                  rootBackground: {
                    beyondHash: beyondRootHash,
                    remixHash: remixRootHash,
                    matchesRemix: beyondRootHash === remixRootHash,
                  },
                  articleHidden: {
                    beyondHash: beyondArticleHiddenHash,
                    remixHash: remixArticleHiddenHash,
                    matchesRemix:
                      beyondArticleHiddenHash === remixArticleHiddenHash,
                  },
                  wrapper,
                  afterWrapperRemoval: {
                    hash: unwrappedHash,
                    matchesRemix: unwrappedHash === remixHash,
                    paint: await readMiningPixelStack(page),
                  },
                },
                null,
                2,
              ),
              "utf8",
            );
          }
        }
        expect(
          beyondHash,
          `full Mining screen, minimum damage ${minimumCraftDamage}, mineral level ${mineObjectLevel}, ${theme}`,
        ).toBe(remixHash);

        await Promise.all([
          page.locator("[data-game-tab='settings']").click(),
          sourcePage
            .locator("footer button")
            .filter({ hasText: "Settings" })
            .click(),
        ]);
      };

      await compareMining({
        minimumCraftDamage: false,
        mineObjectLevel: false,
      });
      await Promise.all([beyondPreference.check(), remixPreference.check()]);
      await Promise.all([
        expect(beyondPreference).toBeChecked(),
        expect(remixPreference).toBeChecked(),
      ]);
      await compareMining({ minimumCraftDamage: true, mineObjectLevel: false });

      await Promise.all([
        (async () => {
          await beyondPreference.uncheck();
          await beyondLevelPreference.check();
        })(),
        (async () => {
          await remixPreference.uncheck();
          await remixLevelPreference.check();
        })(),
      ]);
      await Promise.all([
        expect(beyondPreference).not.toBeChecked(),
        expect(remixPreference).not.toBeChecked(),
        expect(beyondLevelPreference).toBeChecked(),
        expect(remixLevelPreference).toBeChecked(),
      ]);
      await compareMining({ minimumCraftDamage: false, mineObjectLevel: true });
    } finally {
      await sourceContext.close().catch(() => undefined);
    }
  });
}
