<script lang="ts">
  import { resolve } from "$app/paths";
  import type { ObjectSummary } from "$lib/data/objects";
  import { objectPath } from "$lib/links";
  import MineObject from "./MineObject.svelte";

  let { object }: { object: ObjectSummary } = $props();
</script>

<a class="object-card" href={resolve(objectPath(object.level))}>
  <MineObject level={object.level} name={object.name} width={96} />
  <span class="number">#{object.number}</span>
  <span class="name">{object.name}</span>
</a>

<style>
  .object-card {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    padding: 0.9rem 0.6rem 0.8rem;
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
    background: var(--stage);
    color: var(--text);
    text-decoration: none;
    text-align: center;
    transition:
      border-color 120ms,
      transform 120ms;
  }

  .object-card:hover {
    border-color: var(--text-faint);
    transform: translateY(-2px);
  }

  .number {
    font-size: 0.78rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
    margin-top: 0.35rem;
  }

  .name {
    font-family: var(--font-display);
    font-size: 0.95rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }
</style>
