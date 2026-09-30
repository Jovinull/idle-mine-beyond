import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { format } from "prettier";
import { getChromiumLaunchOptions } from "./playwright-browser.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const dependenciesPath = path.join(
  root,
  "docs/knowledge/sources/runtime-dependencies.json",
);
const markupPath = path.join(
  root,
  "tests/fixtures/parity/remix-story-markup.json",
);
const fixturePath = path.join(
  root,
  "tests/fixtures/parity/remix-story-runtime.json",
);
const visualGoldenDirectory = path.join(
  root,
  "tests/fixtures/visual/remix-story-mine-objects",
);
const visualGoldenManifestPath = path.join(
  visualGoldenDirectory,
  "manifest.json",
);
const outputDirectory = path.join(root, ".research/outputs/story-runtime");
const fixedClock = 1_704_067_200_000;
const randomSeed = 0x1d1e;
const viewport = { width: 1440, height: 900 };

function sha256(contents) {
  return createHash("sha256").update(contents).digest("hex");
}

function describeValue(value) {
  const json = JSON.stringify(value);
  return json && json.length > 160 ? `${json.slice(0, 160)}…` : json;
}

function findFirstDifference(actual, expected, location = "$") {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return undefined;
  if (
    typeof actual !== "object" ||
    typeof expected !== "object" ||
    actual === null ||
    expected === null
  ) {
    return `${location}: expected ${describeValue(expected)}, captured ${describeValue(actual)}`;
  }
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of keys) {
    const difference = findFirstDifference(
      actual[key],
      expected[key],
      `${location}.${key}`,
    );
    if (difference) return difference;
  }
  return `${location}: key order differs`;
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[extension] ?? "application/octet-stream"
  );
}

async function verifySource(reference) {
  const checkout = path.resolve(root, reference.researchCheckout);
  const revision = await execFileAsync("git", ["rev-parse", "HEAD"], {
    cwd: checkout,
    windowsHide: true,
  });
  const status = await execFileAsync(
    "git",
    ["status", "--porcelain", "--untracked-files=all"],
    { cwd: checkout, windowsHide: true },
  );
  if (
    revision.stdout.trim() !== reference.pinnedCommit ||
    status.stdout.trim()
  ) {
    throw new Error(
      `Canonical checkout must be clean at ${reference.pinnedCommit}; found ${revision.stdout.trim()}${status.stdout.trim() ? " and a dirty worktree" : ""}.`,
    );
  }
  return checkout;
}

async function loadDependencySnapshots(manifest) {
  const snapshots = new Map();
  for (const dependency of manifest.dependencies) {
    const contents = await readFile(
      path.resolve(root, dependency.researchSnapshot),
    );
    const actualHash = sha256(contents);
    if (actualHash !== dependency.sha256) {
      throw new Error(
        `${dependency.name} snapshot hash ${actualHash} does not match the recorded ${dependency.sha256}.`,
      );
    }
    snapshots.set(dependency.originalRequestUrl, contents);
  }
  return snapshots;
}

function startReadOnlyServer(sourceRoot) {
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let requestedPath;
    try {
      requestedPath = decodeURIComponent(
        new URL(request.url ?? "/", "http://reference.local").pathname,
      );
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (requestedPath.split("/").includes(".git")) {
      response.writeHead(403).end();
      return;
    }

    if (requestedPath === "/") requestedPath = "/index.html";
    const absolutePath = path.resolve(sourceRoot, `.${requestedPath}`);
    const relativePath = path.relative(sourceRoot, absolutePath);
    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const contents = await readFile(absolutePath);
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Length": contents.length,
        "Content-Type": mimeType(absolutePath),
        "X-Content-Type-Options": "nosniff",
      });
      response.end(request.method === "HEAD" ? undefined : contents);
    } catch {
      response.writeHead(404).end();
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("The reference server did not bind a TCP port."));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}/index.html` });
    });
  });
}

async function captureStory(
  reference,
  snapshots,
  markup,
  writeScreenshots,
  includePixelData = false,
) {
  const sourceRoot = await verifySource(reference);
  const { server, url } = await startReadOnlyServer(sourceRoot);
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...getChromiumLaunchOptions(),
    });
    const context = await browser.newContext({
      colorScheme: "light",
      locale: "en-US",
      timezoneId: "UTC",
      viewport,
    });
    await context.addInitScript(
      ({ clock, seed }) => {
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => clock,
        });
        let randomState = seed >>> 0;
        Math.random = () => {
          randomState =
            (Math.imul(randomState, 1_664_525) + 1_013_904_223) >>> 0;
          return randomState / 0x1_0000_0000;
        };
        window.requestAnimationFrame = () => 0;
      },
      { clock: fixedClock, seed: randomSeed },
    );

    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://cdn.jsdelivr.net/**", async (route) => {
      const contents = snapshots.get(route.request().url());
      if (!contents) {
        await route.abort("blockedbyclient");
        return;
      }
      await route.fulfill({
        body: contents,
        contentType: "application/javascript; charset=utf-8",
        status: 200,
      });
    });

    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(
      "Boolean(window.game && window.functions && window.app?.$el)",
    );
    await page.waitForFunction("window.imgLoaded === true");
    await page.evaluate(() => document.fonts.ready);
    if (pageErrors.length) {
      throw new Error(`Reference page errors: ${pageErrors.join("; ")}`);
    }

    const sourceCapture = await page.evaluate(
      async ({ sourceBlocks, requestedViewport, includePixelData }) => {
        const game = window.game;
        const functions = window.functions;
        const app = window.app;
        const Decimal = window.Decimal;
        const chapters = [...game.story.chapters];
        const nextTick = () => new Promise((resolve) => app.$nextTick(resolve));
        const readComputed = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return {
            properties: {
              alignItems: style.alignItems,
              backgroundColor: style.backgroundColor,
              border: style.border,
              borderBottom: style.borderBottom,
              borderTop: style.borderTop,
              boxSizing: style.boxSizing,
              color: style.color,
              display: style.display,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontStyle: style.fontStyle,
              height: style.height,
              left: style.left,
              margin: style.margin,
              marginLeft: style.marginLeft,
              outline: style.outline,
              overflowY: style.overflowY,
              overscrollBehaviorY: style.overscrollBehaviorY,
              padding: style.padding,
              paddingBottom: style.paddingBottom,
              paddingLeft: style.paddingLeft,
              paddingRight: style.paddingRight,
              paddingTop: style.paddingTop,
              position: style.position,
              right: style.right,
              textAlign: style.textAlign,
              top: style.top,
              bottom: style.bottom,
              transform: style.transform,
              width: style.width,
              zIndex: style.zIndex,
            },
            rect: {
              height: Math.round(rect.height * 100) / 100,
              width: Math.round(rect.width * 100) / 100,
              x: Math.round(rect.x * 100) / 100,
              y: Math.round(rect.y * 100) / 100,
            },
          };
        };
        const readRenderedState = async (name) => {
          const article = document.querySelector("article.story");
          if (!article) throw new Error("The Story article did not render.");
          const scroller = article.querySelector(".story-milestones");
          if (!scroller)
            throw new Error("The Story milestone scroller is missing.");
          const sourceVisibleBlocks = sourceBlocks.filter(
            (block) =>
              block.conditionalAncestors.length === 0 &&
              functions.storyDisplayed(block.key),
          );
          const renderedElements = [...scroller.children];
          if (renderedElements.length !== sourceVisibleBlocks.length) {
            throw new Error(
              `Rendered ${renderedElements.length} root Story blocks, expected ${sourceVisibleBlocks.length}.`,
            );
          }
          const objective = article.querySelector(".objective");
          const quotes = [...article.querySelectorAll(".story-quote span")];
          return {
            name,
            page: game.story.page,
            chapterHeading:
              article.querySelector(".chapter-control h3")?.innerText ?? null,
            nextObjective: functions.getNextStoryText(),
            objectiveText: objective?.innerText ?? null,
            objectiveHtml: objective?.innerHTML ?? null,
            visibleBlocks: await Promise.all(
              renderedElements.map(async (element, index) => {
                const sourceBlock = sourceVisibleBlocks[index];
                if (!sourceBlock) {
                  throw new Error("Story source block metadata is missing.");
                }
                const expectedLevels =
                  sourceBlock.embeddedMineObjectAttributes.map((attributes) => {
                    const match = attributes.match(/:level="(\d+)"/);
                    if (!match) {
                      throw new Error(
                        `Could not read mine-object preview level from ${attributes}.`,
                      );
                    }
                    return Number(match[1]);
                  });
                const canvases = [
                  ...element.querySelectorAll("canvas.mine-object"),
                ];
                if (canvases.length !== expectedLevels.length) {
                  throw new Error(
                    `Story block ${sourceBlock.key} rendered ${canvases.length} mine-object previews, expected ${expectedLevels.length}.`,
                  );
                }
                const mineObjectPreviews = await Promise.all(
                  canvases.map(async (canvas, previewIndex) => {
                    const context = canvas.getContext("2d", {
                      willReadFrequently: true,
                    });
                    if (!context) {
                      throw new Error("Mine-object canvas has no 2D context.");
                    }
                    const pixels = context.getImageData(
                      0,
                      0,
                      canvas.width,
                      canvas.height,
                    ).data;
                    const digest = await crypto.subtle.digest(
                      "SHA-256",
                      pixels,
                    );
                    const pixelSha256 = [...new Uint8Array(digest)]
                      .map((byte) => byte.toString(16).padStart(2, "0"))
                      .join("");
                    return {
                      level: expectedLevels[previewIndex],
                      className: canvas.className,
                      width: canvas.width,
                      height: canvas.height,
                      pixelSha256,
                      pixelRgbaBase64: (() => {
                        if (!includePixelData) return undefined;
                        const rgba = new Uint8Array(
                          pixels.buffer,
                          pixels.byteOffset,
                          pixels.byteLength,
                        );
                        let binary = "";
                        for (
                          let offset = 0;
                          offset < rgba.length;
                          offset += 8192
                        ) {
                          binary += String.fromCharCode(
                            ...rgba.subarray(offset, offset + 8192),
                          );
                        }
                        return btoa(binary);
                      })(),
                    };
                  }),
                );
                return {
                  sourceOrder: sourceBlock.sourceOrder,
                  key: sourceBlock.key,
                  occurrence: sourceBlock.occurrence,
                  innerText: element.innerText,
                  outerHtml: element.outerHTML,
                  imageSources: [...element.querySelectorAll("img")].map(
                    (image) => image.getAttribute("src"),
                  ),
                  mineObjectPreviews,
                };
              }),
            ),
            quoteText: quotes.map((quote) => quote.innerText),
            computed: {
              article: readComputed("article.story"),
              scroller: readComputed(".story-milestones"),
              objective: readComputed("article.story .objective"),
              milestone: readComputed(".story-milestones > div"),
              chapterControl: readComputed(".chapter-control"),
              chapterHeading: readComputed(".chapter-control h3"),
              chapterPreviousButton: readComputed(
                ".chapter-control button:first-of-type",
              ),
              chapterNextButton: readComputed(
                ".chapter-control button:last-of-type",
              ),
              chapterNextImage: readComputed(
                ".chapter-control button:last-of-type img",
              ),
              quote: readComputed(".story-quote"),
              quoteText: readComputed(".story-quote span"),
              mineObjectCanvas: readComputed(
                ".story-milestones canvas.mine-object",
              ),
            },
            viewport: requestedViewport,
          };
        };

        game.settings.tab = "story";
        game.story.page = 0;
        await nextTick();
        const freshGame = await readRenderedState("fresh-game-page-0");

        game.highestMineObjectLevel = 215;
        game.highestMoney = new Decimal("5e13");
        game.maxPlanetCoins = new Decimal("1");
        game.upgrades.blacksmith.level = 1;
        game.upgrades.gemWaster.level = 1;
        const wisdomUpgrades = Object.values(game.powers.upgrades);
        if (!wisdomUpgrades[0]) {
          throw new Error(
            "The reference game has no Wisdom upgrade for Story setup.",
          );
        }
        for (const upgrade of wisdomUpgrades) upgrade.level = 0;
        wisdomUpgrades[0].level = 1;

        const lockedKeys = Object.keys(game.story.milestones).filter(
          (key) => !functions.storyUnlocked(key),
        );
        if (lockedKeys.length) {
          throw new Error(
            `Story setup left milestones locked: ${lockedKeys.join(", ")}`,
          );
        }

        const allUnlocked = [];
        for (let page = 0; page < chapters.length; page++) {
          game.story.page = page;
          await nextTick();
          await new Promise((resolve) => setTimeout(resolve, 100));
          allUnlocked.push(
            await readRenderedState(`all-unlocked-page-${page}`),
          );
        }
        game.story.page = 0;
        await nextTick();
        const scrollContainer = document.querySelector(".story-milestones");
        if (!scrollContainer) {
          throw new Error("Story scroll container was not rendered.");
        }
        scrollContainer.scrollTop = 100;
        const beforeScrollTop = scrollContainer.scrollTop;
        functions.increaseStoryPage();
        await nextTick();
        const afterContainer = document.querySelector(".story-milestones");
        if (!afterContainer) {
          throw new Error(
            "Story scroll container disappeared after navigation.",
          );
        }
        const storyNavigationScroll = {
          pageAfterNavigation: game.story.page,
          beforeScrollTop,
          afterScrollTop: afterContainer.scrollTop,
          containerReused: afterContainer === scrollContainer,
        };
        return {
          chapters,
          freshGame,
          allUnlocked,
          storyNavigationScroll,
        };
      },
      {
        sourceBlocks: markup.blocks,
        requestedViewport: viewport,
        includePixelData,
      },
    );

    if (pageErrors.length) {
      throw new Error(`Reference page errors: ${pageErrors.join("; ")}`);
    }
    if (writeScreenshots) {
      await mkdir(outputDirectory, { recursive: true });
      for (const pageIndex of [8, 0]) {
        await page.evaluate(async (pageNumber) => {
          window.game.story.page = pageNumber;
          await new Promise((resolve) => window.app.$nextTick(resolve));
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        }, pageIndex);
        await page.waitForTimeout(40);
        await page.screenshot({
          path: path.join(
            outputDirectory,
            `all-unlocked-page-${pageIndex}.png`,
          ),
          fullPage: true,
        });
      }
      await page.evaluate(async () => {
        window.game.story.page = 8;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const lightPageEightScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller?.scrollTop ?? null;
      });
      if (lightPageEightScroll !== 249) {
        throw new Error(
          `Light Story page 8 screenshot requires 249px scroll; received ${lightPageEightScroll}.`,
        );
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-8-light-1440x900.png",
        ),
        fullPage: false,
      });
      await page.evaluate(() => window.functions.setTheme("dark"));
      await page.waitForTimeout(100);
      const themeProbe = await page.evaluate(() => ({
        href: document.querySelector("#css_theme")?.getAttribute("href"),
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        gameTheme: window.game.settings.theme,
      }));
      if (
        themeProbe.href !== "Themes/dark.css" ||
        themeProbe.bodyBackground !== "rgb(54, 54, 54)" ||
        themeProbe.gameTheme !== "dark"
      ) {
        throw new Error(
          `Remix dark theme failed to load for the Story screenshot: ${JSON.stringify(themeProbe)}.`,
        );
      }
      await page.evaluate(async () => {
        window.game.story.page = 0;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const storyScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller
          ? {
              page: window.game.story.page,
              tab: window.game.settings.tab,
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
              scrollTop: scroller.scrollTop,
            }
          : null;
      });
      if (storyScroll?.scrollTop !== 249) {
        throw new Error(
          `Dark Story screenshot requires 249px scroll; received ${JSON.stringify(storyScroll)}.`,
        );
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-0-dark-1440x900.png",
        ),
        fullPage: false,
      });
      await page.evaluate(async () => {
        window.game.story.page = 8;
        await new Promise((resolve) => window.app.$nextTick(resolve));
        const scroller = document.querySelector(".story-milestones");
        if (!scroller) throw new Error("Story scroller was not rendered.");
        scroller.scrollTop = 249;
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 0;
        }
      });
      const darkPageEightScroll = await page.evaluate(() => {
        const scroller = document.querySelector(".story-milestones");
        return scroller?.scrollTop ?? null;
      });
      if (darkPageEightScroll !== 249) {
        throw new Error(
          `Dark Story page 8 screenshot requires 249px scroll; received ${darkPageEightScroll}.`,
        );
      }
      await page.screenshot({
        path: path.join(
          outputDirectory,
          "story-all-unlocked-page-8-dark-1440x900.png",
        ),
        fullPage: false,
      });
      const visualCaptureMetrics = [];
      for (const theme of ["light", "dark"]) {
        await page.evaluate(async (selectedTheme) => {
          window.functions.setTheme(selectedTheme);
          await new Promise((resolve) => window.app.$nextTick(resolve));
        }, theme);
        await page.waitForTimeout(100);
        const themeState = await page.evaluate(() => ({
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          gameTheme: window.game.settings.theme,
        }));
        const expectedBackground =
          theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
        if (
          themeState.gameTheme !== theme ||
          themeState.bodyBackground !== expectedBackground
        ) {
          throw new Error(
            "Remix " +
              theme +
              " theme failed before Story screenshots: " +
              JSON.stringify(themeState),
          );
        }
        for (let pageIndex = 0; pageIndex < 9; pageIndex += 1) {
          const scrollState = await page.evaluate(async (pageNumber) => {
            window.game.story.page = pageNumber;
            await new Promise((resolve) => window.app.$nextTick(resolve));
            await new Promise((resolve) => setTimeout(resolve, 40));
            const scroller = document.querySelector(".story-milestones");
            if (!scroller) throw new Error("Story scroller was not rendered.");
            scroller.scrollTop = 249;
            for (const animation of document.getAnimations()) {
              animation.pause();
              animation.currentTime = 0;
            }
            return {
              page: window.game.story.page,
              scrollTop: scroller.scrollTop,
              clientHeight: scroller.clientHeight,
              scrollHeight: scroller.scrollHeight,
            };
          }, pageIndex);
          if (scrollState.page !== pageIndex) {
            throw new Error(
              "Story page selection failed: " + JSON.stringify(scrollState),
            );
          }
          await page.mouse.move(viewport.width - 1, viewport.height - 1);
          await page.waitForTimeout(40);
          const fileName =
            "story-all-unlocked-page-" +
            pageIndex +
            "-" +
            theme +
            "-1440x900.png";
          await page.screenshot({
            path: path.join(outputDirectory, fileName),
            fullPage: false,
          });
          visualCaptureMetrics.push({
            page: pageIndex,
            theme,
            scrollTop: scrollState.scrollTop,
            clientHeight: scrollState.clientHeight,
            scrollHeight: scrollState.scrollHeight,
            screenshot: fileName,
          });
        }
      }
      await writeFile(
        path.join(outputDirectory, "story-fullscreen-metrics.json"),
        JSON.stringify(visualCaptureMetrics, null, 2) + "\n",
        "utf8",
      );
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(
        "Boolean(window.game && window.functions && window.app?.$el)",
      );
      await page.waitForFunction("window.imgLoaded === true");
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ["light", "dark"]) {
        await page.evaluate((selectedTheme) => {
          window.game.settings.tab = "settings";
          window.game.story.notifications = 1;
          window.functions.setTheme(selectedTheme);
        }, theme);
        await page.waitForTimeout(100);
        const expectedBodyColor =
          theme === "dark" ? "rgb(54, 54, 54)" : "rgb(250, 250, 250)";
        const settingsTheme = await page.evaluate(() => ({
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          gameTheme: window.game.settings.theme,
          tab: window.game.settings.tab,
          storyNotifications: window.game.story.notifications,
        }));
        if (
          settingsTheme.bodyBackground !== expectedBodyColor ||
          settingsTheme.gameTheme !== theme ||
          settingsTheme.tab !== "settings" ||
          settingsTheme.storyNotifications !== 1
        ) {
          throw new Error(
            `Remix ${theme} Settings screenshot reached the wrong source state: ${JSON.stringify(settingsTheme)}.`,
          );
        }
        await page.evaluate(async () => {
          await new Promise((resolve) => window.app.$nextTick(resolve));
          for (const animation of document.getAnimations()) {
            animation.pause();
            animation.currentTime = 0;
          }
        });
        await page.mouse.move(viewport.width - 1, viewport.height - 1);
        await page.screenshot({
          path: path.join(
            outputDirectory,
            `settings-fresh-${theme}-1440x900.png`,
          ),
          fullPage: false,
        });
      }
    }
    return {
      source: {
        repository: reference.canonicalUrl,
        commit: reference.pinnedCommit,
        license: reference.licenseDetected,
        copyrightNotice: reference.copyrightNotice,
        sourcePaths: [
          "index.html",
          "main.css",
          "Themes/dark.css",
          "Scripts/main.js",
          "Scripts/Components/mine-object.js",
        ],
        captureMethod:
          "Read-only local server of the pinned clean checkout; Playwright Chromium; SHA-verified CDN snapshots.",
        browser: { name: "Chromium", version: browser.version() },
        playwrightVersion: JSON.parse(
          await readFile(path.join(root, "package.json"), "utf8"),
        ).devDependencies["@playwright/test"],
        colorScheme: "light",
        locale: "en-US",
        timezone: "UTC",
        randomSeed,
        scenarios: {
          freshGame:
            "New browser context without a saved game in localStorage.",
          allUnlocked: {
            highestMineObjectLevel: 215,
            highestMoney: "5e13",
            maxPlanetCoins: "1",
            moneyUpgradeLevels: { blacksmith: 1, gemWaster: 1 },
            wisdomUpgradeLevels: { firstUpgrade: 1, remaining: 0 },
          },
        },
        viewport,
      },
      ...sourceCapture,
    };
  } finally {
    await browser?.close();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function main() {
  const mode = process.argv[2];
  if (
    ![
      "--write",
      "--check",
      "--write-pixel-goldens",
      "--check-pixel-goldens",
    ].includes(mode)
  ) {
    throw new Error(
      "Use --check/--write for the Story runtime or --check-pixel-goldens/--write-pixel-goldens for source Canvas baselines.",
    );
  }
  const launchOptions = getChromiumLaunchOptions();
  if (
    mode.startsWith("--write") &&
    (launchOptions.executablePath || launchOptions.channel)
  ) {
    throw new Error(
      "Capture Story runtime evidence with Playwright's pinned Chromium, not an installed Chrome or PLAYWRIGHT_CHROMIUM_EXECUTABLE. Run `pnpm exec playwright install chromium` first.",
    );
  }
  const references = JSON.parse(await readFile(manifestPath, "utf8"));
  const dependencies = JSON.parse(await readFile(dependenciesPath, "utf8"));
  const markup = JSON.parse(await readFile(markupPath, "utf8"));
  const reference = references.references.find(
    ({ name }) => name === "Idle Mine: Remix",
  );
  if (!reference)
    throw new Error("Idle Mine: Remix is absent from the source manifest.");
  if (reference.pinnedCommit !== markup.source.commit) {
    throw new Error(
      "Story markup fixture and source manifest use different commits.",
    );
  }
  const snapshots = await loadDependencySnapshots(dependencies);
  const captured = await captureStory(
    reference,
    snapshots,
    markup,
    mode === "--write",
    mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens",
  );

  const expected = JSON.parse(await readFile(fixturePath, "utf8"));
  captured.source.capturedOn = expected.source.capturedOn;
  if (
    mode !== "--write" &&
    captured.source.browser.version !== expected.source.browser.version
  ) {
    throw new Error(
      `Story runtime was captured with Chromium ${expected.source.browser.version}, but this run used ${captured.source.browser.version}. Run \`pnpm exec playwright install chromium\` so checks use Playwright's pinned browser.`,
    );
  }
  const pixelBaselines = new Map();
  if (mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens") {
    for (const storyPage of captured.allUnlocked) {
      for (const block of storyPage.visibleBlocks) {
        for (const preview of block.mineObjectPreviews) {
          if (!preview.pixelRgbaBase64) continue;
          const rgba = Buffer.from(preview.pixelRgbaBase64, "base64");
          if (sha256(rgba) !== preview.pixelSha256) {
            throw new Error(
              `Raw Canvas pixels for level ${preview.level} do not match their captured SHA-256.`,
            );
          }
          const existing = pixelBaselines.get(preview.level);
          if (existing && sha256(existing.rgba) !== sha256(rgba)) {
            throw new Error(
              `Pinned Story canvas level ${preview.level} produced different PNGs on separate pages.`,
            );
          }
          pixelBaselines.set(preview.level, {
            width: preview.width,
            height: preview.height,
            pixelSha256: preview.pixelSha256,
            rgba,
          });
          delete preview.pixelRgbaBase64;
        }
      }
    }
  }
  if (mode === "--write") {
    captured.source.capturedOn =
      expected.source?.capturedOn ?? new Date().toISOString().slice(0, 10);
    await writeFile(
      fixturePath,
      await format(JSON.stringify(captured), { parser: "json" }),
      "utf8",
    );
    process.stdout.write(
      `Captured fresh Story state and ${captured.allUnlocked.length} unlocked pages from ${reference.pinnedCommit}. Screenshots are in ignored .research/outputs/story-runtime/.\n`,
    );
    return;
  }

  if (JSON.stringify(captured) !== JSON.stringify(expected)) {
    throw new Error(
      `Story runtime differs from tests/fixtures/parity/remix-story-runtime.json at ${findFirstDifference(captured, expected)}. Review the reference state before recapturing.`,
    );
  }
  if (mode === "--write-pixel-goldens" || mode === "--check-pixel-goldens") {
    const expectedPixels = new Map();
    for (const storyPage of expected.allUnlocked) {
      for (const block of storyPage.visibleBlocks) {
        for (const preview of block.mineObjectPreviews) {
          expectedPixels.set(preview.level, preview);
        }
      }
    }
    // gzip headers record the host OS, so checks reuse a saved baseline whose
    // decompressed pixels match instead of comparing freshly compressed bytes.
    for (const [level, image] of pixelBaselines) {
      image.compressed = gzipSync(image.rgba);
      if (mode !== "--check-pixel-goldens") continue;
      const saved = await readFile(
        path.join(visualGoldenDirectory, `level-${level}.rgba.gz`),
      ).catch(() => undefined);
      if (saved && gunzipSync(saved).equals(image.rgba)) {
        image.compressed = saved;
      }
    }
    const previews = [...pixelBaselines.entries()]
      .sort(([left], [right]) => left - right)
      .map(([level, image]) => {
        const runtime = expectedPixels.get(level);
        if (!runtime || runtime.pixelSha256 !== image.pixelSha256) {
          throw new Error(
            `Canvas baseline for level ${level} does not match the pinned Story runtime fixture.`,
          );
        }
        return {
          level,
          width: image.width,
          height: image.height,
          pixelSha256: image.pixelSha256,
          rgbaSha256: sha256(image.rgba),
          compressedSha256: sha256(image.compressed),
          file: `level-${level}.rgba.gz`,
        };
      });
    const visualManifest = {
      source: {
        repository: captured.source.repository,
        commit: captured.source.commit,
        capturedOn: captured.source.capturedOn,
        license: captured.source.license,
        copyrightNotice: captured.source.copyrightNotice,
        sourcePaths: captured.source.sourcePaths,
        captureMethod: captured.source.captureMethod,
        browser: captured.source.browser,
        playwrightVersion: captured.source.playwrightVersion,
      },
      viewport: captured.source.viewport,
      previews,
    };
    if (mode === "--write-pixel-goldens") {
      await mkdir(visualGoldenDirectory, { recursive: true });
      for (const preview of previews) {
        const image = pixelBaselines.get(preview.level);
        await writeFile(
          path.join(visualGoldenDirectory, preview.file),
          image.compressed,
        );
      }
      await writeFile(
        visualGoldenManifestPath,
        await format(JSON.stringify(visualManifest), { parser: "json" }),
        "utf8",
      );
    } else {
      const savedManifest = JSON.parse(
        await readFile(visualGoldenManifestPath, "utf8"),
      );
      if (JSON.stringify(visualManifest) !== JSON.stringify(savedManifest)) {
        throw new Error(
          "Pinned source Canvas baselines differ from tests/fixtures/visual/remix-story-mine-objects/manifest.json.",
        );
      }
      for (const preview of savedManifest.previews) {
        const image = await readFile(
          path.join(visualGoldenDirectory, preview.file),
        );
        if (sha256(image) !== preview.compressedSha256) {
          throw new Error(
            `Canvas PNG baseline ${preview.file} does not match its recorded SHA-256.`,
          );
        }
      }
    }
    process.stdout.write(
      `${mode === "--write-pixel-goldens" ? "Captured" : "Verified"} ${previews.length} Story mine-object Canvas goldens from ${reference.pinnedCommit}.\n`,
    );
    return;
  }
  process.stdout.write(
    `Verified fresh Story state and ${captured.allUnlocked.length} unlocked pages against ${reference.pinnedCommit}.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});
