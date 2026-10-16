# Phase 2 — free accounts and guest experience

Status: local implementation complete; live Google OAuth verification awaits external configuration. No games, buddies, or payments added.

## Scope and product behavior

- Preserve the existing visual direction and guest create/join flow.
- Add tasteful free-account prompts in the header, hero, guest/account comparison, games shelf, room identity form, lobby, and footer.
- Explain that additional account games arrive later; never imply games already exist.
- Add `/account`, signup/signin dialogs, saved nickname/avatar, profile editing, sign-out, and account deletion.
- Keep signup free. No pricing, checkout, or subscription integration.
- Add username/password registration so account mode works immediately without external services.
- Add Google OAuth via Supabase as an optional configured provider. Facebook remains later work.

The original plan preferred avoiding password infrastructure. The implementation now includes username/password authentication to satisfy usable free accounts without mandatory external setup. It does not introduce email/password verification or pretend a recovery workflow exists. This adjustment is recorded explicitly rather than silently substituting a fake account preview.

## Server identity and security

Passwords use independently salted scrypt with N=32768, r=8, p=1, and a 64-byte derived key; comparisons are timing-safe. Hashing concurrency is bounded. Auth endpoints apply per-IP and per-session rate limits, runtime schemas, exact origins, and CSRF checks. Passwords and provider tokens are not stored in command receipts or sent in personalized snapshots.

Successful signup/login/logout rotates the opaque application session cookie and CSRF secret. The old credential is revoked. Membership is rebound transactionally while retaining the seat's ID. The old socket is disconnected; the UI reauthenticates with the new session. Guest-to-account failures do not discard the guest room.

Existing account logins can recover an offline account seat but cannot take over an account's active room in another browser. Conflicting guest/account rooms produce a clear error. Account ownership and catalogue access are derived on the server; request fields cannot choose an account ID or tier. Partners do not receive account credential/profile metadata.

Profiles and password hashes live in the server's private versioned storage. State version 1 migrates to version 2 by retaining rooms/sessions/receipts and initializing the account collection. Unknown versions still fail safely. This remains an aggregate snapshot pilot, not the normalized relational account/buddy schema planned for a larger service; split it into reviewed SQL migrations before expanding public scale.

Google uses per-attempt server-only PKCE storage, a random HttpOnly SameSite=Lax callback cookie, an exact callback URL, a ten-minute attempt expiry, one-use callback consumption, and remote `getUser` verification after code exchange. Google subjects are never merged with a local password account based on matching nickname/email. Provider failures do not grant account access. Provider refresh/access tokens remain transient in the consumed flow; they are not browser storage or durable application credentials.

## Local storage improvement

The normal local database now lives in the operating system's application data folder, outside OneDrive and outside temporary storage. The first startup copies legacy temporary data using SQLite's backup API and keeps the original. Explicit `SQLITE_PATH` test configurations remain isolated. Hosted production still requires PostgreSQL.

## Verification

- TypeScript and production build: passed.
- 27 server/unit/integration tests: passed, including password hashing, session rotation, guest/account authorization, profile saving, offline account recovery, deletion, state migration, OAuth attempt validation, callback replay/expiry, and rejection of forged HTTP identity fields.
- 5 Chromium browser scenarios: passed. Includes live guest rooms, room-preserving account signup/signout/signin, saved profile after refresh, mobile signup, account page, invitation links, and reconnects.
- Automated WCAG AA checks cover the landing page, room identity dialog, phone lobby, signup dialog, and account page.
- Updated phone landing and desktop account screenshots: visually inspected.
- Dependency installation reported zero known vulnerabilities.
- Live Google consent, external PostgreSQL, public deployment, and physical iPhone/tablet checks remain pending. Mocked OAuth tests do not establish live provider readiness.

Next: the user tests this experience. Buddies, pet names, custom avatars, and games remain separate future phases.
