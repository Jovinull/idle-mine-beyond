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
      "backgroundPosition",
      "backgroundRepeat",
      "backgroundSize",
      "backgroundBlendMode",
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
      "transition",
      "transitionProperty",
      "transitionDuration",
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
      "imageRendering",
      "backfaceVisibility",
      "objectFit",
      "objectPosition",
      "transformOrigin",
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
      mineCanvas: (() => {
        const canvas =
          document.querySelector<HTMLCanvasElement>("canvas.mine-object");
        const context = canvas?.getContext("2d");
        const pixels =
          canvas && context
            ? context.getImageData(0, 0, canvas.width, canvas.height).data
            : undefined;
        let pixelHash = 2166136261;
        if (pixels) {
          for (const value of pixels) {
            pixelHash = Math.imul(pixelHash ^ value, 16777619);
          }
        }
        return canvas
          ? {
              bitmap: { width: canvas.width, height: canvas.height },
              attributes: Array.from(canvas.attributes).map(
                ({ name, value }) => [name, value],
              ),
              pixelHash: pixels ? (pixelHash >>> 0).toString(16) : null,
              paint: describe(canvas),
            }
          : null;
      })(),
      cacheCanvas: (() => {
        const canvas =
          document.querySelector<HTMLCanvasElement>("canvas#cache");
        if (!canvas) return null;
        const context = canvas.getContext("2d");
        const pixels = context?.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let pixelHash = 2166136261;
        if (pixels) {
          for (const value of pixels) {
            pixelHash = Math.imul(pixelHash ^ value, 16777619);
          }
        }
        const ancestors: string[] = [];
        for (
          let node: Element | null = canvas;
          node;
          node = node.parentElement
        ) {
          ancestors.push(
            `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}`,
          );
        }
        const style = getComputedStyle(canvas);
        return {
          bitmap: { width: canvas.width, height: canvas.height },
          attributes: Array.from(canvas.attributes).map(({ name, value }) => [
            name,
            value,
          ]),
          pixelHash: pixels ? (pixelHash >>> 0).toString(16) : null,
          isConnected: canvas.isConnected,
          ancestors,
          display: style.display,
          visibility: style.visibility,
          position: style.position,
          rect: (() => {
            const rect = canvas.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          })(),
        };
      })(),
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

async function captureWithElementVisibilityHidden(
  page: Page,
  selector: string,
) {
  const element = page.locator(selector);
  const original = await element.evaluate((node) => {
    const style = (node as HTMLElement).style;
    return {
      value: style.getPropertyValue("visibility"),
      priority: style.getPropertyPriority("visibility"),
    };
  });
  try {
    await element.evaluate((node) => {
      (node as HTMLElement).style.setProperty(
        "visibility",
        "hidden",
        "important",
      );
    });
    return await waitForStableMiningScreenshot(page, false);
  } finally {
    await element.evaluate((node, style) => {
      const inlineStyle = (node as HTMLElement).style;
      inlineStyle.removeProperty("visibility");
      if (style.value) {
        inlineStyle.setProperty("visibility", style.value, style.priority);
      }
    }, original);
  }
}

async function captureWithElementOpacityZero(page: Page, selector: string) {
  const element = page.locator(selector);
  const original = await element.evaluate((node) => {
    const style = (node as HTMLElement).style;
    return {
      value: style.getPropertyValue("opacity"),
      priority: style.getPropertyPriority("opacity"),
    };
  });
  try {
    await element.evaluate((node) => {
      (node as HTMLElement).style.setProperty("opacity", "0", "important");
    });
    const computedOpacity = await element.evaluate(
      (node) => getComputedStyle(node).opacity,
    );
    return {
      png: await waitForStableMiningScreenshot(page),
      computedOpacity,
    };
  } finally {
    await element.evaluate((node, style) => {
      const inlineStyle = (node as HTMLElement).style;
      inlineStyle.removeProperty("opacity");
      if (style.value) {
        inlineStyle.setProperty("opacity", style.value, style.priority);
      }
    }, original);
  }
}

async function captureWithoutCanvasScopeClass(page: Page) {
  const canvas = page.locator("canvas.mine-object");
  const original = await canvas.evaluate((node) => {
    const style = (node as HTMLCanvasElement).style;
    const computed = getComputedStyle(node);
    return {
      className: node.className,
      height: style.getPropertyValue("height"),
      heightPriority: style.getPropertyPriority("height"),
      transition: style.getPropertyValue("transition"),
      transitionPriority: style.getPropertyPriority("transition"),
      computedHeight: computed.height,
      computedTransition: computed.transition,
    };
  });
  try {
    await canvas.evaluate((node, saved) => {
      const element = node as HTMLCanvasElement;
      element.style.setProperty("height", saved.computedHeight, "important");
      element.style.setProperty(
        "transition",
        saved.computedTransition,
        "important",
      );
      for (const className of [...element.classList]) {
        if (/^svelte-/.test(className)) element.classList.remove(className);
      }
    }, original);
    const computed = await canvas.evaluate((node) => {
      const style = getComputedStyle(node);
      return { height: style.height, transition: style.transition };
    });
    return { png: await waitForStableMiningScreenshot(page), computed };
  } finally {
    await canvas.evaluate((node, saved) => {
      const element = node as HTMLCanvasElement;
      element.className = saved.className;
      element.style.removeProperty("height");
      element.style.removeProperty("transition");
      if (saved.height) {
        element.style.setProperty("height", saved.height, saved.heightPriority);
      }
      if (saved.transition) {
        element.style.setProperty(
          "transition",
          saved.transition,
          saved.transitionPriority,
        );
      }
    }, original);
  }
}

async function captureWithReferenceCachePlacement(page: Page) {
  const cache = page.locator("canvas#cache");
  const original = await cache.evaluate((node) => {
    const parent = node.parentElement;
    if (!parent) throw new Error("The Remix cache canvas is detached.");
    return {
      parentSelector: parent.id
        ? `#${parent.id}`
        : parent.tagName.toLowerCase(),
      childIndex: Array.from(parent.childNodes).indexOf(node),
    };
  });
  try {
    await cache.evaluate((node) => {
      const app = document.getElementById("app");
      if (!app) throw new Error("The app root is missing.");
      app.prepend(node);
    });
    const placement = await cache.evaluate((node) => {
      const style = getComputedStyle(node);
      const parent = node.parentElement;
      return {
        parent: parent ? `${parent.tagName.toLowerCase()}#${parent.id}` : null,
        firstChild: parent?.firstElementChild === node,
        display: style.display,
        visibility: style.visibility,
      };
    });
    return { png: await waitForStableMiningScreenshot(page), placement };
  } finally {
    await cache.evaluate((node, saved) => {
      const parent = document.querySelector(saved.parentSelector);
      if (!parent) throw new Error("The original cache parent is missing.");
      parent.insertBefore(node, parent.childNodes[saved.childIndex] ?? null);
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
            const [beyondMineObjectHiddenPng, remixMineObjectHiddenPng] =
              await Promise.all([
                captureWithElementHidden(page, ".mineobject"),
                captureWithElementHidden(sourcePage, ".mineobject"),
              ]);
            const beyondMineObjectHiddenHash = createHash("sha256")
              .update(beyondMineObjectHiddenPng)
              .digest("hex");
            const remixMineObjectHiddenHash = createHash("sha256")
              .update(remixMineObjectHiddenPng)
              .digest("hex");
            const [beyondCanvasHiddenPng, remixCanvasHiddenPng] =
              await Promise.all([
                captureWithElementHidden(page, "canvas.mine-object"),
                captureWithElementHidden(sourcePage, "canvas.mine-object"),
              ]);
            const beyondCanvasHiddenHash = createHash("sha256")
              .update(beyondCanvasHiddenPng)
              .digest("hex");
            const remixCanvasHiddenHash = createHash("sha256")
              .update(remixCanvasHiddenPng)
              .digest("hex");
            const [beyondCanvasInvisiblePng, remixCanvasInvisiblePng] =
              await Promise.all([
                captureWithElementVisibilityHidden(page, "canvas.mine-object"),
                captureWithElementVisibilityHidden(
                  sourcePage,
                  "canvas.mine-object",
                ),
              ]);
            const beyondCanvasInvisibleHash = createHash("sha256")
              .update(beyondCanvasInvisiblePng)
              .digest("hex");
            const remixCanvasInvisibleHash = createHash("sha256")
              .update(remixCanvasInvisiblePng)
              .digest("hex");
            const scopeClassProbe = await captureWithoutCanvasScopeClass(page);
            const scopeClassHash = createHash("sha256")
              .update(scopeClassProbe.png)
              .digest("hex");
            const cachePlacementProbe =
              await captureWithReferenceCachePlacement(page);
            const cachePlacementHash = createHash("sha256")
              .update(cachePlacementProbe.png)
              .digest("hex");
            const [beyondOpacityZero, remixOpacityZero] = await Promise.all([
              captureWithElementOpacityZero(page, "canvas.mine-object"),
              captureWithElementOpacityZero(sourcePage, "canvas.mine-object"),
            ]);
            const beyondOpacityZeroHash = createHash("sha256")
              .update(beyondOpacityZero.png)
              .digest("hex");
            const remixOpacityZeroHash = createHash("sha256")
              .update(remixOpacityZero.png)
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
              [
                "mining-dark-level-mineobject-hidden-beyond.png",
                beyondMineObjectHiddenPng,
              ],
              [
                "mining-dark-level-mineobject-hidden-remix.png",
                remixMineObjectHiddenPng,
              ],
              [
                "mining-dark-level-canvas-hidden-beyond.png",
                beyondCanvasHiddenPng,
              ],
              [
                "mining-dark-level-canvas-hidden-remix.png",
                remixCanvasHiddenPng,
              ],
              [
                "mining-dark-level-canvas-invisible-beyond.png",
                beyondCanvasInvisiblePng,
              ],
              [
                "mining-dark-level-canvas-invisible-remix.png",
                remixCanvasInvisiblePng,
              ],
              [
                "mining-dark-level-beyond-without-canvas-scope-class.png",
                scopeClassProbe.png,
              ],
              [
                "mining-dark-level-beyond-reference-cache-placement.png",
                cachePlacementProbe.png,
              ],
              [
                "mining-dark-level-canvas-opacity-zero-beyond.png",
                beyondOpacityZero.png,
              ],
              [
                "mining-dark-level-canvas-opacity-zero-remix.png",
                remixOpacityZero.png,
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
                  mineObjectHidden: {
                    beyondHash: beyondMineObjectHiddenHash,
                    remixHash: remixMineObjectHiddenHash,
                    matchesRemix:
                      beyondMineObjectHiddenHash === remixMineObjectHiddenHash,
                  },
                  canvasHidden: {
                    beyondHash: beyondCanvasHiddenHash,
                    remixHash: remixCanvasHiddenHash,
                    matchesRemix:
                      beyondCanvasHiddenHash === remixCanvasHiddenHash,
                  },
                  canvasVisibilityHidden: {
                    beyondHash: beyondCanvasInvisibleHash,
                    remixHash: remixCanvasInvisibleHash,
                    matchesRemix:
                      beyondCanvasInvisibleHash === remixCanvasInvisibleHash,
                  },
                  canvasScopeClassRemoved: {
                    hash: scopeClassHash,
                    matchesRemix: scopeClassHash === remixHash,
                    computedStyle: scopeClassProbe.computed,
                  },
                  cacheCanvas: {
                    beyond: beyondPaint.cacheCanvas,
                    remix: remixPaint.cacheCanvas,
                  },
                  referenceCachePlacement: {
                    hash: cachePlacementHash,
                    matchesRemix: cachePlacementHash === remixHash,
                    placement: cachePlacementProbe.placement,
                  },
                  canvasOpacityZero: {
                    beyondHash: beyondOpacityZeroHash,
                    remixHash: remixOpacityZeroHash,
                    matches: beyondOpacityZeroHash === remixOpacityZeroHash,
                    beyondComputedOpacity: beyondOpacityZero.computedOpacity,
                    remixComputedOpacity: remixOpacityZero.computedOpacity,
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
