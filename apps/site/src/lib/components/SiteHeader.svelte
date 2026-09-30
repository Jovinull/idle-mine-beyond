<script lang="ts">
  import { resolve } from "$app/paths";
  import { page } from "$app/state";
  import { site } from "$lib/site";
  import ThemeToggle from "./ThemeToggle.svelte";

  const links = [
    { path: "/wiki/" as const, label: "Wiki" },
    { path: "/about/" as const, label: "About" },
  ];

  function current(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(href);
  }
</script>

<header class="site-header">
  <div class="container bar">
    <a class="wordmark" href={resolve("/")} aria-label="{site.name} home">
      <img src="/Images/pickaxe.png" alt="" width="28" height="28" />
      <span>Idle Mine <em>Beyond</em></span>
    </a>
    <nav aria-label="Main">
      <ul>
        {#each links as link (link.path)}
          <li>
            <a
              href={resolve(link.path)}
              aria-current={current(resolve(link.path)) ? "page" : undefined}
              >{link.label}</a
            >
          </li>
        {/each}
        <li>
          <a class="repo" href={site.repository} rel="external">GitHub</a>
        </li>
      </ul>
    </nav>
    <div class="actions">
      <ThemeToggle />
      <a class="button primary play" href={site.playPath} rel="external">Play</a
      >
    </div>
  </div>
</header>

<style>
  .site-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--bg) 92%, transparent);
    backdrop-filter: saturate(1.2) blur(8px);
    border-bottom: 1px solid var(--line);
  }

  .bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    min-height: 3.75rem;
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text);
    text-decoration: none;
    font-family: var(--font-display);
    font-size: 1.15rem;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .wordmark em {
    font-style: normal;
    color: var(--accent);
  }

  nav ul {
    display: flex;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  nav a {
    display: block;
    padding: 0.4rem 0.7rem;
    border-radius: var(--radius);
    color: var(--text-muted);
    text-decoration: none;
  }

  nav a:hover {
    color: var(--text);
    background: var(--bg-sunken);
  }

  nav a[aria-current="page"] {
    color: var(--text);
    background: var(--bg-sunken);
  }

  .actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .play {
    padding: 0.45rem 1rem;
  }

  @media (max-width: 640px) {
    .bar {
      flex-wrap: wrap;
      gap: 0.25rem 1rem;
      padding-block: 0.5rem;
    }

    nav {
      order: 3;
      width: 100%;
      overflow-x: auto;
    }

    nav a {
      padding-inline: 0.55rem;
    }

    .repo {
      display: none;
    }
  }
</style>
