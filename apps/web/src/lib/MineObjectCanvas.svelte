<script module lang="ts">
  let atlasPromise: Promise<HTMLImageElement> | undefined;
  let layerCacheCanvas: HTMLCanvasElement | undefined;

  function loadAtlas(): Promise<HTMLImageElement> {
    atlasPromise ??= new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new Error("Could not load the Remix mine-object atlas."));
      image.src = "/Images/stone_new.png";
    });
    return atlasPromise;
  }

  function getLayerCacheCanvas(): HTMLCanvasElement {
    layerCacheCanvas ??=
      document.querySelector<HTMLCanvasElement>("canvas#cache") ??
      document.createElement("canvas");
    if (layerCacheCanvas.width !== 256) layerCacheCanvas.width = 256;
    if (layerCacheCanvas.height !== 224) layerCacheCanvas.height = 224;
    layerCacheCanvas.hidden = true;
    if (!layerCacheCanvas.isConnected) {
      layerCacheCanvas.id = "cache";
      document.body.append(layerCacheCanvas);
    }
    return layerCacheCanvas;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import {
    getRemixMineObject,
    type RemixMineObjectCatalog,
  } from "@idle-mine-beyond/core";
  import mineObjectContent from "@idle-mine-beyond/content/remix-mine-content";

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
  let atlas: HTMLImageElement | undefined;
  let atlasReady = $state(false);
  let rendered = $state(false);
  let renderedLevel = $state<number | undefined>();

  const catalog = mineObjectContent as unknown as RemixMineObjectCatalog;

  function drawStone(
    context: CanvasRenderingContext2D,
    color: string,
    layer: number,
    skin: number,
  ) {
    if (!atlas) return;
    const { width, height } = context.canvas;
    context.globalCompositeOperation = "copy";
    context.fillStyle = "#00000000";
    context.fillRect(0, 0, width, height);
    context.drawImage(
      atlas,
      256 * layer,
      256 * skin,
      256,
      224,
      0,
      0,
      width,
      height,
    );
    context.globalCompositeOperation = "multiply";
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(
      atlas,
      256 * layer,
      256 * skin,
      256,
      224,
      0,
      0,
      width,
      height,
    );
    context.globalCompositeOperation = "source-over";
  }

  function drawMineObject(objectLevel: number) {
    if (!atlas || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Mine-object canvas has no 2D context.");

    const object = getRemixMineObject(objectLevel, catalog);
    const cacheCanvas = getLayerCacheCanvas();
    const cacheContext = cacheCanvas.getContext("2d");
    if (!cacheContext)
      throw new Error("Mine-object layer canvas has no 2D context.");

    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = object.colors.length - 1; index >= 0; index -= 1) {
      const color = object.colors[index];
      if (color === undefined || color === "transparent") continue;
      drawStone(cacheContext, color, index, object.skin);
      context.drawImage(cacheCanvas, 0, 0, canvas.width, canvas.height);
    }

    renderedLevel = objectLevel;
    rendered = true;
  }

  function handleDamage() {
    if (!nodamage && damageable) onDamage?.();
  }

  onMount(() => {
    let active = true;
    void loadAtlas().then((image) => {
      if (!active) return;
      atlas = image;
      atlasReady = true;
    });

    return () => {
      active = false;
    };
  });

  $effect(() => {
    const currentLevel = level;
    if (atlasReady) {
      rendered = false;
      drawMineObject(currentLevel);
    }
  });
</script>

<canvas
  bind:this={canvas}
  class="mine-object"
  class:nodmg={nodamage || !damageable}
  width="256"
  height="224"
  data-rendered={rendered ? "true" : "false"}
  data-level={renderedLevel}
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
