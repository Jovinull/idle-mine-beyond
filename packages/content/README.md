# Remix content boundary

`src/remix-mine-content.json` contains the pinned Remix base objects, special object anchors, procedural skin-layer counts, and word list needed to reproduce mine objects. Its source revision and source files are embedded in the data file and recorded in [IP provenance](../../docs/knowledge/ip-provenance.md).

The file is derived from `tests/fixtures/parity/remix-reference-corpus.json` by `pnpm content:sync`. That command checks the canonical source SHA and expected table counts. `pnpm content:check` verifies the tracked file matches its source fixture. Neither command modifies the reference checkout or oracle fixture. Review and test any generated-content change before committing it. Preserve the upstream notice recorded in the data and the tracked [license copy](../../docs/knowledge/sources/licenses/idle-mine-remix-MIT.txt).

The package owns source-backed content data; procedural behavior belongs in the platform-independent core. `packages/core/src/mine-objects.ts` consumes this catalog to reproduce fixed objects, special anchors, and generated object records. This slice is compared with the captured object corpus, but it is not connected to an implemented mining loop or player UI.
