import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";
import { routePinnedRemixOracle } from "./remix-oracle-route.js";

type MineObjectRenderReference = {
  data: {
    objects: { id: number; skin: number; colors: string[] }[];
    saveApplicationSemantics: { inputJson: string };
  };
};

type RuntimeFixture = {
  source: { commit: string };
  allUnlocked: {
    visibleBlocks: {
      mineObjectPreviews: {
        level: number;
        className: string;
        width: number;
        height: number;
        pixelSha256: string;
      }[];
    }[];
  }[];
};

type CanvasManifest = {
  source: { commit: string };
  previews: {
    level: number;
    width: number;
    height: number;
    pixelSha256: string;
    rgbaSha256: string;
    compressedSha256: string;
    file: string;
  }[];
};

test("renders Story mine-object previews against pinned Remix Canvas goldens", async ({
  page,
}) => {
  await page.goto("/__test__/mine-object-renderer");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const fixture = JSON.parse(
    await readFile(
      new URL("../fixtures/parity/remix-story-runtime.json", import.meta.url),
      "utf8",
    ),
  ) as RuntimeFixture;
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/visual/remix-story-mine-objects/manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as CanvasManifest;
  expect(manifest.source.commit).toBe(fixture.source.commit);

  const references = await Promise.all(
    manifest.previews.map(async (preview) => {
      const compressed = await readFile(
        new URL(
          `../fixtures/visual/remix-story-mine-objects/${preview.file}`,
          import.meta.url,
        ),
      );
      const rgba = gunzipSync(compressed);
      const sha256 = (value: Uint8Array) =>
        createHash("sha256").update(value).digest("hex");
      expect(sha256(compressed)).toBe(preview.compressedSha256);
      expect(sha256(rgba)).toBe(preview.rgbaSha256);
      expect(preview.rgbaSha256).toBe(preview.pixelSha256);
      return { ...preview, rgbaBase64: rgba.toString("base64") };
    }),
  );
  const referenceByLevel = new Map(
    references.map((preview) => [preview.level, preview]),
  );
  const expected = fixture.allUnlocked.flatMap((storyPage) =>
    storyPage.visibleBlocks.flatMap((block) => block.mineObjectPreviews),
  );
  const probeInputs = expected.map((preview) => {
    const reference = referenceByLevel.get(preview.level);
    if (!reference)
      throw new Error(
        `Story Canvas baseline is missing level ${preview.level}.`,
      );
    return reference;
  });
  const observed = await page.evaluate(async (inputs) => {
    const probe = (
      window as Window & {
        __idleMineObjectRendererProbe?: (
          values: typeof inputs,
        ) => Promise<unknown>;
      }
    ).__idleMineObjectRendererProbe;
    if (!probe)
      throw new Error("Mine-object renderer probe did not initialize.");
    return probe(inputs);
  }, probeInputs);
  const previews = observed as {
    level: number;
    className: string;
    width: number;
    height: number;
    pixelSha256: string;
    referencePixelSha256: string;
  }[];
  expect(previews).toHaveLength(expected.length);

  for (const [index, preview] of previews.entries()) {
    const source = expected[index]!;
    const golden = referenceByLevel.get(source.level)!;
    expect(preview).toMatchObject({
      level: source.level,
      className: source.className,
      width: source.width,
      height: source.height,
      referencePixelSha256: source.pixelSha256,
    });

    expect(
      preview.pixelSha256,
      `Level ${source.level} must match the pinned RGBA pixels in ${golden.file}.`,
    ).toBe(source.pixelSha256);
  }
});

test("matches Canvas pixels for every captured object in the pinned source corpus", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const reference = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as MineObjectRenderReference;
  const levels = reference.data.objects.map(({ id }) => id);
  expect(levels).toHaveLength(920);
  expect(new Set(levels).size).toBe(levels.length);
  expect(levels).toEqual([...levels].sort((left, right) => left - right));
  expect(levels).toContain(Number.MAX_SAFE_INTEGER);
  expect(new Set(reference.data.objects.map(({ skin }) => skin)).size).toBe(36);
  const visibleSkinLayers = new Set<string>();
  const visibleColors = new Set<string>();
  for (const object of reference.data.objects) {
    for (const [layer, color] of object.colors.entries()) {
      if (color === "transparent") continue;
      visibleSkinLayers.add(`${object.skin}:${layer}`);
      visibleColors.add(color);
    }
  }
  expect(visibleSkinLayers.size).toBe(92);
  expect(visibleColors.size).toBe(2511);

  const save = JSON.parse(
    reference.data.saveApplicationSemantics.inputJson,
  ) as {
    highestMineObjectLevel: number;
    lastActive: number;
    mineObjectLevel: number;
    settings: { showMineObjLevel: boolean; tab?: string; theme: string };
  };
  save.highestMineObjectLevel = levels.at(-1)!;
  save.lastActive = 1_700_000_000_000;
  save.mineObjectLevel = 0;
  save.settings.showMineObjLevel = true;
  save.settings.tab = "main";
  save.settings.theme = "light";
  const encodedSave = encodeRemixLegacySave(save);

  const sourceContext = await browser.newContext({
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 900 },
  });
  const sourcePage = await sourceContext.newPage();
  const initializePage = (encoded: string) => {
    localStorage.clear();
    localStorage.setItem("IdleMine", encoded);
    Date.now = () => 1_700_000_000_000;
  };

  try {
    const sourceUrl = await routePinnedRemixOracle(sourceContext);
    await sourcePage.addInitScript(initializePage, encodedSave);
    const [beyondReady] = await Promise.all([
      page.goto("/__test__/mine-object-renderer"),
      sourcePage.goto(sourceUrl),
    ]);
    expect(beyondReady?.ok()).toBe(true);
    await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");
    await sourcePage.waitForFunction(() => {
      const source = window as Window & {
        game?: unknown;
        imgLoaded?: boolean;
      };
      return Boolean(
        source.game &&
        source.imgLoaded &&
        document.querySelector("article.main .mineobject canvas"),
      );
    });

    const digestPng = (base64: string) =>
      createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
    const batchSize = 16;
    for (let offset = 0; offset < levels.length; offset += batchSize) {
      const batch = levels.slice(offset, offset + batchSize);
      const sourcePngs = await sourcePage.evaluate(async (objectLevels) => {
        const source = window as Window & {
          app?: { $nextTick: (callback: () => void) => void };
          game?: { mineObjectLevel: number };
        };
        if (!source.app || !source.game) {
          throw new Error("Pinned Remix game globals did not initialize.");
        }
        const canvas = document.querySelector<HTMLCanvasElement>(
          "article.main .mineobject canvas",
        );
        if (!canvas) throw new Error("Pinned Remix mine canvas is missing.");
        const nextTick = () =>
          new Promise<void>((resolve) => source.app!.$nextTick(resolve));
        const rendered: { level: number; pngBase64: string }[] = [];
        for (const level of objectLevels) {
          source.game.mineObjectLevel = level;
          await nextTick();
          rendered.push({
            level,
            pngBase64: canvas.toDataURL("image/png").split(",")[1] ?? "",
          });
        }
        return rendered;
      }, batch);
      const beyondPngs = await page.evaluate(async (objectLevels) => {
        const probe = (
          window as Window & {
            __idleMineObjectPngProbe?: (
              ids: number[],
            ) => Promise<{ level: number; pngBase64: string }[]>;
          }
        ).__idleMineObjectPngProbe;
        if (!probe)
          throw new Error("Mine-object PNG probe did not initialize.");
        return probe(objectLevels);
      }, batch);

      expect(beyondPngs.map(({ level }) => level)).toEqual(batch);
      expect(
        beyondPngs.map(({ pngBase64 }) => digestPng(pngBase64)),
        `Beyond Canvas output must match pinned Remix for IDs ${batch[0]}-${batch.at(-1)}.`,
      ).toEqual(sourcePngs.map(({ pngBase64 }) => digestPng(pngBase64)));
    }
  } finally {
    await sourceContext.close().catch(() => undefined);
  }
});
