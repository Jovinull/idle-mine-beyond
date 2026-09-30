<script lang="ts">
  import { resolve } from "$app/paths";
  import presentation from "@idle-mine-beyond/content/remix-upgrade-presentation";
  import { calculateRemixPowerPrestigeEffect } from "@idle-mine-beyond/core";
  import Num from "$lib/components/Num.svelte";
  import Seo from "$lib/components/Seo.svelte";
  import { objectAt } from "$lib/data/objects";
  import { objectPath } from "$lib/links";

  const unlockLevel = presentation.powers.unlockAtHighestMineObjectLevel;
  const unlockObject = unlockLevel - 1;
  const effects = [
    "Multiplies all active and idle damage. It grows by itself: every active click and every idle hit multiplies it, and the Power Power Wisdom upgrades raise that growth.",
    "Multiplies the effect of the Money Blacksmith upgrade, so crafted pickaxes get more Power.",
    "Multiplies the effect of the Money Blacksmith Skill upgrade, so crafted pickaxes get more Quality.",
    "Multiplies every Wisdom drop you collect.",
    "Multiplies Gem Multiplication, so each Gem drop is worth more.",
  ];
  const powers = presentation.powers.names.map((name, index) => ({
    name,
    icon: `/Images/${presentation.powers.icons[index]}`,
    effect: effects[index] ?? "",
  }));
  const examples = [1e3, 1e6, 1e9, 1e15];
</script>

<Seo
  title="Wisdom and Powers"
  description="How the five Powers work in Idle Mine Beyond: what each one multiplies, when the Powers tab opens, and how prestiging a Power sets the next one."
/>

<header class="page-head">
  <p class="eyebrow">Wisdom and Powers</p>
  <h1>Five Powers, one chain</h1>
  <p class="lede">
    The Powers tab opens once you break
    <a href={resolve(objectPath(unlockObject))}>{objectAt(unlockObject).name}</a
    >
    (object #{unlockObject + 1}). From there, objects can drop Wisdom, which
    buys the <a href={resolve("/wiki/upgrades/wisdom/")}>Wisdom upgrades</a>.
  </p>
</header>

<ol class="powers">
  {#each powers as power, index (power.name)}
    <li>
      <img src={power.icon} alt="" width="44" height="44" />
      <div>
        <h2>{power.name}</h2>
        <p>{power.effect}</p>
      </div>
      <span class="order" aria-hidden="true">{index + 1}</span>
    </li>
  {/each}
</ol>

<section>
  <h2>Prestiging a Power</h2>
  <p>
    Each of the first four Powers can be prestiged into the one after it. The
    button appears once the Power reaches 1,000, or when the next Power is
    already above 1. Prestiging sets the next Power to a target and drops the
    current one back down; the Power Prestige Retainment upgrade decides how
    much it keeps. If the next Power already meets the target, the button is
    disabled.
  </p>
  <p>
    For row <var>i</var> (Mining is 0), the target is
    <code>max((value ÷ 1000)<sup>0.5 − 0.1·i</sup>, 1)</code>. Prestiging Power
    of Wisdom gives Power of Exquisity <code>log₁₀(target) + 1</code> instead.
  </p>

  <div class="table-wrap">
    <table>
      <caption>Prestige targets for some current values</caption>
      <thead>
        <tr>
          <th scope="col">Prestige</th>
          {#each examples as value (value)}
            <th scope="col">from <Num {value} precision={0} /></th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each [0, 1, 2, 3] as index (index)}
          <tr>
            <td
              >{powers[index]?.name} → {powers[index + 1]?.name.replace(
                "Power of ",
                "",
              )}</td
            >
            {#each examples as value (value)}
              <td
                ><Num
                  value={calculateRemixPowerPrestigeEffect(
                    value,
                    index as 0 | 1 | 2 | 3,
                  )}
                /></td
              >
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>

<style>
  .page-head {
    margin-bottom: 2rem;
  }

  .powers {
    list-style: none;
    margin: 0 0 3rem;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }

  .powers li {
    position: relative;
    display: flex;
    gap: 1.1rem;
    align-items: flex-start;
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--line);
    border-radius: var(--radius-lg);
    background: var(--bg-raised);
  }

  .powers h2 {
    font-size: 1.2rem;
    margin: 0.15rem 0 0.35rem;
  }

  .powers p {
    margin: 0;
    color: var(--text-muted);
  }

  .order {
    position: absolute;
    right: 1.1rem;
    top: 0.9rem;
    font-family: var(--font-display);
    font-size: 1.6rem;
    color: var(--line-strong);
  }

  section p {
    max-width: var(--measure);
  }

  caption {
    text-align: left;
    color: var(--text-faint);
    font-size: 0.9rem;
    padding-bottom: 0.5rem;
  }

  .table-wrap {
    overflow-x: auto;
    margin-top: 1.5rem;
  }
</style>
