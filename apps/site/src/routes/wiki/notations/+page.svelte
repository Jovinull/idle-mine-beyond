<script lang="ts">
  import { Decimal } from "@idle-mine-beyond/core";
  import { formatNumber } from "@idle-mine-beyond/formatting";
  import Seo from "$lib/components/Seo.svelte";
  import { formatters, notation, setNotation } from "$lib/notation.svelte";

  const samples = ["1234.5", "1e6", "4.2e15", "1e33", "1.8e308", "1e1000"];
  let custom = $state("123456789");

  const customValue = $derived.by(() => {
    try {
      const value = new Decimal(custom.trim().replaceAll(",", ""));
      return Number.isNaN(value.mantissa) ? null : value;
    } catch {
      return null;
    }
  });

  function show(value: string | Decimal, index: number): string {
    const formatter = formatters[index]!;
    return formatNumber(value, formatter, 2, "1e12");
  }
</script>

<Seo
  title="Number notations"
  description="All {formatters.length} number notations from the Idle Mine Beyond Settings, from Standard and Scientific to Roman, Zalgo and Idle Mine Notation, with examples."
/>

<header class="page-head">
  <p class="eyebrow">Number notations</p>
  <h1>{formatters.length} ways to write a big number</h1>
  <p class="lede">
    Settings lets you pick how numbers are written. These are all of them, in
    the game's order, run through the same formatting code. Click a row to use
    it across this wiki.
  </p>
</header>

<label class="custom">
  <span>Try your own number</span>
  <input bind:value={custom} autocomplete="off" spellcheck="false" />
  {#if !customValue}<small>Use a number like 1e50 or 123456.</small>{/if}
</label>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th scope="col">Notation</th>
        {#if customValue}<th scope="col">Yours</th>{/if}
        {#each samples as sample (sample)}
          <th scope="col">{sample}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each formatters as formatter, index (formatter.name)}
        <tr class:selected={notation.index === index}>
          <th scope="row">
            <button type="button" onclick={() => setNotation(index)}>
              {formatter.name}
            </button>
            {#if index === 0}<small>default</small>{/if}
          </th>
          {#if customValue}<td>{show(customValue, index)}</td>{/if}
          {#each samples as sample (sample)}
            <td>{show(sample, index)}</td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .page-head {
    margin-bottom: 1.5rem;
  }

  .custom {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
    margin-bottom: 1.5rem;
    color: var(--text-muted);
  }

  .custom input {
    font: inherit;
    width: 14rem;
    padding: 0.45rem 0.65rem;
    border-radius: var(--radius);
    border: 1px solid var(--line-strong);
    background: var(--bg-raised);
    color: var(--text);
  }

  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
  }

  table {
    font-size: 0.93rem;
  }

  th[scope="row"] {
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.95rem;
    white-space: nowrap;
    color: var(--text);
    border-bottom-color: var(--line);
  }

  th[scope="row"] button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }

  th[scope="row"] button:hover {
    color: var(--accent);
  }

  th small {
    margin-left: 0.4rem;
    color: var(--text-faint);
    font-size: 0.75rem;
  }

  td {
    white-space: nowrap;
    max-width: 18rem;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  tr.selected {
    background: var(--accent-soft);
  }
</style>
