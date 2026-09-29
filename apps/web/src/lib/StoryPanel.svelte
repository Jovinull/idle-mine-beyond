<script lang="ts">
  import { tick } from "svelte";
  import {
    Decimal,
    attemptRemixPayUSDebt,
    decreaseRemixStoryPage,
    getNextRemixStoryObjectiveText,
    getRemixStoryDisplayedMilestones,
    getRemixStoryMaximumPage,
    increaseRemixStoryPage,
    type RemixStoryConditionState,
    type RemixStoryInteractionEffect,
    type RemixStoryMilestone,
    type DecimalSource,
  } from "@idle-mine-beyond/core";
  import {
    createInitialFormatters,
    formatThousands as formatRemixThousands,
    type NotationFormatter,
  } from "@idle-mine-beyond/formatting";
  import storyMilestoneContent from "@idle-mine-beyond/content/remix-story-milestones";
  import storyTemplateContent from "@idle-mine-beyond/content/remix-story-template";
  import { drawRemixMineObjectCanvas } from "./mine-object-rendering.js";
  import {
    renderRemixStoryTemplate,
    type RemixStoryTemplateContent,
  } from "./remix-story-template.js";
  import "./remix-story.css";

  type LogEffect = Extract<RemixStoryInteractionEffect, { type: "logMessage" }>;
  type Props = {
    conditionState?: RemixStoryConditionState;
    page?: number;
    selectedNotation?: NotationFormatter;
    onPageChange?: (page: number) => void;
    onStoryLog?: (effect: LogEffect) => void;
  };

  const milestones = storyMilestoneContent.milestones as RemixStoryMilestone[];
  const template = storyTemplateContent as unknown as RemixStoryTemplateContent;
  const defaultConditionState: RemixStoryConditionState = {
    highestMineObjectLevel: 0,
    highestMoney: 0,
    maxPlanetCoins: 0,
    moneyUpgradeLevels: {},
    wisdomUpgradeLevels: {},
  };
  const defaultNotation = createInitialFormatters()[0]!;

  let {
    conditionState = defaultConditionState,
    page: pageProp = 0,
    selectedNotation = defaultNotation,
    onPageChange,
    onStoryLog,
  }: Props = $props();
  let page = $derived(pageProp);
  let articleHost: HTMLDivElement;
  let pendingScrollTop: number | undefined;

  const maximumPage = $derived(
    getRemixStoryMaximumPage(milestones, conditionState),
  );
  const displayedKeys = $derived(
    new Set(getRemixStoryDisplayedMilestones(milestones, conditionState, page)),
  );
  const formatThousands = (value: DecimalSource, limit?: DecimalSource) =>
    formatRemixThousands(value, selectedNotation, limit ?? "1e12");
  const objectiveText = $derived(
    getNextRemixStoryObjectiveText(milestones, conditionState, {
      formatThousands: (value) => formatThousands(value),
      formatSelectedNotation: (value) => selectedNotation.format(value),
    }),
  );
  const longGoal1 = $derived(selectedNotation.format(new Decimal(2).pow(1024)));
  const longGoal2 = $derived(selectedNotation.format(new Decimal(2).pow(4096)));
  const renderedHtml = $derived(
    renderRemixStoryTemplate(template, {
      page,
      maximumPage,
      displayedKeys,
      objectiveText,
      longGoal1,
      longGoal2,
      formatThousands,
      formatSelectedNotation: (value) => selectedNotation.format(value),
    }),
  );

  function setPage(nextPage: number) {
    page = nextPage;
    onPageChange?.(nextPage);
  }

  function handleStoryAction(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>("[data-story-action]")?.dataset
      .storyAction;
    if (!action) return;

    if (action === "decreaseStoryPage") {
      setPage(decreaseRemixStoryPage(page));
    } else if (action === "increaseStoryPage") {
      setPage(increaseRemixStoryPage(page, maximumPage));
    } else if (action === "payUSDebt") {
      for (const effect of attemptRemixPayUSDebt(conditionState.highestMoney)) {
        if (effect.type === "alert") {
          window.alert(effect.message);
        } else if (onStoryLog) {
          onStoryLog(effect);
        } else {
          window.dispatchEvent(
            new CustomEvent("idle-mine-story-log", { detail: effect }),
          );
        }
      }
    }
  }

  $effect.pre(() => {
    const nextHtml = renderedHtml;
    const scroller =
      articleHost?.querySelector<HTMLElement>(".story-milestones");
    if (scroller) pendingScrollTop = scroller.scrollTop;
    void nextHtml;
  });

  $effect(() => {
    const currentHtml = renderedHtml;
    let active = true;
    const host = articleHost;
    host?.addEventListener("click", handleStoryAction);
    void tick().then(async () => {
      if (!active || !articleHost) return;
      const scroller =
        articleHost.querySelector<HTMLElement>(".story-milestones");
      if (scroller && pendingScrollTop !== undefined) {
        scroller.scrollTop = pendingScrollTop;
        pendingScrollTop = undefined;
      }
      const canvases = articleHost.querySelectorAll<HTMLCanvasElement>(
        "canvas.mine-object[data-level]",
      );
      await Promise.all(
        [...canvases].map(async (canvas) => {
          try {
            await drawRemixMineObjectCanvas(
              canvas,
              Number(canvas.dataset.level),
            );
            if (active) canvas.dataset.rendered = "true";
          } catch (error) {
            if (active) {
              canvas.dataset.error =
                error instanceof Error ? error.message : String(error);
            }
          }
        }),
      );
      void currentHtml;
    });
    return () => {
      active = false;
      host?.removeEventListener("click", handleStoryAction);
    };
  });
</script>

<div
  bind:this={articleHost}
  class="story-panel-host"
  data-story-page={page}
  data-story-maximum-page={maximumPage}
>
  <!-- The fixed template is pinned and validated; its runtime interpolations are escaped. -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html renderedHtml}
</div>
