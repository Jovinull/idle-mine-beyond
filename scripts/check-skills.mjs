import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(root, ".agents/skills");
const expected = [
  "idle-mine-parity",
  "idle-mine-reference-probe",
  "idle-mine-visual-qa",
  "idle-mine-save-compat",
  "idle-mine-research",
  "idle-mine-release",
];
const entries = await readdir(skillsRoot, { withFileTypes: true });
const actual = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const errors = [];

for (const name of expected) {
  const skillPath = path.join(skillsRoot, name, "SKILL.md");
  try {
    const content = await readFile(skillPath, "utf8");
    const description = content.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!content.startsWith(`---\nname: ${name}\n`) || !description) {
      errors.push(`${name}: missing supported frontmatter name or description`);
    }
    if (!content.includes("docs/knowledge/"))
      errors.push(`${name}: must link canonical knowledge documents`);
  } catch {
    errors.push(`${name}: missing SKILL.md`);
  }
}

for (const name of actual) {
  if (!expected.includes(name))
    errors.push(`${name}: unexpected project Skill folder`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${expected.length} project Skills.\n`);
}
