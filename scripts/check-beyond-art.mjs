import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Verifies the unshipped Beyond art pack in art/beyond: every file is listed
// in its manifest with a matching SHA-256 and PNG size, each image keeps the
// size of the Remix image it would replace, every Remix image the web app
// serves (except third-party social icons) has a 1x and 2x counterpart, and
// no product source references the pack before it is approved.

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packRoot = path.join(root, "art/beyond");
const manifest = JSON.parse(
  await readFile(path.join(packRoot, "manifest.json"), "utf8"),
);
const sourceManifest = JSON.parse(
  await readFile(
    path.join(root, "docs/knowledge/sources/reference-manifest.json"),
    "utf8",
  ),
);
const remix = sourceManifest.references.find(
  ({ name }) => name === "Idle Mine: Remix",
);
const errors = [];

if (!remix || manifest.reference.commit !== remix.pinnedCommit) {
  errors.push("The art pack reference commit does not match the Remix pin.");
}
if (manifest.status !== "not-shipped") {
  errors.push(
    `The art pack status is ${manifest.status}; shipping it needs an approved behavioral exception first.`,
  );
}

async function listFiles(directory) {
  const entries = await readdir(directory, {
    recursive: true,
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(directory, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

function pngSize(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function readIfPresent(filePath) {
  return readFile(filePath).catch(() => null);
}

const upstreamRoot = path.join(root, remix?.researchCheckout ?? ".research");
const listed = new Map(manifest.files.map((file) => [file.path, file]));
const packFiles = (await listFiles(packRoot)).filter(
  (file) => file !== "manifest.json" && file !== "README.md",
);

for (const file of packFiles) {
  if (!listed.has(file)) errors.push(`${file} is not in the manifest.`);
}

for (const file of manifest.files) {
  const buffer = await readIfPresent(path.join(packRoot, file.path));
  if (!buffer) {
    errors.push(`${file.path} is listed but missing.`);
    continue;
  }
  const hash = createHash("sha256").update(buffer).digest("hex").toUpperCase();
  if (hash !== file.sha256) {
    errors.push(`${file.path} hash ${hash} does not match ${file.sha256}.`);
  }
  const size = pngSize(buffer);
  if (!size || size.width !== file.width || size.height !== file.height) {
    errors.push(`${file.path} is not a ${file.width}x${file.height} PNG.`);
  }
  if (!file.replaces) continue;

  // The counterpart comes from the pinned checkout when present, otherwise
  // from the unmodified copy the web app serves.
  const counterpart =
    (await readIfPresent(path.join(upstreamRoot, file.replaces))) ??
    (await readIfPresent(path.join(root, "apps/web/static", file.replaces)));
  if (!counterpart) continue;
  const original = pngSize(counterpart);
  if (
    size &&
    (size.width !== original.width * file.scale ||
      size.height !== original.height * file.scale)
  ) {
    errors.push(
      `${file.path} is ${size.width}x${size.height}; ${file.replaces} at ${file.scale}x is ${original.width * file.scale}x${original.height * file.scale}.`,
    );
  }
}

const atlas = listed.get(manifest.atlas.path);
const [cellWidth, cellHeight] = manifest.atlas.cell;
if (
  !atlas ||
  atlas.width !== manifest.atlas.layers * cellWidth ||
  atlas.height !== manifest.atlas.rows * cellHeight
) {
  errors.push("The atlas does not match its declared layer/row layout.");
}

const served = (await listFiles(path.join(root, "apps/web/static/Images")))
  .filter((file) => file.endsWith(".png") && !file.startsWith("social/"))
  .map((file) => `Images/${file}`);
for (const image of served) {
  for (const scale of [1, 2]) {
    const covered = manifest.files.some(
      (file) => file.replaces === image && file.scale === scale,
    );
    if (!covered) errors.push(`${image} has no ${scale}x Beyond counterpart.`);
  }
}

const productRoots = ["apps/web/src", "apps/native/src-tauri/src", "packages"];
for (const productRoot of productRoots) {
  const absolute = path.join(root, productRoot);
  const files = await listFiles(absolute).catch(() => []);
  for (const file of files) {
    if (file.includes("node_modules/") || file.includes("/dist/")) continue;
    if (!/\.(?:ts|js|mjs|svelte|json|rs|html|css)$/.test(file)) continue;
    const content = await readFile(path.join(absolute, file), "utf8");
    if (content.includes("art/beyond")) {
      errors.push(
        `${productRoot}/${file} references the unshipped art pack before approval.`,
      );
    }
  }
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Verified ${manifest.files.length} Beyond art files against the manifest, ${served.length} served Remix images covered at 1x and 2x, and no product references to the unshipped pack.\n`,
  );
}
