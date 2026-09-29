import { expect, it } from "vitest";
import { Decimal } from "../../packages/core/src/index.js";

it("exposes the pinned Decimal compatibility boundary without implying gameplay exists", () => {
  expect(new Decimal(42).toString()).toBe("42");
});
