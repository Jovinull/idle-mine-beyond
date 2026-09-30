import { expect, test, type Page } from "@playwright/test";

// Visits every page linked from the site and checks that it loads cleanly:
// status 200, a title and one h1, no console errors or failed requests, and
// every mine-object canvas drawn by the game's renderer.

async function collectLinks(page: Page): Promise<string[]> {
  return page.$$eval("a[href]", (anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/") && !href.startsWith("//")),
  );
}

function isPage(href: string): boolean {
  const path = href.split(/[?#]/)[0] ?? "";
  return (
    path.endsWith("/") &&
    !path.startsWith("/play/") &&
    !path.startsWith("/Images/") &&
    !path.startsWith("/fonts/") &&
    !path.startsWith("/licenses/")
  );
}

test("every page loads without errors and draws its objects", async ({
  page,
}) => {
  test.setTimeout(600_000);
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      problems.push(`${page.url()}: console ${message.text()}`);
    }
  });
  page.on("pageerror", (error) =>
    problems.push(`${page.url()}: ${error.message}`),
  );
  page.on("requestfailed", (request) =>
    problems.push(`${page.url()}: failed ${request.url()}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) {
      problems.push(`${page.url()}: ${response.status()} ${response.url()}`);
    }
  });

  const queue = ["/"];
  const seen = new Set(queue);
  const assets = new Set<string>();
  while (queue.length > 0) {
    const path = queue.shift()!;
    const response = await page.goto(path, { waitUntil: "networkidle" });
    expect(response?.status(), path).toBe(200);
    await expect(page, path).toHaveTitle(/Idle Mine Beyond/);
    await expect(page.locator("h1"), path).toHaveCount(1);

    const canvases = page.locator("canvas[data-level]");
    const count = await canvases.count();
    for (let index = 0; index < count; index += 1) {
      await expect(
        canvases.nth(index),
        `${path} canvas ${index}`,
      ).not.toHaveAttribute("data-state", /loading|error/);
    }

    for (const href of await collectLinks(page)) {
      const clean = href.split("#")[0]!;
      if (isPage(clean) && !seen.has(clean)) {
        seen.add(clean);
        queue.push(clean);
      } else if (!isPage(clean)) {
        assets.add(clean);
      }
    }
  }

  for (const asset of assets) {
    const response = await page.request.get(asset);
    expect(response.status(), asset).toBe(200);
  }

  expect(seen.size).toBeGreaterThan(170);
  expect(problems).toEqual([]);
});

test("unknown pages return the 404 page", async ({ page }) => {
  const response = await page.goto("/wiki/objects/9999/");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Nothing to mine here.");
});

test("the sitemap lists the pages and robots.txt points to it", async ({
  request,
}) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/wiki/objects/215/</loc>");
  expect(sitemap).toContain("/play/</loc>");
  expect(sitemap.match(/<url>/g)?.length ?? 0).toBeGreaterThan(170);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});
