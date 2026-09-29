import { readFile } from "node:fs/promises";
import fc from "fast-check";
import { expect, it } from "vitest";
import { RemixRandom } from "../../packages/core/src/index.js";

type RandomDraw =
  | { type: "double"; value: number }
  | { type: "integer-default"; value: number }
  | { type: "integer"; bound: number; value: number };

const fixture = JSON.parse(
  await readFile(
    new URL("../fixtures/parity/remix-reference-corpus.json", import.meta.url),
    "utf8",
  ),
) as {
  metadata: { sourceCommit: string };
  data: {
    randomSemantics: {
      seed: number;
      draws: RandomDraw[];
    }[];
    randomSequenceExhaustion: {
      seed: number;
      warmupDraws: number;
      sequenceLength: number;
      values: (number | string)[];
      firstNaNIndex: number;
    };
  };
};

function drawSequence(seed: number): RandomDraw[] {
  const random = new RemixRandom(seed);
  const integerBounds: (number | undefined)[] = [undefined, 2, 6, 10000];
  const draws: RandomDraw[] = [];

  for (let index = 0; index < 16; index++) {
    if (index % 2 === 0) {
      draws.push({ type: "double", value: random.nextDouble() });
    } else {
      const bound = integerBounds[Math.floor(index / 2) % integerBounds.length];
      draws.push(
        bound === undefined
          ? { type: "integer-default", value: random.nextInt() }
          : { type: "integer", bound, value: random.nextInt(bound) },
      );
    }
  }

  return draws;
}

it("matches the pinned Remix seeded Random corpus", () => {
  const observed = fixture.data.randomSemantics.map(({ seed }) => ({
    seed,
    draws: drawSequence(seed),
  }));
  const expected = fixture.data.randomSemantics.map(({ seed, draws }) => ({
    seed,
    draws,
  }));

  expect(fixture.metadata.sourceCommit).toBe(
    "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21",
  );
  expect(observed).toEqual(expected);
});

it("produces repeatable in-range streams for explicit nonnegative seeds", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
      (seed) => {
        const first = new RemixRandom(seed);
        const second = new RemixRandom(seed);

        for (let index = 0; index < 32; index++) {
          const value = first.nextDouble();
          expect(value).toBe(second.nextDouble());
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThan(1);
        }
      },
    ),
    { numRuns: 100 },
  );
});

it("preserves the source RNG sequence-exhaustion boundary", () => {
  const random = new RemixRandom(fixture.data.randomSequenceExhaustion.seed);
  const values = Array.from({ length: 41 }, () => {
    const value = random.nextDouble();
    return Number.isNaN(value) ? "NaN" : value;
  });
  const observed = {
    ...fixture.data.randomSequenceExhaustion,
    values,
    firstNaNIndex: values.findIndex((value) => value === "NaN"),
  };

  expect(observed).toEqual(fixture.data.randomSequenceExhaustion);
});
