# Behavioral exceptions

## Default

**No pre-parity behavioral exceptions are approved.**

Do not silently “fix” a legacy behavior because it appears strange, inconvenient, unsafe, or poorly balanced. Verify the live/source behavior, record it as a legacy quirk or defect, and reproduce it during parity unless an exception is explicitly accepted.

## Required record for an exception

For every proposed player-visible deviation before parity-v1, record:

- Reference behavior and exact pinned source/runtime evidence.
- The observable problem and affected states.
- The intentional Beyond behavior.
- Why the deviation is required before parity.
- Compatibility, save, and platform impact.
- Tests and fixtures proving the new behavior.
- Decision date, status, and approver.

## Exception log

| ID  | Deviation | Evidence | Tests | Decision | Status        |
| --- | --------- | -------- | ----- | -------- | ------------- |
| —   | None      | —        | —     | —        | No exceptions |

Internal refactors that do not change observable behavior are not exceptions, but still require regression coverage where behavior is at risk.
