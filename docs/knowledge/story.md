# Story system

The Remix source stores story chapters and ordered milestones with conditions, display text, and chapter/page indices. Story unlock checks in the pinned source evaluate condition expressions with eval. The UI has chapter navigation, milestone notifications, and saved page/scroll state.

**Verified source observation:** story content is part of the target and must not be paraphrased, shortened, reorganized, or have jokes removed during parity. The source text and exact milestone ordering require dedicated fixtures.

**Known implementation concern:** eval is an internal legacy implementation detail. Beyond may replace the condition evaluator with typed data while preserving milestone unlock timing and presentation. That refactor requires parity tests.

Open extraction work includes every milestone condition, text block, page boundary, notification rule, scroll-restoration behavior, and all interactions when the player moves between story and other tabs.
