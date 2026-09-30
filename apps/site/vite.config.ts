import { sveltekit } from "@sveltejs/kit/vite";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";

const workspaceRoot = searchForWorkspaceRoot(
  fileURLToPath(new URL("../..", import.meta.url)),
);
const gameStatic = fileURLToPath(new URL("../web/static", import.meta.url));
const sharedDirectories = ["Images", "fonts", "licenses"];

const contentTypes: Record<string, string> = {
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/**
 * Serves the game's static files (images, fonts, licenses) from the site root
 * in development and emits them into the client build. The game requests them
 * from `/Images/...` and `/fonts/...`, and the wiki draws with the same atlas.
 */
function sharedGameStatic(): Plugin {
  return {
    name: "shared-game-static",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = decodeURIComponent(
          (request.url ?? "/").split("?")[0] ?? "/",
        );
        const top = pathname.split("/")[1] ?? "";
        if (!sharedDirectories.includes(top)) return next();
        const file = path.resolve(gameStatic, `.${pathname}`);
        if (!file.startsWith(gameStatic)) return next();
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) return next();
        response.setHeader(
          "Content-Type",
          contentTypes[path.extname(file)] ?? "application/octet-stream",
        );
        response.end(await readFile(file));
      });
    },
    async generateBundle() {
      if (this.environment.config.consumer !== "client") return;
      for (const directory of sharedDirectories) {
        for (const file of await listFiles(path.join(gameStatic, directory))) {
          this.emitFile({
            type: "asset",
            fileName: path.relative(gameStatic, file).split(path.sep).join("/"),
            source: await readFile(file),
          });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [sharedGameStatic(), sveltekit()],
  server: { fs: { allow: [workspaceRoot] } },
  resolve: {
    alias: {
      "break_infinity.js/break_infinity": fileURLToPath(
        new URL(
          "../../packages/formatting/src/ad-notations-decimal-bridge.ts",
          import.meta.url,
        ),
      ),
    },
  },
});
