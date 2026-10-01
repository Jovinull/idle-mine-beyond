<script lang="ts">
  import { formatNumber } from "@idle-mine-beyond/formatting";
  import Seo from "$lib/components/Seo.svelte";
  import { formatters, notation, setNotation } from "$lib/notation.svelte";

  // Three sizes are enough to show how each notation behaves.
  const samples = [
    { value: "123456789", label: "123,456,789" },
    { value: "4.2e15", label: "4.2e15" },
    { value: "1e1000", label: "1e1000" },
  ];

  function show(value: string, index: number): string {
    return formatNumber(value, formatters[index]!, 2, "1e12");
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
    the game's order, run through the same formatting code. Click a name to use
    it across this wiki.
  </p>
</header>

<table>
  <thead>
    <tr>
      <th scope="col">Notation</th>
      {#each samples as sample (sample.value)}
        <th scope="col">{sample.label}</th>
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
        {#each samples as sample (sample.value)}
          <td data-label={sample.label}>{show(sample.value, index)}</td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .page-head {
    margin-bottom: 1.5rem;
  }

  table {
    table-layout: fixed;
    font-size: 0.93rem;
  }

  th[scope="col"]:first-child {
    width: 13rem;
  }

  td {
    overflow-wrap: anywhere;
  }

  th[scope="row"] {
    text-transform: none;
    letter-spacing: 0;
    font-size: 0.95rem;
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

  tr.selected {
    background: var(--accent-soft);
  }

  /* On phones each notation becomes a small card with its three values. */
  @media (max-width: 640px) {
    thead {
      display: none;
    }

    table,
    tbody,
    tr,
    th[scope="row"],
    td {
      display: block;
      width: auto;
    }

    tr {
      padding: 0.7rem 0.2rem;
      border-bottom: 1px solid var(--line);
    }

    th[scope="row"],
    td {
      border: 0;
      padding: 0.15rem 0.5rem;
    }

    th[scope="row"] {
      font-family: var(--font-display);
      margin-bottom: 0.25rem;
    }

    td {
      display: grid;
      grid-template-columns: 7.5rem 1fr;
      gap: 0.75rem;
    }

    td::before {
      content: attr(data-label);
      color: var(--text-faint);
    }
  }
</style>
