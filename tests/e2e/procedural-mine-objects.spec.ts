import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createFreshBeyondVisualSave } from "./visual-state.js";

type ReferenceMineObject = {
  readonly id: number;
  readonly name: string;
  readonly drops: Record<string, { readonly chance: number }>;
};
type ReferenceCorpus = {
  readonly metadata: { readonly sourceCommit: string };
  readonly data: { readonly objects: readonly ReferenceMineObject[] };
};

const fixedClock = 1_704_067_200_000;
const sourceCorpusUrl = new URL(
  "../fixtures/parity/remix-reference-corpus.json",
  import.meta.url,
);

// Covers the three source generation regions and the first sparse high-ID probe.
for (const objectId of [80, 150, 600, 769]) {
  test(`loads and renders pinned procedural mine object ${objectId}`, async ({
    page,
  }) => {
    const [serializedFreshSave, corpusText] = await Promise.all([
      createFreshBeyondVisualSave({
        clockMs: fixedClock,
        theme: "light",
        tab: "main",
      }),
      readFile(sourceCorpusUrl, "utf8"),
    ]);
    const corpus = JSON.parse(corpusText) as ReferenceCorpus;
    expect(corpus.metadata.sourceCommit).toBe(
      "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
    );
    const reference = corpus.data.objects.find(({ id }) => id === objectId);
    if (!reference) {
      throw new Error(`Pinned mine-object fixture is missing ID ${objectId}.`);
    }

    const beyondSave = JSON.parse(serializedFreshSave) as {
      state: {
        simulation: {
          mineObjectLevel: number;
          highestMineObjectLevel: number;
        };
        settings: { showMineObjLevel: boolean };
      };
    };
    beyondSave.state.simulation.mineObjectLevel = objectId;
    beyondSave.state.simulation.highestMineObjectLevel = objectId;
    beyondSave.state.settings.showMineObjLevel = true;

    await page.addInitScript(
      ({ now, serializedSave }) => {
        localStorage.clear();
        localStorage.setItem("IdleMineBeyond", serializedSave);
        Object.defineProperty(Date, "now", {
          configurable: true,
          value: () => now,
        });
      },
      { now: fixedClock, serializedSave: JSON.stringify(beyondSave) },
    );
    await page.goto("/");
    await expect(page.locator("#app")).toHaveAttribute(
      "data-app-state",
      "ready",
    );

    await expect(page.locator("[data-mine-object-level]")).toHaveText(
      `#${objectId + 1}`,
    );
    await expect(page.locator(".mineobject h2")).toHaveText(reference.name);
    const details = page.locator(".mineobject > div > p");
    await expect(page.locator("[data-mine-object-hp]")).toContainText("HP:");
    await expect(details.nth(1)).toContainText("D:");
    await expect(details.nth(2)).toContainText("$");
    await expect(details.nth(0)).not.toHaveText("HP:");
    await expect(details.nth(1)).not.toHaveText("D:");
    await expect(details.nth(2)).not.toHaveText("$");

    const dropEntries = Object.entries(reference.drops);
    const dropLabel = page.locator(".mine-drop");
    await expect(dropLabel).toHaveCount(dropEntries.length);
    if (dropEntries.length === 1) {
      const [dropName] = dropEntries[0]!;
      await expect(dropLabel.locator("img.inline")).toHaveAttribute(
        "alt",
        dropName === "wisdom" ? "Wisdom" : "Planet Coins",
      );
    }

    const canvas = page.locator("canvas.mine-object");
    await expect(canvas).toHaveAttribute("data-rendered", "true");
    await expect(canvas).toHaveAttribute("data-level", String(objectId));
    await expect(canvas).toHaveAttribute("data-damageable", "false");
    const visiblePixelCount = await canvas.evaluate((element) => {
      const context = (element as HTMLCanvasElement).getContext("2d");
      if (!context) throw new Error("Mine-object Canvas has no 2D context.");
      const { data } = context.getImageData(
        0,
        0,
        (element as HTMLCanvasElement).width,
        (element as HTMLCanvasElement).height,
      );
      let count = 0;
      for (let alpha = 3; alpha < data.length; alpha += 4) {
        if (data[alpha] !== 0) count += 1;
      }
      return count;
    });
    expect(visiblePixelCount).toBeGreaterThan(0);
  });
}
