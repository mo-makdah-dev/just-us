> Current product rules are in [ROOMS_V2_PLAN.md](docs/ROOMS_V2_PLAN.md): four occupants, saved rooms, single-use membership/visitor codes and signed-in chat. These supersede the original two-person and no-chat scope below.

# Just Us — detailed project plan

Planning date: October 16, 2026. Working name only. Status: room/account foundation plus the non-game design release implemented locally: pixel studio, people, private labels, account recovery, and illustrated rooms. See `docs/PRODUCTION_CHECKLIST.md` and `docs/RELEASE_READINESS.md` for current verification and remaining external production gates. The numbered phases below preserve the original plan. No games yet.

## 1. Product direction and scope precedence

Just Us is a mobile-first website where two people enter a private shared room, spend time together, and eventually choose among a growing collection of polished 2D games. A room belongs to the session together, rather than to one game. Couples are the primary audience, but friends and other game buddies are welcome.

The latest clarification supersedes the earlier brief in two places: optional accounts now belong in the product, and the first implementation contains **zero playable games**. Build the room foundation first; add and verify one game at a time afterward. Payments remain outside the initial release.

### Initial foundation

- Create or join a private two-person room using a link or code.
- Enter as a guest without an account.
- Choose a nickname and a configurable pixel avatar; no photo uploads.
- See both participants, connection status, and a shared lobby.
- Refresh or briefly disconnect without losing the participant's seat.
- Show an honest empty games area until the first game ships.
- Establish a deployable architecture and verify two independent clients.

### Subsequent pre-commercial work

- Optional Google sign-in; Facebook is a separate provider milestone.
- Persistent profile, multiple mutually accepted buddies, and a private pet name per buddy.
- Guest versus signed-in game access, enforced by the server.
- Tic-tac-toe first, then colour guessing and matching answers, each separately approved and verified.

### Outside the first release

Subscriptions, payment collection, public matchmaking, public room discovery, spectators, more than two players per room, built-in voice/video, photo uploads, 3D games, native app-store apps, public messaging, and extensive game-history storage. Monthly/yearly billing is a future product phase, not a placeholder checkout now.

## 2. Recommended stack

| Area | Recommendation | Reason and tradeoff |
| --- | --- | --- |
| Language | TypeScript throughout | Shared protocol types and safer game changes; runtime validation remains mandatory. |
| UI | React with Vite | Fast iteration, reusable responsive game components; marketing SEO is less automatic than with server rendering. |
| Styling | CSS Modules and shared CSS variables | Small dependency surface, deliberate design, accessible responsive layouts. |
| HTTP server | Node.js current supported LTS with Express | One familiar runtime for API, socket server, and production frontend assets. Verify exact version before setup. |
| Multiplayer | Socket.IO | Rooms, acknowledgements, reconnect support; still needs application-level recovery and duplicate handling. |
| Validation | Zod | Validate every HTTP/socket command and persisted versioned settings. |
| Accounts | Supabase Auth | Managed Google/Facebook integration without maintaining passwords; external vendor and provider configuration required. |
| Persistent storage | Supabase PostgreSQL | Accounts, buddies, entitlements, and recoverable room snapshots in one relational system. |
| Database access | Server-side pg plus explicit SQL migrations | Transparent transactions and fewer abstractions; SQL discipline and migration checks required. |
| Unit/integration tests | Vitest and Socket.IO clients | Test pure rules plus real transport behavior. |
| Browser tests | Playwright | Two isolated browser contexts plus viewport coverage; browser binaries require installation approval. |
| Deployment | One always-on Render Node service, Supabase separately | One application origin, straightforward WebSockets and deployment; single-region and initial single-server limits. |

Use an npm-workspaces repository, not independently versioned services. Avoid Redis, Kubernetes, a separate API language, and a large game engine initially.

### Alternatives considered

- **Next.js + separate realtime service:** useful if content/SEO becomes central, but adds a server boundary for little benefit to the initial private room. A Next.js route is not the proposed long-lived socket host.
- **Supabase-only browser realtime:** attractive for presence, but private game rules still need trusted server execution. Keep one authoritative application server rather than splitting moves across client database writes and broadcasts.
- **Cloudflare Workers + Durable Objects:** strong room-oriented scaling option. It introduces a different runtime, storage model, and deployment workflow. Reconsider if room concurrency or per-room isolation justifies migration.
- **Firebase:** viable managed alternative, but relational buddies/entitlements fit PostgreSQL naturally; it would not remove the need for authoritative rules.
- **Self-managed VPS:** potentially economical but transfers OS patching, backups, TLS, monitoring, and incident recovery to us. Managed hosting is the faster starting point.

I reviewed the Sites skill for website workflow applicability. This request is explicitly plan-only, so no Site is registered or published. The proposed Node architecture uses direct hosting; do not assume a Workers-based Sites deployment can run this Socket.IO server unchanged.

## 3. Rendering: HTML, CSS, SVG, Canvas, or WebGL?

No WebGL is needed for the planned games. Use semantic HTML buttons and CSS Grid for boards, HTML for prompts/cards, and SVG for avatars and lightweight illustration. Use Canvas 2D later for drawing strokes, with accessible surrounding controls and text alternatives. Canvas can also render complex puzzle scenes if needed.

WebGL becomes worth evaluating for many animated sprites, expensive effects, or a measured rendering bottleneck. Being 2D does not prohibit WebGL; it simply does not justify its complexity here. Do not adopt Phaser/Pixi/Three.js before a game needs it.

Keep game logic independent of React and rendering technology so a later renderer does not require rewriting rules or networking.

## 4. Architecture and authority

```text
Phone / tablet / desktop
  React UI
    HTTPS commands + secure participant cookie
    Socket.IO connection + per-player snapshots
                 |
  Node application (one origin)
    session authentication / limits / runtime validation
    room command queue / lifecycle / authorization
    game registry / pure rule modules / player projections
    transactions / snapshot persistence / expiry sweeper
                 |
  Supabase Auth              PostgreSQL
  provider identity          profiles, buddies, rooms, snapshots
```

Production Node serves the built frontend, HTTP API, and sockets on the same origin. Development uses a Vite proxy for API/socket traffic. Supabase supplies identity and persistence; its Realtime product is not needed for game transport.

The browser proposes actions, never outcomes. The server derives the participant from a valid session, verifies membership/seat/permissions/phase/revision, applies rules, persists the result, and only then acknowledges and sends individual views. Never accept a client-supplied winner, score, entitlement, player identity, target colour, or bingo call.

Start with one application instance and one serialized command queue per room. Database transactions and revision checks protect persistence. Multiple Node instances are explicitly unsupported until shared coordination, room ownership, transport routing, distributed rate limits, and recovery tests are implemented.

## 5. Repository layout

```text
apps/
  web/
    src/
      app/                 routing, app shell, error boundaries
      features/rooms/      create, join, lobby, reconnect UI
      features/identity/   nickname, avatar, optional login
      features/buddies/    accepted links and private pet names
      components/          accessible shared UI
      styles/              tokens, layouts, reduced motion
      games/               game-specific React views, added later
  server/
    src/
      http/                APIs, cookies, health/readiness
      realtime/            socket authentication, commands, projections
      rooms/               lifecycle, queues, revisions, recovery
      sessions/            guest identity, auth integration
      persistence/         transactions, SQL repositories, cleanup
      security/            validation, limits, redaction
      games/               trusted game adapters, added later
packages/
  protocol/                safe DTOs, commands, errors, schema versions
  game-core/               interfaces and shared deterministic helpers
  avatar/                  validated avatar config and safe renderer
  game-rules/              pure individual game modules, added later
db/migrations/             reviewed SQL schema changes
tests/integration/         two-client transport and persistence tests
tests/e2e/                 isolated browser contexts
docs/                      architecture, rules, deployment, operations
PROJECT_PLAN.md
.env.example               placeholders only
```

Never import server state types or repositories into the browser. Shared protocol exports contain only permitted views and validated inputs. Runtime state and secrets stay out of Git and OneDrive-synchronized project files.

## 6. User journeys and screens

1. **Home:** Create room, Join room, and unobtrusive optional sign-in. Warm copy; no mandatory account detour.
2. **Your identity:** nickname and avatar preset/customization. A nickname is a display label, not a unique account identifier.
3. **Create:** server creates a room and owner seat atomically; show copy-link and copy-code controls with success feedback.
4. **Join:** validate invitation, collect identity, claim the second seat atomically. Two simultaneous joiners cannot both succeed.
5. **Waiting room:** creator sees their identity and invitation controls. Never imply that a partner has joined before the server confirms it.
6. **Shared lobby:** two participant cards, connection indicators, room controls, and an empty game collection in the foundation build.
7. **Later game flow:** proposal -> partner accepts -> both ready -> game -> result -> mutually accepted rematch or lobby.
8. **Recovery:** visible reconnecting state; successful recovery restores the correct view. Expired/full/invalid rooms get distinct actionable messages.
9. **Account area later:** profile, avatars, buddies, privacy controls, and account deletion.

Create the room first. A future quick-play button may preselect a proposed game after room creation, but must use exactly the same room lifecycle.

## 7. Visual and accessible design

Direction: warm neutral background, ink text, a restrained coral or plum accent, soft panel corners, crisp pixel avatars, and generous breathing room. Avoid excessive hearts, scripted fonts, compulsory couple labels, or animations that slow joining.

- Design from 320–390 CSS-pixel phone widths upward; check portrait and landscape.
- Use a single-column phone flow and a wider board-plus-sidebar layout on desktop.
- Target 44px touch controls, readable 16px base text, visible keyboard focus, and WCAG 2.2 AA contrast.
- Respect reduced motion, zoom, safe-area insets, virtual keyboards, and screen-reader announcements.
- Never encode player identity, turn, validity, or outcome through colour alone.
- Every board needs keyboard navigation, meaningful cell labels, and an announced result.
- Do not promise that every dense board fits tiny screens with large cells: Connect Five needs an accessible alternate selection mode, discussed below.
- Sound optional and off by default until requested; no autoplay dependency.
- Handle loading, offline, full-room, expired-room, rejected-action, and server-restart states as designed screens.

## 8. Identity, accounts, and avatars

### Guest identity

Issue a cryptographically random opaque session credential in a Secure, HttpOnly, SameSite cookie in production. Store only its hash server-side. Associate it with a participant seat. Room codes and socket IDs are not identity credentials. JavaScript-readable persistent guest bearer tokens are not the default.

Refreshing the same browser resumes its seat. A new browser/device cannot reclaim it using the room code alone. Explicitly leaving revokes membership. Clearing cookies can lose guest access; provide an honest recovery explanation rather than accepting a nickname as proof.

### Accounts

Start account rollout with Google. Facebook remains supported in the architecture but follows separately because provider setup, consent, policies, and approval requirements can differ. Do not add email/password, SMS, or password-reset infrastructure initially.

The backend validates provider-issued identity and binds it to an application session; validate OAuth state/PKCE through supported auth flows and allowlisted redirects. Keep provider/service secrets server-side. Do not merge accounts solely because untrusted profile data contains the same email. Explicit linking must require authenticated proof.

Guest-to-account upgrade keeps the current seat through a transactional identity binding. Provider cancellation or callback failure must not destroy the guest room. Account logout revokes account sessions and prompts a clear leave-or-continue-as-new-guest choice rather than silently retaining account authority.

### Pixel avatars

Store a small versioned JSON configuration: preset base, skin palette, hair, eyes, outfit, accessory, and background. Render approved local parts; never accept arbitrary SVG/HTML uploads. Make a small editor with presets and a randomize button, rather than a full pixel-paint application. Store guest choices for their session and account choices persistently. Asset rights must permit commercial use and customization.

## 9. Buddies and pet names

Accounts may have multiple buddies. Linking requires an unpredictable invitation and explicit acceptance. No email search, contact upload, or automatic relationship disclosure initially.

Proposed pet-name semantics: a label you assign to a buddy is private to you. The buddy sees their own nickname unless both opt into a separate shared room label. This avoids publishing a private nickname unexpectedly. A temporary guest room label can be introduced without creating a permanent buddy record.

Allow remove buddy and block account. Blocking prevents new buddy invitations and account-linked invitations; it cannot identify someone who returns anonymously as an unrelated guest. Do not pretend otherwise. Buddy status does not grant access to an existing room or take a reserved seat.

## 10. Guest, account, and future paid access

Separate identity from entitlements:

| Capability | Guest | Signed-in free | Future paid |
| --- | --- | --- | --- |
| Create/join rooms | Yes | Yes | Yes |
| Nickname/pixel avatar | Session | Saved | Saved |
| Basic games | Yes, once shipped | Yes | Yes |
| Additional games | By invitation policy | Account catalogue | Future premium catalogue |
| Buddy list/private pet names | No persistent list | Yes | Yes |
| Billing | None | None | Later phase |

Recommended default: an eligible signed-in player unlocks account games for both current participants. A future subscription should similarly allow one subscriber to invite a guest, subject to product approval. Requiring both people to register/pay creates extra friction. This is a recommendation, not a settled subscription promise.

The server checks catalogue access when proposing and starting a game. Once started, permit the current match to finish if eligibility changes; recheck before a new match. Entitlements are server-derived and versioned. Do not implement Stripe, price cards claiming live availability, trials, or subscription webhooks now.

## 11. Room lifecycle and controls

Room phases: waiting -> lobby -> game proposal -> active game -> results -> lobby. Disconnected presence is independent of game phase.

Proposed initial defaults, configurable after testing:

- Maximum two participant seats; no spectators.
- 128-bit random invitation identifier in links.
- Separate 10-character random human code from a 32-character unambiguous alphabet: about 50 bits. Enforce uniqueness; expire and rate-limit code lookup.
- After the second seat is claimed, close new admissions. Reconnect credentials still work.
- Waiting empty rooms expire after 30 minutes; an occupied waiting room expires after two hours without intentional activity.
- Preserve a disconnected player's seat for five minutes, with a visible countdown. Mobile background suspension counts as disconnection, not deliberate departure.
- If both disconnect, retain recoverable state for 30 minutes, bounded by the room's absolute expiry.
- Expire idle rooms after two hours without meaningful actions; heartbeats alone do not extend them. Absolute maximum lifetime: 24 hours.
- Warn connected users before idle expiry. Either can choose to keep the session active.
- After a partner's grace period ends, offer end session or mutually safe return-to-waiting flow. Do not silently let a stranger inherit their game secrets. Cancel the old match and clear its private state before replacement.

Either player may propose games; the partner must accept. During an active game, switching or abandoning requires partner confirmation, except that either can always leave their own session. A departed player's absence must not trap the other indefinitely.

Creator controls invitation regeneration and closing the room. Regeneration invalidates old join invitations, not authenticated memberships. Temporary creator disconnection does not transfer ownership. After confirmed departure/grace expiry, transfer room controls to the remaining participant; do not automatically declare a game winner. Game-specific forfeits are explicit later rules.

Expiry is checked during reads/actions/reconnects as well as by a cleanup job. A delayed cleanup timer never makes an expired invitation valid.

## 12. Realtime protocol and recovery

Every state-changing command includes a command ID, room ID, expected revision, game-instance ID when relevant, and a validated payload. Derive actor identity from the session. The server returns an acknowledgement with an error code or committed revision.

Use bounded command-ID deduplication and transactionally record critical accepted commands. A retried move returns its original acknowledgement rather than playing twice. Reject stale revisions and send a fresh safe snapshot. Bind commands to a game-instance ID so a delayed rematch move cannot affect a different match.

Socket.IO preserves ordering on a connection, but default delivery is at most once; connection recovery can fail. Application snapshots, acknowledgements, revision checks, and idempotency remain necessary. See [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) and [connection recovery](https://socket.io/docs/v4/connection-state-recovery/).

On reconnect: authenticate again, verify membership and expiry, replace or mark the older connection read-only, and send a newly projected snapshot. Do not replay stored raw private room payloads. A second tab for the same seat gets an explicit takeover/read-only choice; it never becomes player two automatically.

During network loss, disable authoritative controls and show pending/reconnecting status. Never queue a chain of speculative moves. A server restart reloads unexpired persisted state and command receipts. Commit before broadcast; if a crash occurs after commit but before notification, snapshot recovery reconciles both clients.

Pause turn deadlines while reconnecting in casual untimed games. Timed games later need explicit server-clock rules and background-tab tests.

## 13. Private information model

Canonical server state has public, per-player private, and server-only portions. For each recipient, construct a fresh allowlisted view. Never broadcast full state and hide fields with CSS or client logic.

- Colour clue-giver receives target; guesser receives grid and clue only until reveal.
- Matching answers reveal submission status but never partner text before both lock.
- Bingo sends only the player's own card plus shared calls until rules permit reveal.
- Character game sends own secret only to its owner.
- Cooperative puzzle secrets are projected according to that puzzle's explicit rules.

No private answers in analytics, URLs, exception payloads, or ordinary logs. Test serialized HTTP/socket responses and reconnect snapshots for leaks, including observers trying to join transport channels without membership. TLS protects transport; this is not end-to-end encryption, and the server necessarily processes answers.

## 14. Data model and persistence

| Record | Essential fields / constraints |
| --- | --- |
| profiles | auth subject, display nickname, avatar config/version, timestamps |
| sessions | credential hash, guest/account binding, expiry, revocation |
| buddy_invites | inviter, hashed random token, expiry, accepted/revoked status |
| buddy_links | accepted account pair; unique normalized pair |
| buddy_labels | owner account, buddy account, private pet name |
| blocks | blocker account, blocked account; unique pair |
| rooms | random ID, hashed join secret/code lookup, creator membership, phase, revision, expiry |
| memberships | room, seat 1/2, participant/session identity, last seen, grace expiry; unique room+seat |
| game_instances | room, game ID/rule version, phase, canonical state, revision |
| command_receipts | actor, room/game instance, command ID, result revision; unique dedupe key |
| entitlements | account, capability, source, validity; no billing integration initially |

Use SQL transactions for seat claims, identity upgrades, and moves. JSONB is appropriate for versioned per-game snapshots; relational constraints protect membership and identity. Use least-privileged server database credentials. Deny browser access to room snapshots and buddy labels through database policies; do not rely on an unguessable table key.

Persist room identity and recoverable snapshots from the hosted foundation; an in-memory-only room would fail restart recovery. Local pre-database exploration may be disposable, clearly marked as such, but does not meet foundation acceptance.

Delete private game payloads on room expiry/close, with cleanup within 24 hours as an initial operational target. Keep command receipts only through their bounded retry/recovery window. Default to no lasting private answer history. Account deletion removes profile/buddy labels and revokes sessions; document backup retention and eventual deletion limitations before public launch.

## 15. Game module contract

Each game supplies:

- Metadata: internal ID, independent display name, rules version, player count, access tier, supported settings.
- Input schemas and initial-state factory using trusted server randomness.
- Pure action reducer that validates actor, phase, and move legality.
- Per-player projection and public summary functions.
- Outcome/scoring function and rematch initialization.
- Reconnect/timeout policy and versioned snapshot validation.
- Responsive UI component with keyboard/touch behavior.
- Unit tests, transport tests, privacy fixtures, and two-session browser scenarios.

Transport, identities, buddy features, expiry, and room ownership remain outside game reducers. Persist the game's rules version with every running match. Never silently load an incompatible snapshot after deployment; migrate it deliberately or close affected matches with a clear explanation.

## 16. Game one: tic-tac-toe

- 3×3 board; players X and O alternate marking one empty cell.
- First player is randomized for the first match; swap starting player on rematch.
- Three matching marks in a row, column, or diagonal wins. Full board without a winner is a draw.
- Server rejects out-of-turn, occupied-cell, out-of-bounds, stale-instance, and post-result actions.
- No timer initially. Disconnect pauses interaction until recovery or explicit cancellation.
- Results show winner/draw and both rematch votes. A single vote cannot reset the match.
- Returning to lobby does not destroy the room; preserve session-level wins only while the room exists.

This is the smallest game to prove turn enforcement and outcomes, but it starts only after the zero-game foundation is accepted.

## 17. Game two: colour guessing

Proposed v1 rules: six rounds, alternating clue-giver, both sharing one cooperative score. The server selects a target from a fixed 6×6 sRGB palette and sends it only to the clue-giver. Both receive the same ordered grid; the guesser receives no target index until reveal.

Clue-giver submits a written clue up to 160 characters, then guesser chooses one swatch and confirms. No edits after locking the clue or guess. No timer. Reveal target, guess, distance, and points after confirmation. Use cell coordinates and keyboard labels; do not expose target through accessible descriptions before reveal.

Calculate closeness on the server using a documented perceptual colour space. Proposed scoring: convert fixed palette values to OKLab, let d be Euclidean distance, tolerance t=0.03, and cutoff D=0.30. Points = round(100 × clamp(1 − max(0,d−t)/(D−t),0,1)). Exact and near guesses receive 100; distant guesses bottom out at zero. These are initial tuning constants, not a claim of universal perceptual equivalence; confirm through device testing before release.

Use fixed sRGB values, no wide-gamut-only palette, avoid extreme near-indistinguishable shades, and allow a practice round. Explain screen/brightness differences. Colour vision differences require optional labelled/family assistance and a candid statement that this game is inherently colour-dependent. Never require system calibration or claim tolerance can eliminate device differences.

Test target confidentiality in initial view, clue submission, invalid commands, and reconnects. Score calculation is deterministic from palette IDs; clients never submit arbitrary distance or points.

## 18. Game three: matching answers

- Five prompts per match from an original reviewed prompt pack.
- Each player privately writes an answer, maximum 200 characters, and locks it.
- One player's submission only exposes “ready” to the other. Reveal both together after both lock.
- After reveal, each independently votes match/no match. Award one shared point only if both vote match. Disagreement earns zero; show it without blame. Both votes lock before the judgement is finalized.
- Normalized exact text may be suggested as a match, but players remain judges; do not add paid AI judgement.
- Next prompt starts once both acknowledge the result. Unsubmitted drafts may remain locally in memory; do not log them or persist across unrelated rooms.
- If someone leaves before reveal, cancel the prompt and erase hidden text rather than revealing the remaining answer.

Include a mutually agreed skip control for uncomfortable prompts. No explicit/adult prompt pack in the initial catalogue.

## 19. Later game backlog with concrete rules

| Game | Proposed rules and interaction | Extra engineering / rights checks |
| --- | --- | --- |
| Four in a Row | 7 columns × 6 rows, gravity, alternate dropping one piece, four or more contiguous pieces horizontal/vertical/diagonal wins; full board draw. | Independent branding/art; do not use Connect Four as the product title without clearance. |
| Five in a Row | 15×15 grid, no gravity, alternate placing a stone at an empty intersection; five or more contiguous stones wins; overlines allowed, no forbidden-move rules; full board draw. | Freestyle variant, with first-player advantage acknowledged. On phones provide zoom plus coordinate selection and confirmation; 15 large touch cells cannot fit across a narrow screen. |
| Bingo | Two independently shuffled 5×5 cards, B 1–15/I 16–30/N 31–45/G 46–60/O 61–75, free centre. Server draws without replacement when both ready for next call. First validated full row/column/diagonal wins; simultaneous wins tie. | Each player sees own card. Claim button validated against called numbers; invalid claims do not end match. No money, prizes, or wagering. Review local regulation before changing that. |
| Guess the character | Original 4×4 roster with visible distinguishing traits. Each privately selects a character; alternate yes/no questions and recorded answers, local eliminations, or a final guess on their turn. Correct guess wins; incorrect final guess loses. | Original or commercially licensed characters only; manually answered questions initially, no AI character service. Avoid another game's branded title/presentation. |
| Draw and guess | Four alternating drawing rounds, original server-selected word visible only to drawer; 60 seconds per round, server clock, guess limit and normalized matching. Correct guess earns one shared point. | Canvas 2D, normalized strokes, point/rate/size caps, late-join/reconnect projection, background timer rules. Never transmit secret word in public events. |
| Cooperative puzzles | Start with one original 4×4 tile-routing puzzle: rotate tiles to connect source to destination; both may act, server serializes conflicting rotations, solved state validated server-side. | Begin with one explicit puzzle type, not a general puzzle engine. Seeded generation requires solvability tests; alternative text/tile controls. |

Order after the first three games is a product choice. Ship each independently with the module checklist; do not implement this whole table in one phase.

## 20. Security and basic abuse protection

- Treat invitations as bearer invitations, distinct from participant credentials. No public indexes or room enumeration APIs.
- Use cryptographic random identifiers, hashed session/join secrets, constant-safe token handling, TLS, strict origin checks, CSRF protection for cookie-authenticated mutations, and secure headers/CSP.
- Authenticate socket handshakes and authorize every command. Transport-room membership alone is not permission.
- Atomic membership constraints prevent a third participant, including races.
- Initial tunable limits: room creation 5 per IP per 10 minutes; failed joins 10 per IP per minute; ordinary actions 20 per participant per second with small burst allowance; maximum 8KB ordinary command payload. Drawing uses separately bounded batches later.
- Apply IP limits carefully for shared networks; combine IP and session signals and cap total concurrent/empty rooms. Configure trusted proxy headers explicitly.
- Bound nicknames at 24 characters, pet names at 32, answers/clues per game; trim safely, normalize where appropriate, render as text, and reject oversized structures.
- Return generic lookup failures where detailed responses would enable code probing. Once authenticated, show useful room-state errors.
- Do not include invitation tokens in analytics/referrers. Use a fragment invitation exchanged through POST when feasible, then remove it from the visible URL; redact unavoidable URL/code logs.
- Keep dependency lockfiles, check advisories before deployment, and maintain an asset/dependency licence inventory.
- Basic account block/report path before public beta; CAPTCHA only if observed abuse warrants it.

## 21. Multiplayer verification plan

Tests must use two independent browser contexts with separate cookies/storage; two tabs sharing identity do not prove two-player behavior. Also test a third rejected client and a second tab attempting the same seat.

| Scenario | Expected evidence |
| --- | --- |
| Create on desktop, join on phone viewport | Both identities and lobby presence update without reload. |
| Two simultaneous join requests | Exactly one second-seat claim; no extra participant snapshot. |
| Forged participant/room IDs | Rejected with no state change or private data. |
| Refresh either client | Same seat, avatar, room revision and correct private projection. |
| Disconnect/reconnect within grace | Seat preserved; pending command reconciled; no duplicates. |
| Network loss after commit before ack | Retried command yields one committed action. |
| Server restart | Unexpired room recovered; old socket ID irrelevant. |
| Expired grace/room | Clear outcome; expired secrets never reopen old state. |
| Game selection races | One accepted proposal/revision; both consent before start. |
| Tic-tac-toe | All eight win lines, draw, turn rejection, stale/duplicate/post-win actions. |
| Colour guessing | No target in guesser's payload before reveal; known palette scores and tolerance boundaries. |
| Matching answers | No partner text before both submit; joint reveal; vote disagreement and leave cleanup. |
| Account upgrade/login failure | Guest seat retained; no identity collision or unintended account merge. |
| Entitlement bypass | Direct socket/API calls cannot start restricted games. |
| Responsive/accessibility | 320/390px phone, tablet, desktop, zoom, keyboard, reduced motion, screen-reader smoke test. |

Run real phone/tablet browser checks in addition to emulated viewports, including iOS Safari backgrounding and Android Chrome. Test partners on different networks on a staging HTTPS URL before calling remote multiplayer verified. Localhost tests cannot establish that a public deployment works.

Unit tests target reducers, scoring, expiry clocks, projections, and entitlement decisions. Integration tests use a real temporary database and live socket server. Do not add tests that merely restate CSS implementation.

## 22. Local development

After dependency approval, provide Windows-friendly instructions and commands for install, dev, build, unit tests, integration tests, and browser tests. Pin the supported Node runtime and package manager through repository metadata.

Use environment variables for app origin, port, database URL, Supabase URL/public key, and server-only auth secrets. `.env.example` contains descriptions and placeholders. Ignore real environment files, test traces with sensitive payloads, runtime state, and build output.

Start with a dedicated Supabase development project to avoid requiring Docker installation. Its network dependency is a tradeoff. Fully offline accounts/database work is a later optional local Supabase/Postgres setup requiring separate Docker/runtime approval. Keep staging and production databases separate; tests must refuse production endpoints.

Two browsers on one machine can verify sessions. A physical phone cannot reach the laptop's localhost; later use an explicitly configured LAN dev binding and firewall allowance or a secure staging URL. Do not expose dev servers or production secrets through a casual public tunnel.

## 23. Deployment and operations

1. Create source repository and protected production configuration when authorized; no external repository or service is created in this planning task.
2. Build the React bundle and Node server reproducibly from the lockfile.
3. Deploy one always-on Node web service that serves frontend/API/sockets. Bind to the hosting-provided port and host interface.
4. Put Supabase in the closest practical region to the Node service. Choose the service region based on where the first partners are located; do not assume one region removes intercontinental latency.
5. Configure HTTPS domain, exact OAuth callback URLs, allowed origins, and secrets through provider settings.
6. Apply backward-compatible database migrations before new code depends on them; verify readiness and schema compatibility.
7. Run two-browser remote smoke tests, reconnect tests, and restart recovery against staging.
8. Publish after the phase's agreed validation and service/budget authorization. Explain any incomplete device tests honestly.

Health endpoint checks process liveness; readiness checks database/schema readiness without exposing secrets. Log command type, duration, error code, correlation ID, and revision rather than private content. Monitor active rooms, socket failures, reconnect success, database latency, memory, and rejected commands.

Before commercial launch: automate supported database backups, perform an actual restore drill, define retention, add budget alerts and usage review, and write rollback/incident instructions. A backup feature is not verified until recovery has been exercised.

Deployments may disconnect sockets even with platform zero-downtime features; recovery must tolerate that. For incompatible rule changes, stop starting affected matches and drain or explicitly cancel them before rollout.

Scale only from measured concurrent sockets, commands/second, p95 latency, and memory. Before a second Node replica: add coordinated room ownership/serialization and a compatible socket adapter; account for sticky routing if polling is enabled; test split connections and failover. Pub/sub alone does not make two independent room authorities safe.

## 24. Estimated hosting and operating costs

All figures below are **USD**, before taxes and currency conversion, researched October 16, 2026. These are planning allowances, not quotations or measured capacity guarantees. CAD totals depend on the payment-date exchange rate. Recheck actual checkout pricing before authorizing services.

Provider anchors: Render lists a small paid Node web service at about $7/month; its workspace fee and compute are separate. Supabase offers Free and Pro, with Pro starting at $25/month and usage/project compute affecting totals. See [Render pricing](https://render.com/pricing), [Render small-business cost guide](https://render.com/articles/how-much-does-cloud-application-hosting-cost-for-small-businesses), and [Supabase pricing](https://supabase.com/pricing).

| Stage | App hosting | Auth/database | Other allowance | Estimated monthly total |
| --- | --- | --- | --- | --- |
| Local development with hosted dev database | $0 | Free tier if within limits | $0 | $0 |
| Small private online pilot | ~$7 | Free tier if suitable | $0–5 | ~$7–12 |
| Small dependable public beta | ~$7–25 | ~$25 base | ~$2–15 | ~$34–65 |
| Public beta with paid workspace features | Prior row plus workspace fee if selected | Included above | Included above | Add current workspace fee, presently ~$25 |
| Growing service planning envelope | Higher/multiple instances | Larger compute/usage | Monitoring, backups, bandwidth | Budget ~$100–300+, validate through load tests |

The public-beta range annualizes to roughly $408–780 before domain registration. The private pilot can use a provider URL. Reserve an additional **$15–30/year** for a normal custom domain as an unverified budget allowance; actual name, TLD, premium status, and renewal quote determine cost. Branding is undecided, so no domain availability or purchase is implied.

Free hosting/database tiers are for experimentation, not a reliability promise: sleeping/pausing behavior, quotas, retention, and backups must be checked. Use an always-on app service for shared sessions. A paid database is recommended before a public product depends on it.

Separate staging, additional Supabase projects, point-in-time recovery, extra compute, bandwidth, paid monitoring, support tooling, and email can increase totals. No photo/video hosting is needed in this scope. Google/Facebook provider setup is not budgeted as a per-login hosting charge; verify provider terms before launch. Email infrastructure is unnecessary for Google-only login unless we introduce email features.

These totals exclude labour, legal advice, trademark filings, commissioned artwork, business registration, tax, marketing, and future payment processing. No subscription transaction costs exist until billing is implemented.

Track cost per active room-hour and paid subscriber later. Monthly active users alone do not predict socket concurrency. Example: a target hosting budget of $50/month divided by a hypothetical $5 contribution per subscriber needs 10 subscribers to cover hosting only; that is arithmetic, not a pricing recommendation or profitability forecast.

## 25. Copyright, trademarks, and commercial use

General planning guidance, not a legal clearance opinion. Relevant markets and exact implementation matter.

The U.S. Copyright Office distinguishes game ideas/methods from protectable expression such as artwork and written rules. Canada's IP office similarly distinguishes ideas from their original expression. This supports independently implementing traditional mechanics, rather than copying another game's assets or presentation. Sources: [U.S. Copyright Office: Games](https://www.copyright.gov/register/tx-games.html), [CIPO copyright basics](https://www.ised-isde.canada.ca/site/canadian-intellectual-property-office/en/copyright-learn-basics/copyright-learn-basics-protect-your-original-works-learn-why-copyright-matters).

Do not conclude “popular means nobody owns it.” Trademarks protect source-identifying names/designs separately from copyright; patents and other rights can also matter. The Canadian database identifies a registered CONNECT FOUR mark associated with Hasbro. Use an independently cleared title such as a working “Four in a Row,” original visuals, and our own explanation of the rules; a generic-looking alternative name still deserves clearance before commercial release. Sources: [USPTO IP distinctions](https://www.uspto.gov/trademarks/basics/trademark-patent-copyright), [CIPO CONNECT FOUR record](https://ised-isde.canada.ca/cipo/trademark-search/431855).

Practical checklist per game:

1. Write our own code and rules text; do not copy an existing site's source, screenshots, board styling, prompts, or sound effects.
2. Use original/appropriately licensed characters and artwork. Familiar film/cartoon characters are not automatically available because this is a small game.
3. Keep an asset ledger recording source, author, licence version, commercial-use permissions, modifications, and required attribution. “Free download” is not a licence.
4. Review software dependencies for commercial redistribution/use obligations; paid products can use many open-source packages, but licence conditions vary.
5. Search proposed app and game branding in intended markets. “Just Us” is a working name with no availability or trademark clearance claimed.
6. Before commercial launch, obtain a qualified review of branding, close adaptations, terms, privacy, and target-market obligations. No claim-free guarantee follows from using traditional rules.

Subscription revenue can come from the convenience, original execution, room experience, catalogue, and licensed content. We need not invent new mechanics, and charging money does not grant rights to someone else's expression.

## 26. Privacy and launch readiness

Collect the minimum account profile and provider identifiers needed. Do not request contacts or social posting permissions. Treat pet names, buddy relationships, and answer text as sensitive user content. No advertising trackers in the initial private experience.

Before public beta, decide intended age audience and launch jurisdictions, provide privacy/terms/contact and deletion procedures, document vendors and retention, and review applicable requirements. Avoid claiming worldwide compliance from a generic template. Billing later requires a separate review of cancellation, renewal disclosures, refunds, taxes, and consumer rules.

## 27. Development phases and gates

Work one phase at a time. At the end of each, report delivered behavior, checks passed, remaining limitations, and the proposed next phase. Dependency installation always requires approval for a concrete package/runtime/browser list. Do not treat plan acceptance as blanket authority to purchase hosting or install future game libraries.

### Phase 0 — this planning task

Deliver this plan, source-backed hosting/IP guidance, architectural recommendation, and a short decision list. No implementation, installs, account creation, or publication. **Complete when the Markdown is saved and checked.**

### Phase 1 — small zero-game room foundation (recommended next)

Implement home/create/join, guest session, a few avatar presets, nickname, two-seat shared lobby, invitation controls, expiry, persisted room snapshots, and refresh/reconnect handling. Include the empty catalogue and module boundary; do not build mock playable games. Custom avatar editor, OAuth, and buddy UI wait for their own phases.

Proposed packages to present for approval after checking compatibility: React, React DOM, Vite, TypeScript, Express, Socket.IO/server+client, Zod, pg, Vitest, Playwright, and the minimal type/build/dev-runner packages needed. Name exact versions and requested Playwright browser downloads in that approval request. No global installs by default.

Acceptance: two isolated browsers join the same room, a third is rejected, refresh preserves seats, duplicate commands are safe, disconnect countdown/reconnect work, restart restores unexpired room, and mobile lobby is usable. Validate persisted data and expired-room rejection. Deliver a local demo and deployment instructions. External staging deployment can follow within this phase only after service credentials and spend are authorized.

### Phase 2 — optional account identity

Google sign-in, saved profile/avatar, safe guest upgrade, logout, deletion path, and server-side entitlement foundation. Validate provider callback failure, duplicate identity, forbidden redirects, and seat preservation. Separate provider setup from dependency approval. Facebook is a distinct follow-up milestone, not a reason to delay Google.

### Phase 3 — avatar editor and buddies

Small layered avatar editor, accepted buddy invites, multiple buddies, private labels, removal/blocking, and account privacy tests. No photo uploads or public user search.

### Phase 4 — first game: tic-tac-toe

Implement the module contract and catalogue access using one complete game. Verify all outcomes, transport enforcement, rematch agreement, return-to-lobby, and reconnect. Keep it available to guests so the initial experience is useful.

### Phase 5 — colour guessing

Implement private projections, clue/guess phases, deterministic closeness scoring, six rounds, device-tolerance testing, and reveal. Decide whether it is the first account-catalogue game after testing the guest invitation policy.

### Phase 6 — matching answers

Original prompts, private submissions, simultaneous reveal, joint human judgement, skips, cleanup, and secret-leak tests. Verify reconnect before and after reveal.

### Phase 7 — deployment/public-beta hardening

Remote two-network verification, production region/domain/OAuth settings, device/accessibility pass, measured load test, budget alerts, backup restore, privacy/terms/deletion readiness, and rollback rehearsal. Earlier phases should already be deployable; do not defer discovering hosting incompatibilities until now.

### Phase 8 onward — expand one game at a time

Choose Four in a Row, Five in a Row, Bingo, character guessing, drawing, or the first cooperative puzzle. Each is a separately scoped phase with rules, rights review, UI, authority, privacy, and tests.

### Future commercial phase — separate approval

Define subscription value and guest invitation policy from real use. Select monthly/yearly pricing and billing vendor, then implement server-verified entitlements, signed idempotent webhooks, cancellation/dunning, tax handling, support, and purchase tests. Never trust a payment success redirect as proof of entitlement.

## 28. Effort expectations and main risks

Rough active-development planning ranges, not calendar promises: room foundation 3–6 focused developer-days; accounts 2–4; avatar/buddies 3–6; tic-tac-toe 1–3; colour guessing 3–5; matching answers 2–4; public-beta hardening 3–6. Provider approval delays, design iteration, unfamiliar environments, and defects are additional. Re-estimate after Phase 1 based on actual pace. These ranges assume one developer and do not require parallel agents.

Main risks: mobile background suspension, secret leaks through recovery payloads, seat-claim races, changing account identity mid-session, premature multi-server scaling, provider configuration delays, overly dense phone boards, and unclear content rights. The phases deliberately exercise these foundations before expanding the catalogue.

## 29. Decisions to confirm

No answer is needed to finish this plan. Before implementation, the most consequential choices are:

1. **Stack:** approve React/Vite + Node/Socket.IO + Supabase? Recommended yes.
2. **Account order:** build guest rooms first, then Google, with Facebook later? Recommended yes.
3. **Access:** should one signed-in player unlock account games for their guest? Recommended yes; no billing yet.
4. **Pet names:** private to the person assigning them, with shared labels only by consent? Recommended yes.
5. **Hosting target:** private pilot around $7–12/month, then plan roughly $34–65/month for public beta before domain/tax? No service purchase is authorized by choosing this plan.
6. **Before external setup:** which regions are the first players in, and which audience/launch markets should we design provider/privacy setup for?

Branding, subscription price, exact account-only catalogue, and later-game order can wait. The next actionable step is Phase 1, after stack agreement and a concrete dependency-install request.

## 30. Research references

Official sources checked October 16, 2026; provider prices and policies may change.

- [Render pricing](https://render.com/pricing) and [compute plans](https://render.com/docs/compute-plans).
- [Render free-service limits](https://render.com/docs/free).
- [Supabase pricing](https://supabase.com/pricing) and [billing overview](https://supabase.com/docs/guides/platform/billing-on-supabase).
- [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Facebook login](https://supabase.com/docs/guides/auth/social-login/auth-facebook).
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/) and [connection recovery](https://socket.io/docs/v4/connection-state-recovery/).
- [U.S. Copyright Office: Games](https://www.copyright.gov/register/tx-games.html).
- [CIPO copyright basics](https://www.ised-isde.canada.ca/site/canadian-intellectual-property-office/en/copyright-learn-basics/copyright-learn-basics-protect-your-original-works-learn-why-copyright-matters).
- [USPTO trademark/patent/copyright comparison](https://www.uspto.gov/trademarks/basics/trademark-patent-copyright).
- [Canadian CONNECT FOUR trademark record](https://ised-isde.canada.ca/cipo/trademark-search/431855).
