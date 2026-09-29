import {
  getRemixMineObject,
  type RemixMineObjectCatalog,
} from "@idle-mine-beyond/core";
import mineObjectContent from "@idle-mine-beyond/content/remix-mine-content";

const catalog = mineObjectContent as unknown as RemixMineObjectCatalog;
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

function drawStone(
  context: CanvasRenderingContext2D,
  atlas: HTMLImageElement,
  color: string,
  layer: number,
  skin: number,
): void {
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

export async function drawRemixMineObjectCanvas(
  canvas: HTMLCanvasElement,
  level: number,
): Promise<void> {
  const atlas = await loadAtlas();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Mine-object canvas has no 2D context.");

  const object = getRemixMineObject(level, catalog);
  const cacheCanvas = getLayerCacheCanvas();
  const cacheContext = cacheCanvas.getContext("2d");
  if (!cacheContext) {
    throw new Error("Mine-object layer canvas has no 2D context.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let index = object.colors.length - 1; index >= 0; index -= 1) {
    const color = object.colors[index];
    if (color === undefined || color === "transparent") continue;
    drawStone(cacheContext, atlas, color, index, object.skin);
    context.drawImage(cacheCanvas, 0, 0, canvas.width, canvas.height);
  }
}
