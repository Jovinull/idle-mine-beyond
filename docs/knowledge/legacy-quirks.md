# Legacy quirks and known concerns

Strange does not mean wrong. First verify actual reference behavior, document it, create a test, and reproduce it during parity unless an exception is accepted.

## Source-observed implementation concerns

These are confirmed in code at the pinned revision. Player-visible effects should still be reproduced or independently measured before calling them runtime defects.

| Concern                                                                                                                      | Source evidence                                                                     | Classification                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Main loop uses Date.now() and requestAnimationFrame; at most one idle hit is processed per update and timer is reset to zero | Scripts/main.js                                                                     | Legacy timing quirk; background impact requires runtime measurement               |
| Story milestone conditions are evaluated with eval                                                                           | Scripts/Define/functions.js                                                         | Internal implementation/security concern; replace only behind compatibility tests |
| Game logic calls Math.random directly                                                                                        | Scripts/pickaxe.js, Scripts/mineobject.js, Scripts/utils.js, Scripts/Define/game.js | Testability and reproducibility concern                                           |
| Save timestamps call Date.now directly                                                                                       | Scripts/Define/game.js and Scripts/Define/functions.js                              | Testability concern                                                               |
| Gameplay code accesses localStorage directly                                                                                 | Scripts/Define/functions.js                                                         | Platform coupling                                                                 |
| Hard reset calls localStorage.clear()                                                                                        | Scripts/Define/functions.js                                                         | Potentially broad storage clearing                                                |
| Save loading mutates a shared global game object                                                                             | Scripts/Define/game.js and Scripts/Define/functions.js                              | Architecture concern                                                              |
| No formal versioned schema/migration layer is evident in the inspected save path                                             | Scripts/Define/functions.js                                                         | Recovery/compatibility concern; full audit remains open                           |
| No automated test setup exists in the pinned Remix repository                                                                | Repository contents                                                                 | Verification gap                                                                  |

## Reported player concerns (not specifications)

The bootstrap research records community criticism about long gem grinds, dud frustration, autoclicker advantage, one-hit farming, story pacing, background-tab progress, and save loss. These reports are valuable research leads, not proof of exact mechanics. Preserve them in the post-parity backlog with source links and do not change parity behavior based on them.

## Suspected edge case

Some rate functions convert hit counts to Number and divide by idle damage. Whether this produces player-visible problems in reachable states has not been verified. Treat it as a hypothesis until a focused probe establishes the behavior.

## Verified extreme-ID result

Under the pinned runtime and break_infinity.js 2.2.0 snapshot, `functions.getMineObject(Number.MAX_SAFE_INTEGER)` returns an object whose HP, defense, and value stringify as `Infinity`; the fixture retains the finite mantissa/exponent representation returned by Decimal. This is an observed output at a pathological, impractical ID. Whether the game can reach or display that ID through ordinary progression is unverified, so do not generalize it into a player-visible defect.

## Seeded RNG sequence exhaustion

**Verified legacy behavior (source and controlled runtime):** `Scripts/random.js` warms a new `Random` instance through ten digits of its 50-character `SEQ`. It does not wrap the sequence. The first 40 draws after construction use remaining digits; draw 41 parses `undefined`, making the RNG state and result `NaN`. The pinned runtime output is in `randomSequenceExhaustion` in the reference corpus.

The current object generator consumes four draws per post-Universe object, so this limit is not reached by one generation call. Preserve the behavior if matching the source class; do not add sequence cycling as cleanup. Beyond requires an explicit seed and excludes the source's seedless `Date.now()` path by project decision.

## Exception policy

No listed concern grants permission to change observable behavior. See [behavioral exceptions](BEHAVIORAL_EXCEPTIONS.md).
