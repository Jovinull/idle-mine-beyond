<script lang="ts">
  import { resolve } from "$app/paths";
  import ObjectDetails from "$lib/components/ObjectDetails.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { fixedLevels, objectAt, objectNumber } from "$lib/data/objects";
  import { chapterForLevel, chapters } from "$lib/data/story";
  import { objectPath } from "$lib/links";

  let { data } = $props();

  const level = $derived(data.level);
  const object = $derived(objectAt(level));
  const position = $derived(fixedLevels.indexOf(level));
  const previous = $derived(fixedLevels[position - 1]);
  const next = $derived(fixedLevels[position + 1]);
  const gapAfter = $derived(
    next !== undefined && next > level + 1
      ? { from: level + 1, to: next - 1 }
      : null,
  );
</script>

<Seo
  title="{object.name} (#{objectNumber(level)})"
  description="{object.name} is mine object #{objectNumber(
    level,
  )} in Idle Mine Beyond, found in Chapter {chapterForLevel(level) +
    1}: {chapters[
    chapterForLevel(level)
  ]}. HP, defense, value, drops and Story notes."
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href={resolve("/wiki/objects/")}>Mine objects</a>
  <span aria-hidden="true">/</span>
  <span>#{objectNumber(level)}</span>
</nav>

<h1>{object.name}</h1>

<ObjectDetails {level} />

<nav class="pager" aria-label="Neighbouring objects">
  {#if previous !== undefined}
    <a class="prev" href={resolve(objectPath(previous))}>
      <small>Previous · #{objectNumber(previous)}</small>
      {objectAt(previous).name}
    </a>
  {:else}<span></span>{/if}
  {#if next !== undefined}
    <a class="next" href={resolve(objectPath(next))}>
      <small>Next hand-made · #{objectNumber(next)}</small>
      {objectAt(next).name}
    </a>
  {:else}
    <a class="next" href={resolve(objectPath(level + 1))}>
      <small>Next · #{objectNumber(level + 1)}</small>
      Procedural universes
    </a>
  {/if}
</nav>

{#if gapAfter}
  <p class="gap muted">
    Objects #{objectNumber(gapAfter.from)} to #{objectNumber(gapAfter.to)} are generated
    by formula.
    <a href={resolve(objectPath(gapAfter.from))}
      >Open #{objectNumber(gapAfter.from)} in the explorer</a
    >.
  </p>
{/if}

<style>
  .crumbs {
    font-size: 0.9rem;
    color: var(--text-faint);
    margin-bottom: 0.75rem;
  }

  .crumbs a {
    color: var(--text-muted);
  }

  h1 {
    margin-bottom: 1.75rem;
  }

  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 3rem;
  }

  .pager a {
    display: grid;
    gap: 0.15rem;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-display);
  }

  .pager a:hover {
    border-color: var(--line-strong);
  }

  .pager small {
    font-family: var(--font-body);
    color: var(--text-faint);
    font-size: 0.8rem;
  }

  .next {
    text-align: right;
  }

  .gap {
    margin-top: 1rem;
    font-size: 0.95rem;
  }
</style>
