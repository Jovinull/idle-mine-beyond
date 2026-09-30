# Legacy quirks and known concerns

Strange does not mean wrong. First verify actual reference behavior, document it, create a test, and reproduce it during parity unless an exception is accepted.

## Source-observed implementation concerns

These are confirmed in code at the pinned revision. Player-visible effects should still be reproduced or independently measured before calling them runtime defects.

| Concern                                                                                                                                                                            | Source evidence                                                                          | Classification                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Main loop uses Date.now() and requestAnimationFrame; at most one idle hit is processed per update and timer is reset to zero                                                       | Scripts/main.js                                                                          | Legacy timing quirk; background impact requires runtime measurement                                             |
| Story milestone conditions are evaluated with eval                                                                                                                                 | Scripts/Define/functions.js                                                              | Internal implementation/security concern; replace only behind compatibility tests                               |
| Game logic calls Math.random directly                                                                                                                                              | Scripts/pickaxe.js, Scripts/mineobject.js, Scripts/utils.js, Scripts/Define/game.js      | Testability and reproducibility concern                                                                         |
| Save timestamps call Date.now directly                                                                                                                                             | Scripts/Define/game.js and Scripts/Define/functions.js                                   | Testability concern                                                                                             |
| Gameplay code accesses localStorage directly                                                                                                                                       | Scripts/Define/functions.js                                                              | Platform coupling                                                                                               |
| Every random pickaxe craft evaluates the Blacksmith Expertise effect and consumes one random draw even at level zero; a positive level below its 25% chance consumes a second draw | Scripts/Define/game.js, Scripts/pickaxe.js; seeded crafting distribution probe           | Random-stream compatibility quirk; later Power, Quality, streak, and name rolls depend on preserving this order |
| Hard reset requires three confirmations, calls localStorage.clear(), reloads the startup snapshot without saving, and preserves loop timers and startup lastActive                 | Scripts/Define/functions.js, Scripts/Define/game.js; `hardResetSemantics` runtime corpus | Broad storage clearing and stale reset timestamp are verified compatibility behavior                            |
| Save loading mutates a shared global game object                                                                                                                                   | Scripts/Define/game.js and Scripts/Define/functions.js                                   | Architecture concern                                                                                            |
| No formal versioned schema/migration layer is evident in the inspected save path                                                                                                   | Scripts/Define/functions.js                                                              | Recovery/compatibility concern; full audit remains open                                                         |
| No automated test setup exists in the pinned Remix repository                                                                                                                      | Repository contents                                                                      | Verification gap                                                                                                |

## Reported player concerns (not specifications)

The bootstrap research records community criticism about long gem grinds, dud frustration, autoclicker advantage, one-hit farming, story pacing, background-tab progress, and save loss. These reports are valuable research leads, not proof of exact mechanics. Preserve them in the post-parity backlog with source links and do not change parity behavior based on them.

## Rate hit-count overflow

**Verified legacy behavior (source and controlled runtime):** at Mud with pickaxe damage `1e-308` and Idle Power level 1, damage remains positive as a Decimal but `totalHp / damage` exceeds Number range. Remix's `Math.ceil` conversion turns the hit count into Infinity, so MPC, MPS, and GPS evaluate to zero. The fixture case is `number-hit-count-overflow`. This confirms the code path, not that ordinary play can reach the state; save reachability remains unverified.

## Verified extreme-ID result

Under the pinned runtime and break_infinity.js 2.2.0 snapshot, `functions.getMineObject(Number.MAX_SAFE_INTEGER)` returns an object whose HP, defense, and value stringify as `Infinity`; the fixture retains the finite mantissa/exponent representation returned by Decimal. This is an observed output at a pathological, impractical ID. Whether the game can reach or display that ID through ordinary progression is unverified, so do not generalize it into a player-visible defect.

## Seeded RNG sequence exhaustion

**Verified legacy behavior (source and controlled runtime):** `Scripts/random.js` warms a new `Random` instance through ten digits of its 50-character `SEQ`. It does not wrap the sequence. The first 40 draws after construction use remaining digits; draw 41 parses `undefined`, making the RNG state and result `NaN`. The pinned runtime output is in `randomSequenceExhaustion` in the reference corpus.

The current object generator consumes four draws per post-Universe object, so this limit is not reached by one generation call. Preserve the behavior if matching the source class; do not add sequence cycling as cleanup. Beyond requires an explicit seed and excludes the source's seedless `Date.now()` path by project decision.

## Highest damageable object scan

**Verified legacy behavior (source and controlled runtime):** `functions.getHighestDamageableMineObjectLevel()` scans only from `max(0, game.mineObjectLevel - 1)` through nine levels ahead, returning `i - 1` when either the baseline active or idle damage cannot pass the candidate object's defense. If all ten probes are damageable, it returns `Number.MAX_SAFE_INTEGER` instead of the last scanned index. In the captured upgraded scenario at current object 90, this returned `9007199254740991`. With zero damage at THE UNIVERSE (current index 214), it returned 212 because scanning starts at 213. `getGPS()` compares the current index against this result to decide whether to apply the last-object gem multiplier, so preserve this behavior pending any accepted exception.

## Pickaxe names bypass exact special-object lookup

**Verified source and controlled runtime behavior:** `Pickaxe.generateName()` reads `game.mineObjects[id]`; when the slot is absent, it calls `functions.generateMineObject(id)` directly rather than `functions.getMineObject(id)`. `getMineObject()` first checks `game.specialMineObjects`, but the fallback generator only uses special anchors with indices strictly less than `id`. In the controlled pickaxe fixture, a name roll selects ID 210 and produces `HD 4943-b`, while ordinary mine-object lookup at ID 210 returns `Galaxy Supercluster`. Preserve this mismatch in pickaxe naming; do not substitute the displayed mine-object name.

## Mining hit and object-break transitions

**Verified legacy behavior (source and controlled runtime):** the idle timer uses a strict `>` interval check, performs at most one hit per update, resets to zero, and discards excess elapsed time. On a breaking hit, Remix awards Money and replaces the object with full HP at the same index; it does not carry over damage or navigate automatically. Reward RNG order is Gem first, then Planet Coin if defined, then Wisdom if defined. The Gem roll is attempted on every break. Captured hit cases and the pure Beyond action boundary are in `miningHitSemantics` and `packages/core/src/remix-mining-transitions.ts`; save/story loop behavior and wider drop distributions remain open.

## Autosave and frame event ordering

**Verified source and controlled runtime behavior:** the update-frame save timer uses strict `> 60`, resets to zero after one save request, and discards excess time even when a long frame crosses multiple intervals. Exact equality does not save. `refreshStoryNotifications()` is requested every update after the save check; active clicks do not run either frame event. A backwards clock delta decreases both timers. Four `frame-*` cases in `miningHitSemantics` capture these outcomes. Actual persistence and milestone-condition transitions remain separate compatibility work.

**Verified source and controlled runtime behavior:** `update()` applies an idle hit, calls `saveGame()` when due, then refreshes Story notifications. If that hit unlocks Story milestones on the same frame, the save contains the updated mining resources/progress but the old Story high-water index and notification count; the live state advances Story immediately afterward. `simulationFrameSemantics.idle-break-saves-before-story-notification-refresh` captures this order. Preserve it when a real save adapter is connected.

## Offline load at zero rates and repeated clock reads

**Verified source and controlled runtime behavior:** once `offlineSec > 300` and `nooffline` is false, Remix logs the welcome-back message and saves even if all three offline rates are zero. It still raises `highestMoney` to at least the current Money and `maxPlanetCoins` to at least the current Planet Coins. `loadGame()` evaluates the `Date.now()` fallback while loading `lastActive` even when that field exists, then reads the clock again for elapsed time. Applied offline progress reads it once for `lastActive` and `saveGame()` reads it again before serialization. `offlineProgressionSemantics` captures these call counts and a clock advancing between each read; preserve the read order through an injected clock.

## Save encoding corrupts non-ASCII text

**Verified source and controlled runtime behavior:** `getSaveString()` encodes `JSON.stringify(game)` with `encodeURIComponent`, then `escape`, then `btoa`. `loadGame()` applies `atob`, `decodeURIComponent`, then `unescape` before `JSON.parse`. Because `unescape` runs after the UTF-8 percent bytes have been decoded into `%HH` escapes, those bytes become individual U+00xx characters. The controlled pickaxe-name round-trip in `saveSemantics` changes `Probe — Å Ω →` into the UTF-8 byte characters instead of preserving the original text; `decodedMatchesJson` is false for the captured starting save as well. Treat this as a legacy defect that remains part of observed compatibility behavior until a documented exception is approved.

## Partial legacy save fields preserve mixed defaults

**Verified source and controlled runtime behavior:** for the deliberately minimal save `{ "story": {} }`, missing resource fields pass through `new Decimal(undefined)` before `loadVal`, so they become zero rather than using the apparent alternate value (including the fresh-game 5-Gem value). Missing Story subfields default to page 0, zero notifications, highest unlocked -1, and scroll 0. Missing Gem and Planet Coin upgrade groups reset their levels; missing settings, Money upgrades, Powers, and pickaxe groups leave the preexisting runtime values untouched. The seeded sentinel results are in `saveSemantics.missingOptionalGroups`. This does not specify all historical saves or malformed-input behavior.

Present-but-empty groups behave differently from absent groups. Empty `upgrades`, `gemUpgrades`, and `planetCoinUpgrades` objects preserve seeded levels; an empty `powers` upgrade group resets its levels, while an empty Powers values array preserves existing values. The saved Story tab is ignored by `loadGame()`, which leaves the runtime tab untouched. An empty pickaxe object sets its fallback name but its Decimal power and quality become zero because `new Decimal(undefined)` runs before `loadVal`. `saveSemantics.emptyPresentGroups` captures these outcomes.

**Verified source and controlled runtime behavior:** empty Base64 and valid Base64 containing invalid JSON throw `SyntaxError` without an alert. Invalid Base64 and Base64 containing an invalid percent escape trigger an `Error loading Game: ` alert and then still throw `SyntaxError` because `loadGame()` continues to `JSON.parse(undefined)`. A syntactically valid JSON object without `story` throws `TypeError` only after resource and mine-level fields have already been assigned. `saveSemantics.loadErrors` captures these partial effects and ordering; `saveSemantics.base64Variants` confirms that ASCII whitespace and omitted padding are accepted. Malformed-input recovery remains unimplemented.

## Story notification high-water gaps

**Verified source and controlled runtime behavior:** `refreshStoryNotifications()` scans every remaining milestone index after `highestUnlocked`, without stopping at an unsatisfied condition. If a later independent condition is already true, it can move the high-water index past earlier false milestones. The two-stage `notificationSequence` in `storySemantics` first advances to index 28 with `planetcoin`, then makes `firstMud` true; `storyDisplayed()` shows it while the notification count remains unchanged. Keep direct visibility and notifications as separate rules; do not replace the source scan with a consecutive-unlock loop.

## Fresh settings number-format selection index

**Verified source and controlled runtime behavior:** the initial `game.numberFormatter` in `Scripts/Define/game.js` is a separate `StandardNotation` instance from the first item in `game.numberFormatters`. `functions.refreshNumberSelect()` uses identity comparison to find the selected formatter; in the captured fresh state, the result is `-1` after its 50 ms callback. The `leaving-story-saves-scroll-and-refreshes-settings-select` case in `storyTabSemantics` records this value. Preserve the source result during compatibility work; whether the empty selection is visually apparent in the real settings DOM remains unverified.

## Active damage object argument

**Verified legacy behavior (source and controlled runtime):** `functions.getActiveDamage(obj)` subtracts the supplied object's defense from its direct-damage term, then adds `functions.getIdleDPS(obj)` multiplied by Planet Coin Active Power. `getIdleDPS` declares no parameter and reads `game.currentMineObject`, so its supplied `obj` is ignored. The `currentObjectArgumentQuirk` fixture captures a current object at index 90 and explicit target at 118; Beyond reproduces this split in `calculateRemixActiveDamage`.

## Exception policy

No listed concern grants permission to change observable behavior. See [behavioral exceptions](BEHAVIORAL_EXCEPTIONS.md).
