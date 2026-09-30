<script lang="ts">
  import type { Snippet } from "svelte";
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import type { Pathname } from "$app/types";
  import NotationPicker from "$lib/components/NotationPicker.svelte";
  import WikiSearch from "$lib/components/WikiSearch.svelte";
  import { wikiSections } from "$lib/wiki-nav";

  let { children }: { children: Snippet } = $props();

  function isCurrent(linkPath: Pathname): boolean {
    const href = resolve(linkPath);
    const current = page.url.pathname;
    if (href === resolve("/wiki/")) return current === href;
    return current === href || current.startsWith(href);
  }

  const currentLabel = $derived(
    wikiSections
      .flatMap((section) => section.links)
      .filter((link) => isCurrent(link.path))
      .at(-1)?.label ?? "Wiki",
  );
</script>

{#snippet links()}
  {#each wikiSections as section (section.title)}
    <p class="section">{section.title}</p>
    <ul>
      {#each section.links as link (link.path)}
        <li>
          <a
            href={resolve(link.path)}
            aria-current={isCurrent(link.path) ? "page" : undefined}
            >{link.label}</a
          >
        </li>
      {/each}
    </ul>
  {/each}
{/snippet}

<div class="container wiki">
  <aside class="sidebar">
    <div class="tools">
      <WikiSearch />
      <NotationPicker />
    </div>
    <nav class="desktop-nav" aria-label="Wiki">
      {@render links()}
    </nav>
    <details class="mobile-nav">
      <summary>Wiki menu <span>· {currentLabel}</span></summary>
      <nav aria-label="Wiki sections">
        {@render links()}
      </nav>
    </details>
  </aside>
  <div class="content">
    {@render children()}
  </div>
</div>

<style>
  .wiki {
    display: grid;
    grid-template-columns: 15rem minmax(0, 1fr);
    gap: 3rem;
    padding-top: 2.5rem;
  }

  .sidebar {
    position: sticky;
    top: 5rem;
    align-self: start;
    max-height: calc(100vh - 6rem);
    overflow-y: auto;
    padding-bottom: 2rem;
  }

  .tools {
    display: grid;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .mobile-nav {
    display: none;
  }

  .section {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 1.25rem 0 0.4rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  nav a {
    display: block;
    padding: 0.3rem 0.6rem;
    border-radius: var(--radius);
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.97rem;
  }

  nav a:hover {
    color: var(--text);
    background: var(--bg-sunken);
  }

  nav a[aria-current="page"] {
    color: var(--text);
    background: var(--accent-soft);
  }

  .content {
    min-width: 0;
  }

  @media (max-width: 900px) {
    .wiki {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding-top: 1.5rem;
    }

    .sidebar {
      position: static;
      max-height: none;
      overflow: visible;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--line);
    }

    .tools {
      grid-template-columns: 1fr 1fr;
    }

    .desktop-nav {
      display: none;
    }

    .mobile-nav {
      display: block;
    }

    summary {
      cursor: pointer;
      padding: 0.6rem 0;
      color: var(--text);
    }

    summary span {
      color: var(--text-muted);
    }
  }

  @media (max-width: 520px) {
    .tools {
      grid-template-columns: 1fr;
    }
  }
</style>
