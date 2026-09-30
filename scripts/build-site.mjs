import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Builds the deployable project site into apps/site/build: the prerendered
// site and wiki, plus the game built under /play/. Set VITE_SITE_URL to the
// public origin (default: https://idle-mine-beyond.pages.dev).

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const siteBuild = path.join(root, "apps/site/build");
const siteUrl = (
  process.env.VITE_SITE_URL ?? "https://idle-mine-beyond.pages.dev"
).replace(/\/+$/, "");

function run(command, env = {}) {
  const result = spawnSync(command, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    throw new Error(`"${command}" failed with exit code ${result.status}.`);
  }
}

const gameBuild = await mkdtemp(path.join(os.tmpdir(), "imb-game-"));
try {
  run("pnpm --dir apps/web build", {
    BEYOND_GAME_BASE_PATH: "/play",
    BEYOND_GAME_BUILD_DIR: gameBuild,
  });
  run("pnpm --dir apps/site build", { VITE_SITE_URL: siteUrl });
  await cp(gameBuild, path.join(siteBuild, "play"), { recursive: true });
} finally {
  await rm(gameBuild, { recursive: true, force: true });
}

// Sitemap and robots.txt from the prerendered pages.
const entries = await readdir(siteBuild, { recursive: true });
const pages = entries
  .map((entry) => entry.split(path.sep).join("/"))
  .filter((entry) => entry.endsWith("index.html"))
  .map((entry) => `/${entry.replace(/index\.html$/, "")}`)
  .filter((page) => !page.startsWith("/play/"))
  .sort();
const urls = [...pages, "/play/"]
  .map((page) => `  <url><loc>${siteUrl}${page}</loc></url>`)
  .join("\n");
await writeFile(
  path.join(siteBuild, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
await writeFile(
  path.join(siteBuild, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
);

process.stdout.write(
  `Site ready in apps/site/build: ${pages.length} pages plus the game at /play/ (${siteUrl}).\n`,
);
