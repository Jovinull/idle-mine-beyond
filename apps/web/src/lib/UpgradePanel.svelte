<script lang="ts">
  import { untrack } from "svelte";
  import {
    REMIX_UPGRADE_KEYS,
    type RemixSimulationState,
    type RemixUpgradePurchaseSimulationAction,
  } from "@idle-mine-beyond/core";
  import upgradePresentation from "@idle-mine-beyond/content/remix-upgrade-presentation";
  import type { NotationFormatter } from "@idle-mine-beyond/formatting";
  import {
    getRemixShopUpgradeDisplay,
    type RemixShopUpgradeGroup,
  } from "$lib/remix-upgrade-display.js";

  type Props = {
    simulation: RemixSimulationState;
    selectedNotation: NotationFormatter;
    selectedGroup: RemixShopUpgradeGroup;
    pressedKeys: readonly string[];
    refreshRevision: number;
    onGroupChange: (group: RemixShopUpgradeGroup) => void;
    onPurchase: (action: RemixUpgradePurchaseSimulationAction) => void;
  };

  type UpgradePresentation = {
    name: string;
    description: string;
    image: string;
    resource: number;
    maxLevel: number | "Infinity";
  };

  type UpgradePresentationData = {
    groups: Record<RemixShopUpgradeGroup, Record<string, UpgradePresentation>>;
  };

  let {
    simulation,
    selectedNotation,
    selectedGroup,
    pressedKeys,
    refreshRevision,
    onGroupChange,
    onPurchase,
  }: Props = $props();
  let highlightedKey = $state<string | null>(null);
  let displayedPressedKeys = $state<string[]>([]);

  $effect(() => {
    if (refreshRevision >= 0) {
      displayedPressedKeys = untrack(() => [...pressedKeys]);
    }
  });

  const presentation = upgradePresentation as UpgradePresentationData;
  const shopGroups = {
    money: { label: "Money Upgrades", icon: "money.png" },
    gems: { label: "Gem Upgrades", icon: "gem.png" },
    planetCoins: { label: "PC Upgrades", icon: "planetcoin.png" },
  } as const;

  function upgradeKeys(group: RemixShopUpgradeGroup): readonly string[] {
    return REMIX_UPGRADE_KEYS[group];
  }

  function upgradeLevel(group: RemixShopUpgradeGroup, key: string): number {
    return (simulation.upgrades[group] as Record<string, number>)[key]!;
  }

  function upgradeDisplay(group: RemixShopUpgradeGroup, key: string) {
    return getRemixShopUpgradeDisplay({
      group,
      key,
      level: upgradeLevel(group, key),
      state: simulation,
      formatter: selectedNotation,
    });
  }

  function buyUpgrade(key: string) {
    displayedPressedKeys = [...pressedKeys];
    const operation = pressedKeys.includes("Control")
      ? { method: "buy100" as const }
      : pressedKeys.includes("Shift")
        ? { method: "buy10" as const }
        : { method: "buy" as const };
    onPurchase({
      type: "upgradePurchase",
      group: selectedGroup,
      key,
      operation,
    } as RemixUpgradePurchaseSimulationAction);
  }
</script>

<section class="upgrade-panel" aria-label="Upgrades">
  {#if simulation.highestMineObjectLevel >= 61}
    <div class="upg-tabs">
      {#each Object.entries(shopGroups) as [group, tab] (group)}
        {#if group === "money" || (group === "gems" && simulation.highestMineObjectLevel >= 61) || (group === "planetCoins" && simulation.highestMineObjectLevel >= 90)}
          <button
            data-upgrade-tab={group}
            aria-pressed={selectedGroup === group}
            onclick={() => {
              displayedPressedKeys = [...pressedKeys];
              highlightedKey = null;
              onGroupChange(group as RemixShopUpgradeGroup);
            }}
          >
            <span class="inline-resource">
              <img class="inline" src={`/Images/${tab.icon}`} alt="" />
              {tab.label}
            </span>
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  <div class="upgradelist-wrapper">
    <div class="upgradelist">
      {#each upgradeKeys(selectedGroup) as key (key)}
        {@const upgrade = presentation.groups[selectedGroup][key]!}
        {@const level = upgradeLevel(selectedGroup, key)}
        {@const display = upgradeDisplay(selectedGroup, key)}
        <!-- Keep the source's pointer-only upgrade div interaction during parity. -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="upgrade"
          class:gem={selectedGroup === "gems"}
          class:pc={selectedGroup === "planetCoins"}
          class:cantafford={!display.affordable}
          data-upgrade-group={selectedGroup}
          data-upgrade-key={key}
          data-upgrade-level={level}
          onmouseenter={() => {
            displayedPressedKeys = [...pressedKeys];
            highlightedKey = key;
          }}
          onmouseleave={() => {
            if (highlightedKey === key) highlightedKey = null;
          }}
          onclick={() => buyUpgrade(key)}
        >
          <img src={`/Images/${upgrade.image}`} alt="" />
          <br />
          <span class="lvl" style="text-align: right; font-size: 110%;">
            {display.levelDisplay}
          </span>
        </div>
      {/each}
    </div>
  </div>

  {#if highlightedKey}
    {@const upgrade = presentation.groups[selectedGroup][highlightedKey]}
    {#if upgrade}
      {@const display = upgradeDisplay(selectedGroup, highlightedKey)}
      <div class="highlightedupgrade" data-upgrade-details={highlightedKey}>
        <div>
          <h3>{upgrade.name}</h3>
          <span>{upgrade.description}</span><br />
          <span><b>{display.effectDisplay}</b></span><br />
          <span><b>{display.priceDisplay}</b></span><br />
        </div>
        <div>
          <p>
            <span
              class="multibuy"
              class:active={displayedPressedKeys.includes("Shift") &&
                !displayedPressedKeys.includes("Control")}
              >Hold SHIFT to buy 10</span
            ><br />
            <span
              class="multibuy"
              class:active={displayedPressedKeys.includes("Control")}
              >Hold CTRL to buy 100</span
            >
          </p>
        </div>
      </div>
    {/if}
  {/if}
</section>

<style>
  .upg-tabs {
    display: flex;
    width: 100%;
    justify-content: center;
  }

  .upg-tabs button {
    margin: 0 1rem;
  }

  .upgradelist-wrapper {
    display: flex;
    justify-content: center;
  }

  .upgradelist {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    justify-content: left;
  }

  .upgrade {
    position: relative;
    display: inline-block;
    margin: 3%;
    padding: 0.4em;
    padding-bottom: 1.05em;
    border: 2px solid black;
    border-radius: 3px;
    background-color: #fbfdff;
    cursor: pointer;
    text-align: center;
    font-size: 75%;
  }

  .upgrade.gem {
    background-color: #9be5f2;
  }

  .upgrade.gem:hover {
    background-color: #7dbbc6 !important;
  }

  .upgrade.pc {
    background-color: #9596f2;
  }

  .upgrade.pc:hover {
    background-color: #7c7dce !important;
  }

  .upgrade .lvl {
    position: absolute;
    right: 0.2rem;
    bottom: 0;
    font-weight: bold;
  }

  .upgrade.cantafford {
    cursor: auto;
    opacity: 0.3;
  }

  .upgrade:hover:not(.cantafford) {
    background-color: #e2e4e6;
  }

  .upgrade img {
    height: 4em;
  }

  .highlightedupgrade {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    line-height: 1.1em;
  }

  .highlightedupgrade h3 {
    margin: 0;
    font-family: Montserrat, sans-serif;
  }

  .highlightedupgrade .multibuy {
    color: #505050;
    font-size: 80%;
  }

  .highlightedupgrade .multibuy.active {
    color: #00bc00;
  }

  :global(body[data-theme="dark"]) .upgrade {
    background-color: #4d4d4d;
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) .upgrade:hover {
    background-color: #636363;
  }

  :global(body[data-theme="dark"]) .upgrade.gem {
    background-color: #005177;
  }

  :global(body[data-theme="dark"]) .upgrade.gem:hover {
    background-color: #0071a4 !important;
  }

  :global(body[data-theme="dark"]) .upgrade.pc {
    background-color: #2733a3;
  }

  :global(body[data-theme="dark"]) .upgrade.pc:hover {
    background-color: #2c3dc3 !important;
  }

  :global(body[data-theme="dark"]) .upg-tabs button {
    background-color: #636363;
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) .upg-tabs button:hover {
    background-color: #636363;
  }

  :global(body[data-theme="dark"]) .highlightedupgrade .multibuy:not(.active) {
    color: #c1c1c1;
  }
</style>
