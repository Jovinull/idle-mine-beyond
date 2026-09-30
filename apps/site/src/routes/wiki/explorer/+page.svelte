<script lang="ts">
  import { onMount } from "svelte";
  import { replaceState } from "$app/navigation";
  import { resolve } from "$app/paths";
  import ObjectDetails from "$lib/components/ObjectDetails.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import {
    isFixed,
    lastFixedLevel,
    levelFromNumber,
    objectAt,
    objectNumber,
  } from "$lib/data/objects";
  import { objectPath } from "$lib/links";

  // Object numbers far beyond this lose integer precision in the generator.
  const maxNumber = 1_000_000;
  let input = $state("73");
  let number = $state(73);
  let problem = $state("");

  const level = $derived(levelFromNumber(number));
  const name = $derived(objectAt(level).name);

  function show(value: string, updateUrl: boolean) {
    const parsed = Number(value.trim().replace(/^#/, ""));
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxNumber) {
      problem = `Enter a whole number from 1 to ${maxNumber.toLocaleString("en")}.`;
      return;
    }
    problem = "";
    number = parsed;
    input = String(parsed);
    if (updateUrl) {
      replaceState(resolve(`/wiki/explorer/?n=${parsed}`), {});
    }
  }

  onMount(() => {
    const n = new URL(window.location.href).searchParams.get("n");
    if (n) show(n, false);
  });

  function step(delta: number) {
    show(String(Math.min(Math.max(number + delta, 1), maxNumber)), true);
  }
</script>

<Seo
  title="Object explorer"
  description="Look up any mine object in Idle Mine Beyond by its number, including the procedural objects between the hand-made ones and every universe after THE UNIVERSE."
/>

<header class="page-head">
  <p class="eyebrow">Object explorer</p>
  <h1>Any object, by number</h1>
  <p class="lede">
    Past #{objectNumber(lastFixedLevel)} THE UNIVERSE, and in the gaps between hand-made
    objects, the game builds each object from its number. The explorer runs the same
    generator, so names, colors and stats match the game.
  </p>
</header>

<form
  class="lookup"
  onsubmit={(event) => {
    event.preventDefault();
    show(input, true);
  }}
>
  <label for="object-number">Object number</label>
  <div class="row">
    <button
      type="button"
      class="button"
      onclick={() => step(-1)}
      aria-label="Previous object">←</button
    >
    <input
      id="object-number"
      inputmode="numeric"
      autocomplete="off"
      bind:value={input}
      aria-invalid={problem ? "true" : undefined}
      aria-describedby={problem ? "object-number-problem" : undefined}
    />
    <button
      type="button"
      class="button"
      onclick={() => step(1)}
      aria-label="Next object">→</button
    >
    <button type="submit" class="button primary">Show</button>
  </div>
  {#if problem}<p id="object-number-problem" class="problem">{problem}</p>{/if}
  <p class="presets">
    Try
    <button type="button" class="link" onclick={() => show("73", true)}
      >#73</button
    >,
    <button type="button" class="link" onclick={() => show("150", true)}
      >#150</button
    >,
    <button type="button" class="link" onclick={() => show("216", true)}
      >#216</button
    >
    or
    <button type="button" class="link" onclick={() => show("10000", true)}
      >#10000</button
    >.
  </p>
</form>

<section class="result" aria-live="polite">
  <h2>
    <span class="number">#{number}</span>
    {name}
  </h2>
  {#if isFixed(level)}
    <p class="muted">
      This is a hand-made object. <a href={resolve(objectPath(level))}
        >Open its wiki page</a
      >.
    </p>
  {/if}
  <ObjectDetails {level} />
</section>

<style>
  .page-head {
    margin-bottom: 2rem;
  }

  .lookup {
    padding: 1.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
    margin-bottom: 2.5rem;
  }

  label {
    display: block;
    font-size: 0.9rem;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }

  .row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  input {
    font: inherit;
    font-size: 1.1rem;
    width: 10rem;
    padding: 0.55rem 0.75rem;
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: var(--bg);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .problem {
    color: #c0392b;
    margin: 0.6rem 0 0;
  }

  .presets {
    margin: 0.9rem 0 0;
    font-size: 0.95rem;
    color: var(--text-muted);
  }

  .link {
    font: inherit;
    color: var(--accent);
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  h2 {
    margin-bottom: 1.5rem;
  }

  .number {
    display: block;
    font-family: var(--font-body);
    font-size: 0.95rem;
    color: var(--text-faint);
    letter-spacing: 0.02em;
  }
</style>
