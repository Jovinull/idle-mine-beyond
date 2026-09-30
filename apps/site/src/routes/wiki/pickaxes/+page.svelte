<script lang="ts">
  import { resolve } from "$app/paths";
  import ResourceIcon from "$lib/components/ResourceIcon.svelte";
  import Seo from "$lib/components/Seo.svelte";

  // (gems − 1) / 5 + 1, the Power multiplier from the Gems put into a craft.
  const gemExamples = [1, 3, 6, 11, 26, 101].map((gems) => ({
    gems,
    multiplier: (gems - 1) / 5 + 1,
  }));
  // Chance that the Quality bonus streak reaches n rolls (50% each, max 15).
  const streaks = [0, 1, 2, 3, 5, 10, 15].map((rolls) => ({
    rolls,
    bonus: 1.15 ** rolls,
    chance: rolls === 15 ? 0.5 ** 15 : 0.5 ** (rolls + 1),
  }));
</script>

<Seo
  title="Pickaxe crafting"
  description="How pickaxe crafting works in Idle Mine Beyond: Gems in, a random pickaxe out. Power, Quality, damage, duds and the Quality streak, as in Idle Mine: Remix."
/>

<header class="page-head">
  <p class="eyebrow">Pickaxe crafting</p>
  <h1>Gems in, a random pickaxe out</h1>
  <p class="lede">
    Crafting is the game's only way to get a stronger pickaxe, and it is random
    on purpose. You spend Gems, the Blacksmith rolls a new pickaxe, and you keep
    it only if it beats the one you hold.
  </p>
</header>

<section>
  <h2>What a pickaxe is</h2>
  <p>
    A pickaxe has a name, a <strong>Power</strong> and a
    <strong>Quality</strong>. Its damage is simply Power × Quality. That number,
    multiplied by your upgrades and Powers and reduced by the object's defense,
    is what each hit does. See
    <a href={resolve("/wiki/mechanics/")}>Mining and offline</a>.
  </p>
</section>

<section>
  <h2>How a craft works</h2>
  <ol class="steps">
    <li>
      You pay Gems <ResourceIcon kind="gems" decorative />. One Gem by default;
      the Gem Waster upgrades let you choose to spend more per craft.
    </li>
    <li>
      More Gems raise Power: the craft multiplies it by
      <code>(Gems − 1) ÷ 5 + 1</code>. Blacksmith and Blacksmith Skill raise the
      minimum Power and Quality, and Blacksmith Expertise has a 25% chance to
      add bonus points worth 15% Power each.
    </li>
    <li>
      Quality gets a streak bonus: the game flips a 50% coin, and every win
      multiplies Quality by 1.15. The streak stops at the first loss or after 15
      wins.
    </li>
    <li>
      The new pickaxe replaces yours only if its damage is strictly higher. An
      equal or weaker result is a <em>dud</em>: the Gems are spent and you keep
      your old pickaxe.
    </li>
    <li>
      With the Bulk Crafting upgrade (Planet Coins), hold <kbd>Shift</kbd> while crafting
      to craft several pickaxes at once.
    </li>
  </ol>
</section>

<div class="tables">
  <section>
    <h3>Gems spent and Power</h3>
    <table>
      <thead>
        <tr><th scope="col">Gems</th><th scope="col">Power multiplier</th></tr>
      </thead>
      <tbody>
        {#each gemExamples as row (row.gems)}
          <tr><td>{row.gems}</td><td>×{row.multiplier}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
  <section>
    <h3>Quality streak</h3>
    <table>
      <thead>
        <tr>
          <th scope="col">Wins</th>
          <th scope="col">Quality bonus</th>
          <th scope="col">Chance</th>
        </tr>
      </thead>
      <tbody>
        {#each streaks as row (row.rolls)}
          <tr>
            <td>{row.rolls}</td>
            <td>×{row.bonus.toFixed(2)}</td>
            <td
              >{row.chance >= 0.001
                ? `${(row.chance * 100).toFixed(1)}%`
                : `1 in ${Math.round(1 / row.chance).toLocaleString("en")}`}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </section>
</div>

<section>
  <h2>Names</h2>
  <p>
    Every pickaxe gets a generated name. It depends on the Quality tier, a
    random name pattern and sometimes a mine object, with a suffix when
    Expertise adds a bonus. That is why you see pickaxes like “Bad Mud Pick”
    early on.
  </p>
</section>

<aside class="note">
  <h2>Why it stays random</h2>
  <p>
    Idle Mine Beyond keeps the Remix crafting rules exactly, including the order
    of every random roll. Two players with the same Gems can craft very
    different pickaxes, just like in the original.
  </p>
</aside>

<style>
  .page-head {
    margin-bottom: 2rem;
  }

  section,
  .note {
    max-width: var(--measure);
    margin-bottom: 2.25rem;
  }

  strong {
    font-weight: 400;
    color: var(--accent);
  }

  .steps {
    padding-left: 1.3rem;
    display: grid;
    gap: 0.75rem;
  }

  .tables {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
    gap: 2rem;
    margin-bottom: 2.25rem;
  }

  .tables section {
    margin: 0;
  }

  .note {
    padding: 1.1rem 1.3rem;
    border-left: 3px solid var(--accent);
    background: var(--bg-raised);
    border-radius: 0 var(--radius) var(--radius) 0;
  }

  .note h2 {
    font-size: 1.1rem;
  }

  .note p {
    margin: 0;
    color: var(--text-muted);
  }
</style>
