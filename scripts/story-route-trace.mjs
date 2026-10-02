import { createHash } from "node:crypto";

// A Story route trace has one JSON record per source checkpoint:
// `{ event, checkpoint: { label, state, random } }`. Captures in `.research/`
// keep every checkpoint. A compact trace keeps every event, but only some full
// checkpoints; each of those also carries `chain`, a SHA-256 chain over every
// checkpoint up to and including it, so a replay still proves each step.

/** Records between kept full checkpoints inside long repeated stretches. */
export const compactCheckpointInterval = 10_000;

/** JSON with sorted object keys; `undefined` properties are omitted. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Extends a checkpoint chain; start from the empty string. */
export function chainStoryRouteCheckpoint(previousChain, checkpoint) {
  return createHash("sha256")
    .update(previousChain)
    .update(canonicalJson(checkpoint))
    .digest("hex");
}

/** Farm breaks and the selections around them repeat for most of a route. */
export function isRepeatedStoryRouteEvent(event) {
  return (
    (event.type === "select" && event.purpose === "progress") ||
    ((event.type === "select" || event.type === "mine") &&
      event.purpose === "farm")
  );
}

/**
 * Turns full trace records into compact ones. Keeps the full checkpoint for
 * every progression event, every `compactCheckpointInterval`th record, and the
 * last record.
 */
export async function* compactStoryRouteRecords(records) {
  let chain = "";
  let index = 0;
  let pending;
  for await (const record of records) {
    if (pending) yield pending(false);
    index++;
    chain = chainStoryRouteCheckpoint(chain, record.checkpoint);
    const recordChain = chain;
    const keep =
      !isRepeatedStoryRouteEvent(record.event) ||
      index % compactCheckpointInterval === 0;
    pending = (last) =>
      keep || last
        ? {
            event: record.event,
            checkpoint: record.checkpoint,
            chain: recordChain,
          }
        : { event: record.event };
  }
  if (pending) yield pending(true);
}
