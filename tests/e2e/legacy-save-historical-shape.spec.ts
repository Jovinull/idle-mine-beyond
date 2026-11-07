import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { encodeRemixLegacySave } from "../../packages/persistence/src/remix-save-codec.js";

test("imports a minimized historical-shaped save through Settings", async ({
  page,
}) => {
  const fixture = JSON.parse(
    await readFile(
      new URL(
        "../fixtures/parity/remix-historical-save-shape.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as {
    input: Record<string, unknown> & {
      money: string;
      highestMoney: string;
      gems: string;
      mineObjectLevel: number;
      highestMineObjectLevel: number;
      pickaxe: { name: string; pow: string; quality: string };
    };
  };

  await page.addInitScript(() => {
    localStorage.clear();
    Date.now = () => 1_704_067_200_000;
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-app-state", "ready");
  await page.locator("[data-game-tab='settings']").click();

  const encoded = encodeRemixLegacySave(fixture.input);
  const settings = page.locator("article.settings");
  await settings.locator("[data-settings-save-field]").fill(encoded);
  await settings
    .getByRole("button", { name: "Import (from Text Field)" })
    .click();

  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("IdleMineBeyond")))
    .not.toBeNull();
  const imported = await page.evaluate(() => {
    const value = localStorage.getItem("IdleMineBeyond");
    if (!value) throw new Error("Imported Beyond save was not persisted.");
    return JSON.parse(value) as {
      state: {
        simulation: {
          mineObjectLevel: number;
          highestMineObjectLevel: number;
          resources: {
            money: string;
            highestMoney: string;
            gems: string;
            planetCoins: string;
            wisdom: string;
          };
          pickaxe: { name: string; power: string; quality: string };
        };
      };
    };
  });

  expect(imported.state.simulation).toMatchObject({
    mineObjectLevel: fixture.input.mineObjectLevel,
    highestMineObjectLevel: fixture.input.highestMineObjectLevel,
    resources: {
      money: fixture.input.money,
      highestMoney: fixture.input.highestMoney,
      gems: fixture.input.gems,
      planetCoins: "0",
      wisdom: "0",
    },
    pickaxe: {
      name: fixture.input.pickaxe.name,
      power: fixture.input.pickaxe.pow,
      quality: fixture.input.pickaxe.quality,
    },
  });
  expect(
    await page.evaluate(() => localStorage.getItem("IdleMine")),
  ).toBeNull();
});
