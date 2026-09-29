# Pickaxe and crafting compatibility

## Non-negotiable rule

Remix crafting is stochastic and procedural. A pickaxe can be a dud. The current pickaxe is replaced only when a new pickaxe has strictly greater damage. Preserve the generated name, power, quality, damage, bonus, gem consumption, roll order, and dud feedback.

## Source-observed model

A pickaxe stores name, power, and quality. Damage is power × quality. Scripts/pickaxe.js computes a gem power multiplier equivalent to (gems − 1) / 5 + 1, then calculates power and quality using the money upgrades, gem input, and random rolls. Blacksmith Expertise adds 15% power per applied bonus point.

Quality receives repeated 1.15 multipliers on successive 50% rolls, stopping on the first failure or at the loop limit of 15. Names depend on quality tier, a random name form, and sometimes a nearby mine object. A name may include a bonus suffix.

The average and minimum-craft display paths use a separate deterministic average mode. Do not use that mode as the implementation for a real craft.

## Craft flow

Scripts/Define/functions.js computes gems used through Gem Waster, supports a bulk loop while Shift is held, subtracts gems per attempt, and replaces the current tool only when new damage is greater. A dud emits a message containing the crafted P, Q, and damage values.

## RNG

The source calls Math.random directly in crafting and naming, and the normal object/drop logic also has random calls. The procedural generator has its own seeded Random implementation. Beyond will inject an explicit RNG service; reference random-call order is compatibility-critical.

## Tests required before implementation is considered complete

- Fixed state and controlled sequence of random values.
- Minimum, average, and sampled craft outputs.
- Quality roll stopping and 15-roll limit.
- Name branches and edge quality tiers.
- Expertise bonus and bulk craft behavior.
- Gem consumption, insufficient gems, dud feedback, and strict greater-than replacement.
- Distribution tests based on repeated reference samples, with tolerances justified by sample size.

## Prior art warning

Remux's generator sets quality to 1 and calculates power from input gems × 20 × one random value. That is not the Remix algorithm and must not be ported as the compatibility implementation.
