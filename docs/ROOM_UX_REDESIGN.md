# Room UX redesign

## Purpose
Keep the illustrated room as the centre of the experience. Remove the long control wall and make the next action obvious on phones, tablets and desktops. Games remain previews until implemented; do not imply that Play works today.

## Phase 1: simplify the room
- Preserve the existing room artwork, seats and atmosphere controls.
- Replace duplicate avatar cards and promotional blocks with a compact people strip.
- Put the game library entrance inside the room illustration, with a clearly labelled button that works by touch, keyboard and mouse.
- Open a native modal library with illustrated covers, names below the covers, player counts and honest Coming soon status. A play-shaped control sits on the cover but is disabled until a game exists.
- Keep room settings in one collapsible Room options panel. Group Invitations, People and access, and Room settings separately; do not destroy existing access/security functionality.

## Phase 2: chat
- Desktop: adjacent conversation panel, bounded message history and a compact composer.
- Phone: room/chat tabs, one primary task at a time, a bounded conversation viewport and a composer above the bottom safe area.
- Remove always-visible Delete message links. Keep moderation in a deliberate message options disclosure and room-history controls in settings.
- Retain signed-in-only permissions on the server. Guests see a concise sign-in gate.
- Preserve scroll position when reading older messages, follow new messages when already at the bottom, and reset drafts when changing rooms/accounts.

## Phase 3: responsiveness and performance
- Inspect full-room render frequency, redundant reads, avatar rendering and animation costs before changing server behaviour.
- Do not rerender the entire app every second unless there is an active reconnect countdown.
- Fetch friend options only when their panel is opened; avoid refetching them on every room chat update.
- Respect reduced motion and keep touch targets at least 44px.

## Validation and delivery
- Compile/typecheck, run affected browser regressions and the room security/access scenarios.
- Use independent browser sessions to verify chat delivery, moderation and room invitations after navigation changes.
- Verify 390px and 320px layouts, keyboard dialog closing, no horizontal overflow, and automated accessibility checks.
- Review screenshots of the room, chat and library before deploying to the existing service. Keep a pre-deploy encrypted snapshot through the existing deploy helper.
- No new dependencies or billing changes.

## Planned library
Tic-tac-toe, matching answers, Colour Hue, bingo, categories, original-character guessing (Guess Who-style), original social bluffing (Fakin' It-style), draw and guess, four/five-in-a-row and cooperative puzzles. All games free during experimentation. Later: a free selection and one optional monthly/yearly plan. No games or payment processing are implemented by this redesign.

## Delivered verification
+- Room artwork preserved; duplicate avatar panels and in-room account promotions removed.
+- Touch/keyboard-accessible bookshelf opens a preview library with cover controls and names below covers.
+- Native disclosure groups retain visitor/member invitations, friend invites, access removal, blocking, room rename, history clear and leave/delete confirmations.
+- Mobile room/chat views include an unread count; desktop shows conversation alongside the room. Message deletion is inside an explicit message-options disclosure.
+- Removed the unused once-per-second top-level clock and friend-list refreshes on every socket session event. Friend options load when their section opens and refresh on browser focus.
+- Removed redundant room-created/joined toasts. Chat composer fits in the tested 390×844 viewport; no horizontal overflow at 320px. Tablet bookshelf positioning checked against occupied seats.
+- Build/typecheck pass. All 15 browser scenarios verified across the full run and focused reruns, including independent room sessions, chat, access/moderation, avatars/themes, reconnection and automated WCAG checks. The one full-run failure was a stale expectation for a removed heading; its corrected scenario passed on rerun.
+- Screenshots reviewed for desktop room, phone room/chat/library, tablet and narrow phone. Games remain coming-soon previews. Free hosting cold starts and geographic network latency are not eliminated by these client changes.
