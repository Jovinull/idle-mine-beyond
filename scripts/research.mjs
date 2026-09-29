import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const researchRoot = path.join(root, ".research");
const manifestPath = path.join(
  root,
  "docs/knowledge/sources/reference-manifest.json",
);
const immutableNotice = `# Local reference workspace\n\nCanonical upstream checkouts are reference-only. Do not edit, reformat, update dependencies, or modify these repositories. If instrumentation is needed, create a separate derived copy and retain the untouched checkout.\n`;

async function git(args, cwd = root) {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    windowsHide: true,
  });
  return stdout.trim();
}

async function verifyCheckout(reference, checkout) {
  const origin = await git(["remote", "get-url", "origin"], checkout);
  const revision = await git(["rev-parse", "HEAD"], checkout);
  const status = await git(["status", "--porcelain"], checkout);
  const expectedUrl = reference.canonicalUrl.replace(/\.git$/, "");
  if (
    origin.replace(/\.git$/, "").toLowerCase() !== expectedUrl.toLowerCase()
  ) {
    throw new Error(
      `${reference.name}: unexpected origin ${origin}; expected ${reference.canonicalUrl}`,
    );
  }
  if (revision !== reference.pinnedCommit) {
    throw new Error(
      `${reference.name}: HEAD ${revision} differs from manifest ${reference.pinnedCommit}`,
    );
  }
  if (status) {
    throw new Error(
      `${reference.name}: checkout is dirty. Preserve it and investigate manually; setup does not reset references.`,
    );
  }
  return { name: reference.name, revision, clean: true };
}

async function main() {
  const action = process.argv[2] ?? "check";
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const references = manifest.references.filter(
    (reference) => reference.researchCheckout,
  );
  for (const directory of ["upstream", "snapshots", "experiments", "outputs"]) {
    await mkdir(path.join(researchRoot, directory), { recursive: true });
  }

  const noticePath = path.join(researchRoot, "README.md");
  try {
    const existing = await readFile(noticePath, "utf8");
    if (existing !== immutableNotice) {
      throw new Error(
        `${noticePath} exists with different content. It was not overwritten.`,
      );
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(noticePath, immutableNotice, { flag: "wx" });
  }

  const results = [];
  for (const reference of references) {
    const checkout = path.resolve(root, reference.researchCheckout);
    if (!checkout.startsWith(`${path.resolve(researchRoot)}${path.sep}`)) {
      throw new Error(
        `Refusing a checkout outside .research: ${reference.researchCheckout}`,
      );
    }
    try {
      await git(["rev-parse", "--git-dir"], checkout);
      results.push(await verifyCheckout(reference, checkout));
    } catch (error) {
      if (
        error.code !== "ENOENT" &&
        !String(error.stderr ?? "").includes("not a git repository")
      )
        throw error;
      if (action !== "setup") {
        throw new Error(
          `${reference.name}: missing clone; run pnpm research:setup`,
          { cause: error },
        );
      }
      await execFileAsync(
        "git",
        [
          "clone",
          "--no-checkout",
          "--filter=blob:none",
          reference.canonicalUrl,
          checkout,
        ],
        {
          cwd: root,
          windowsHide: true,
        },
      );
      await git(["checkout", "--detach", reference.pinnedCommit], checkout);
      results.push(await verifyCheckout(reference, checkout));
    }
  }
  for (const result of results) {
    process.stdout.write(`${result.name}: ${result.revision} (clean)\n`);
  }
  process.stdout.write(
    action === "setup"
      ? "Research workspace is ready.\n"
      : "Pinned checkouts verified.\n",
  );
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
