<script lang="ts">
  import { objectAt, objectNumber } from "$lib/data/objects";
  import MineObject from "./MineObject.svelte";
  import Num from "./Num.svelte";

  // A walk through the game, from the first object to the last hand-made one.
  const tour = [
    0, 1, 12, 27, 33, 50, 60, 71, 89, 101, 109, 138, 169, 173, 199, 214,
  ];
  let step = $state(0);
  let hits = $state(0);

  const level = $derived(tour[step] ?? 0);
  const object = $derived(objectAt(level));

  function hit() {
    hits += 1;
    step = (step + 1) % tour.length;
  }
</script>

<figure class="hero-object">
  <button
    type="button"
    class="target"
    onclick={hit}
    aria-label="Mine {object.name} and go deeper"
  >
    <MineObject {level} name={object.name} width={300} />
  </button>
  <figcaption>
    <span class="number">#{objectNumber(level)}</span>
    <span class="name">{object.name}</span>
    <span class="hp">HP <Num value={object.hp} /></span>
    <span class="hint" aria-hidden="true"
      >{hits === 0
        ? "Click it to dig deeper"
        : `${step + 1} of ${tour.length}`}</span
    >
  </figcaption>
</figure>

<style>
  .hero-object {
    margin: 0;
    display: grid;
    justify-items: center;
    gap: 1rem;
    padding: 2rem 1.5rem 1.5rem;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: 14px;
  }

  .target {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition:
      filter 200ms,
      transform 200ms;
  }

  .target:active {
    filter: brightness(0.75);
    transform: scale(0.925);
  }

  figcaption {
    display: grid;
    justify-items: center;
    text-align: center;
    gap: 0.15rem;
    min-height: 6.5rem;
  }

  .number {
    font-size: 0.85rem;
    color: #7a7a7a;
    font-variant-numeric: tabular-nums;
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.7rem;
    line-height: 1.2;
    color: var(--text);
  }

  .hp {
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin-top: 0.5rem;
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
</style>
