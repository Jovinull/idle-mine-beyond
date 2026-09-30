import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Serves apps/site/build the way a static host does: directory URLs get
// index.html, missing trailing slashes redirect, unknown paths get 404.html.
// Usage: pnpm site:preview [--port 4175] [--host 127.0.0.1]

const root = path.resolve(
  fileURLToPath(new URL("../apps/site/build", import.meta.url)),
);
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index > 0 ? process.argv[index + 1] : fallback;
};
const port = Number(argument("--port", "4175"));
const host = argument("--host", "127.0.0.1");

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
};

async function isFile(file) {
  return (await stat(file).catch(() => null))?.isFile() ?? false;
}

async function resolve(pathname) {
  const target = path.resolve(root, `.${pathname}`);
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (pathname.endsWith("/")) {
    const index = path.join(target, "index.html");
    return (await isFile(index)) ? { file: index } : null;
  }
  if (await isFile(target)) return { file: target };
  if (await isFile(path.join(target, "index.html"))) {
    return { redirect: `${pathname}/` };
  }
  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const found = await resolve(pathname);
  if (found?.redirect) {
    response.writeHead(308, { Location: `${found.redirect}${url.search}` });
    response.end();
    return;
  }
  const file = found?.file ?? path.join(root, "404.html");
  const body = await readFile(file);
  response.writeHead(found ? 200 : 404, {
    "Content-Type":
      types[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  response.end(body);
});

server.listen(port, host, () => {
  process.stdout.write(
    `Site preview: http://${host}:${port}/ (Ctrl+C to stop)\n`,
  );
});
