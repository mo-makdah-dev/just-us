> Rooms v2 uses schema version 4 and the membership/chat rules in [ROOMS_V2_PLAN.md](ROOMS_V2_PLAN.md). Older lifecycle notes below describe the original foundation.

# Phase 1 architecture decisions

The product plan is the long-term direction. These are the original Phase 1 choices and limits. Phase 2 adds version-two account storage, username authentication, optional Google OAuth, and durable local data; its current decisions are documented in [PHASE_2.md](PHASE_2.md).

## One process, one authoritative state owner

Express serves HTTP and production assets; Socket.IO transports personalized snapshots and commands. Vite is development middleware only. One serialized service queue handles state mutations; every accepted command is saved before acknowledgement and broadcast. Failures restore the prior in-memory snapshot.

The browser never supplies player IDs as authority. An opaque HttpOnly cookie maps to a hashed server session; separate CSRF secrets and exact origins protect mutations and socket handshakes. A participant may have one socket at a time. Another tab sees an explicit conflict; close the first tab before reconnecting. No silent seat duplication.

No automatic raw-packet recovery is enabled. Reconnecting clients authenticate again and receive new allowlisted projections. Canonical session hashes, join-link hashes, and command receipts are not sent to partners. All client renderings of nicknames are escaped React text.

## Persistence adjustment for free local testing

The plan proposed hosted PostgreSQL from the first development setup. To make the experiment runnable without user-managed infrastructure, Phase 1 also implements a built-in Node SQLite adapter. It uses a path under the OS temp directory by default, outside the synchronized checkout. Production rejects missing PostgreSQL configuration.

Both adapters currently persist a versioned aggregate snapshot in one private row. This deliberately reduces migration complexity for the zero-game pilot. It is not the final normalized profile/buddy/game schema in the plan. Before accounts or large room counts, introduce reviewed SQL migrations and normalized durable entities, then migrate existing versioned data explicitly. No secret content history exists in this phase.

SQLite saves use an exclusive local connection and transactions. Hosted PostgreSQL uses a private owner row with an unpredictable per-process token, heartbeat and server/maintenance mode. Startup validates stored state before claiming ownership; saves lock/check ownership before updating JSONB and migration backups. A transaction advisory lock establishes a common lock order around startup DDL and state operations. An old process cannot commit after the replacement's claim. Its HTTP mutation routes fail closed, readiness becomes unavailable, and sockets close their transports so browsers retry against the replacement. Default backup/restore mode refuses to replace any live owner; a live maintenance owner also blocks application startup. Ownership expires for maintenance recovery after 15 seconds without a heartbeat, and an orderly close clears only its own token.

This supports one active authority plus a retiring instance during rolling deployment. It does not support active-active horizontal scaling or promise zero downtime. Use the Supabase shared session pooler on 5432 for the pilot; live provider pooling/TLS still needs verification. Real local PostgreSQL tests cover state fencing, rejected schema takeover, browser-role denial and overlapping HTTP/socket room continuity.

PostgreSQL startup creates a private RLS-enabled `just_us_state` table and revokes browser-role privileges. Bootstrap therefore needs a database role with table-creation/ownership privileges in a dedicated project. Before wider production use, separate migrations from a least-privileged runtime role.

The PostgreSQL adapter is implemented but cannot be declared integration-tested until a dedicated real database is connected. SQLite restart persistence is covered by automated tests. State versions are validated; unknown/incompatible versions refuse startup rather than resetting data silently.

The local SQLite connection uses exclusive locking so a second process cannot silently overwrite a different in-memory authority's snapshot. Restart recovery tests close the first connection before reopening the database.

## Invitations and storage

Join links carry a 128-bit secret in a URL fragment. The browser removes the fragment and posts the secret over the same origin. Only its hash is stored on the room. Command receipts retain the creator's invite response for a bounded retry window; treat the database as sensitive. Human room codes are stored on the room for authenticated participants to display, with rate-limited lookup. Room codes are join invitations, never seat recovery credentials.

The creator's link is cached in browser session storage for convenient repeat sharing. A refresh retains it. A fresh browser session may only show the room code; the creator can regenerate a fresh link. Both link and code are invalidated on rotation. Admission closes when both seats are taken. Returning guests require their original cookie; matching nicknames confer no authority.

## Lifecycle

- Five-minute disconnected-seat grace while another participant remains present.
- If everyone disconnects, thirty-minute recovery, bounded by other expiry.
- Two-hour idle timeout based on intentional actions, not pings or reconnects.
- Twenty-four-hour absolute room lifetime.
- After the creator leaves or their grace expires with a partner present, transfer controls to the remaining participant.
- A vacant previously occupied room does not automatically admit new people. Its remaining owner explicitly opens a fresh invitation.
- Lookup, actions, and reconnects check expiry. A 15-second sweep deletes expired snapshots; read checks do not rely on the timer being punctual.
- Session cookie lifetime: seven days; expired orphan sessions and old dedupe receipts are cleaned up.

The UI includes live reconnect countdowns and a warning when fewer than ten minutes remain. Explicit keep-open requests reset idle time but never absolute lifetime. Refresh does not extend a room indefinitely.

## Operating limits

This is a small private pilot: capped sessions/rooms, one server, aggregate persistence, in-memory request limits, and no paid-service promises. Logs omit payloads and tokens. TLS certificate validation remains enabled for the database. App readiness reads storage; health only checks the HTTP process.

Socket.IO uses WebSocket transport only to simplify one-origin routing. Networks that block WebSockets will not receive a polling fallback in this phase; the UI reports reconnecting. Adding fallback requires explicit hosting/routing and browser tests.

There are no games yet, so turn/outcome/hidden-answer tests begin with the first game. Phase 1 tests projection boundaries and room action authority; it does not claim to test future game secrets.

