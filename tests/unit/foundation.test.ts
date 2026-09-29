import { expect, it } from "vitest";
import { implementationStatus } from "../../packages/core/src/index.js";

it("keeps gameplay implementation explicitly unstarted in the foundation scaffold", () => {
  expect(implementationStatus).toBe("not-started");
});
