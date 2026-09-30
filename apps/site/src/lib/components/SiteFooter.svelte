<script lang="ts">
  import { resolve } from "$app/paths";
  import { site } from "$lib/site";
</script>

<footer class="site-footer">
  <div class="container grid">
    <div class="about">
      <p class="name">Idle Mine <em>Beyond</em></p>
      <p>
        An unofficial remake of <a href={site.remixRepository} rel="external"
          >Idle Mine: Remix</a
        >
        by veprogames, which is itself a remix of
        <a href={site.originalGame} rel="external">Idle Mine</a> by Crovie. Not affiliated
        with either author.
      </p>
      <p class="fine">
        Game art, text and data from Idle Mine: Remix are used under its
        <a href="/licenses/idle-mine-remix-MIT.txt" rel="external"
          >MIT license</a
        >, © 2023 veprogames. Number notations by
        <a
          href="https://github.com/antimatter-dimensions/notations"
          rel="external">AD Notations</a
        >.
      </p>
    </div>
    <nav aria-label="Footer">
      <h2>Play</h2>
      <ul>
        <li><a href={site.playPath} rel="external">Play in browser</a></li>
        <li><a href={resolve("/about/")}>About the project</a></li>
        <li><a href={site.repository} rel="external">Source code</a></li>
      </ul>
    </nav>
    <nav aria-label="Wiki">
      <h2>Wiki</h2>
      <ul>
        <li><a href={resolve("/wiki/objects/")}>Mine objects</a></li>
        <li><a href={resolve("/wiki/upgrades/")}>Upgrades</a></li>
        <li><a href={resolve("/wiki/story/")}>Story</a></li>
        <li><a href={resolve("/wiki/notations/")}>Notations</a></li>
      </ul>
    </nav>
  </div>
</footer>

<style>
  .site-footer {
    margin-top: 6rem;
    border-top: 1px solid var(--line);
    background: var(--bg-sunken);
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .grid {
    display: grid;
    grid-template-columns: 2.2fr 1fr 1fr;
    gap: 2.5rem;
    padding-block: 3rem 3.5rem;
  }

  .name {
    font-family: var(--font-display);
    font-size: 1.15rem;
    color: var(--text);
    margin-bottom: 0.75rem;
  }

  .name em {
    font-style: normal;
    color: var(--accent);
  }

  .about p {
    max-width: 52ch;
  }

  .fine {
    font-size: 0.85rem;
    color: var(--text-faint);
  }

  h2 {
    font-family: var(--font-body);
    font-size: 0.78rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-faint);
    margin-bottom: 0.9rem;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.45rem;
  }

  a {
    color: var(--text-muted);
  }

  a:hover {
    color: var(--text);
  }

  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }

    .about {
      grid-column: 1 / -1;
    }
  }
</style>
