<script lang="ts">
  import {
    Decimal,
    REMIX_UPGRADE_KEYS,
    getRemixPowerPrestigeRows,
    type DecimalSource,
    type RemixPowerPrestigeIndex,
    type RemixSimulationState,
    type RemixUpgradeKey,
  } from "@idle-mine-beyond/core";
  import upgradePresentation from "@idle-mine-beyond/content/remix-upgrade-presentation";
  import type { NotationFormatter } from "@idle-mine-beyond/formatting";
  import { getRemixWisdomUpgradeDisplay } from "$lib/remix-upgrade-display.js";

  type Props = {
    simulation: RemixSimulationState;
    powerValueExtras: readonly DecimalSource[];
    selectedNotation: NotationFormatter;
    pressedKeys: readonly string[];
    formatNumber: (
      value: DecimalSource,
      precision?: number,
      limit?: DecimalSource,
      below1000?: number,
    ) => string;
    onPrestige: (index: RemixPowerPrestigeIndex) => void;
    onUpgrade: (key: RemixUpgradeKey<"wisdom">, amount: 1 | 10 | 100) => void;
  };

  type PowerPresentation = {
    powers: { names: string[]; icons: string[] };
  };

  let {
    simulation,
    powerValueExtras,
    selectedNotation,
    pressedKeys,
    formatNumber,
    onPrestige,
    onUpgrade,
  }: Props = $props();

  const presentation = upgradePresentation as PowerPresentation;
  const upgradeKeys = REMIX_UPGRADE_KEYS.wisdom;
  const prestigeRows = $derived(
    getRemixPowerPrestigeRows(simulation, powerValueExtras),
  );
  const buyAmount = $derived(
    pressedKeys.includes("Control")
      ? 100
      : pressedKeys.includes("Shift")
        ? 10
        : 1,
  );
  const wisdom = $derived(simulation.resources.wisdom ?? new Decimal(0));
</script>

<article class="powers" data-powers-panel>
  <p class="wisdom" data-wisdom-balance>
    <span class="inline-resource">
      You have <img class="inline" src="/Images/wisdom.png" alt="" />
      {formatNumber(wisdom, 2, "1e12", 0)}
    </span>
  </p>
  <p>
    With <img class="inline" src="/Images/wisdom.png" alt="" /> wisdom, you are able
    to become smart enough to become stronger with every click! Get smart in all areas
    of mining to get to heights no one has thought of yet.
  </p>

  <table class="powers-table">
    <tbody>
      {#each prestigeRows as row (`${row.index}:${row.currentValue.toString()}`)}
        <tr data-power-row={row.index}>
          <td>{presentation.powers.names[row.index]}</td>
          <td>
            <img
              class="inline"
              src={`/Images/${presentation.powers.icons[row.index]}`}
              alt=""
            />
            x {formatNumber(row.currentValue, 2, "1e9", 3)}
          </td>
          <td>
            {#if row.index < 4}
              {#if row.buttonVisible && row.prestigeEffect}
                <button
                  data-power-prestige={row.index}
                  disabled={row.buttonDisabled}
                  onclick={() =>
                    onPrestige(row.index as RemixPowerPrestigeIndex)}
                >
                  Prestige: x{formatNumber(row.prestigeEffect, 2, "1e9", 2)}
                </button>
              {:else}
                <span>Req. x{formatNumber(1e3, 0)}</span>
              {/if}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  <div class="powers-upgrades">
    {#each upgradeKeys as key (key)}
      {@const display = getRemixWisdomUpgradeDisplay({
        key,
        state: simulation,
        formatter: selectedNotation,
      })}
      <button
        class="upgrade-standalone"
        data-wisdom-upgrade={key}
        data-upgrade-level={display.level}
        onclick={() => onUpgrade(key, buyAmount as 1 | 10 | 100)}
      >
        <h4>
          {display.name}
          {#if buyAmount > 1}<span>{buyAmount}</span>{/if}
          {#if Number.isFinite(display.maxLevel)}<span>
              {display.level} / {display.maxLevel}
            </span>{/if}
        </h4>
        <p class="description">{display.description}</p>
        <p>{display.effectDisplay}</p>
        <p>
          <img class="inline" src="/Images/wisdom.png" alt="" />
          {display.priceDisplay}
        </p>
      </button>
    {/each}
  </div>
</article>

<style>
  article.powers {
    box-sizing: border-box;
    height: 84vh;
    overflow-y: auto;
    padding: 0.5rem;
  }

  article.powers p {
    padding: 0 1em;
  }

  article.powers p.wisdom {
    font-size: 150%;
    text-align: center;
  }

  table.powers-table {
    margin: auto;
    font-size: 130%;
  }

  table.powers-table td {
    padding: 0.2em 0.2em 0.2em 0.5em;
    border: 1px solid #000;
  }

  table.powers-table td:nth-child(2) {
    min-width: 6em;
  }

  .powers-upgrades {
    display: flex;
    height: 30vh;
    flex-wrap: wrap;
    justify-content: space-between;
    overflow-y: scroll;
    margin-right: 1em;
  }

  button.upgrade-standalone {
    width: 40%;
    margin: 1em;
  }

  .upgrade-standalone p {
    margin: 0.15em 0;
  }

  .upgrade-standalone .description {
    font-size: 70%;
  }

  :global(body[data-theme="dark"]) table.powers-table td {
    border-color: #c1c1c1;
  }
</style>
