import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/story-assets.json",
);
const sourceManifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const remix = sourceManifest.references.find(
  ({ name }) => name === "Idle Mine: Remix",
);

if (
  !remix ||
  remix.canonicalUrl !== manifest.remix.repository ||
  remix.pinnedCommit !== manifest.remix.commit
) {
  throw new Error(
    "Story asset manifest does not match the canonical Remix pin.",
  );
}

function resolveInside(relativePath) {
  const absolutePath = path.resolve(root, relativePath);
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Asset manifest path escapes the project root: ${relativePath}`,
    );
  }
  return absolutePath;
}

async function sha256(filePath) {
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}

const upstreamRoot = resolveInside(remix.researchCheckout);
const hasUpstream = await readFile(path.join(upstreamRoot, ".git/HEAD"))
  .then(() => true)
  .catch(() => false);
const copiedFiles = [...manifest.copiedImages, ...manifest.copiedFonts];

for (const file of copiedFiles) {
  const destinationPath = resolveInside(file.destination);
  const destinationHash = await sha256(destinationPath);
  if (destinationHash !== file.sha256) {
    throw new Error(
      `${file.destination} hash ${destinationHash} does not match ${file.sha256}.`,
    );
  }

  if (hasUpstream) {
    const sourcePath = resolveInside(
      path.join(remix.researchCheckout, file.source),
    );
    const sourceHash = await sha256(sourcePath);
    if (sourceHash !== file.sha256 || sourceHash !== destinationHash) {
      throw new Error(
        `${file.source} in the pinned checkout differs from ${file.destination}.`,
      );
    }
  }
}

const imageNotice = await readFile(
  resolveInside(manifest.remix.noticePath),
  "utf8",
);
if (!imageNotice.includes(manifest.remix.notice)) {
  throw new Error(
    "The copied Remix image notice is missing its copyright line.",
  );
}

const fullLicense = await readFile(
  resolveInside(manifest.remix.fullLicensePath),
);
for (const copyPath of manifest.remix.productLicenseCopies) {
  const copy = await readFile(resolveInside(copyPath));
  if (!copy.equals(fullLicense)) {
    throw new Error(
      `${copyPath} differs from the tracked canonical Remix MIT notice.`,
    );
  }
}

for (const font of manifest.copiedFonts) {
  const license = await readFile(resolveInside(font.licenseFile), "utf8");
  const expectedNotice = font.notice ?? font.noticeInBundledLicenseFile;
  if (
    !license.includes("SIL OPEN FONT LICENSE Version 1.1") ||
    !license.includes(expectedNotice)
  ) {
    throw new Error(
      `The ${font.family} OFL notice is missing or inconsistent.`,
    );
  }
}

process.stdout.write(
  `Verified ${manifest.copiedImages.length} Story images and ${manifest.copiedFonts.length} font files against tracked SHA-256 values${hasUpstream ? " and the pinned Remix checkout" : ""}; required notices and ${manifest.remix.productLicenseCopies.length} full MIT license copies are present.\n`,
);
