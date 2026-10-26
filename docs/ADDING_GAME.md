# Adding a game

The shared platform owns room admission, TV presence, sessions, seats, readiness, permissions, starting, account identity, score retention and audio preferences. A game owns its rules, board state, result calculation and renderer. Do not add game-specific branches to `Rooms`, `main`, `GameScreen` or `GameWaitingRoom`.

## Required registration

1. Add the game's action and public view types in `packages/protocol/src/games/<game>.ts`, then add its discriminated entry to `GameContracts` in the protocol index.
2. Add its metadata and modes to `packages/games/src/catalogue.ts`. Modes declare minimum/maximum participants; the shared waiting room renders them automatically.
3. Implement rules and a `GameModule<State, Action, View>` under `apps/server/src/games/<game>/`. Register it in `gameModules`. Both state and actions have runtime Zod schemas; stored values are opaque only at the registry boundary.
4. Implement a renderer under `apps/web/src/games/<game>/` and register its adapter in `gameRegistry.tsx`. Its `turnSignal` returns a stable round ID and increasing turn count; the common screen supplies sound and mute. The adapter narrows the discriminated session type, so its renderer receives its own typed view/actions.

No changes are required to the room transport, shared session service, TV, waiting-room UI, library rendering or account score UI.

## Server contract

- `create` creates a validated, serializable state. `open` prepares a fresh session while preserving the game's account scoreboard.
- `start` receives only the connected, ready participants who joined their own seats. The platform validates mode, capacity and permission first. Do not implement another join/ready system in the game.
- `permission` classifies each game action as participant/rules (`player`), room-setting-controlled management (`configure`), or room-owner-only (`owner`). The shared service authorizes management; the game must still verify whose turn it is and reject spectators or stale moves.
- `act` applies a validated game action. New games must not expose a second action that bypasses shared start validation.
- `reconcile` handles game-specific consequences of a departed participant. Its context includes participants, including disconnected seats within the existing room reconnect grace. Explicitly leaving a game seat removes that participant immediately.
- `phase` reports `waiting`, `playing`, or `results`. Keep a running competition in `playing` between its rounds.
- `project` returns the typed public view and must never expose private score/account keys.
- `clear` removes transient game state and preserves account scores. `anonymize` removes a deleted account's identity.
- Use `recordGameScore` for the shared account-only room ledger, and `context.record` for game-scoped durable account totals. The provided ledger helper calls `context.record`; do not call it twice.

## Shared behavior

Opening a game seats the opener. Other admitted room members can watch or join a free seat, including guests and people without management permission. Only a person can change their own seat/readiness. Joining starts ready; changing modes requests readiness again from other participants. Starting requires enough ready, connected players. The owner setting controls creating/configuring/starting games, not joining them.

TV views are counted per socket. Returning to the living room gives up that person's seat once their last game-view tab leaves. The final viewer leaving clears the session and board; scores remain. Network disconnects keep the existing room-seat grace while another viewer remains. A server restart starts with the TV off.

## Migration and compatibility

Room storage now uses `gameStates[gameId]` and `gameSession`. Account totals use `gameScoresByGame[accountId][gameId]`. Loading older version-4 data migrates the old room `ticTacToe` and account `gameScores` fields; old scores and rooms are retained and transient sessions are cleared on restart.

`games/tic-tac-toe.ts`, `RoomView.ticTacToe`, the old `ticTacToe` command and `SessionView.gameScores` are compatibility boundaries for existing tooling/clients. New clients use `gameSession` / `gameAction` commands and `scoresByGame`. Legacy game commands cannot mutate a new shared session. New games do not implement a legacy adapter.

## Verification

Use independent browser contexts for participants. Test the shared platform with test-only modules (`tests/unit/game-sessions.test.ts`), then test the new game's own rules. Test runtime validation, stale actions, spectators, reconnect/departure outcomes, account-only scoring, deleted accounts and public projection. Cover self-joining, readiness, multiple modes and responsive waiting-room screens in the browser. No production second game was added by this refactor.
