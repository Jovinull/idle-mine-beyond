import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // Every page is prerendered; 404.html is the client-rendered fallback
    // that static hosts serve for unknown paths.
    adapter: adapter({ fallback: "404.html", strict: true }),
    // Root-absolute URLs everywhere: the search index and the 404 fallback
    // are read from arbitrary paths, where relative links would break.
    paths: { relative: false },
    alias: {
      // The game's own renderer and Story template, imported read-only.
      $game: "../web/src/lib",
    },
    prerender: {
      // /play/ is the separately built game, added next to the site output.
      handleHttpError: ({ path, message }) => {
        if (path === "/play/" || path.startsWith("/play/")) return;
        throw new Error(message);
      },
      handleMissingId: "fail",
      handleUnseenRoutes: "fail",
    },
    csp: {
      mode: "hash",
      directives: {
        "default-src": ["self"],
        "script-src": ["self"],
        "style-src": ["self", "unsafe-inline"],
        "img-src": ["self", "data:", "blob:"],
        "font-src": ["self"],
        "connect-src": ["self"],
        "object-src": ["none"],
        "base-uri": ["self"],
        "form-action": ["self"],
      },
    },
  },
};

export default config;
