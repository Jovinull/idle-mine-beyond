<script lang="ts">
  import { onMount } from "svelte";
  import {
    Decimal,
    calculateRemixPickaxeCraft,
    calculateRemixMiningRates,
    getRemixCraftGemSelectionControls,
    getRemixMineObject,
    isRemixPowersUnlocked,
    resolveRemixMiningInput,
    transitionRemixStoryTab,
    type DecimalSource,
    type RemixMineObjectCatalog,
    type RemixSimulationAction,
    type RemixStoryConditionState,
    type RemixStoryInteractionEffect,
    type RemixStoryMilestone,
    type RemixPowerPrestigeIndex,
    type RemixUpgradeKey,
    type RemixUpgradeContext,
  } from "@idle-mine-beyond/core";
  import mineObjectContent from "@idle-mine-beyond/content/remix-mine-content";
  import legacySaveTemplateContent from "@idle-mine-beyond/content/remix-legacy-save-template";
  import storyMilestoneContent from "@idle-mine-beyond/content/remix-story-milestones";
  import {
    createRemixFormatters,
    formatNumber as formatRemixNumber,
    formatPercent as formatRemixPercent,
    formatThousands,
    type NotationFormatter,
  } from "@idle-mine-beyond/formatting";
  import type { RemixLegacySaveApplicationState } from "@idle-mine-beyond/persistence";
  import MineObjectCanvas from "$lib/MineObjectCanvas.svelte";
  import StoryPanel from "$lib/StoryPanel.svelte";
  import SettingsPanel from "$lib/SettingsPanel.svelte";
  import UpgradePanel from "$lib/UpgradePanel.svelte";
  import PowersPanel from "$lib/PowersPanel.svelte";
  import {
    createRemixWebGameSession,
    type RemixWebGameSession,
    type RemixWebSessionEffect,
  } from "$lib/platform/remix-game-session.js";
  import {
    clearBrowserRemixStorage,
    createBrowserRemixSaveStorage,
    readBrowserRemixLegacySave,
    readRemixRecoveryData,
  } from "$lib/platform/remix-save-storage.js";
  import {
    clearTauriRemixSaveStorage,
    createTauriRemixSaveStorage,
    getRemixTauriInvoke,
    type RemixTauriWindow,
  } from "$lib/platform/remix-tauri-save-storage.js";

  type SessionStatus = "loading" | "ready" | "recovery" | "error";
  type StoryLogEffect = Extract<
    RemixStoryInteractionEffect,
    { type: "logMessage" }
  >;
  type DisplayMessage = { message: string; color: string };

  const catalog = mineObjectContent as unknown as RemixMineObjectCatalog;
  const storyMilestones =
    storyMilestoneContent.milestones as RemixStoryMilestone[];
  const formatters = createRemixFormatters();

  let appState = $state<RemixLegacySaveApplicationState>();
  let gameSession: RemixWebGameSession | undefined;
  let sessionStatus = $state<SessionStatus>("loading");
  let recoveryMessage = $state("");
  let recoveryActionMessage = $state("");
  let recoverySaveString = $state("");
  let recoveryBeyondFileText = $state("");
  let recoveryBeyondFileName = $state("");
  let recoveryBundleText = $state("");
  let recoveryCopyAcknowledged = $state(false);
  let actionError = $state("");
  let messages = $state<DisplayMessage[]>([]);
  let pressedKeys = $state<string[]>([]);
  let resumeAnimation: (() => void) | undefined;
  let recoveryReader: (() => Promise<string>) | undefined;

  const simulation = $derived(appState?.simulation);
  const craftGemSelection = $derived.by(() =>
    simulation ? getRemixCraftGemSelectionControls(simulation) : undefined,
  );
  const selectedNotation = $derived.by<NotationFormatter>(() => {
    const index = appState?.settings.numberFormatterIndex ?? 0;
    return formatters[index] ?? formatters[0]!;
  });
  const miningRates = $derived.by(() => {
    if (!simulation) return undefined;
    const resolved = resolveRemixMiningInput({ state: simulation, catalog });
    return calculateRemixMiningRates(resolved.mining);
  });
  const storyConditionState = $derived.by<RemixStoryConditionState | undefined>(
    () => {
      if (!simulation) return undefined;
      return {
        highestMineObjectLevel: simulation.highestMineObjectLevel,
        highestMoney: simulation.resources.highestMoney,
        maxPlanetCoins: simulation.resources.maxPlanetCoins,
        moneyUpgradeLevels: simulation.upgrades.money,
        wisdomUpgradeLevels: simulation.upgrades.wisdom,
      };
    },
  );
  const minimumCraftDamage = $derived.by(() => {
    if (!simulation) return new Decimal(0);
    const context: RemixUpgradeContext = {
      levels: simulation.upgrades,
      powers: {
        craftsmanship: simulation.powers.craftsmanship,
        expertise: simulation.powers.expertise,
        exquisity: simulation.powers.exquisity,
      },
      highestMineObjectLevel: simulation.highestMineObjectLevel,
    };
    return calculateRemixPickaxeCraft({
      gems: craftGemSelection?.gemCost ?? 1,
      context,
      mode: { kind: "minimum" },
    }).damage;
  });

  function formatNumber(
    value: DecimalSource,
    precision = 2,
    limit: DecimalSource = "1e12",
    below1000?: number,
  ): string {
    return formatRemixNumber(
      value,
      selectedNotation,
      precision,
      limit,
      below1000,
    );
  }

  function formatPercent(value: DecimalSource, precision = 1): string {
    return formatRemixPercent(value, selectedNotation, precision);
  }

  async function dispatch(action: RemixSimulationAction) {
    if (!gameSession) return;
    actionError = "";
    try {
      const result = await gameSession.dispatch(action);
      if (result.status === "recoveryRequired") {
        sessionStatus = "recovery";
        recoveryMessage =
          result.initialization.status === "recoveryRequired"
            ? result.initialization.reason
            : "The save could not be loaded safely.";
      } else {
        appState = result.state;
        if (result.status === "persistenceFailed") {
          actionError = `Save failed: ${result.persistence.status}`;
        }
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function updateApplicationState(
    update: (
      current: RemixLegacySaveApplicationState,
    ) => RemixLegacySaveApplicationState,
  ) {
    if (!gameSession) return;
    const result = await gameSession.updateApplicationState(update);
    if (result.status === "updated") appState = result.state;
    else {
      sessionStatus = "recovery";
      recoveryMessage =
        result.initialization.status === "recoveryRequired"
          ? result.initialization.reason
          : "The save could not be loaded safely.";
    }
  }

  async function changeNumberFormatter(index: number) {
    await updateApplicationState((state) => ({
      ...state,
      settings: { ...state.settings, numberFormatterIndex: index },
    }));
  }

  async function changePreference(
    key: "showMineObjLevel" | "showMinCraftDamage",
    value: boolean,
  ) {
    await updateApplicationState((state) => ({
      ...state,
      settings: { ...state.settings, [key]: value },
    }));
  }

  async function changeTheme(theme: "light" | "dark") {
    await updateApplicationState((state) => ({
      ...state,
      settings: { ...state.settings, theme },
    }));
    if (!gameSession || sessionStatus !== "ready") return;
    document.body.dataset.theme = theme;
    await saveCurrentState();
  }

  async function saveCurrentState() {
    if (!gameSession) return;
    actionError = "";
    try {
      const result = await gameSession.saveNow();
      if (result.status === "recoveryRequired") {
        sessionStatus = "recovery";
        recoveryMessage =
          result.initialization.status === "recoveryRequired"
            ? result.initialization.reason
            : "The save could not be loaded safely.";
      } else {
        appState = result.state;
        if (result.status === "persistenceFailed") {
          actionError = `Save failed: ${result.persistence.status}`;
        }
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function exportCurrentSave() {
    if (!gameSession) return;
    actionError = "";
    try {
      const result = await gameSession.exportLegacySave(messages);
      if (result.status === "recoveryRequired") {
        sessionStatus = "recovery";
        recoveryMessage =
          result.initialization.status === "recoveryRequired"
            ? result.initialization.reason
            : "The save could not be loaded safely.";
      } else {
        appState = result.state;
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function importCurrentSave(saveString: string) {
    if (!gameSession) return;
    actionError = "";
    try {
      const result = await gameSession.importLegacySave(saveString);
      if (result.status === "recoveryRequired") {
        sessionStatus = "recovery";
        recoveryMessage =
          result.initialization.status === "recoveryRequired"
            ? result.initialization.reason
            : "The save could not be loaded safely.";
        return;
      }
      if (result.status === "legacyLoadFailed") {
        const failure = result.result.result;
        if (failure.status === "invalidEncoding") {
          window.alert(
            `Error loading Game: ${failure.decodeError.name}: ${failure.decodeError.message}`,
          );
        }
        actionError = failure.parseError.message;
        return;
      }

      appState = result.state;
      if (result.result.status === "persistenceFailed") {
        actionError = `Save failed: ${result.result.persistence.status}`;
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function hardResetCurrentSave() {
    if (!gameSession) return;
    actionError = "";
    try {
      const result = await gameSession.hardReset((message) =>
        window.confirm(message),
      );
      if (result.status === "recoveryRequired") {
        sessionStatus = "recovery";
        recoveryMessage =
          result.initialization.status === "recoveryRequired"
            ? result.initialization.reason
            : "The save could not be loaded safely.";
      } else if (result.status === "reset") {
        appState = result.state;
        messages = [];
      } else if (result.status === "storageFailed") {
        actionError = `Hard Reset failed: ${result.message}`;
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  }

  async function exportRecoveryData() {
    try {
      if (!recoveryReader) throw new Error("Save storage is not ready.");
      recoveryBundleText = await recoveryReader();
      const blob = new Blob([recoveryBundleText], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `idle-mine-beyond-recovery-${new Date()
        .toISOString()
        .replaceAll(":", "-")}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      recoveryActionMessage =
        "Recovery data was prepared for download. Keep a copy before replacing a damaged save.";
    } catch (error) {
      recoveryActionMessage = `Could not read recovery data: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function recoverFromLegacySave() {
    if (!gameSession || !recoveryCopyAcknowledged) return;
    recoveryActionMessage = "";
    try {
      const result = await gameSession.recoverLegacySave(recoverySaveString);
      if (result.status === "recovered") {
        appState = result.state;
        sessionStatus = "ready";
        recoveryMessage = "";
        recoveryActionMessage = "Legacy Remix save recovered and stored.";
        document.body.dataset.theme = result.state.settings.theme;
        resumeAnimation?.();
      } else if (result.status === "legacyLoadFailed") {
        recoveryActionMessage =
          "The pasted Remix save could not be decoded or loaded. Stored save data was not replaced.";
      } else if (result.status === "persistenceFailed") {
        recoveryActionMessage = `The save loaded, but could not be stored (${result.result.persistence.status}). The recovery screen remains open.`;
      } else {
        recoveryActionMessage =
          "This session is no longer in a recoverable startup state. Reload the page and try again.";
      }
    } catch (error) {
      recoveryActionMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  async function readBeyondRecoveryFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    recoveryBeyondFileText = "";
    recoveryBeyondFileName = "";
    if (!file) return;
    try {
      recoveryBeyondFileText = await file.text();
      recoveryBeyondFileName = file.name;
      recoveryActionMessage = `Selected recovery file: ${file.name}`;
    } catch (error) {
      recoveryActionMessage = `Could not read recovery file: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function recoverFromBeyondFile() {
    if (!gameSession || !recoveryCopyAcknowledged || !recoveryBeyondFileText) {
      return;
    }
    recoveryActionMessage = "";
    try {
      const result = await gameSession.recoverBeyondSaveFile(
        recoveryBeyondFileText,
      );
      if (result.status === "recovered") {
        appState = result.state;
        sessionStatus = "ready";
        recoveryMessage = "";
        recoveryActionMessage = `Beyond save recovered from ${recoveryBeyondFileName || "the selected file"}.`;
        document.body.dataset.theme = result.state.settings.theme;
        resumeAnimation?.();
      } else if (result.status === "fileRejected") {
        const detail =
          result.result.status === "unsupportedVersion"
            ? `Unsupported ${result.result.source} version.`
            : result.result.status === "empty"
              ? "The recovery bundle contains no Beyond save."
              : result.result.message;
        recoveryActionMessage = `The Beyond recovery file was rejected: ${detail} Stored data was not replaced.`;
      } else if (result.status === "persistenceFailed") {
        recoveryActionMessage = `The save was valid, but could not be stored (${result.result.persistence.status}). The recovery screen remains open.`;
      } else {
        recoveryActionMessage =
          "This session is no longer in a recoverable startup state. Reload the page and try again.";
      }
    } catch (error) {
      recoveryActionMessage =
        error instanceof Error ? error.message : String(error);
    }
  }

  function pushLegacyMessage(effect: { message: string; color: string }) {
    messages = [effect, ...messages].slice(0, 6);
  }

  function dispatchEffect(effect: RemixWebSessionEffect) {
    if (effect.type === "setTheme") {
      document.body.dataset.theme = effect.theme;
      return;
    }
    pushLegacyMessage(effect);
  }

  function pushStoryLog(effect: StoryLogEffect) {
    pushLegacyMessage(effect);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (
      (event.key === "Shift" || event.key === "Control") &&
      !pressedKeys.includes(event.key)
    ) {
      pressedKeys = [...pressedKeys, event.key];
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    pressedKeys = pressedKeys.filter((key) => key !== event.key);
  }

  async function changeTab(
    targetTab: "main" | "story" | "settings" | "powers",
  ) {
    const current = appState;
    if (!current || !gameSession) return;
    const scroller = document.querySelector<HTMLElement>(".story-milestones");
    const transition = transitionRemixStoryTab({
      currentTab: current.settings.tab,
      targetTab,
      currentScrollTop: scroller?.scrollTop ?? 0,
      scrollY: current.storyScrollY,
      notifications: current.simulation.story.notifications,
    });
    await updateApplicationState((state) => ({
      ...state,
      storyScrollY: transition.state.scrollY,
      settings: { ...state.settings, tab: transition.state.tab },
      simulation: {
        ...state.simulation,
        story: {
          ...state.simulation.story,
          notifications: transition.state.notifications,
        },
      },
    }));

    for (const effect of transition.effects) {
      if (effect.type === "restore-story-scroll") {
        window.setTimeout(() => {
          const storyScroller =
            document.querySelector<HTMLElement>(".story-milestones");
          if (storyScroller) storyScroller.scrollTop = effect.scrollY;
        }, effect.delayMs);
      } else {
        window.setTimeout(() => {
          const select = document.querySelector<HTMLSelectElement>(
            "#numberformatselect",
          );
          if (select) {
            select.selectedIndex = appState?.settings.numberFormatterIndex ?? 0;
          }
        }, effect.delayMs);
      }
    }
  }

  async function changeStoryPage(page: number) {
    await updateApplicationState((state) => ({
      ...state,
      simulation: {
        ...state.simulation,
        story: { ...state.simulation.story, page },
      },
    }));
  }

  async function prestigePower(index: RemixPowerPrestigeIndex) {
    await dispatch({ type: "prestigePower", index });
  }

  async function buyWisdomUpgrade(
    key: RemixUpgradeKey<"wisdom">,
    amount: 1 | 10 | 100,
  ) {
    await dispatch({
      type: "upgradePurchase",
      group: "wisdom",
      key,
      operation: { method: "buyN", count: amount, align: true },
    });
  }

  async function changeMineObject(delta: -1 | 1) {
    await updateApplicationState((state) => {
      const nextLevel = state.simulation.mineObjectLevel + delta;
      if (
        nextLevel < 0 ||
        nextLevel > state.simulation.highestMineObjectLevel
      ) {
        return state;
      }
      return {
        ...state,
        simulation: {
          ...state.simulation,
          mineObjectLevel: nextLevel,
          currentObject: getRemixMineObject(nextLevel, catalog),
        },
      };
    });
  }

  onMount(() => {
    let disposed = false;
    let animationFrame = 0;
    const clock = { now: () => Date.now() };
    const initialGameTimestampMs = clock.now();
    // Remix initializes deltaTimeNew and deltaTimeOld before onCreate().
    clock.now();
    let deltaTimeOld = clock.now();

    const handleEffect = (effect: RemixWebSessionEffect) => {
      if (!disposed) dispatchEffect(effect);
    };
    const tauriInvoke = getRemixTauriInvoke(window as RemixTauriWindow);
    const saveStorage = tauriInvoke
      ? createTauriRemixSaveStorage(tauriInvoke)
      : createBrowserRemixSaveStorage();
    recoveryReader = async () =>
      JSON.stringify(
        await readRemixRecoveryData({
          storage: saveStorage,
          readLegacySave: readBrowserRemixLegacySave,
        }),
        null,
        2,
      );
    const handleBlur = () => (pressedKeys = []);
    gameSession = createRemixWebGameSession({
      catalog,
      legacySaveTemplate: legacySaveTemplateContent.template as Record<
        string,
        unknown
      >,
      storyMilestones,
      initialGameTimestampMs,
      random: { nextDouble: () => Math.random() },
      clock,
      storage: saveStorage,
      async clearAllStorage() {
        if (tauriInvoke) await clearTauriRemixSaveStorage(tauriInvoke);
        clearBrowserRemixStorage();
      },
      readLegacySave: readBrowserRemixLegacySave,
      resolveNumberFormatter(index) {
        const formatter = formatters[index];
        if (!formatter) {
          throw new RangeError(
            `Unknown Remix number formatter index ${index}.`,
          );
        }
        return (value, precision, limit, below1000) =>
          formatRemixNumber(value, formatter, precision, limit, below1000);
      },
      resolveNotationFormatter(index) {
        const formatter = formatters[index];
        if (!formatter) {
          throw new RangeError(
            `Unknown Remix number formatter index ${index}.`,
          );
        }
        return formatter;
      },
      dispatchEffect: handleEffect,
    });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", handleBlur);

    const runFrame = async () => {
      const deltaTimeNew = clock.now();
      const deltaSeconds = (deltaTimeNew - deltaTimeOld) / 1000;
      deltaTimeOld = clock.now();
      await dispatch({ type: "idleFrame", deltaSeconds });
      if (!disposed) animationFrame = window.requestAnimationFrame(runFrame);
    };
    resumeAnimation = () => {
      if (!disposed) animationFrame = window.requestAnimationFrame(runFrame);
    };

    const initialize = async () => {
      try {
        const result = await gameSession!.initialize();
        if (disposed) return;
        if (result.status === "recoveryRequired") {
          sessionStatus = "recovery";
          recoveryMessage = result.reason;
          return;
        }
        appState = result.state;
        sessionStatus = "ready";
        if (result.saveFailure) {
          actionError = `Save failed: ${result.saveFailure.status}`;
        }
        document.body.dataset.theme = result.state.settings.theme;
        resumeAnimation?.();
      } catch (error) {
        sessionStatus = "error";
        recoveryMessage =
          error instanceof Error ? error.message : String(error);
      }
    };
    void initialize();

    return () => {
      disposed = true;
      resumeAnimation = undefined;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  });
</script>

<svelte:head>
  <title>Idle Mine: Remix — Beyond</title>
  <meta
    name="description"
    content="An evidence-backed reimplementation of Idle Mine: Remix."
  />
</svelte:head>

<div
  id="app"
  data-app-state={sessionStatus}
  data-theme={appState?.settings.theme ?? "light"}
  data-number-formatter={selectedNotation.name}
>
  <header>
    <h1>Idle Mine: Remix</h1>
    {#if simulation}
      <span>{formatNumber(simulation.resources.money)} $</span>
      <span class="inline-resource">
        <img class="inline" src="/Images/gem.png" alt="Gems" />
        {formatNumber(simulation.resources.gems, 2, "1e12", 0)}
      </span>
      {#if simulation.highestMineObjectLevel >= 90}
        <span class="inline-resource">
          <img class="inline" src="/Images/planetcoin.png" alt="Planet Coins" />
          {formatNumber(simulation.resources.planetCoins, 2, "1e12", 0)}
        </span>
      {/if}
    {/if}
  </header>

  <main>
    {#if sessionStatus === "loading"}
      <p class="session-message">Loading save…</p>
    {:else if sessionStatus === "recovery" || sessionStatus === "error"}
      <section class="session-message" role="alert">
        <h2>Save needs attention</h2>
        <p>{recoveryMessage}</p>
        <p>
          Export a copy of the stored save slots before attempting recovery. The
          export reads data only and does not modify storage.
        </p>
        <button data-recovery-export onclick={exportRecoveryData}
          >Download recovery data</button
        >
        {#if recoveryBundleText}
          <textarea
            data-recovery-bundle
            aria-label="Recovery data bundle"
            readonly
            value={recoveryBundleText}></textarea>
          <label>
            <input
              data-recovery-acknowledgement
              type="checkbox"
              bind:checked={recoveryCopyAcknowledged}
            />
            I saved a copy of the recovery data before continuing.
          </label>
          <label for="recovery-beyond-file">Beyond recovery file</label>
          <input
            id="recovery-beyond-file"
            data-recovery-beyond-file
            type="file"
            accept="application/json,.json"
            onchange={readBeyondRecoveryFile}
          />
          <button
            data-recovery-beyond-import
            disabled={!recoveryCopyAcknowledged || !recoveryBeyondFileText}
            onclick={recoverFromBeyondFile}>Recover from Beyond file</button
          >
          <label for="recovery-legacy-save">Legacy Remix save</label>
          <textarea
            id="recovery-legacy-save"
            data-recovery-legacy-save
            bind:value={recoverySaveString}
            placeholder="Paste an exported Remix save here"></textarea>
          <button
            data-recovery-import
            disabled={!recoveryCopyAcknowledged || !recoverySaveString.trim()}
            onclick={recoverFromLegacySave}>Recover from Remix save</button
          >
        {/if}
        {#if recoveryActionMessage}
          <p data-recovery-result role="status">{recoveryActionMessage}</p>
        {/if}
      </section>
    {:else if appState && simulation}
      {#if appState.settings.tab === "story"}
        <StoryPanel
          conditionState={storyConditionState}
          page={simulation.story.page}
          {selectedNotation}
          onPageChange={changeStoryPage}
          onStoryLog={pushStoryLog}
        />
      {:else if appState.settings.tab === "settings"}
        <SettingsPanel
          settings={appState.settings}
          {formatters}
          onNumberFormatterChange={changeNumberFormatter}
          onThemeChange={changeTheme}
          onPreferenceChange={changePreference}
          onSave={saveCurrentState}
          onExportFieldStringChange={(value) =>
            void updateApplicationState((state) => ({
              ...state,
              settings: { ...state.settings, exportFieldString: value },
            }))}
          onExport={exportCurrentSave}
          onImport={importCurrentSave}
          onHardReset={hardResetCurrentSave}
          error={actionError}
        />
      {:else if appState.settings.tab === "powers"}
        <PowersPanel
          {simulation}
          powerValueExtras={appState.powerValueExtras}
          {selectedNotation}
          {pressedKeys}
          {formatNumber}
          onPrestige={prestigePower}
          onUpgrade={buyWisdomUpgrade}
        />
      {:else}
        <article class="main">
          <div class="mineobject">
            <button
              class="changemineobj"
              aria-label="Previous mine object"
              style:visibility={simulation.mineObjectLevel > 0
                ? "visible"
                : "hidden"}
              onclick={() => changeMineObject(-1)}
              ><img
                class="left"
                src="/Images/btn_left.png"
                alt="Previous"
              /></button
            >
            <div>
              {#if appState.settings.showMineObjLevel}
                <h4 data-mine-object-level>
                  #{simulation.mineObjectLevel + 1}
                </h4>
              {/if}
              <MineObjectCanvas
                level={simulation.mineObjectLevel}
                damageable={miningRates?.activeDamage.gt(0) ?? false}
                onDamage={() => void dispatch({ type: "activeClick" })}
              />
              <h2>{simulation.currentObject.name}</h2>
              <p data-mine-object-hp>
                HP: {formatNumber(simulation.currentObject.hp)}
              </p>
              <p>D: {formatNumber(simulation.currentObject.defense)}</p>
              <p style="margin: 0;">
                ${formatNumber(simulation.currentObject.value)}
              </p>
              {#if simulation.currentObject.drops.planetcoin}
                <p class="mine-drop">
                  {formatPercent(
                    simulation.currentObject.drops.planetcoin.chance,
                  )} for
                  <span class="inline-resource">
                    <img
                      class="inline"
                      src="/Images/planetcoin.png"
                      alt="Planet Coins"
                    />
                    {formatNumber(
                      simulation.currentObject.drops.planetcoin.amount,
                      2,
                      "1e9",
                    )}
                  </span>
                </p>
              {/if}
              {#if simulation.currentObject.drops.wisdom}
                <p class="mine-drop">
                  {formatPercent(simulation.currentObject.drops.wisdom.chance)} for
                  <span class="inline-resource">
                    <img class="inline" src="/Images/wisdom.png" alt="Wisdom" />
                    {formatNumber(
                      simulation.currentObject.drops.wisdom.amount,
                      2,
                      "1e9",
                    )}
                  </span>
                </p>
              {/if}
            </div>
            <button
              class="changemineobj"
              aria-label="Next mine object"
              style:visibility={simulation.mineObjectLevel <
              simulation.highestMineObjectLevel
                ? "visible"
                : "hidden"}
              onclick={() => changeMineObject(1)}
              ><img
                class="right"
                src="/Images/btn_right.png"
                alt="Next"
              /></button
            >
          </div>

          <UpgradePanel
            {simulation}
            {selectedNotation}
            {pressedKeys}
            onPurchase={(action) => void dispatch(action)}
          />

          <div class="stats">
            <div>
              <p>
                <img class="inline" src="/Images/pickaxe.png" alt="pickaxe" />
                {simulation.pickaxe.name}
              </p>
              <p>P: {formatNumber(simulation.pickaxe.power)}</p>
              <p>Q: {formatPercent(simulation.pickaxe.quality, 0)}</p>
              <p>Base Dmg: {formatNumber(miningRates?.pickaxeDamage ?? 0)}</p>
            </div>
            <div class="resources">
              <p class:red={miningRates?.activeDamage.eq(0) ?? false}>
                Damage/click<br />{formatNumber(miningRates?.activeDamage ?? 0)}
              </p>
              <p class:red={miningRates?.idleDamage.eq(0) ?? false}>
                Damage/s<br />{formatNumber(miningRates?.idleDps ?? 0)}
              </p>
              <p>
                Money per Click<br />{formatNumber(
                  miningRates?.moneyPerClick ?? 0,
                  2,
                  "1e12",
                  2,
                )} $
              </p>
              <p>
                Money/s<br />{formatNumber(
                  miningRates?.moneyPerSecond ?? 0,
                  2,
                  "1e12",
                  2,
                )} $
              </p>
              <div>
                Avg. Gems/s<br />
                <p class="inline-resource" style="margin: 0;">
                  {formatNumber(miningRates?.gemsPerSecond ?? 0, 2, "1e12", 3)}
                  <img class="inline" src="/Images/gem.png" alt="Gems" />
                </p>
              </div>
              {#if new Decimal(simulation.resources.maxPlanetCoins).gt(0)}
                <div>
                  Avg. Planet Coins/s<br />
                  <p class="inline-resource" style="margin: 0;">
                    {formatNumber(
                      miningRates?.planetCoinsPerSecond ?? 0,
                      2,
                      "1e12",
                      3,
                    )}
                    <img
                      class="inline"
                      src="/Images/planetcoin.png"
                      alt="Planet Coins"
                    />
                  </p>
                </div>
              {/if}
            </div>
          </div>

          <div class="activity">
            <div class="messagelog" aria-live="polite">
              {#each messages as item, index (`${index}:${item.message}`)}
                <p style:color={item.color}>{item.message}</p>
              {/each}
            </div>
            <div class="craft-pickaxe">
              {#if craftGemSelection?.visible}
                <button
                  class="level-change"
                  data-craft-gem-level="decrease"
                  aria-label="Use fewer Gems for the next Pickaxe"
                  disabled={craftGemSelection.decreaseDisabled}
                  onclick={() =>
                    void dispatch({
                      type: "changeCraftGemLevel",
                      direction: "decrease",
                    })}
                >
                  {#if craftGemSelection.showDecreaseIcon}
                    <img
                      class="left level-change"
                      src="/Images/btn_left.png"
                      alt=""
                    />
                  {/if}
                </button>
              {/if}
              <button
                data-craft-pickaxe
                onclick={() =>
                  void dispatch({
                    type: "craftPickaxe",
                    shiftHeld: pressedKeys.includes("Shift"),
                  })}
              >
                Craft a new Pickaxe<br />
                {#if appState.settings.showMinCraftDamage}
                  <span
                    data-minimum-craft-damage
                    style="font-size: 60%; display: block;"
                    >Minimum Base Damage: {formatNumber(
                      minimumCraftDamage,
                      2,
                      "1e12",
                      0,
                    )}</span
                  >
                {/if}
                <span class="inline-resource" data-craft-gem-cost>
                  <img
                    class="inline"
                    src="/Images/gem.png"
                    alt="Gems"
                  />{formatThousands(
                    craftGemSelection?.gemCost ?? 1,
                    selectedNotation,
                  )}
                  {#if pressedKeys.includes("Shift") && simulation.upgrades.planetCoins.bulkCraft > 0}
                    &nbsp;x {simulation.upgrades.planetCoins.bulkCraft + 1}
                  {/if}
                </span>
              </button>
              {#if craftGemSelection?.visible}
                <button
                  class="level-change"
                  data-craft-gem-level="increase"
                  aria-label="Use more Gems for the next Pickaxe"
                  disabled={craftGemSelection.increaseDisabled}
                  onclick={() =>
                    void dispatch({
                      type: "changeCraftGemLevel",
                      direction: "increase",
                    })}
                >
                  {#if craftGemSelection.showIncreaseIcon}
                    <img
                      class="right level-change"
                      src="/Images/btn_right.png"
                      alt=""
                    />
                  {/if}
                </button>
              {/if}
            </div>
            {#if actionError}
              <p role="alert" class="action-error">{actionError}</p>
            {/if}
          </div>
        </article>
      {/if}
    {/if}
  </main>

  <footer>
    <button
      data-game-tab="mining"
      aria-pressed={appState?.settings.tab === "main"}
      onclick={() => changeTab("main")}
    >
      <img class="inline" src="/Images/pickaxe.png" alt="pickaxe" /> Mining
    </button>
    {#if simulation && isRemixPowersUnlocked(simulation.highestMineObjectLevel)}
      <button
        data-game-tab="powers"
        aria-pressed={appState?.settings.tab === "powers"}
        onclick={() => changeTab("powers")}
      >
        <img class="inline" src="/Images/wisdom.png" alt="powers" /> Powers
      </button>
    {/if}
    <button
      data-game-tab="story"
      class="story-tab"
      aria-pressed={appState?.settings.tab === "story"}
      onclick={() => changeTab("story")}
    >
      {#if simulation && simulation.story.notifications > 0}
        <span class="notification">{simulation.story.notifications}</span>
      {/if}
      <img
        class="inline"
        class:notification={simulation && simulation.story.notifications > 0}
        src="/Images/story.png"
        alt="pickaxe"
      /> Story
    </button>
    <button
      data-game-tab="settings"
      aria-pressed={appState?.settings.tab === "settings"}
      onclick={() => changeTab("settings")}
    >
      <img class="inline" src="/Images/settings.png" alt="options" /> Settings
    </button>
  </footer>
</div>

<style>
  @font-face {
    font-family: "Work Sans";
    src: url("/fonts/worksans/WorkSans-Regular.woff2") format("woff2");
  }

  @font-face {
    font-family: "Montserrat";
    src: url("/fonts/montserrat/Montserrat-Regular.woff2") format("woff2");
  }

  :global(body) {
    margin: 0;
    padding: 0;
    height: 100vh;
    overflow-y: hidden;
    overscroll-behavior: contain;
    background: #fafafa;
    color: #000;
    font:
      18px "Work Sans",
      sans-serif;
    user-select: none;
  }

  :global(body[data-theme="dark"]) {
    background-color: #363636;
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) :is(span, h4, p, button) {
    color: #c1c1c1;
  }

  :global(body[data-theme="dark"]) header,
  :global(body[data-theme="dark"]) footer {
    background-color: #212121;
  }

  :global(body[data-theme="dark"]) button,
  :global(body[data-theme="dark"]) footer button {
    background-color: #4d4d4d;
  }

  :global(body[data-theme="dark"]) button:hover:not(:disabled) {
    background-color: #636363;
  }

  #app {
    display: grid;
    grid-template-rows: 8vh 84vh 8vh;
  }

  header,
  footer {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5em;
    background: #e6e6e6;
    z-index: 1;
  }

  header h1,
  header span {
    flex-grow: 1;
    font-size: 4vh;
  }

  header span:nth-of-type(1) {
    flex-grow: 1.1;
    text-align: center;
  }

  header .inline-resource {
    justify-content: flex-end;
  }

  h1,
  h2,
  h4 {
    margin: 0;
    font-family: Montserrat, sans-serif;
  }

  main {
    min-height: 0;
    overflow: hidden;
  }

  article {
    padding: 0.5rem;
  }

  button {
    border: 0;
    background: #cfcfcf;
    font-size: 110%;
    outline: 0;
  }

  button:hover:not(:disabled) {
    background: #b6b6b6;
  }

  button:disabled {
    opacity: 0.7;
  }

  .inline-resource {
    display: inline-flex;
    align-items: center;
  }

  img.inline {
    display: inline;
    height: 1em;
  }

  .inline-resource img {
    margin: 0 0.2em;
  }

  img[src$="wisdom.png"] {
    animation: wisdom-resource-rotate 1s linear infinite;
  }

  @keyframes wisdom-resource-rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(-360deg);
    }
  }

  .main {
    display: grid;
    box-sizing: border-box;
    height: 84vh;
    padding: 1.5em;
    grid-template-columns: 45vw auto;
    grid-template-rows: 45vh auto;
  }

  .mineobject {
    display: grid;
    grid-template-columns: 3em auto 3em;
    text-align: center;
    font-size: 140%;
  }

  .mineobject p {
    line-height: 0.2em;
  }

  .mineobject h2 {
    font-size: 150%;
    white-space: nowrap;
  }

  .mineobject :global(canvas.mine-object) {
    height: 6em;
  }

  .mineobject .changemineobj {
    width: 2.5em;
    height: 2.5em;
    margin-top: 2.5em;
    background: transparent;
  }

  .changemineobj img {
    width: 100%;
    transition:
      transform 250ms,
      filter 250ms;
  }

  .changemineobj img:hover {
    transform: scaleX(0.85);
  }

  .changemineobj img:active {
    transform: scaleX(0.7);
    filter: brightness(0.9);
  }

  .mine-drop {
    margin: 0.7rem;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    padding: 1rem;
    margin-top: 2rem;
    font-size: 0.9rem;
  }

  .stats .resources {
    font-size: 80%;
    text-align: right;
  }

  .stats p {
    margin: 0.5em 0;
  }

  .red {
    color: #a90500;
  }

  .activity {
    margin-top: 3.5rem;
  }

  .messagelog {
    box-sizing: content-box;
    height: 6.5em;
    overflow-y: scroll;
    margin: 0 1rem;
    padding: 0.25rem;
    border: 1px solid #000;
    font-size: 80%;
  }

  .messagelog p {
    margin: 0;
  }

  .craft-pickaxe {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1rem;
  }

  .craft-pickaxe button {
    margin: 0 1rem;
  }

  .craft-pickaxe button.level-change {
    min-width: 3.75rem;
    background-color: transparent;
  }

  .craft-pickaxe img.level-change {
    height: 3rem;
    transition:
      filter 200ms,
      transform 200ms;
  }

  .craft-pickaxe img.left {
    transform-origin: left;
  }

  .craft-pickaxe img.right {
    transform-origin: right;
  }

  .craft-pickaxe img.level-change:hover {
    transform: scaleX(0.85);
  }

  .craft-pickaxe img.level-change:active {
    transform: scaleX(0.7);
    filter: brightness(0.9);
  }

  :global(body[data-theme="dark"]) .craft-pickaxe button.level-change:hover {
    background-color: transparent !important;
  }

  footer {
    justify-content: flex-start;
    padding: 1vh;
  }

  footer button {
    display: flex;
    min-width: 5vh;
    height: 5vh;
    align-items: center;
    margin: 0.5vh;
    padding: 0.2vh 0.5rem;
    background: #fff;
    color: #000;
    font-size: 3vh;
  }

  footer button:hover {
    background: rgb(222, 222, 222);
  }

  .story-tab {
    position: relative;
  }

  .story-tab img.notification {
    margin-right: 0.9rem;
  }

  .story-tab span.notification {
    position: absolute;
    left: 1.5rem;
    bottom: 0.2rem;
    min-width: 2vh;
    height: 2vh;
    padding: 0.17vh;
    border-radius: 100%;
    background-color: red;
    color: white;
    font-size: 1.9vh;
  }

  footer button img,
  footer button span {
    padding: 0;
    margin: 0;
    margin-right: 0.5rem;
  }

  .session-message {
    box-sizing: border-box;
    padding: 2rem;
  }

  .action-error {
    color: #a90500;
    text-align: center;
  }
</style>
