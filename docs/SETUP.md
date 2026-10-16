# What you need to set up

**The free hosted experiment is now set up.** Visit https://just-us-c7ee609b.onrender.com. See [HOSTED_RELEASE.md](HOSTED_RELEASE.md) for results and your testing steps. The following instructions remain for local development or a future fresh deployment.

Updated October 16, 2026. Local experimentation is ready without external accounts. The assistant handles code, commands, configuration, and verification; you guide and test. You only need to perform account sign-in/consent or provide access where a service requires your ownership.

## 1. Testing on this computer — nothing external

Open `Start Just Us.cmd` or run `npm run dev`, then visit **http://localhost:3210**. Use your normal browser for one person and a private/incognito window for the second. Do not use two ordinary tabs to simulate two people.

Local rooms and free username accounts are stored under `%LOCALAPPDATA%/JustUs/rooms.sqlite` on Windows. Existing temporary room data is copied automatically on first startup; the original is retained. Use `SQLITE_PATH` in `.env` to override the location. Do not put runtime databases in the source repository or OneDrive.

Nothing in this version requires Google, Facebook, Stripe, Supabase Auth, email, a domain purchase, or a paid plan.

## 2. Playing remotely — recommended free experiment

You already have GitHub. Prefer [the automated CLI setup](CLI_SETUP.md): open `Connect Just Us.cmd`, approve the three sign-ins and confirm a Free Supabase organization. The assistant can handle provisioning. The instructions below are a manual fallback.

For partners in different locations, use the live **Render Free web service + Supabase PostgreSQL project** within their quotas. Localhost remains available for development.

### Your account-level steps

1. Sign in to or create GitHub (for the source repository), Render, and Supabase accounts. A different supported Git provider can replace GitHub.
2. Create a dedicated **Free** Supabase project for Just Us experimentation. Pick a region near the eventual Render service. Save its database password in your password manager.
3. In the project's **Connect** dialog, choose **Session pooler** on port 5432 for this pilot. Copy the provided connection string rather than composing the hostname. Replace the password placeholder and percent-encode reserved password characters. A direct connection is also acceptable where IPv6 connectivity is available. Transaction pooler 6543 is outside this verified setup. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)
4. Store the database URL in Render's secret environment settings or a local ignored `.env`; do not post credentials into repository files, screenshots, or the chat. If you want assistance, share which dashboard step you are on, not your password.
5. Authorize Render's repository connection. Keep your source private if preferred; users only need the eventual website URL.

The assistant can prepare repository/deployment configuration and guide these steps. It cannot invent your credentials or complete third-party consent on your behalf without access.

### Render service configuration

Create a **Web Service**, not a Static Site. Choose Node runtime, the repository root, one instance, and the **Free** compute option.

| Setting | Value |
| --- | --- |
| Build command | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start command | `npm start` |
| Health check path | `/ready` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24.11.0` (or a supported patched Node 24 release) |
| `HOST` | `0.0.0.0` |
| `APP_ORIGIN` | Optional on Render; derives from `RENDER_EXTERNAL_URL` |
| `DATABASE_URL` | Secret Supabase direct/session connection string |
| `TRUST_PROXY` | `1` for Render's expected reverse-proxy arrangement; verify deployment topology |

Let Render supply `PORT`. No frontend `VITE_` secrets are needed. Optional Google OAuth uses server-side `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; see `ACCOUNT_SETUP.md`. The start command runs the compiled Node server; development dependencies can be pruned after building.

If database TLS trust requires the project's root certificate, obtain the certificate from the provider and mount it through Render secret files. Set `DATABASE_CA_FILE` to that file path. Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` or change certificate validation to false.

The first boot creates private RLS-protected tables. A replacement server atomically claims authority, fencing the previous server from every subsequent write. This permits updates to the same Render service with a brief reconnect; no manual suspend/recreation is required. Keep one desired instance. See [handover details](FREE_DEPLOYMENT.md#updating-this-pilot). Normalize aggregate storage before broad scaling.

These settings follow the [Render Express deployment workflow](https://render.com/docs/deploy-node-express-app). Check current provider UI/limits during setup.

### Free-tier limitations

Render's free app can sleep after inactivity, take time to wake, restart, and lose local files. This is why hosted mode requires external PostgreSQL. Its included hours/build/bandwidth quotas also apply. Use a provider subdomain; no domain purchase is needed. [Render free-service limits](https://render.com/docs/free)

Supabase's Free project is suitable for experiments within quotas, not a backup/reliability guarantee. Check its current pause, storage, connection, and backup conditions before depending on it. [Supabase pricing](https://supabase.com/pricing)

Keep paid add-ons disabled. Check the provider billing dashboard and spend controls. Do not choose Render's temporary free PostgreSQL database as durable ongoing storage without accepting its expiry; the recommended database here is Supabase.

## 3. Remote verification after access is configured

The assistant should verify `/ready`, then create a room on one independent browser and join from another on the HTTPS URL. You and your partner should also test from different networks and actual phones/tablets. Check refresh, temporarily turning network off/on, leaving, reopening invitations, and closing the room.

Until that happens, remote multiplayer, real-device backgrounding, and live PostgreSQL recovery remain unverified. Local Chromium emulation does not replace iPhone/iPad testing.

## 4. Accounts and optional Google setup

Free username/password accounts work now without an external account. Google OAuth is implemented but requires provider setup. Follow [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md) for exact steps. Facebook remains a later phase.
