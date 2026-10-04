import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// The minutes-long live Remix differentials tagged @slow. They are kept out of
// `pnpm test:e2e` (and CI) so the default suite stays short.
export default defineConfig({
  ...base,
  grep: /@slow/,
  grepInvert: undefined,
});
