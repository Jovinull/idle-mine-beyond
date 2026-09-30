<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import type { Pathname } from "$app/types";

  type Entry = { title: string; href: string; kind: string; terms: string };

  let query = $state("");
  let entries = $state<Entry[] | null>(null);
  let active = $state(0);
  let open = $state(false);
  const listId = "wiki-search-results";
  let input: HTMLInputElement;

  let loading: Promise<void> | undefined;
  function load(): Promise<void> {
    loading ??= fetch("/wiki/search.json")
      .then((response) => response.json())
      .then((data: Entry[]) => {
        entries = data;
      });
    return loading;
  }

  // Keep anything typed before the page finished loading its scripts.
  onMount(() => {
    if (input.value) {
      query = input.value;
      open = document.activeElement === input;
      void load();
    }
  });

  function score(entry: Entry, needle: string): number {
    const title = entry.title.toLowerCase();
    if (title === needle) return 0;
    if (title.startsWith(needle)) return 1;
    if (title.includes(needle)) return 2;
    if (entry.terms.includes(needle)) return 3;
    return -1;
  }

  const results = $derived.by(() => {
    const needle = query.trim().toLowerCase();
    if (!entries || needle.length === 0) return [];
    return entries
      .map((entry) => ({ entry, rank: score(entry, needle) }))
      .filter((item) => item.rank >= 0)
      .sort(
        (a, b) => a.rank - b.rank || a.entry.title.localeCompare(b.entry.title),
      )
      .slice(0, 8)
      .map((item) => item.entry);
  });

  function choose(entry: Entry | undefined) {
    if (!entry) return;
    open = false;
    query = "";
    void goto(resolve(entry.href as Pathname));
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      active = Math.min(active + 1, results.length - 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      active = Math.max(active - 1, 0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape") {
      open = false;
    }
  }
</script>

<div class="search">
  <label for="wiki-search" class="visually-hidden">Search the wiki</label>
  <input
    id="wiki-search"
    type="search"
    placeholder="Search objects, upgrades…"
    autocomplete="off"
    role="combobox"
    aria-expanded={open && results.length > 0}
    aria-controls={listId}
    aria-activedescendant={open && results[active]
      ? `${listId}-${active}`
      : undefined}
    bind:this={input}
    bind:value={query}
    onfocus={() => {
      open = true;
      void load();
    }}
    oninput={() => {
      open = true;
      void load();
      active = 0;
    }}
    onblur={() => setTimeout(() => (open = false), 120)}
    onkeydown={onKeydown}
  />
  {#if open && results.length > 0}
    <ul id={listId} role="listbox">
      {#each results as entry, index (entry.href)}
        <li
          id="{listId}-{index}"
          role="option"
          aria-selected={index === active}
          class:active={index === active}
        >
          <a
            href={resolve(entry.href as Pathname)}
            onmousedown={(event) => {
              event.preventDefault();
              choose(entry);
            }}
          >
            <span>{entry.title}</span>
            <small>{entry.kind}</small>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .search {
    position: relative;
  }

  input {
    width: 100%;
    font: inherit;
    font-size: 0.95rem;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    padding: 0.5rem 0.7rem;
  }

  input::placeholder {
    color: var(--text-faint);
  }

  ul {
    position: absolute;
    z-index: 30;
    left: 0;
    right: 0;
    top: calc(100% + 4px);
    margin: 0;
    padding: 0.3rem;
    list-style: none;
    background: var(--bg-raised);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    min-width: 16rem;
  }

  a {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.4rem 0.55rem;
    border-radius: 4px;
    color: var(--text);
    text-decoration: none;
  }

  li.active a,
  a:hover {
    background: var(--bg-sunken);
  }

  small {
    color: var(--text-faint);
    white-space: nowrap;
  }
</style>
