<script lang="ts">
  import { drawRemixMineObjectCanvas } from "$game/mine-object-rendering";

  type Props = {
    level: number;
    name: string;
    /** Rendered width in CSS pixels; height keeps the game's 256:224 ratio. */
    width?: number;
    stage?: boolean;
  };

  let { level, name, width = 128, stage = false }: Props = $props();
  let canvas: HTMLCanvasElement;
  let state = $state<"loading" | "ready" | "error">("loading");

  $effect(() => {
    const current = level;
    let active = true;
    state = "loading";
    drawRemixMineObjectCanvas(canvas, current)
      .then(() => {
        if (active) state = "ready";
      })
      .catch(() => {
        if (active) state = "error";
      });
    return () => {
      active = false;
    };
  });
</script>

<span class="mine-object" class:stage style:--w="{width}px">
  <canvas
    bind:this={canvas}
    width="256"
    height="224"
    role={name ? "img" : undefined}
    aria-label={name || undefined}
    aria-hidden={name ? undefined : "true"}
    data-level={level}
    data-state={state}
  ></canvas>
</span>

<style>
  .mine-object {
    display: inline-grid;
    place-items: center;
    width: var(--w);
    aspect-ratio: 256 / 224;
    flex: none;
  }

  .mine-object.stage {
    width: calc(var(--w) + 2rem);
    padding: 1rem;
    aspect-ratio: auto;
    background: var(--stage);
    border: 1px solid var(--stage-line);
    border-radius: var(--radius-lg);
  }

  canvas {
    display: block;
    width: var(--w);
    height: auto;
    aspect-ratio: 256 / 224;
    transition: opacity 160ms;
  }

  canvas[data-state="loading"] {
    opacity: 0;
  }
</style>
