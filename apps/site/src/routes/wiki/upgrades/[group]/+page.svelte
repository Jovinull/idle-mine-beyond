<script lang="ts">
  import { resolve } from "$app/paths";
  import ResourceIcon from "$lib/components/ResourceIcon.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import UpgradeEntry from "$lib/components/UpgradeEntry.svelte";
  import {
    TABLE_HIGHEST_LEVEL,
    groupBySlug,
    upgradeGroups,
  } from "$lib/data/upgrades";
  import { upgradeGroupPath } from "$lib/links";

  let { data } = $props();
  const group = $derived(groupBySlug(data.slug)!);
</script>

<Seo
  title="{group.label} upgrades"
  description="{group.label} upgrades in Idle Mine Beyond: {group.upgrades
    .map((upgrade) => upgrade.name)
    .join(', ')}. Prices and effects by level, with a calculator."
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href={resolve("/wiki/upgrades/")}>Upgrades</a>
  <span aria-hidden="true">/</span>
  <span>{group.label}</span>
</nav>

<header class="page-head">
  <h1>
    <ResourceIcon kind={group.resourceIcon} size={40} decorative />
    {group.label} upgrades
  </h1>
  <p class="lede">{group.summary}</p>
  <p class="note">
    Tables show the game's own shop text with every other upgrade at level 0 and
    every Power at 1.
    {#if group.id === "wisdom"}
      Increasing Damage Boost also grows with the highest object you reach; its
      table uses object #{TABLE_HIGHEST_LEVEL + 1}, just past the Powers unlock.
    {:else}
      Upgrades that read other upgrades or Powers show higher values later in a
      run.
    {/if}
  </p>
  <ul class="toc">
    {#each group.upgrades as upgrade (upgrade.key)}
      <li><a href="#{upgrade.key}">{upgrade.name}</a></li>
    {/each}
  </ul>
</header>

{#each group.upgrades as upgrade (upgrade.key)}
  <UpgradeEntry {upgrade} />
{/each}

<nav class="others" aria-label="Other upgrade groups">
  {#each upgradeGroups.filter((other) => other.id !== group.id) as other (other.id)}
    <a href={resolve(upgradeGroupPath(other.slug))}>
      <ResourceIcon kind={other.resourceIcon} decorative />
      {other.label} upgrades
    </a>
  {/each}
</nav>

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
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .note {
    font-size: 0.93rem;
    color: var(--text-faint);
    max-width: var(--measure);
  }

  .toc {
    list-style: none;
    padding: 0;
    margin: 1.25rem 0 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .toc a {
    display: inline-block;
    padding: 0.25rem 0.7rem;
    border: 1px solid var(--line);
    border-radius: 999px;
    font-size: 0.9rem;
    color: var(--text-muted);
    text-decoration: none;
  }

  .toc a:hover {
    color: var(--text);
    border-color: var(--line-strong);
  }

  .others {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-top: 2.5rem;
  }
</style>
