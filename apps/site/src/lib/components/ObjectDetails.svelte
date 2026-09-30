<script lang="ts">
  import { resolve } from "$app/paths";
  import {
    isFixed,
    objectAt,
    objectNumber,
    proceduralRegion,
    quotesFor,
  } from "$lib/data/objects";
  import { chapterForLevel, chapters } from "$lib/data/story";
  import { chapterPath } from "$lib/links";
  import { fmtPercent } from "$lib/notation.svelte";
  import MineObject from "./MineObject.svelte";
  import Num from "./Num.svelte";
  import ResourceIcon from "./ResourceIcon.svelte";

  let { level }: { level: number } = $props();

  const object = $derived(objectAt(level));
  const chapter = $derived(chapterForLevel(level));
  const quotes = $derived(quotesFor(level));
  const fixed = $derived(isFixed(level));
  const dropEntries = $derived(Object.entries(object.drops));
  const layers = $derived(
    object.colors
      .map((color, index) => ({ color, index }))
      .filter((layer) => layer.color !== "transparent"),
  );
</script>

<div class="details">
  <div class="stage-column">
    <MineObject {level} name={object.name} width={256} stage />
    {#each quotes as quote (quote.key + quote.level)}
      <figure class="quote">
        <blockquote>{quote.caption}</blockquote>
        <figcaption>
          Story, <a href={resolve(chapterPath(quote.page))}
            >Chapter {quote.page + 1}</a
          >
        </figcaption>
      </figure>
    {/each}
  </div>

  <div class="facts">
    <dl class="stats">
      <div>
        <dt>HP</dt>
        <dd><Num value={object.hp} /></dd>
      </div>
      <div>
        <dt>Defense</dt>
        <dd><Num value={object.defense} /></dd>
      </div>
      <div>
        <dt>Value</dt>
        <dd><ResourceIcon kind="money" /> <Num value={object.value} /></dd>
      </div>
      {#each dropEntries as [kind, drop] (kind)}
        <div>
          <dt>{kind === "wisdom" ? "Wisdom drop" : "Planet Coin drop"}</dt>
          <dd>
            {fmtPercent(drop.chance)} for
            <ResourceIcon kind={kind === "wisdom" ? "wisdom" : "planetcoin"} />
            <Num value={drop.amount} limit="1e9" />
          </dd>
        </div>
      {/each}
    </dl>

    <dl class="meta">
      <div>
        <dt>Object</dt>
        <dd>#{objectNumber(level)}</dd>
      </div>
      <div>
        <dt>Found in</dt>
        <dd>
          <a href={resolve(chapterPath(chapter))}
            >Chapter {chapter + 1}: {chapters[chapter]}</a
          >
        </dd>
      </div>
      <div>
        <dt>Made by</dt>
        <dd>{fixed ? "Hand-made definition" : proceduralRegion(level)}</dd>
      </div>
      <div>
        <dt>Sprite</dt>
        <dd>Skin {object.skin}, {layers.length} tinted layers</dd>
      </div>
    </dl>

    <h2 class="swatch-title">Layer colors</h2>
    <ul class="swatches">
      {#each layers as layer (layer.index)}
        <li>
          <span class="chip" style:background={layer.color}></span>
          <span class="swatch-label">Layer {layer.index + 1}</span>
          <code>{layer.color}</code>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  .details {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2.5rem;
    align-items: start;
  }

  .stage-column {
    display: grid;
    gap: 1rem;
    justify-items: start;
  }

  .quote {
    margin: 0;
    max-width: 18rem;
  }

  blockquote {
    margin: 0;
    font-family: var(--font-story);
    font-style: italic;
    font-size: 1.35rem;
    line-height: 1.3;
    color: var(--text);
  }

  figcaption {
    margin-top: 0.35rem;
    font-size: 0.85rem;
    color: var(--text-faint);
  }

  dl {
    margin: 0;
    display: grid;
    gap: 0;
  }

  dl > div {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 1rem;
    padding: 0.6rem 0;
    border-bottom: 1px solid var(--line);
  }

  dt {
    color: var(--text-muted);
  }

  dd {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .stats dd {
    font-size: 1.15rem;
  }

  .meta {
    margin-top: 1.75rem;
  }

  .swatch-title {
    font-family: var(--font-body);
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin: 2rem 0 0.75rem;
  }

  .swatches {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.25rem;
  }

  .swatches li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .chip {
    width: 1.4rem;
    height: 1.4rem;
    border-radius: 4px;
    border: 1px solid var(--line-strong);
  }

  .swatch-label {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  @media (max-width: 820px) {
    .details {
      grid-template-columns: 1fr;
    }

    dl > div {
      grid-template-columns: 9rem 1fr;
    }
  }
</style>
