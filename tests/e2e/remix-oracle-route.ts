import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { BrowserContext } from "@playwright/test";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const oracleOrigin = "http://remix-reference.invalid";

type ReferenceManifest = {
  references: {
    name: string;
    pinnedCommit: string;
    researchCheckout: string;
  }[];
};

type DependencyManifest = {
  sourceCommit: string;
  dependencies: {
    originalRequestUrl: string;
    researchSnapshot: string;
    sha256: string;
  }[];
};

function mimeType(filePath: string): string {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ttf": "font/ttf",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    }[path.extname(filePath).toLowerCase()] ?? "application/octet-stream"
  );
}

export async function routePinnedRemixOracle(
  context: BrowserContext,
): Promise<string> {
  const [referenceManifest, dependencyManifest] = await Promise.all([
    readFile(
      path.join(projectRoot, "docs/knowledge/sources/reference-manifest.json"),
      "utf8",
    ).then((text) => JSON.parse(text) as ReferenceManifest),
    readFile(
      path.join(
        projectRoot,
        "docs/knowledge/sources/runtime-dependencies.json",
      ),
      "utf8",
    ).then((text) => JSON.parse(text) as DependencyManifest),
  ]);
  const reference = referenceManifest.references.find(
    ({ name }) => name === "Idle Mine: Remix",
  );
  if (!reference) throw new Error("Canonical Remix source pin is missing.");
  if (dependencyManifest.sourceCommit !== reference.pinnedCommit) {
    throw new Error(
      "Remix runtime dependency snapshots do not match the source pin.",
    );
  }

  const sourceRoot = path.resolve(projectRoot, reference.researchCheckout);
  const [revision, status] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: sourceRoot,
      windowsHide: true,
    }),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: sourceRoot,
      windowsHide: true,
    }),
  ]);
  if (
    revision.stdout.trim() !== reference.pinnedCommit ||
    status.stdout.trim()
  ) {
    throw new Error(
      `Remix oracle must be clean at ${reference.pinnedCommit}; found ${revision.stdout.trim()}${status.stdout.trim() ? " with a dirty worktree" : ""}.`,
    );
  }

  const dependencySnapshots = new Map<string, Buffer>();
  for (const dependency of dependencyManifest.dependencies) {
    const contents = await readFile(
      path.resolve(projectRoot, dependency.researchSnapshot),
    );
    const digest = createHash("sha256").update(contents).digest("hex");
    if (digest !== dependency.sha256) {
      throw new Error(
        "A pinned Remix runtime dependency failed its SHA-256 check.",
      );
    }
    dependencySnapshots.set(dependency.originalRequestUrl, contents);
  }

  await context.route("**/*", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      await route.fulfill({ status: 405, headers: { Allow: "GET, HEAD" } });
      return;
    }

    if (requestUrl.origin === oracleOrigin) {
      let pathname: string;
      try {
        pathname = decodeURIComponent(requestUrl.pathname);
      } catch {
        await route.fulfill({ status: 400 });
        return;
      }
      if (pathname.split("/").includes(".git")) {
        await route.fulfill({ status: 403 });
        return;
      }
      if (pathname === "/") pathname = "/index.html";
      const absolutePath = path.resolve(sourceRoot, `.${pathname}`);
      const relativePath = path.relative(sourceRoot, absolutePath);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
      ) {
        await route.fulfill({ status: 403 });
        return;
      }
      try {
        const contents = await readFile(absolutePath);
        const response = {
          contentType: mimeType(absolutePath),
          headers: { "Cache-Control": "no-store" },
          status: 200,
        };
        if (request.method() === "HEAD") {
          await route.fulfill(response);
        } else {
          await route.fulfill({ ...response, body: contents });
        }
      } catch {
        await route.fulfill({ status: 404 });
      }
      return;
    }

    const snapshot = dependencySnapshots.get(request.url());
    if (snapshot) {
      const response = {
        contentType: "application/javascript; charset=utf-8",
        status: 200,
      };
      if (request.method() === "HEAD") {
        await route.fulfill(response);
      } else {
        await route.fulfill({ ...response, body: snapshot });
      }
      return;
    }

    await route.abort("blockedbyclient");
  });

  return `${oracleOrigin}/index.html`;
}
