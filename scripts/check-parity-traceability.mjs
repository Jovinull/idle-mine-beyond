import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mapPath = path.join(
  root,
  "docs/knowledge/parity-traceability/areas.json",
);
const remixRoot = path.join(root, ".research/upstream/idle-mine-remix");
const registry = JSON.parse(await readFile(mapPath, "utf8"));
const matrix = await readFile(path.join(root, registry.matrix), "utf8");
const entries = registry.areas;
const names = entries.map(({ name }) => name);
const failures = [];
const assertionTestPattern =
  /`(?:tests\/(?:parity|unit|e2e)|packages\/[^`]+)\/[^`]+\.(?:test|spec)\.ts`/;
const assertionTestReferencesPattern =
  /`((?:tests\/(?:parity|unit|e2e)|packages\/[^`]+)\/[^`]+\.(?:test|spec)\.ts)`/g;

if (new Set(names).size !== names.length) {
  failures.push("The area registry contains duplicate names.");
}

const matrixAreas = new Map();
for (const line of matrix.split(/\r?\n/)) {
  if (!line.startsWith("|")) continue;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
  const name = cells[0];
  if (!name || name === "Area" || /^-+$/.test(name)) continue;
  matrixAreas.set(name, cells.at(-1));
}

const registeredAreas = new Set(names);
for (const area of matrixAreas.keys()) {
  if (!registeredAreas.has(area)) {
    failures.push(`Matrix area has no traceability entry: ${area}`);
  }
}
for (const area of registeredAreas) {
  if (!matrixAreas.has(area)) {
    failures.push(`Traceability entry is not a matrix area: ${area}`);
  }
}

const documents = new Map();
for (const entry of entries) {
  const documentPath = path.resolve(path.dirname(mapPath), entry.document);
  let contents = documents.get(documentPath);
  if (contents === undefined) {
    contents = await readFile(documentPath, "utf8").catch(() => undefined);
    if (contents === undefined) {
      failures.push(`Missing traceability document: ${entry.document}`);
      continue;
    }
    documents.set(documentPath, contents);
  }

  const heading = `## ${entry.heading}`;
  const headingIndex = contents.indexOf(`${heading}\n`);
  if (headingIndex === -1) {
    failures.push(
      `Missing traceability heading for ${entry.name}: ${entry.document}#${entry.heading}`,
    );
    continue;
  }

  const bodyStart = headingIndex + heading.length;
  const nextHeading = contents.indexOf("\n## ", bodyStart);
  const section = contents.slice(
    bodyStart,
    nextHeading === -1 ? contents.length : nextHeading,
  );
  const hasRemixSource = /\*\*Remix source(?: branches)?:\*\*/.test(section);
  const hasBeyondSource = /\*\*Beyond source:\*\*/.test(section);
  const hasSourceStatus =
    /\*\*(?:Covered(?: branches| foundation)?|Gap(?: \/ sampled)?|Sampled(?: \(qualified\))?|Scope):\*\*/.test(
      section,
    );
  const traceHeading = section.match(/^### .*function and branch trace\s*$/m);

  if (entry.name !== "Visual slice" && !hasRemixSource && !hasBeyondSource) {
    failures.push(
      `Traceability section has no source declaration: ${entry.name}`,
    );
  }
  if (entry.name !== "Visual slice" && !hasSourceStatus) {
    failures.push(
      `Traceability section has no coverage/gap/scope status: ${entry.name}`,
    );
  }
  if (entry.name !== "Visual slice" && !traceHeading) {
    failures.push(
      `Traceability section has no function/branch inventory: ${entry.name}`,
    );
  }

  if (traceHeading) {
    const afterHeading = section.slice(
      (traceHeading.index ?? 0) + traceHeading[0].length,
    );
    const tableHeader = afterHeading.match(/^\|.*\|\s*$/m);
    if (!tableHeader) {
      failures.push(`Function/branch inventory has no table: ${entry.name}`);
    } else {
      const table = afterHeading.slice(tableHeader.index ?? 0);
      const tableLines = table
        .split(/\r?\n/)
        .filter((line) => line.startsWith("|"));
      const isSeparatorRow = (line) =>
        /^\|\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|$/.test(line);
      const rows = tableLines.filter(
        (line, index) =>
          !isSeparatorRow(line) && !isSeparatorRow(tableLines[index + 1] ?? ""),
      );
      if (rows.length === 0) {
        failures.push(
          `Function/branch inventory has no mapped paths: ${entry.name}`,
        );
      }
      for (const [index, row] of rows.entries()) {
        const cells = row
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (cells.length !== 3 || cells.some((cell) => cell.length === 0)) {
          failures.push(
            `Mapped path ${index + 1} must contain a source branch, evidence, and assertion: ${entry.name}`,
          );
        }
        if (
          !assertionTestPattern.test(row) &&
          !row.includes("Out of web-v1 scope") &&
          !row.includes("**Gap:**")
        ) {
          failures.push(
            `Mapped path ${index + 1} has no assertion test or explicit scope: ${entry.name}`,
          );
        }
      }
    }
  }

  const hasUncoveredGap = /\*\*Gap(?: \/ sampled)?(?::|\*\*)/.test(section);
  const hasUnqualifiedSample = /\*\*Sampled(?::|\*\*)/.test(section);
  if (
    matrixAreas.get(entry.name) === "Certified" &&
    (hasUncoveredGap || hasUnqualifiedSample)
  ) {
    failures.push(
      `Matrix area is marked Certified while its source map records an open gap: ${entry.name}`,
    );
  }
  if (
    entry.name !== "Visual slice" &&
    !section.includes("Out of web-v1 scope") &&
    !assertionTestPattern.test(section)
  ) {
    failures.push(
      `In-scope traceability section has no linked test: ${entry.name}`,
    );
  }

  for (const [, testPath] of section.matchAll(assertionTestReferencesPattern)) {
    await readFile(path.join(root, testPath), "utf8").catch(() => {
      failures.push(`Missing test referenced by traceability map: ${testPath}`);
    });
  }

  for (const [, sourceReference] of section.matchAll(
    /`((?:Scripts\/[^`]+?\.js|index\.html)(?::[^`]*)?)`/g,
  )) {
    const [sourcePath, ...referenceParts] = sourceReference.split(":");
    const sourceLocator = referenceParts.join(":");
    const functionName = sourceLocator.match(
      /([A-Za-z_$][\w$]*)\s*(?:\([^)]*\))?$/,
    )?.[1];
    const pinnedPath = path.join(remixRoot, sourcePath);
    const source = await readFile(pinnedPath, "utf8").catch(() => undefined);
    if (source === undefined) {
      failures.push(`Missing pinned Remix source path: ${sourcePath}`);
    } else if (sourcePath === "index.html" && /^\d+$/.test(sourceLocator)) {
      const line = source.split(/\r?\n/)[Number(sourceLocator) - 1];
      if (!line?.includes("highestMineObjectLevel >= 90")) {
        failures.push(
          `Pinned Remix source line changed: ${sourcePath}:${sourceLocator}`,
        );
      }
    } else if (functionName && !source.includes(functionName)) {
      failures.push(
        `Pinned source path does not contain mapped function ${sourceReference}`,
      );
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Verified source-to-test traceability entries for ${registeredAreas.size} parity matrix areas. No certification status is inferred by this check.\n`,
  );
}
