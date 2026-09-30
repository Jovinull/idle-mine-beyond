<script lang="ts">
  import {
    cumulativePrice,
    sampleLevels,
    upgradeRow,
    type Upgrade,
  } from "$lib/data/upgrades";
  import { currentFormatter, fmt } from "$lib/notation.svelte";

  let { upgrade }: { upgrade: Upgrade } = $props();

  const maxLabel = $derived(
    Number.isFinite(upgrade.maxLevel) ? String(upgrade.maxLevel) : "No limit",
  );
  const calculatorMax = $derived(
    Number.isFinite(upgrade.maxLevel) ? upgrade.maxLevel : 100_000,
  );

  let calcInput = $state("10");
  const calcLevel = $derived.by(() => {
    const parsed = Number(calcInput);
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    return Math.min(parsed, calculatorMax);
  });
  const calcRow = $derived(
    calcLevel === null
      ? null
      : upgradeRow(upgrade, calcLevel, currentFormatter()),
  );
  const calcTotal = $derived(
    calcLevel === null ? null : cumulativePrice(upgrade, calcLevel),
  );
</script>

<article class="upgrade" id={upgrade.key}>
  <header>
    <img src={upgrade.icon} alt="" width="56" height="56" />
    <div>
      <h3>{upgrade.name}</h3>
      <p class="description">{upgrade.description}</p>
      <p class="max">Max level: <span>{maxLabel}</span></p>
    </div>
  </header>

  <div class="table-wrap">
    <table>
      <caption class="visually-hidden">{upgrade.name} by level</caption>
      <thead>
        <tr>
          <th scope="col">Level</th>
          <th scope="col">Effect (now → next)</th>
          <th scope="col">Price of next level</th>
        </tr>
      </thead>
      <tbody>
        {#each sampleLevels(upgrade) as level (level)}
          {@const row = upgradeRow(upgrade, level, currentFormatter())}
          <tr>
            <td>{row.levelDisplay}</td>
            <td>{row.effectDisplay}</td>
            <td>{row.priceDisplay}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="calculator">
    <label for="calc-{upgrade.group}-{upgrade.key}">Level</label>
    <input
      id="calc-{upgrade.group}-{upgrade.key}"
      inputmode="numeric"
      autocomplete="off"
      bind:value={calcInput}
    />
    {#if calcRow && calcTotal}
      <p>
        Effect <strong>{calcRow.effectDisplay}</strong>. Next level costs
        <strong>{calcRow.priceDisplay.trim()}</strong>. Reaching level {calcRow.level}
        from 0 costs <strong>{fmt(calcTotal, 2, "1e12", 0)}</strong> in total.
      </p>
    {:else}
      <p class="muted">Enter a whole number from 0 to {calculatorMax}.</p>
    {/if}
  </div>
</article>

<style>
  .upgrade {
    padding: 1.5rem 0 2rem;
    border-bottom: 1px solid var(--line);
    scroll-margin-top: 5rem;
  }

  header {
    display: flex;
    gap: 1.1rem;
    align-items: flex-start;
  }

  header img {
    flex: none;
    image-rendering: auto;
  }

  h3 {
    margin: 0.2rem 0 0.35rem;
  }

  .description {
    margin: 0 0 0.3rem;
    color: var(--text-muted);
  }

  .max {
    margin: 0;
    font-size: 0.9rem;
    color: var(--text-faint);
  }

  .max span {
    color: var(--text-muted);
  }

  .table-wrap {
    overflow-x: auto;
    margin-top: 1.25rem;
  }

  td:first-child {
    width: 7rem;
  }

  .calculator {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
    margin-top: 1.1rem;
    padding: 0.9rem 1rem;
    background: var(--bg-sunken);
    border-radius: var(--radius);
    font-size: 0.97rem;
  }

  .calculator label {
    color: var(--text-muted);
  }

  .calculator input {
    font: inherit;
    width: 6.5rem;
    padding: 0.35rem 0.55rem;
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: var(--bg-raised);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .calculator p {
    margin: 0;
    flex: 1 1 22rem;
  }

  strong {
    font-weight: 400;
    color: var(--text);
    background: var(--bg-raised);
    padding: 0 0.3em;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
</style>
