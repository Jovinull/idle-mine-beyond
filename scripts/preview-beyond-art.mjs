import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Local-only preview of the unshipped Beyond art pack: serves the normal web
// build, but answers /Images/* from art/beyond/Images when the pack has that
// file. Product code and the shipped build are untouched; Remix art stays the
// default everywhere else.
// Usage: pnpm art:preview [--no-build] [--port 4174]

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const buildRoot = path.join(root, "apps/web/build");
const packRoot = path.join(root, "art/beyond");
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const port = Number(argument("--port", "4174"));

if (!process.argv.includes("--no-build")) {
  // One command string: pnpm is a .cmd shim on Windows and needs a shell.
  const result = spawnSync("pnpm --dir apps/web build", {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

async function fileInside(base, requestPath) {
  const candidate = path.resolve(base, `.${requestPath}`);
  const relative = path.relative(base, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  const info = await stat(candidate).catch(() => null);
  return info?.isFile() ? candidate : null;
}

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(
    new URL(request.url ?? "/", "http://localhost").pathname,
  );
  const file =
    (requestPath.startsWith("/Images/")
      ? await fileInside(packRoot, requestPath)
      : null) ??
    (await fileInside(buildRoot, requestPath)) ??
    (path.extname(requestPath) ? null : path.join(buildRoot, "index.html"));
  if (!file) {
    response.writeHead(404).end("Not found");
    return;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type":
      types[path.extname(file).toLowerCase()] ?? "application/octet-stream",
  });
  response.end(await readFile(file));
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(
    `Beyond art preview: http://127.0.0.1:${port}/ (Ctrl+C to stop)\n`,
  );
});
