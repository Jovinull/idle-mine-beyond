<script lang="ts">
  import { resolve } from "$app/paths";
  import HeroObject from "$lib/components/HeroObject.svelte";
  import MineObject from "$lib/components/MineObject.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { fixedObjects, objectAt } from "$lib/data/objects";
  import { chapters, milestones, storyQuotes } from "$lib/data/story";
  import { upgradeCount } from "$lib/data/upgrades";
  import { formatters } from "$lib/notation.svelte";
  import { chapterPath } from "$lib/links";
  import { site } from "$lib/site";

  const descent = chapters.map((title, page) => ({
    page,
    title,
    levels: [
      ...new Set(
        storyQuotes.filter((quote) => quote.page === page).map((q) => q.level),
      ),
    ].slice(0, 3),
  }));

  const features = [
    {
      icon: "/Images/pickaxe.png",
      title: "Mine",
      text: "Click the object to hit it. Break it for Money, unlock the next one, and keep going. Your Auto-Mining-Device keeps hitting on its own.",
    },
    {
      icon: "/Images/upgrades/blacksmith.png",
      title: "Craft",
      text: "Spend Gems on a random pickaxe. Most crafts are small steps, some are duds, and a lucky Quality streak can jump you far ahead.",
    },
    {
      icon: "/Images/gem.png",
      title: "Upgrade",
      text: `${upgradeCount} upgrades across Money, Gems, Planet Coins and Wisdom, each shop opening as you reach it.`,
    },
    {
      icon: "/Images/wisdom.png",
      title: "Grow your Powers",
      text: `Past ${objectAt(169).name}, collect Wisdom and push five Powers up a prestige chain.`,
    },
    {
      icon: "/Images/story.png",
      title: "Follow the Story",
      text: `${chapters.length} chapters and ${milestones.length} milestones tell you where you are and what to aim for next.`,
    },
    {
      icon: "/Images/money.png",
      title: "Come back later",
      text: "Close the tab and come back to offline earnings for up to six hours, more with upgrades.",
    },
  ];

  const facts = [
    { value: String(fixedObjects.length), label: "hand-made objects" },
    { value: "∞", label: "generated after them" },
    { value: String(upgradeCount), label: "upgrades" },
    { value: String(formatters.length), label: "number notations" },
  ];
</script>

<Seo description={site.description} />

<section class="hero container">
  <div class="intro">
    <p class="eyebrow">Unofficial remake of Idle Mine: Remix</p>
    <h1>Mine your way from Mud to THE&nbsp;UNIVERSE.</h1>
    <p class="lede">
      Idle Mine Beyond rebuilds the browser idle game object for object and
      formula for formula. Free, in your browser, no account.
    </p>
    <div class="cta">
      <a class="button primary big" href={site.playPath} rel="external"
        >Play now</a
      >
      <a class="button big" href={resolve("/wiki/")}>Browse the wiki</a>
    </div>
    <p class="small">
      Your game saves in this browser. Coming from Idle Mine: Remix? Import your
      save from Settings.
    </p>
  </div>
  <HeroObject />
</section>

<section class="descent" aria-labelledby="descent-title">
  <div class="container">
    <div class="section-head">
      <h2 id="descent-title">Nine chapters deep</h2>
      <p class="muted">
        Every object you break unlocks a tougher one. The Story follows you from
        a lump of Mud to planets, stars and galaxies.
      </p>
    </div>
  </div>
  <ol class="strata">
    {#each descent as chapter (chapter.page)}
      <li>
        <a href={resolve(chapterPath(chapter.page))}>
          <span class="chapter">Chapter {chapter.page + 1}</span>
          <span class="sprites" aria-hidden="true">
            {#each chapter.levels as level (level)}
              <MineObject {level} name="" width={50} />
            {/each}
          </span>
          <span class="title">{chapter.title}</span>
        </a>
      </li>
    {/each}
  </ol>
</section>

<section class="container features" aria-labelledby="features-title">
  <div class="section-head">
    <h2 id="features-title">How it plays</h2>
  </div>
  <ul>
    {#each features as feature (feature.title)}
      <li>
        <img src={feature.icon} alt="" width="48" height="48" />
        <h3>{feature.title}</h3>
        <p>{feature.text}</p>
      </li>
    {/each}
  </ul>
</section>

<section class="container approach" aria-labelledby="approach-title">
  <div class="approach-text">
    <p class="eyebrow">The approach</p>
    <h2 id="approach-title">{site.motto}</h2>
    <p>
      Beyond is being rebuilt against the original Remix code, pinned to one
      exact version. Every object, upgrade formula and Story milestone is
      extracted from it and tested against it, down to the order of the random
      rolls in pickaxe crafting.
    </p>
    <p>
      Once the remake plays exactly like the original, improvements come on top,
      without taking the original experience away.
      <a href={resolve("/about/")}>Read more about the project</a>.
    </p>
  </div>
  <dl class="facts">
    {#each facts as fact (fact.label)}
      <div>
        <dt>{fact.label}</dt>
        <dd>{fact.value}</dd>
      </div>
    {/each}
  </dl>
</section>

<section class="container closing">
  <h2>Ready to dig?</h2>
  <p class="muted">It starts with a single piece of Mud.</p>
  <div class="cta">
    <a class="button primary big" href={site.playPath} rel="external"
      >Play now</a
    >
    <a class="button big" href={site.repository} rel="external"
      >Source on GitHub</a
    >
  </div>
</section>

<style>
  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: center;
    padding-block: clamp(3rem, 8vw, 6rem) clamp(3rem, 6vw, 5rem);
  }

  .hero h1 {
    font-size: clamp(2.5rem, 5.4vw, 4rem);
    line-height: 1.04;
    margin-bottom: 1.25rem;
  }

  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 2rem 0 1.25rem;
  }

  .big {
    padding: 0.85rem 1.5rem;
    font-size: 1.05rem;
  }

  .small {
    font-size: 0.92rem;
    color: var(--text-faint);
    max-width: 44ch;
  }

  .section-head {
    max-width: 48rem;
    margin-bottom: 2rem;
  }

  .section-head p {
    font-size: 1.1rem;
  }

  .descent {
    padding-block: 4.5rem;
    border-block: 1px solid var(--line);
    background: var(--bg-sunken);
  }

  .strata {
    list-style: none;
    margin: 0;
    padding: 0.25rem max(var(--gutter), calc((100vw - var(--page)) / 2)) 1rem;
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(12.5rem, 1fr);
    gap: 0.75rem;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    scroll-padding-inline: max(var(--gutter), calc((100vw - var(--page)) / 2));
  }

  .strata li {
    scroll-snap-align: start;
  }

  .strata a {
    display: grid;
    gap: 0.9rem;
    height: 100%;
    padding: 1.1rem 1.1rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
    color: var(--text);
    text-decoration: none;
    transition:
      border-color 120ms,
      transform 120ms;
  }

  .strata a:hover {
    border-color: var(--line-strong);
    transform: translateY(-2px);
  }

  .chapter {
    font-size: 0.75rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .sprites {
    display: flex;
    justify-content: center;
    gap: 0.2rem;
    min-height: 4.25rem;
    padding: 0.4rem;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius);
  }

  .strata .title {
    font-family: var(--font-display);
    font-size: 1.1rem;
    line-height: 1.25;
  }

  .features {
    padding-block: 5rem 2rem;
  }

  .features ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
    gap: 2.25rem 2.5rem;
  }

  .features img {
    display: block;
    margin-bottom: 0.9rem;
  }

  .features h3 {
    margin-bottom: 0.4rem;
  }

  .features p {
    color: var(--text-muted);
    margin: 0;
  }

  .approach {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
    gap: 3rem;
    align-items: center;
    margin-top: 4rem;
    padding: clamp(1.75rem, 4vw, 3rem);
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--bg-raised);
  }

  .approach-text p:not(.eyebrow) {
    color: var(--text-muted);
  }

  .facts {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 2rem;
  }

  .facts div {
    display: flex;
    flex-direction: column-reverse;
    border-top: 1px solid var(--line);
    padding-top: 0.8rem;
  }

  .facts dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: 2.4rem;
    line-height: 1.1;
    color: var(--accent);
  }

  .facts dt {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .closing {
    text-align: center;
    padding-top: 6rem;
  }

  .closing .cta {
    justify-content: center;
  }

  @media (max-width: 880px) {
    .hero,
    .approach {
      grid-template-columns: 1fr;
    }
  }
</style>
