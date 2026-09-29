import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, searchForWorkspaceRoot, type Plugin } from "vite";
import { fileURLToPath } from "node:url";

const workspaceRoot = searchForWorkspaceRoot(
  fileURLToPath(new URL("../..", import.meta.url)),
);

function compatibilityBrowserHarness(): Plugin {
  const smokeModule = fileURLToPath(
    new URL("./tests/formatting-smoke.ts", import.meta.url),
  ).replaceAll("\\", "/");
  const mineObjectModule = fileURLToPath(
    new URL("./tests/mine-objects-smoke.ts", import.meta.url),
  ).replaceAll("\\", "/");
  const miningRatesModule = fileURLToPath(
    new URL("./tests/mining-rates-smoke.ts", import.meta.url),
  ).replaceAll("\\", "/");
  const upgradesModule = fileURLToPath(
    new URL("./tests/upgrades-smoke.ts", import.meta.url),
  ).replaceAll("\\", "/");
  const harnessModules = new Map([
    ["/__test__/formatting", smokeModule],
    ["/__test__/mine-objects", mineObjectModule],
    ["/__test__/mining-rates", miningRatesModule],
    ["/__test__/upgrades", upgradesModule],
  ]);

  return {
    name: "compatibility-browser-test-harness",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const modulePath = harnessModules.get(request.url?.split("?")[0] ?? "");
        if (!modulePath) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(
          `<!doctype html><html><body><pre id="result" data-ready="false">Loading</pre><script type="module" src="/@fs/${modulePath}"></script></body></html>`,
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [compatibilityBrowserHarness(), sveltekit()],
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
