<script lang="ts">
  import { resolve } from "$app/paths";
  import MineObject from "$lib/components/MineObject.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { objectAt } from "$lib/data/objects";
  import {
    chapterMilestones,
    chapters,
    milestones,
    storyQuotes,
  } from "$lib/data/story";
  import { chapterPath } from "$lib/links";

  const overview = chapters.map((title, page) => ({
    page,
    title,
    milestones: chapterMilestones(page).length,
    previews: [
      ...new Set(
        storyQuotes.filter((quote) => quote.page === page).map((q) => q.level),
      ),
    ].slice(0, 4),
  }));
</script>

<Seo
  title="Story"
  description="The {chapters.length} chapters and {milestones.length} milestones of the Idle Mine Beyond Story, with the objective that unlocks each one."
/>

<header class="page-head">
  <p class="eyebrow">Story</p>
  <h1>{chapters.length} chapters, {milestones.length} milestones</h1>
  <p class="lede">
    The Story tab tells where you are and what to do next. Each milestone
    unlocks when you reach an object, earn an amount of Money, or buy a key
    upgrade. The chapters below contain spoilers.
  </p>
</header>

<ol class="chapters">
  {#each overview as chapter (chapter.page)}
    <li>
      <a href={resolve(chapterPath(chapter.page))}>
        <span class="number">Chapter {chapter.page + 1}</span>
        <span class="title">{chapter.title}</span>
        <span class="previews" aria-hidden="true">
          {#each chapter.previews as level (level)}
            <MineObject {level} name={objectAt(level).name} width={56} />
          {/each}
        </span>
        <span class="count">{chapter.milestones} milestones</span>
      </a>
    </li>
  {/each}
</ol>

<style>
  .page-head {
    margin-bottom: 2rem;
  }

  .chapters {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
  }

  a {
    display: grid;
    grid-template-columns: 7rem 1fr auto auto;
    align-items: center;
    gap: 1.25rem;
    padding: 0.8rem 1.1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
    color: var(--text);
    text-decoration: none;
  }

  a:hover {
    border-color: var(--line-strong);
  }

  .number {
    font-size: 0.78rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .title {
    font-family: var(--font-display);
    font-size: 1.15rem;
  }

  .previews {
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem 0.4rem;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
  }

  .count {
    font-size: 0.88rem;
    color: var(--text-faint);
    width: 7.5rem;
    text-align: right;
  }

  @media (max-width: 720px) {
    a {
      grid-template-columns: 1fr auto;
    }

    .number {
      grid-column: 1 / -1;
    }

    .count {
      display: none;
    }
  }
</style>
