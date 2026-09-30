<script lang="ts">
  import { resolve } from "$app/paths";
  import { drawRemixMineObjectCanvas } from "$game/mine-object-rendering";
  import Seo from "$lib/components/Seo.svelte";
  import {
    chapterHtml,
    chapterMilestones,
    chapters,
    objectiveText,
  } from "$lib/data/story";
  import { chapterPath, objectPath } from "$lib/links";
  import { currentFormatter } from "$lib/notation.svelte";

  let { data } = $props();
  const page = $derived(data.page);
  const html = $derived(chapterHtml(page, currentFormatter()));
  const steps = $derived(chapterMilestones(page));
  let article: HTMLElement;

  $effect(() => {
    void html;
    const canvases = article.querySelectorAll<HTMLCanvasElement>(
      "canvas.mine-object[data-level]",
    );
    for (const canvas of canvases) {
      const level = Number(canvas.dataset["level"]);
      canvas.setAttribute("role", "img");
      void drawRemixMineObjectCanvas(canvas, level).then(() => {
        canvas.dataset["rendered"] = "true";
      });
      const link = canvas.closest(".story-quote");
      if (link && !link.querySelector("a.object-link")) {
        const anchor = document.createElement("a");
        anchor.className = "object-link";
        anchor.href = resolve(objectPath(level));
        anchor.textContent = "Object page";
        link.append(anchor);
      }
    }
  });
</script>

<Seo
  title="Chapter {page + 1}: {chapters[page]}"
  description="Story chapter {page + 1} of Idle Mine Beyond, {chapters[
    page
  ]}: the full text and the objective for each of its {steps.length} milestones."
/>

<nav class="crumbs" aria-label="Breadcrumb">
  <a href={resolve("/wiki/story/")}>Story</a> <span aria-hidden="true">/</span>
  <span>Chapter {page + 1}</span>
</nav>

<header class="page-head">
  <p class="eyebrow">Chapter {page + 1} of {chapters.length}</p>
  <h1>{chapters[page]}</h1>
</header>

<div class="layout">
  <article class="story-text" bind:this={article}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- the pinned Story template, rendered by the game's own renderer -->
    {@html html}
  </article>

  <aside class="objectives" aria-labelledby="objectives-title">
    <h2 id="objectives-title">Milestones</h2>
    <ol>
      {#each steps as step (step.key)}
        {@const text = objectiveText(step, currentFormatter())}
        <li>
          <span class="step">#{step.index + 1}</span>
          {text || "Start the game"}
        </li>
      {/each}
    </ol>
  </aside>
</div>

<nav class="pager" aria-label="Chapters">
  {#if page > 0}
    <a href={resolve(chapterPath(page - 1))}>
      <small>Previous chapter</small>{chapters[page - 1]}
    </a>
  {:else}<span></span>{/if}
  {#if page < chapters.length - 1}
    <a class="next" href={resolve(chapterPath(page + 1))}>
      <small>Next chapter</small>{chapters[page + 1]}
    </a>
  {/if}
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

  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 17rem;
    gap: 3rem;
    align-items: start;
  }

  .story-text {
    max-width: var(--measure);
  }

  .story-text :global(> div) {
    padding-bottom: 1.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--line);
  }

  .story-text :global(h3) {
    font-size: 1.4rem;
  }

  .story-text :global(.story-quote) {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 1.25rem;
    margin: 1.25rem 0;
    padding: 1rem 1.25rem;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
  }

  .story-text :global(.story-quote canvas),
  .story-text :global(.story-quote img) {
    width: 7rem;
    height: auto;
  }

  .story-text :global(.story-quote img) {
    width: 4.5rem;
  }

  .story-text :global(.story-quote span) {
    flex: 1 1 12rem;
    font-family: var(--font-story);
    font-style: italic;
    font-size: 1.6rem;
    line-height: 1.25;
    color: #404040;
  }

  :global(:root[data-theme="dark"]) .story-text :global(.story-quote span) {
    color: #c1c1c1;
  }

  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme="light"]))
      .story-text
      :global(.story-quote span) {
      color: #c1c1c1;
    }
  }

  .story-text :global(.object-link) {
    font-size: 0.85rem;
    margin-left: auto;
  }

  .story-text :global(.story-button) {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 0.95rem;
  }

  .objectives {
    position: sticky;
    top: 5rem;
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
  }

  .objectives h2 {
    font-family: var(--font-body);
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 0.75rem;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
    font-size: 0.95rem;
  }

  .step {
    display: inline-block;
    min-width: 2.2rem;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  .pager {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-top: 3rem;
  }

  .pager a {
    display: grid;
    gap: 0.15rem;
    padding: 0.9rem 1.1rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-display);
  }

  .pager a:hover {
    border-color: var(--line-strong);
  }

  .pager small {
    font-family: var(--font-body);
    font-size: 0.8rem;
    color: var(--text-faint);
  }

  .pager .next {
    text-align: right;
  }

  @media (max-width: 1080px) {
    .layout {
      grid-template-columns: 1fr;
    }

    .objectives {
      position: static;
      order: -1;
    }
  }
</style>
