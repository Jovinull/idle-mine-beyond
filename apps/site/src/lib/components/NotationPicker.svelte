<script lang="ts">
  import { formatters, notation, setNotation } from "$lib/notation.svelte";
</script>

<label class="notation-picker">
  <span>Number notation</span>
  <select
    value={notation.index}
    onchange={(event) => setNotation(Number(event.currentTarget.value))}
  >
    {#each formatters as formatter, index (formatter.name)}
      <option value={index}>{formatter.name}</option>
    {/each}
  </select>
</label>

<style>
  .notation-picker {
    display: grid;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: var(--text-faint);
    letter-spacing: 0.04em;
  }

  select {
    font: inherit;
    font-size: 0.95rem;
    letter-spacing: 0;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 0.4rem 0.5rem;
  }
</style>
