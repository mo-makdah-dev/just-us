# Non-game completeness audit — October 16, 2026

## Scope and order

Preserve the existing visual design and single-authority architecture. No games, billing, paid services or new dependencies. Each change is server-validated and covered by focused regression checks before publication.

### Phase 1: access and data integrity

- Security session revocation must detach visits without deleting saved rooms, memberships or history.
- Signing into an occupied guest seat must apply account bans and blocks, including restoration from another offline session. A denied upgrade rolls back without consuming the visitor seat or changing credentials.
- Blocking removes pending targeted invitations and separates active visits; blocked saved members cannot expose each other's chat by returning while the other is offline. Ownership is preserved; members may leave access independently. Anonymous identity circumvention remains inherently unpreventable.
- Recovery-key regeneration rechecks the credential used to authorize it inside the write queue.
- Room-code regeneration checks both visitor and membership namespaces.

### Phase 2: everyday controls

- Owners can revoke visitor/membership codes without replacing them, view pending friend-room invitations and cancel them.
- Authors can delete their own messages; owners can moderate any message and explicitly clear room history. Retire cached acknowledgements holding deleted content so retries cannot restore it.
- Accounts can revoke other sessions without resetting their password. Require recent sign-in, preserve saved rooms, rotate the current session and invalidate stale cookies.
- Download a private JSON export containing the account's own profile, people labels, saved-room summaries and authored messages. Exclude hashes, credentials, cookies, invite secrets and other people's messages. Require a recent sign-in.

### Phase 3: usability and truth in product copy

- Clear room chat drafts on room/account identity changes; preserve drafts on failed send. Never force-scroll someone reading earlier messages.
- Offer manual refresh/retry for saved rooms and avoid leaving stale invitation errors after success.
- Correct deletion copy: owned rooms are deleted; other-room membership is removed; previous messages are anonymized.
- Add in-app help/data explanations for guest expiry, single-use codes, chat retention, recovery keys and hosting wake-up/reconnect behavior. State actual behavior without inventing operator/legal details.
- Update outdated readiness documentation; distinguish a complete private-beta feature set from public-launch operations still needing a human decision (operator/contact, actual-device tests, managed backups, Google configuration).

### Phase 4: verification and release

Run typecheck, compiled build, server/integration suite, independent-browser scenarios and dependency audit. Add regression cases for session revocation, blocked/removed sign-in, privacy-safe export, invitation cancellation and chat deletion. Test new controls in independent browser sessions and phone accessibility. Publish to existing private GitHub/Render service with encrypted pre-deploy snapshot; run focused live checks with synthetic accounts and remove test data. Preserve existing local and production data.

## Audit findings and completed implementation

- Saved-room loss during account recovery/session revocation: fixed by detaching visits rather than deleting their rooms.
- Removed/blocked account upgrade through a guest seat: authorization is checked again inside the sign-in transaction; failures preserve the guest visit.
- Blocks now revoke membership in each other's owned rooms, cancel targeted requests and separate other shared visits. Owners keep their own room. Unblocking does not silently restore membership.
- Owners can revoke both open codes and cancel individual pending room invitations. Pending invitation identities are projected to the owner only.
- Chat authors can delete their messages; owners can moderate messages or clear all history with confirmation. Cached acknowledgement payloads are retired after deletion.
- Account security supports recent-sign-in-gated other-session revocation and a private JSON data download. Exports exclude credentials, invite tokens and other authors' messages.
- Special connections can become ordinary accepted friends without deleting private labels.
- Chat drafts clear when room/account identity changes, and scrolling respects someone reading older messages.
- Same-page invitation links now open their flow through hash-change handling, fixing links ignored on an already-open homepage.
- The help/data dialog describes actual cookie, storage, recovery, block, retention and free-host behavior; deletion copy matches saved-room destruction.
- No new dependencies, provider accounts, services or charges were introduced. Storage remains version 4; existing data needs no destructive migration.

## Public launch boundaries

This completes a bounded non-game private-beta audit, not a claim that all possible defects are eliminated. Before a broad public launch, the operator still needs to choose a real support/contact identity and policies, configure Google only if wanted, arrange off-host backups/alerts and test actual devices/networks. The free single-instance aggregate-store capacity and in-memory rate limits remain documented constraints. No public reports/moderation service, email reset or payment feature is implied.

## Verification record

Pending final local browser checks, CI and controlled live publication. Results are updated after those checks complete.

- A second device may sign in for account management without taking over an active seat. It can explicitly revoke other sessions, then enter a saved room. Duplicate live visits remain refused.
- Revoked sessions clear their account view automatically, including on recovery; fresh sign-in is needed to return.
- Full-browser tests use larger authentication and general API IP allowances only under NODE_ENV=test because all synthetic accounts share localhost. Integration checks confirm production ignores both test allowances and still rejects the thirteenth authentication request and the 181st API request in their respective windows.
