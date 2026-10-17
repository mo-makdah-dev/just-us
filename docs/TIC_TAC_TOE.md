# Tic-tac-toe: first playable game

## Product and delivery
Free for guests and accounts. Existing four-seat rooms stay unchanged: two players compete and everybody else watches the exact same authoritative board. No subscriptions, payment checks or new dependencies. Games are separate server/client modules using the existing room session, CSRF, Socket.IO, durable storage and command receipts.

## Rules
- Standard 3×3 board, X first; three in a row horizontally, vertically or diagonally wins. Nine occupied cells without a winner is a draw.
- Raise/lower your hand to volunteer. The owner may select any two connected players (including themselves), or choose a random pair. User delegated the final mode defaults and clarified that everyone may raise a hand. Hands signal interest and are not required for selection. Volunteering is not a move permission; only the two selected players can move.
- Single match: one result, rematch with swapped X/O, or choose another pair. Every room member can spectate and raise their hand. Only the owner starts/rematches/returns to the room.
- Knockout: select 2–4 connected entrants; shuffle with server cryptographic randomness; pair them and award a bye for an odd entrant. A draw replays the fixture with swapped marks; a bye never creates a win or score. The owner can start an available fixture, but cannot change its opponents or invent advancement. The final decisive winner is champion.
- Points league: select 2–4 connected entrants. Every pair plays twice, once as X and once as O (n×(n−1) fixtures: 2, 6 or 12). Schedule order is randomized. Win = 3, draw = 1, loss = 0. Forfeits count as wins/losses. Equal final points share a rank/title; no arbitrary hidden tie-break. The owner may choose the next pending fixture, not add extra scoring fixtures.
- Mid-tournament arrivals spectate until the next competition. Only one match may be active. Entrants and fixtures freeze when the competition starts. No implicit auto-start surprises after a result.
- Owner cancellation voids the unfinished match and ends the competition; completed results remain recorded. Cancellation requires explicit UI confirmation. A playing participant can resign with confirmation; the opponent wins by forfeit.

## Presence, authority and races
- Client sends only commands: action, match ID, cell or selected player IDs. It never sends a board, winner or score. Server validates membership, ownership where needed, selected fixture, match identity, turn, cell bounds, occupancy and connection state.
- Owner setup uses room revisions. Moves use the exact match ID and occupied-cell count (ply), so chat and raised hands do not invalidate a legitimate move, while a delayed double-click cannot land on a later turn or rematch. One-use command receipts and terminal-state validation prevent duplicate scoring. Chat/hand updates never mutate the board.
- A temporary disconnect pauses moves until both players return. Refresh restores board, volunteers, standings and result from durable room state. No short chess clock is introduced.
- Leaving/removal or expiry of the existing five-minute reconnect reservation resolves an active game as a forfeit if one opponent remains, or a void if neither remains. Scheduled missing entrants are resolved before the next fixture; both missing void the fixture. Tournament progression must not hang on departed players.
- On saved-room owner absence, current players may finish their match; no spectator acquires owner privileges. Owner returns to manage the schedule. Guest ownership continues using existing room-transfer rules.

## Scores and privacy
- Room scoreboard: games, wins, draws, losses, forfeits and points; retained with the room for the most recent 256 scoring identities. Results are committed exactly once with the terminal move/forfeit, not when a browser opens the result panel.
- Account scoreboard: private personal aggregate, persisted independently of room deletion. Guest scores belong only to the current session/room and are not converted into a permanent account history automatically. Signing in midway affects future matches; a match freezes its scoring identities when started.
- Account deletion removes personal aggregates and anonymizes references in retained room game records. Account export includes its own aggregate. Do not expose session hashes, account aggregate keys, credentials or other users' private histories to spectators.
- Keep bounded records: cumulative statistics plus at most 40 recent match summaries per room; no unbounded board/event logs. Tournament state is bounded by four entrants and 12 fixtures (knockout draw replays retain only the current fixture board).

## UI
- Tic-tac-toe becomes the first playable library card; all other games remain honest previews.
- A focused game panel beside/below the illustrated room contains the board, player/turn labels, spectator state and compact raise-hand control. Owner setup, tournament standings and scoreboards use collapsible sections to avoid another wall of controls.
- Large keyboard/touch targets, labelled cells, visible X/O shapes and winning line, live result text and no reliance on colour alone. Chat remains usable in its existing desktop panel/mobile tab.
- Profile gets a private My game scores section; the room game panel has a room scoreboard with everyone’s results, including former participants.

## Implementation phases
1. Pure, serializable game engine and explicit rules/state schemas; meaningful win/draw/turn/forfeit/tournament tests.
2. Room integration, migrations/defaults, private account totals, identity snapshots, cleanup, projections and security tests.
3. Mobile-first board/library/profile UI; independent-session browser tests for play/spectators/rematch/results/refresh.
4. Build, full regression suites, screenshot/accessibility review, encrypted pre-deploy snapshot, deployment and live verification.

## Verification — October 17, 2026
+- Build and typecheck pass. All 99 server/storage tests pass, including eight winning lines, draw, turn/cell enforcement, spectators, exactly-once scoring, room restoration, grace expiry, departures, byes, knockout replays, balanced league pairings, shared first place, private score exports/deletion and guest-to-account identity separation.
+- All 17 browser scenarios pass; the final game scenarios were rerun after move sequencing and UI polish. Independent guest sessions demonstrate owner-as-spectator, raised hands, third-device play, refresh, winning line, rematch swap and resignation. Signed-in sessions complete a two-fixture league and recover their private profile totals after refresh. Mobile game accessibility and 320px overflow checks pass.
+- Network protocol 5 requires older tabs to refresh so both partners receive the game UI. Production abuse limits remain unchanged; larger same-IP quotas apply only to the test runtime and are covered by production-limit regression tests.
+- The local real-connection smoke script completes an authoritative win and checks exactly three total points before removing its temporary room. Deployment uses the existing encrypted snapshot and single-writer process.
