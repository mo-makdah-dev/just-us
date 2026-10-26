# Reusable game platform and shared waiting room

## Goal
A game owns its rules, state, actions and board. The platform owns sessions, membership, permissions, readiness, lifecycle, transport and account scoring. A future game registers its module and client renderer, without copying room or waiting-room code.

## 1. Contracts and modules
- Introduce a discriminated game ID/action/view contract and a shared catalogue with supported modes and participant limits.
- Move tic-tac-toe-specific protocol types into its own module.
- Give the server a module registry with schema, state creation, rules, projection, active-state and cleanup hooks. Keep persisted data validated.
- Route new clients through generic session and game-action commands; retain a clearly isolated compatibility adapter for existing commands and stored room data.

## 2. Shared session service
- Own open/close, mode choice, self-join/leave, readiness and start validation in one service.
- Anyone admitted to a room may join/watch; the existing owner setting controls creating/configuring/starting games, not participation.
- The opener gets a seat; everyone else chooses Join game or Watch. Joining marks a person ready; each player can toggle readiness. No caller may assign another person's seat or readiness.
- Start only with enough connected, ready participants, within the registered mode limit. Make join/ready actions independent of stale room revisions and idempotent through existing command receipts.
- Preserve room admission guards, per-tab TV viewing, last-viewer cleanup, reconnect handling and durable account scores.
- Partition account scores by game ID so later games cannot overwrite tic-tac-toe totals.

## 3. Shared waiting-room UX
- A clear header and compact mode switch, illustrated seat cards, shared readiness badges and a single join/ready action.
- Distinguish spectators from participants and show why Start is unavailable.
- Keep cream/lavender/sage styling, useful keyboard labels, mobile/tablet layouts and reduced motion.
- Mount game-specific boards inside a common game screen. Main app, library and room TV use registry/session metadata.
- Separate gameplay code and game setup; remove the old private player checklist and redundant waiting-room controls.

## 4. Quality and verification
- Add focused shared-engine tests using two small test-only game modules to prove the same lifecycle logic works without tic-tac-toe dependencies.
- Verify migration, default/restricted permissions, self-only seats, concurrent joins, capacity, readiness, departures, per-tab presence, rollback/idempotency, game-scoped scores and server restart cleanup.
- Preserve the authoritative tic-tac-toe rule suite. Update browser checks for self-joining, two independent clients, real moves, audio/mute, results, tournaments, invitation entry and routing.
- Build, inspect desktop/tablet/mobile screenshots and accessibility checks. Document the exact steps to add a second game and any compatibility boundary.

## Delivery
Implement and verify this refactor without adding a second production game or installing dependencies. Publish to the existing hosting after checks pass; local preview continues to use the hosted backend. Record actual validation and any remaining limits.
## Verified delivery

- Production build and strict TypeScript checks passed.
- Full server/unit suite: 20 files, 146 tests passed.
- Browser coverage passed for shared waiting rooms, self-joining/readiness/mode synchronization, restricted-owner settings, real multiplayer moves, rematches/tournaments, turn sound and mute, TV entry/cleanup, invitation entry, room links, route guards, dashboard history and people/avatar editing.
- Desktop, tablet and mobile layouts were captured and inspected; WCAG 2 A/AA checks passed on the tested surfaces.
- Shared lifecycle behavior was exercised with two test-only modules, not by adding a second production game.
- Migration tests preserve old account totals and room data, move scores to game-keyed storage, and start with the TV off after restart.
- See `docs/ADDING_GAME.md` for the module contract, registration steps and compatibility boundaries.
