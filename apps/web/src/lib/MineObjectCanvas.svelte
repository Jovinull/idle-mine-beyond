<script lang="ts">
  import { drawRemixMineObjectCanvas } from "./mine-object-rendering.js";

  type Props = {
    level: number;
    nodamage?: boolean;
    damageable?: boolean;
    onDamage?: () => void;
  };

  let {
    level,
    nodamage = false,
    damageable = false,
    onDamage,
  }: Props = $props();
  let canvas: HTMLCanvasElement;
  let rendered = $state(false);
  let renderedLevel = $state<number | undefined>();
  let renderError = $state<string | undefined>();

  function handleDamage() {
    if (!nodamage && damageable) onDamage?.();
  }

  $effect(() => {
    const currentLevel = level;
    let active = true;
    rendered = false;
    renderedLevel = undefined;
    renderError = undefined;

    void drawRemixMineObjectCanvas(canvas, currentLevel)
      .then(() => {
        if (!active) return;
        renderedLevel = currentLevel;
        rendered = true;
      })
      .catch((error: unknown) => {
        if (active) {
          renderError = error instanceof Error ? error.message : String(error);
        }
      });

    return () => {
      active = false;
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="mine-object"
  class:nodmg={nodamage || !damageable}
  width="256"
  height="224"
  data-damageable={damageable ? "true" : "false"}
  data-rendered={rendered ? "true" : "false"}
  data-level={renderedLevel}
  data-error={renderError}
  onclick={handleDamage}
></canvas>

<style>
  canvas.mine-object {
    height: 6em;
    transition:
      filter 200ms,
      transform 200ms;
  }

  canvas.mine-object:active:not(.nodmg) {
    filter: brightness(0.75);
    transform: scale(0.925);
  }
</style>
