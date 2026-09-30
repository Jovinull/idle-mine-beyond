import adapter from "@sveltejs/adapter-static";
import rootConfig from "../../svelte.config.js";

// The project site (apps/site) mounts the game under a sub-path. Both
// variables are opt-in; without them the build is the standalone game.
const base = process.env.BEYOND_GAME_BASE_PATH ?? "";
const pages = process.env.BEYOND_GAME_BUILD_DIR ?? "build";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  ...rootConfig,
  kit: {
    ...rootConfig.kit,
    adapter: adapter({ pages, assets: pages, fallback: "index.html" }),
    paths: { base },
  },
};

export default config;
