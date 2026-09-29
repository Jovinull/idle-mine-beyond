# Parity matrix

Status reflects evidence and validation, not code presence. All areas begin as **not started**. “Foundation only” means the test harness exists but no game behavior has been implemented or certified.

| Area                              | Source understood       | Behavior documented | Fixtures extracted | Unit / property tests | Golden tests | UI / E2E            | Visual | Parity status |
| --------------------------------- | ----------------------- | ------------------- | ------------------ | --------------------- | ------------ | ------------------- | ------ | ------------- |
| Big-number math and serialization | Partial source review   | Partial             | No                 | Harness only          | No           | —                   | —      | Not started   |
| Number formatting and notations   | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Fixed mine objects                | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Special mine objects              | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Procedural mine objects           | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Object drops and random outcomes  | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Mine rendering and compositing    | Source mechanism noted  | Partial             | No                 | No                    | No           | No                  | No     | Not started   |
| Active and idle damage            | Formula source reviewed | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Money and money upgrades          | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Gems and gem upgrades             | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Planet Coins and upgrades         | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Wisdom and Powers                 | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Upgrade costs, caps, and effects  | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Pickaxe crafting RNG              | Source reviewed         | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Pickaxe naming and replacement    | Source reviewed         | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Random distributions and RNG      | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Story and notifications           | Source structure noted  | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Save encoding and save shape      | Source path reviewed    | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Legacy save import and recovery   | Source path reviewed    | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Save export and round-trip        | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Offline progression and time      | Source path reviewed    | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Settings and input controls       | Partial source review   | Partial             | No                 | Harness only          | No           | No                  | No     | Not started   |
| Light and dark themes             | CSS source reviewed     | Partial             | No                 | —                     | No           | No                  | No     | Not started   |
| Desktop UI and visual parity      | Source structure noted  | Partial             | No                 | —                     | No           | Scaffold smoke only | No     | Not started   |
| Native packaging and platforms    | Shell scaffold checked  | No                  | No                 | No                    | No           | No                  | No     | Not started   |

Bootstrap smoke tests validate fixture metadata and harness wiring only. No row is complete.
