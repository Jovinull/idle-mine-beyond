import { expect, test } from "@playwright/test";

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
