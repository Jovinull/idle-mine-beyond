import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("serves the foundation shell without implying gameplay exists", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Foundation scaffold" }),
  ).toBeVisible();
  await expect(
    page.getByText("Phase 0 — Foundation / reference archaeology"),
  ).toBeVisible();
  await expect(
    page.getByText("Gameplay implementation has not started."),
  ).toBeVisible();
});

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
        "ALL",
        "Blind",
        "Brackets",
        "Clock",
        "Dots",
        "Hex",
        "Imperial",
        "Infinity",
        "Mixed engineering",
        "Mixed scientific",
        "Prime",
        "Roman",
        "Shi",
        "Zalgo",
        "Binary",
        "Chinese",
        "Coronavirus",
        "Elemental",
        "Evil",
        "Flags",
        "Greek Letters",
        "Haha Funny",
        "Hexadecimal",
        "Japanese",
        "Mixed Logarithm (Sci)",
        "Nice",
        "Omega",
        "Omega (Short)",
        "Precise Prime",
        "Tritetrated",
        "YesNo",
      ],
      grouped: "1,000",
      percent: "0.50%",
    }),
  );
});
