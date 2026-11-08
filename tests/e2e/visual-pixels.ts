import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

export function renderedPixelHash(screenshot: Buffer): string {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!screenshot.subarray(0, 8).equals(signature)) {
    throw new Error("Expected a PNG screenshot.");
  }
  let width = 0;
  let height = 0;
  let colorType = -1;
  const imageData: Buffer[] = [];
  for (let offset = 8; offset < screenshot.length;) {
    const length = screenshot.readUInt32BE(offset);
    const type = screenshot.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      width = screenshot.readUInt32BE(dataStart);
      height = screenshot.readUInt32BE(dataStart + 4);
      const bitDepth = screenshot[dataStart + 8]!;
      colorType = screenshot[dataStart + 9]!;
      const interlace = screenshot[dataStart + 12]!;
      if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
        throw new Error("Unsupported PNG screenshot format.");
      }
    } else if (type === "IDAT") {
      imageData.push(screenshot.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }
  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowBytes = width * bytesPerPixel;
  const filtered = inflateSync(Buffer.concat(imageData));
  const rows = Buffer.alloc(rowBytes * height);
  const paeth = (left: number, above: number, upperLeft: number) => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
      ? left
      : aboveDistance <= upperLeftDistance
        ? above
        : upperLeft;
  };
  for (let y = 0; y < height; y += 1) {
    const sourceStart = y * (rowBytes + 1);
    const filter = filtered[sourceStart]!;
    const destinationStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = filtered[sourceStart + 1 + x]!;
      const left =
        x >= bytesPerPixel ? rows[destinationStart + x - bytesPerPixel]! : 0;
      const above = y > 0 ? rows[destinationStart + x - rowBytes]! : 0;
      const upperLeft =
        y > 0 && x >= bytesPerPixel
          ? rows[destinationStart + x - rowBytes - bytesPerPixel]!
          : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? left
            : filter === 2
              ? above
              : filter === 3
                ? Math.floor((left + above) / 2)
                : filter === 4
                  ? paeth(left, above, upperLeft)
                  : undefined;
      if (predictor === undefined) throw new Error("Unsupported PNG filter.");
      rows[destinationStart + x] = (raw + predictor) & 0xff;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  for (let source = 0, destination = 0; source < rows.length;) {
    const alpha = colorType === 6 ? rows[source + 3]! : 255;
    rgba[destination] = alpha === 0 ? 0 : rows[source]!;
    rgba[destination + 1] = alpha === 0 ? 0 : rows[source + 1]!;
    rgba[destination + 2] = alpha === 0 ? 0 : rows[source + 2]!;
    rgba[destination + 3] = alpha;
    source += bytesPerPixel;
    destination += 4;
  }
  return createHash("sha256").update(rgba).digest("hex");
}
