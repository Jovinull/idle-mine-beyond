<script lang="ts">
  import { resolve } from "$app/paths";
  import MineObject from "$lib/components/MineObject.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { fixedObjects } from "$lib/data/objects";
  import { chapters, milestones } from "$lib/data/story";
  import { upgradeCount } from "$lib/data/upgrades";
  import { formatters } from "$lib/notation.svelte";

  const sections = [
    {
      path: "/wiki/objects/" as const,
      title: "Mine objects",
      text: `All ${fixedObjects.length} hand-made objects with HP, defense, value, drops and colors.`,
      level: 18,
    },
    {
      path: "/wiki/explorer/" as const,
      title: "Object explorer",
      text: "Look up any object by number, including every procedural one.",
      level: 250,
    },
    {
      path: "/wiki/story/" as const,
      title: "Story",
      text: `${chapters.length} chapters and ${milestones.length} milestones, with what unlocks each.`,
      level: 60,
    },
    {
      path: "/wiki/upgrades/" as const,
      title: "Upgrades",
      text: `${upgradeCount} upgrades with prices, effects and a level calculator.`,
      level: 55,
    },
    {
      path: "/wiki/powers/" as const,
      title: "Wisdom and Powers",
      text: "The five Powers, what they multiply, and how prestige works.",
      level: 169,
    },
    {
      path: "/wiki/pickaxes/" as const,
      title: "Pickaxe crafting",
      text: "How Gems become pickaxes, and why some crafts are duds.",
      level: 6,
    },
    {
      path: "/wiki/mechanics/" as const,
      title: "Mining and offline",
      text: "Damage, defense, drops, autosave and offline earnings.",
      level: 35,
    },
    {
      path: "/wiki/notations/" as const,
      title: "Number notations",
      text: `All ${formatters.length} notations from Settings, side by side.`,
      level: 68,
    },
  ];
</script>

<Seo
  title="Wiki"
  description="The Idle Mine Beyond wiki: every mine object, upgrade, Story chapter and mechanic, generated from the game's own data."
/>

<header class="page-head">
  <p class="eyebrow">Wiki</p>
  <h1>Everything in the game, from its own data</h1>
  <p class="lede">
    This wiki is built from the same data and code as the game. Numbers, names,
    sprites and Story text cannot drift from what you see while playing, because
    they come from the same place.
  </p>
</header>

<ul class="sections">
  {#each sections as section (section.path)}
    <li>
      <a href={resolve(section.path)}>
        <span class="sprite"
          ><MineObject level={section.level} name="" width={64} /></span
        >
        <span>
          <span class="title">{section.title}</span>
          <span class="text">{section.text}</span>
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .page-head {
    margin-bottom: 2.25rem;
  }

  .sections {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr));
    gap: 0.9rem;
  }

  a {
    display: flex;
    align-items: center;
    gap: 1rem;
    height: 100%;
    padding: 1rem 1.2rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
    color: var(--text);
    text-decoration: none;
  }

  a:hover {
    border-color: var(--line-strong);
  }

  .sprite {
    flex: none;
    display: grid;
    place-items: center;
    width: 5rem;
    height: 4.5rem;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
  }

  .title {
    display: block;
    font-family: var(--font-display);
    font-size: 1.15rem;
    margin-bottom: 0.2rem;
  }

  .text {
    display: block;
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.45;
  }
</style>
