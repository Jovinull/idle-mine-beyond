<script lang="ts">
  import { resolve } from "$app/paths";
  import {
    REMIX_OFFLINE_DEFAULT_HOURS,
    REMIX_OFFLINE_MONEY_MULTIPLIER,
    REMIX_OFFLINE_THRESHOLD_SECONDS,
  } from "@idle-mine-beyond/core";
  import Seo from "$lib/components/Seo.svelte";
</script>

<Seo
  title="Mining and offline"
  description="How mining works in Idle Mine Beyond: active and idle damage, defense, breaking objects, Gem and coin drops, autosave and offline earnings, with the game's formulas."
/>

<header class="page-head">
  <p class="eyebrow">Mechanics</p>
  <h1>Mining, drops and time away</h1>
  <p class="lede">
    The rules and formulas below are the ones Idle Mine Beyond runs, checked
    against the original Remix code.
  </p>
</header>

<nav class="toc" aria-label="On this page">
  <a href="#damage">Damage</a>
  <a href="#breaking">Breaking objects</a>
  <a href="#drops">Drops</a>
  <a href="#idle">Idle mining</a>
  <a href="#saving">Saving</a>
  <a href="#offline">Offline earnings</a>
</nav>

<section id="damage">
  <h2>Damage</h2>
  <p>
    Every hit starts from your pickaxe's damage (Power × Quality). Upgrades and
    Powers multiply it, then the object's <strong>defense</strong> is subtracted.
    If the result is zero or less, your hits do nothing: you need a better pickaxe
    or more upgrades before that object can be mined.
  </p>
  <dl class="formulas">
    <div>
      <dt>Click damage</dt>
      <dd>
        <code
          >max(0, pickaxe × Active Power × Power of Mining × Upgrade Damage
          Upgrade − defense) + idle damage per second × Planet Coin Active Power</code
        >
      </dd>
    </div>
    <div>
      <dt>Idle damage</dt>
      <dd>
        <code
          >max(0, pickaxe × Idle Power × Power of Mining × Increasing Damage
          Boost × Upgrade Damage Upgrade − defense)</code
        >
      </dd>
    </div>
    <div>
      <dt>Idle damage per second</dt>
      <dd><code>idle damage × Idle Speed</code></dd>
    </div>
  </dl>
  <p class="aside">
    Power of Mining grows as you play: every click and every idle hit multiply
    it a little. See <a href={resolve("/wiki/powers/")}>Wisdom and Powers</a>.
  </p>
</section>

<section id="breaking">
  <h2>Breaking objects</h2>
  <p>
    When an object's HP reaches zero you get its Money value, the next object
    unlocks, and the same object comes back at full HP. Extra damage from the
    last hit is lost, and the game never moves you to the next object on its
    own; use the arrows when you are ready.
  </p>
</section>

<section id="drops">
  <h2>Drops</h2>
  <ul>
    <li>
      <strong>Gems</strong> can drop from any object. The base chance is 2%; the three
      Gem Chance upgrades raise it, and Gem Multiplication decides how many you get.
      The Gem Bonus upgrade adds more when you mine the highest object you can damage.
    </li>
    <li>
      <strong>Planet Coins</strong> drop only from objects that list them, from the
      first asteroid onward. Each object page shows the chance and amount.
    </li>
    <li>
      <strong>Wisdom</strong> drops from ESSENCE OF WISDOM, several stars and galaxies
      after it, and many procedural universes. Your Power of Wisdom multiplies every
      Wisdom drop.
    </li>
  </ul>
</section>

<section id="idle">
  <h2>Idle mining</h2>
  <p>
    The Auto-Mining-Device hits the current object once every
    <code>1 ÷ Idle Speed</code> seconds. It checks once per animation frame and lands
    at most one hit per frame, so an Idle Speed above your screen's frame rate does
    not add more hits. This is how the original behaves, and Beyond keeps it.
  </p>
  <p>Money per second while idling is:</p>
  <p><code>Money value × Idle Speed ÷ ceil(object HP ÷ idle damage)</code></p>
</section>

<section id="saving">
  <h2>Saving</h2>
  <ul>
    <li>The game saves automatically every 60 seconds.</li>
    <li>Crafting a stronger pickaxe saves right away.</li>
    <li>
      Buying an upgrade does not save by itself. If you close the game right
      after a big purchase, wait for the next autosave or save from Settings
      first.
    </li>
  </ul>
</section>

<section id="offline">
  <h2>Offline earnings</h2>
  <p>
    When you come back after more than {REMIX_OFFLINE_THRESHOLD_SECONDS / 60} minutes,
    the game pays you for the time away, up to {REMIX_OFFLINE_DEFAULT_HOURS} hours
    plus the Offline Time upgrade.
  </p>
  <ul>
    <li>
      Money: {REMIX_OFFLINE_MONEY_MULTIPLIER * 100}% of your idle Money per
      second.
    </li>
    <li>
      Gems and Planet Coins: only with the Offline Gems and Offline Planet Coins
      upgrades, at the rate those upgrades give, rounded down.
    </li>
  </ul>
</section>

<style>
  .page-head {
    margin-bottom: 1.5rem;
  }

  .toc {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 2.5rem;
  }

  .toc a {
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

  section {
    max-width: var(--measure);
    margin-bottom: 2.75rem;
  }

  strong {
    font-weight: 400;
    color: var(--accent);
  }

  ul {
    padding-left: 1.2rem;
    display: grid;
    gap: 0.55rem;
  }

  .formulas {
    margin: 1.25rem 0;
    display: grid;
    gap: 0.9rem;
  }

  .formulas dt {
    font-size: 0.85rem;
    color: var(--text-faint);
    margin-bottom: 0.2rem;
  }

  .formulas dd {
    margin: 0;
  }

  .formulas code {
    display: block;
    padding: 0.7rem 0.9rem;
    line-height: 1.5;
    white-space: normal;
  }

  .aside {
    color: var(--text-muted);
    font-size: 0.97rem;
  }
</style>
