<script lang="ts">
  import { resolve } from "$app/paths";
  import ResourceIcon from "$lib/components/ResourceIcon.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { upgradeCount, upgradeGroups } from "$lib/data/upgrades";
  import { upgradeGroupPath } from "$lib/links";
</script>

<Seo
  title="Upgrades"
  description="All {upgradeCount} upgrades in Idle Mine Beyond across Money, Gems, Planet Coins and Wisdom, with prices and effects at every level."
/>

<header class="page-head">
  <p class="eyebrow">Upgrades</p>
  <h1>{upgradeCount} upgrades, four currencies</h1>
  <p class="lede">
    Every price and effect in these pages is computed by the game's own upgrade
    code and formatted the way the shop shows it. Pick a notation in the sidebar
    to see the numbers as you play.
  </p>
</header>

<ul class="groups">
  {#each upgradeGroups as group (group.id)}
    <li>
      <a href={resolve(upgradeGroupPath(group.slug))}>
        <span class="title">
          <ResourceIcon kind={group.resourceIcon} size={28} decorative />
          {group.label} upgrades
          <span class="count">{group.upgrades.length}</span>
        </span>
        <span class="summary">{group.summary}</span>
        <span class="names">
          {group.upgrades.map((upgrade) => upgrade.name).join(" · ")}
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .page-head {
    margin-bottom: 2rem;
  }

  .groups {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr));
    gap: 1rem;
  }

  a {
    display: grid;
    gap: 0.6rem;
    height: 100%;
    padding: 1.25rem 1.35rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
    color: var(--text);
    text-decoration: none;
  }

  a:hover {
    border-color: var(--line-strong);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-family: var(--font-display);
    font-size: 1.2rem;
  }

  .count {
    margin-left: auto;
    font-family: var(--font-body);
    font-size: 0.85rem;
    color: var(--text-faint);
  }

  .summary {
    color: var(--text-muted);
  }

  .names {
    font-size: 0.88rem;
    color: var(--text-faint);
  }
</style>
