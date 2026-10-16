# Just Us — non-game release candidate

October 16, 2026. Local implementation and verification complete. **Not deployed or certified as a live production service.**

## What you can test now

Open http://localhost:3210. Use an incognito window or a separate browser for the other person. Normal tabs share one browser identity.

1. Register a free account, save the recovery key, and open **My account**.
2. In **My profile & pixels**, choose a preset, draw with pencil/eraser/fill, use undo/redo, and save. The canvas also works with keyboard arrows and Space/Enter.
3. In **My people**, invite a special person or a friend. Send the generated private link to another signed-in account. Both sides must consent; one special-person connection is allowed per account.
4. Rename your category headings, for example “My love” and “Good company.” Set a pet name for a connection. Only you see your names; the partner retains their own headings and pet names.
5. Create a room, share its room link/code, and join from the independent browser. Your artwork appears in the illustrated room. The creator can change sage/sunset/midnight themes; the other player sees the update.
6. Refresh, disconnect/reconnect, leave, close, reopen an invitation, or block a connected account. Guest rooms remain available without registering.
7. **Account security** supports password changes and fresh recovery keys. **Forgot password? Use a recovery key** performs a one-use reset and signs out older account sessions.

No games, subscriptions, photo uploads, chat, or automatic room admission for friends have been added.

## Production work completed in the repository

- Compiled Node server and frontend build; normal startup no longer depends on a TypeScript runner.
- Non-root Docker runtime definition and a free Render service blueprint.
- GitHub Actions workflow for build, unit/integration tests, browser checks, and dependency audit.
- Secure/HttpOnly production cookies, session rotation, CSRF/origin controls, strict CSP, timeouts, input bounds, auth/action limits, and server-derived account privileges.
- Account deletion requires a recent sign-in; deleted accounts lose their connections/invitations and other sessions.
- Recovery keys are random, hashed at rest, shown once, single use, and replaced after reset. No email recovery is promised.
- Guest and account state migrates to schema version 3. Storage keeps a private pre-upgrade snapshot transactionally, with at most three schema versions and 30-day expiry on subsequent writes.
- Backup/export and restore CLI with checksums, schema validation, and a backup of current state before restore. Restores discard old browser sessions, ephemeral rooms, receipts, and invitations, so old cookies are not revived.
- Readiness/liveness endpoints; no private answers, passwords, or token payloads in normal server logs.
- Safe fixed-palette pixel data, not user-authored SVG/HTML. Guests cannot send custom art through room input.
- Explicit connection consent, special-person uniqueness inside the authoritative write queue, ownership checks, private per-viewer pet names, and block/remove controls.
- Browser storage is optional; unavailable preference caches do not break room/account APIs. Rendering failures offer a recovery screen, and success notices dismiss automatically.

## Verified locally

- Production compilation and frontend build.
- Server/unit/integration checks include real PostgreSQL ownership handover, stale-writer refusal, maintenance exclusion, browser-role denial, an old-password login racing recovery, relationships, private labels, backups, profiles, production headers and room foundation checks. See the latest deployment automation report for counts.
- Eight independent Chromium browser scenarios against the compiled release, including deployment retry, recovery/password changes across separate browsers, two-account connections, profile art, private labels, shared room themes, invitation links, third-player rejection, refresh and reconnect.
- Automated WCAG AA checks for home, sign-in/room dialogs, the account page/editor, people page, and phone room.
- Phone 320/390px, tablet 768/1024px, and desktop layout checks; representative screenshots visually inspected.
- Dependency audit: zero known vulnerabilities at the last check.
- Real CLI backup/restore exercised on isolated SQLite data, not on your account database.

Automated accessibility checks are not a full accessibility certification. Simulated browser networking and viewport emulation are not actual iPhone/iPad or intercontinental-network testing.

## External launch gates — still required

1. **Dedicated hosted PostgreSQL:** connect the project, verify certificate trust and browser-role denial, run the actual PostgreSQL persistence/restore checks, and set an appropriate runtime database role. The adapter is implemented but has not been connected to a real database in this session.
2. **HTTPS hosting:** connect a source repository and the Render service (or equivalent), enter secrets through the provider UI, verify the compiled app and WebSockets on its HTTPS URL, and test from two different networks. The free provider URL is enough for experimentation; a purchased domain is optional.
3. **Live Google consent:** configure the provider and callbacks, then test success, cancellation, expired attempts, and seat-preserving upgrades. Existing OAuth tests use mocked provider responses; Google is disabled when its configuration is absent.
4. **Production operations:** choose retention, schedule off-host encrypted backups with restore drills, establish alerting/contact ownership, and confirm spend controls and free-tier limits. Repository scripts do not create a managed backup schedule by themselves.
5. **Public-service policies:** set the actual operator/contact, launch markets and age audience, and review privacy/terms obligations before public release. No invented business details or blanket legal compliance claim.
6. **Actual-device testing:** complete iOS Safari, Android Chrome, tablet, keyboard/screen-reader, zoom, and real background/resume checks.

## Capacity and deployment constraints

This is a **single-instance private-beta candidate**, not a horizontally scaled public platform. It persists versioned aggregate snapshots, with bounded room/account/session counts and in-memory abuse limits. No performance or availability SLA is claimed. Normalize persistent entities and add measured load tests/distributed coordination before scaling beyond that model.

One process owns the active PostgreSQL token. A replacement claims authority inside a transaction; the old token is fenced from later writes. Rolling updates now use the same service and URL, with a short reconnect instead of manual suspension. Real local PostgreSQL tests pass; live Render/Supabase handover still needs verification. Keep one desired instance and use the documented session pooler on 5432. A free host can sleep or restart, and free database tiers have quotas/availability limits.

## Build and operate

```powershell
npm ci
npm run build
npm start
```

The generated server lives in `dist/server`; only the frontend under `dist/web` is publicly served. Development remains `npm run dev`. Do not run the Vite development middleware in production. The Dockerfile is supplied but its image was not built in this environment; CI and the Render blueprint have not been executed on their external providers.

### Backups

Stop the application first so the state owner releases its lock. Use a protected destination outside Git/OneDrive:

Run `npm run build` first after source updates. Backup/restore commands use compiled JavaScript and remain available when development dependencies have been pruned.

```powershell
npm run backup -- C:/path/to/private/just-us-backup.json
npm run restore -- C:/path/to/private/just-us-backup.json --confirm-restore
```

The tools honor `.env`, `SQLITE_PATH`, `DATABASE_URL`, and `DATABASE_CA_FILE`. Restoration validates the backup on an isolated database before opening the target, backs up the previous target, and then writes the validated state. Users must sign in again after restore. Backups contain private profiles, relationship labels, and credential hashes: restrict access, encrypt off-host copies, and define retention. Deleting an account removes it from live state; older backup copies expire through the documented retention/operations process.

For external configuration, see [SETUP.md](SETUP.md) and [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md).
