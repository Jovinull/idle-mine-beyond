import { mount, unmount } from "svelte";
import MineObjectCanvas from "../src/lib/MineObjectCanvas.svelte";

type PixelReference = {
  level: number;
  width: number;
  height: number;
  pixelSha256: string;
  rgbaBase64: string;
};

type RenderedPreview = {
  level: number;
  className: string;
  width: number;
  height: number;
  pixelSha256: string;
  referencePixelSha256: string;
  maxRgbDelta: number;
  differentRgbPixels: number;
  alphaMismatchPixels: number;
};

const output = document.querySelector<HTMLPreElement>("#result");
if (!output)
  throw new Error("Mine-object renderer probe failed to initialize.");

const host = document.createElement("div");
host.id = "mine-object-renderer-host";
document.body.append(host);

const browserWindow = window as Window & {
  __idleMineObjectRendererProbe?: (
    references: PixelReference[],
  ) => Promise<RenderedPreview[]>;
};

browserWindow.__idleMineObjectRendererProbe = async (references) => {
  const previews: RenderedPreview[] = [];

  for (const reference of references) {
    const { level } = reference;
    host.replaceChildren();
    const component = mount(MineObjectCanvas, {
      target: host,
      props: { level, nodamage: true },
    });
    const canvas = host.querySelector<HTMLCanvasElement>("canvas.mine-object");
    if (!canvas)
      throw new Error(`Mine-object canvas did not mount for level ${level}.`);

    const deadline = performance.now() + 5000;
    while (
      (canvas.dataset.rendered !== "true" ||
        Number(canvas.dataset.level) !== level) &&
      performance.now() < deadline
    ) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    if (
      canvas.dataset.rendered !== "true" ||
      Number(canvas.dataset.level) !== level
    ) {
      throw new Error(`Mine-object canvas did not render level ${level}.`);
    }

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context)
      throw new Error(
        `Mine-object canvas has no 2D context at level ${level}.`,
      );
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const digest = await crypto.subtle.digest("SHA-256", pixels);

    const referenceBinary = atob(reference.rgbaBase64);
    const referencePixels = Uint8ClampedArray.from(referenceBinary, (byte) =>
      byte.charCodeAt(0),
    );
    const referenceDigest = await crypto.subtle.digest(
      "SHA-256",
      referencePixels,
    );

    let maxRgbDelta = 0;
    let differentRgbPixels = 0;
    let alphaMismatchPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      let pixelDiffers = false;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(
          pixels[offset + channel]! - referencePixels[offset + channel]!,
        );
        maxRgbDelta = Math.max(maxRgbDelta, delta);
        if (delta > 0) pixelDiffers = true;
      }
      if (pixelDiffers) differentRgbPixels += 1;
      if (pixels[offset + 3] !== referencePixels[offset + 3]) {
        alphaMismatchPixels += 1;
      }
    }

    previews.push({
      level,
      className: [...canvas.classList]
        .filter(
          (className) => className === "mine-object" || className === "nodmg",
        )
        .join(" "),
      width: canvas.width,
      height: canvas.height,
      pixelSha256: [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      referencePixelSha256: [...new Uint8Array(referenceDigest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(""),
      maxRgbDelta,
      differentRgbPixels,
      alphaMismatchPixels,
    });
    await unmount(component);
  }

  return previews;
};

output.textContent = "Mine-object renderer probe ready";
output.dataset.ready = "true";
