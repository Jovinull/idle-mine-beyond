import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const workspaceRoot = searchForWorkspaceRoot(
  fileURLToPath(new URL("../..", import.meta.url)),
);

function formattingBrowserHarness(): Plugin {
  const smokeModule = fileURLToPath(
    new URL("./tests/formatting-smoke.ts", import.meta.url),
  ).replaceAll("\\", "/");

  return {
    name: "formatting-browser-test-harness",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== "/__test__/formatting") {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          `<!doctype html><html><body><pre id="result" data-ready="false">Loading</pre><script type="module" src="/@fs/${smokeModule}"></script></body></html>`,
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [formattingBrowserHarness(), sveltekit()],
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
