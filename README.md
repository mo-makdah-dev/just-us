# Just Us

A private little space for two. Guest rooms, free accounts, pixel-art profiles, friends, and one special person are implemented. Playable games arrive later. See [release readiness](docs/RELEASE_READINESS.md) for verified work and the remaining live-production gates.

**Live experiment:** https://just-us-c7ee609b.onrender.com — see [verified hosted release](docs/HOSTED_RELEASE.md). Create an online account there; local accounts remain separate.

## Try it locally

Node 24 LTS is required. Dependencies are already installed in this checkout.

```powershell
npm run dev
```

Open **http://localhost:3210**. Create a room in your normal browser, then open a private/incognito window to join with the code. Two ordinary tabs share one identity and intentionally cannot occupy both seats.

Alternatively double-click **Start Just Us.cmd**. It waits for the website to be ready, or reuses an existing healthy Just Us server. Keep the server terminal open; close it to stop the server. The launcher never installs dependencies automatically.

No cloud account, database installation, Docker, domain, or credit card is needed for local rooms or username accounts. Local state is stored under `%LOCALAPPDATA%/JustUs/rooms.sqlite` on Windows, outside OneDrive. First startup copies the original temporary guest database there if it exists; the original is retained. Set `SQLITE_PATH` in `.env` to override this path. Node's built-in SQLite API currently emits an experimental warning; PostgreSQL is required in production.

## Included

- Mobile-first landing, nickname and six original pixel-avatar presets.
- Create/join via unpredictable invitation link or a 10-character code.
- Two-person lobby, live connection status, secure browser sessions.
- Refresh/reconnect recovery, reserved seats, idle/absolute expiry.
- Creator invitation rotation, leave/close controls, ownership transfer after departure.
- Server authority, runtime validation, CSRF/origin checks, action limits, idempotent commands.
- Local SQLite and a PostgreSQL adapter, with no public database reads.
- Free username/password accounts, saved profiles, sign-out, and account deletion.
- Server-verified account access flags and guest-to-account room continuity.
- Optional server-side Google OAuth integration through Supabase (external configuration required).
- Guest/free-account comparison, contextual sign-in prompts, and an account page at `/account`.

The profile includes a 24×24 pixel-art editor, friends and one accepted special person, private pet names, and editable category names. Shared rooms have an illustrated interior and owner-controlled themes. Password changes and single-use recovery keys are available in account security. Facebook, games, payments, and account-provider linking remain later work. Google stays disabled until configured; username accounts work immediately.

## Development commands

```powershell
npm run check
npm run build
npm test
npm run test:e2e
npm start
```

`npm start` serves the production frontend build locally. `npm run dev` serves the same server with Vite development middleware. Browser tests launch a separate test server on port 3211 and temporary isolated SQLite data. Integration tests use temporary ephemeral servers and in-memory databases. Neither test suite needs production credentials.

Source layout follows [PROJECT_PLAN.md](PROJECT_PLAN.md). Shared browser protocol types contain no canonical private state. Future game rules use `packages/game-core` and register independently; no game is registered yet.

## External setup and deployment

Start with [automated CLI setup](docs/CLI_SETUP.md): double-click **Connect Just Us.cmd**, approve the three provider sign-ins, and confirm your Supabase organization is Free. The assistant can create the repository/database/service. Fenced PostgreSQL handover now supports updates to the same service; no manual replacement is needed. The manual walkthrough remains available as a fallback.

The app is deployed on Render Free with dedicated Supabase PostgreSQL. Live HTTPS, independent browser rooms, database privacy/persistence and a real redeploy have passed verification. See [the hosted release](docs/HOSTED_RELEASE.md). Actual iPhone/iPad and different-network testing remain necessary.

See [docs/ACCOUNT_SETUP.md](docs/ACCOUNT_SETUP.md) for Google OAuth setup and [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) for the current release's scope, checks, backup/restore commands, and external setup gates. Phase documents preserve historical implementation notes.

See [docs/PHASE_1.md](docs/PHASE_1.md) for scope and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for implementation tradeoffs.
