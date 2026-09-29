import { expect, it } from "vitest";

it("recognizes the frozen Remix source manifest as the parity oracle", async () => {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../../docs/knowledge/sources/reference-manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as { references: { name: string; role: string; pinnedCommit: string }[] };
  const remix = manifest.references.find(
    (reference) => reference.name === "Idle Mine: Remix",
  );

  expect(remix?.role).toBe("Canonical behavioral and source reference");
  expect(remix?.pinnedCommit).toMatch(/^[0-9a-f]{40}$/);
});
