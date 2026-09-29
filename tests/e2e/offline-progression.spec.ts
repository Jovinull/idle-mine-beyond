import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("matches captured Remix offline loading behavior in Chromium", async ({
  page,
}) => {
  await page.goto("/__test__/offline-progression");
  await expect(page.locator("#result")).toHaveAttribute("data-ready", "true");

  const corpus = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-reference-corpus.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    data: {
      offlineProgressionSemantics: {
        scenarios: {
          name: string;
          input: {
            elapsedSeconds: number;
            omitLastActive?: boolean;
            noOffline: boolean;
            upgrades: { offlineTime: number };
            nowMs: number;
          };
          clockReadCount: number;
          dateNowReads: number[];
          stateAfterLoad: unknown;
          events: unknown[];
          storageWrites: unknown[];
        }[];
      };
    };
  };
  const semantics = corpus.data.offlineProgressionSemantics;
  const observed = await page.evaluate((input) => {
    const probe = (
      window as Window & {
        __idleMineOfflineProbe?: (value: typeof input) => unknown;
      }
    ).__idleMineOfflineProbe;
    if (!probe)
      throw new Error("Offline progression probe did not initialize.");
    return probe(input);
  }, semantics);

  expect(observed).toEqual(
    semantics.scenarios.map((scenario) => {
      const lastActiveMs = scenario.input.omitLastActive
        ? scenario.dateNowReads[0]!
        : scenario.input.nowMs - scenario.input.elapsedSeconds * 1000;
      const elapsedSeconds = (scenario.dateNowReads[1]! - lastActiveMs) / 1000;
      const applied = elapsedSeconds > 300 && !scenario.input.noOffline;
      const processedSeconds = applied
        ? Math.min(
            3600 * (6 + scenario.input.upgrades.offlineTime),
            elapsedSeconds,
          )
        : 0;

      return {
        name: scenario.name,
        elapsedSeconds,
        processedSeconds,
        applied,
        clockReadCount: scenario.clockReadCount,
        dateNowReads: scenario.dateNowReads,
        stateAfterLoad: scenario.stateAfterLoad,
        events: scenario.events,
        storageWrites: scenario.storageWrites,
      };
    }),
  );
});
