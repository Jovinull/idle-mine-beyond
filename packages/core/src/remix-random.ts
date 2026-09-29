const INT_MAX = 2_147_483_647;
const SEQUENCE = "31415926535897932384626433832795028841971693993751";

/**
 * The explicitly seeded path of Remix's `Random` class.
 *
 * Seedless construction in the reference reads `Date.now()`. Beyond requires
 * callers to inject a seed so simulation code stays deterministic.
 */
export class RemixRandom {
  private generation = 0;
  private n: number;

  constructor(private readonly seed: number) {
    this.n = seed;
    for (let index = 0; index < 10; index++) this.next();
  }

  next(): void {
    const increment =
      this.seed + Number.parseInt(SEQUENCE[this.generation]!, 10);
    this.n = (this.n + increment) * increment;
    this.n %= INT_MAX;
    this.generation++;
  }

  nextInt(bound = INT_MAX): number {
    this.next();
    return this.n % bound;
  }

  nextDouble(): number {
    this.next();
    return this.n / INT_MAX;
  }
}
