import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignored = new Set([
  ".git",
  ".research",
  "node_modules",
  ".svelte-kit",
  "build",
  "target",
]);
const files = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(fullPath);
  }
}

async function checkMarkdownLinks(file, content, errors) {
  const expression = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(expression)) {
    const target = match[1].trim().replace(/^<|>$/g, "").split(/[?#]/, 1)[0];
    if (!target || /^(?:[a-z]+:|\/\/)/i.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
      errors.push(
        `${path.relative(root, file)}: link escapes repository: ${target}`,
      );
      continue;
    }
    try {
      await stat(resolved);
    } catch {
      errors.push(
        `${path.relative(root, file)}: missing link target: ${target}`,
      );
    }
  }
}

await walk(root);
const errors = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  await checkMarkdownLinks(file, content, errors);
}

try {
  JSON.parse(
    await readFile(
      path.join(root, "docs/knowledge/sources/reference-manifest.json"),
      "utf8",
    ),
  );
} catch (error) {
  errors.push(`Reference manifest is not valid JSON: ${error.message}`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Checked ${files.length} Markdown files and the reference manifest.\n`,
  );
}
