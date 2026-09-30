<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import { site } from "$lib/site";

  const remixCommit = "0e0f4bf5a9c66e5603cda2ce4bd54213023dae21";
</script>

<Seo
  title="About"
  description="What Idle Mine Beyond is, how it is built to match Idle Mine: Remix, and who made the games it comes from."
/>

<article class="container about">
  <header>
    <p class="eyebrow">About</p>
    <h1>A remake that starts by being identical</h1>
    <p class="lede">
      Idle Mine Beyond is a fan-made remake of Idle Mine: Remix. It is free, its
      source code is public, and it is not affiliated with the authors of either
      game.
    </p>
  </header>

  <section>
    <h2>Where it comes from</h2>
    <p>
      <a href={site.originalGame} rel="external">Idle Mine</a> by Crovie is the
      original idle mining game. veprogames rebuilt it as
      <a href={site.remixRepository} rel="external">Idle Mine: Remix</a>, with a
      much longer progression, procedural objects, a Story, more resources and
      late-game systems. Beyond is a remake of the final version of Remix, which
      you can still <a href={site.remixPlay} rel="external">play here</a>.
    </p>
  </section>

  <section>
    <h2>Identical first. Better second.</h2>
    <p>
      The goal of the first release is simple: play exactly like Remix. The
      project pins one exact version of the Remix source code (<code
        >{remixCommit.slice(0, 7)}</code
      >) and treats it as the reference for every rule.
    </p>
    <ul>
      <li>
        Objects, upgrades, Story text and number notations are extracted from
        the original and checked into the project with their source.
      </li>
      <li>
        Formulas are rewritten and then compared, value by value, with what the
        original produces.
      </li>
      <li>
        Pickaxe crafting keeps the original's random rolls in the same order, so
        it feels the same, luck included.
      </li>
      <li>
        Screens are compared pixel by pixel against the original in light and
        dark themes.
      </li>
    </ul>
    <p>
      Improvements, such as new art and quality-of-life features, come after
      that, and the original experience stays available.
    </p>
  </section>

  <section>
    <h2>This site</h2>
    <p>
      The wiki is generated from the same data and code as the game. Object
      sprites are drawn by the game's renderer, upgrade tables come from the
      game's own formulas, and Story chapters are rendered from the original
      text.
    </p>
  </section>

  <section>
    <h2>Credits and licenses</h2>
    <ul>
      <li>
        Idle Mine: Remix by veprogames. Its code, art, text and data are used
        under the
        <a href="/licenses/idle-mine-remix-MIT.txt" rel="external"
          >MIT license</a
        >, © 2023 veprogames.
      </li>
      <li>Idle Mine, the original game and concept, by Crovie.</li>
      <li>
        Number notations by
        <a
          href="https://github.com/antimatter-dimensions/notations"
          rel="external">AD Notations</a
        >, MIT license.
      </li>
      <li>
        Fonts: Montserrat and Work Sans, SIL Open Font License (<a
          href="/fonts/montserrat/OFL.txt"
          rel="external">Montserrat</a
        >,
        <a href="/fonts/worksans/OFL.txt" rel="external">Work Sans</a>).
      </li>
    </ul>
  </section>

  <section>
    <h2>Source code and feedback</h2>
    <p>
      Everything is on <a href={site.repository} rel="external">GitHub</a>,
      including the rules the project follows and the evidence behind each game
      rule. Found something that does not match the original? Open an issue
      there.
    </p>
  </section>
</article>

<style>
  .about {
    max-width: 50rem;
    padding-top: 3.5rem;
  }

  header {
    margin-bottom: 2.5rem;
  }

  section {
    margin-bottom: 2.5rem;
  }

  section p,
  section li {
    color: var(--text-muted);
  }

  ul {
    padding-left: 1.2rem;
    display: grid;
    gap: 0.55rem;
  }
</style>
