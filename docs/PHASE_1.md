# Phase 1 — implementation checkpoint

Status: local implementation delivered. Dependencies installed under the user's explicit authorization. Hosted PostgreSQL and internet-device verification remain pending external account setup.

## Deliverable

A responsive zero-game room foundation: create/join, nicknames, pixel avatar presets, two-seat lobby, secure guest sessions, invitation controls, connection status, expiry, reconnects, and restart recovery. Accounts and games follow in later phases.

## Installation scope

`package.json` and `package-lock.json` record the installed dependencies. The build and TypeScript checks pass. Vitest was upgraded after the original version range resolved to vulnerable test tooling; the subsequent audit reports zero known vulnerabilities.

- Runtime: React/React DOM, Express, Socket.IO server/client, Zod, PostgreSQL client (`pg`).
- Development: TypeScript, Vite, tsx, Vitest, Playwright Test, axe browser accessibility checking, and relevant TypeScript definitions.
- Browser download: Chromium only, for two isolated browser-context tests.
- Locations: project-local `node_modules` and lockfile; normal npm cache and Playwright browser cache. No global npm packages or new Node installation.
- Persistent production room state: PostgreSQL, never project-local OneDrive files. Tests use temporary isolated state and must never point at production.

The user authorized implementation/tool installation and clarified that he will guide and test while the assistant handles setup. No paid service was created. Network-restricted installs and localhost tests were retried with the runtime's permitted network access.

## Free experimental setup

No purchases or service registrations are part of this checkpoint. [SETUP.md](SETUP.md) contains exact environment variables and free-tier deployment steps. Local testing now uses built-in SQLite without an external account; see [ARCHITECTURE.md](ARCHITECTURE.md) for this documented adjustment and the versioned aggregate snapshot storage. Hosted PostgreSQL persistence remains unverified without a dedicated database connection.

The requested free preference applies to the experiment. Explain free-host sleep/expiry limitations before recommending an external setup; do not silently choose paid hosting. Google/Facebook configuration is outside Phase 1.

## Verification gate

Build/type checks; room lifecycle and authorization tests; two isolated browsers plus a rejected third client; mobile viewport; refresh and reconnect; expired-room rejection; database restart recovery once a dedicated development database is available. Report local checks separately from public two-network checks.

## Verification results

- TypeScript and production frontend build: passed.
- 14 unit/integration tests: passed. Includes concurrency, member/owner enforcement, privacy projections, validation, invitation rotation, expiry, reconnects, database reopen, failed-save rollback, and real HTTP/socket sessions.
- 3 Chromium browser scenarios: passed. Includes isolated desktop/phone identities, third-player rejection, refresh, simulated offline/online events, invitation links at 320px, keyboard dialog dismissal, and automated WCAG AA checks for home, identity dialog, and phone lobby.
- Desktop home/lobby and phone lobby screenshots: visually inspected.
- PostgreSQL adapter, public deployment, actual phones/tablets, and two-location internet behavior: pending external setup; no remote verification claimed.
- No playable games or accounts were added.
