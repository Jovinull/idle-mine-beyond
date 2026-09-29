import { expect, test } from "@playwright/test";

test("bundles the pinned formatter boundary in a browser", async ({ page }) => {
  await page.goto("/__test__/formatting");

  const result = page.locator("#result");
  await expect(result).toHaveAttribute("data-ready", "true");
  await expect(result).toHaveText(
    JSON.stringify({
      names: [
        "Standard",
        "Scientific",
        "Engineering",
        "Letters",
        "Logarithm",
        "Cancer",
      ],
      grouped: "1,000",
      percent: "0.50%",
    }),
  );
});
