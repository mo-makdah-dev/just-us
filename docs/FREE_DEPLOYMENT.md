# Your free online experiment

Checked October 16, 2026. You already have GitHub. You still need Render and Supabase accounts. Keep both on their **Free** plans. No domain purchase is needed.

**This project is now hosted and verified.** Open https://just-us-c7ee609b.onrender.com and see [HOSTED_RELEASE.md](HOSTED_RELEASE.md). The setup instructions below are retained for rebuilding the experiment.

**Recommended: use the [automated CLI setup](CLI_SETUP.md).** The tools are installed. Open `Connect Just Us.cmd`, approve the three sign-ins and confirm your Supabase organization is Free. The assistant can create the private repository and hosted resources. The dashboard instructions below are a manual fallback.

## What runs where

| Part | On your computer now | Online experiment |
| --- | --- | --- |
| Website and live room server | Node, localhost:3210 | One Render Free Node web service |
| Accounts, profiles, relationships, rooms | SQLite in `%LOCALAPPDATA%/JustUs` | Supabase Free PostgreSQL database |
| Source and automated checks | This folder | Your private GitHub repository |
| Google login | Optional, not configured | Optional, separate setup |

Local username/password accounts already work without a cloud service. Supabase is the hosted database here; enabling its email authentication is unnecessary. Local accounts do not automatically appear online: register separate test accounts on the deployed website.

Expected hosting cost is **$0/month within free quotas**. Render can sleep after 15 minutes without inbound traffic and take about a minute to wake. Supabase Free can pause after low activity over seven days. These interruptions make this an experimental setup. See [Render Free](https://render.com/docs/free), [Supabase pricing](https://supabase.com/pricing), and [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

## 1. Publish source to GitHub

1. Create a **private**, empty GitHub repository named `just-us`. Leave README, license and gitignore initialization unchecked.
2. Give the assistant its repository URL. This checkout currently has no remote; the assistant can prepare the initial source commit/push once GitHub authentication is available. Alternatively publish this existing folder with GitHub Desktop.
3. Publish source only. `.env`, `node_modules`, `dist`, browser-test results and runtime databases must stay excluded. Never upload your SQLite account database or database password.

## 2. Create the online database

1. Open [Supabase](https://supabase.com/dashboard), create an account and a Free organization if prompted.
2. Choose **New project**, name it `Just Us experiment`, select a nearby region, and generate a strong database password. Save it in your password manager.
3. Once provisioned, open **Connect → Session pooler**. Copy the PostgreSQL connection URL with port **5432**. Replace the password placeholder with your saved password, URL-encoding reserved characters. Retain the dashboard's actual user/host/project values.
4. Do **not** choose Transaction pooler / port 6543: this app holds a PostgreSQL session lock. See [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres).
5. Keep that URL for Render's secret environment setting. Do not paste it into chat or GitHub. The server creates its private pilot tables automatically.

## 3. Create the website server

1. Open [Render](https://dashboard.render.com/), create an account and authorize access to your `just-us` GitHub repository.
2. Choose **New → Web Service**, select the repository and its source branch, choose Node runtime, and leave the root directory blank.
3. Select **Free**, one instance, and initially **Auto-Deploy: Off** so live checks happen before unattended releases.
4. Build command: `npm ci --include=dev && npm run build && npm prune --omit=dev`
5. Start command: `npm start`
6. Enter these environment variables through Render's environment editor:

| Name | Value |
| --- | --- |
| `NODE_VERSION` | `24` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `TRUST_PROXY` | `1` |
| `DATABASE_URL` | Your secret Supabase Session pooler URL |
| `APP_ORIGIN` | Optional on Render: automatically uses `RENDER_EXTERNAL_URL` |

Render supplies `PORT` and the website origin. Do not add frontend `VITE_` database keys. If setting an explicit `APP_ORIGIN`, it must match the actual HTTPS URL without a trailing slash.

7. Set the health check path to `/ready`. Use the actual `https://...onrender.com` URL assigned to your service. No custom domain is required. [Render web services](https://render.com/docs/web-services)
8. Deploy and watch the logs. If database certificate verification fails, obtain your provider's root CA certificate, mount it as a Render secret file, and set `DATABASE_CA_FILE` to its path. Never disable certificate verification.

### Updating this pilot

The database allows one active authority while supporting overlapping replacement. A new server validates the stored schema and atomically claims a new ownership token. Every write checks that token inside its transaction; the retired server cannot overwrite the new state. Its sockets close and retry, with the same browser sessions and room seats. Backup/restore tools refuse to replace a live server.

Deploy updates to the **same Render service**; no manual suspend, replacement service or URL change is required. Expect a short reconnect during handover. This has passed a real local PostgreSQL/two-server test; Render's live routing behavior still needs verification after sign-in. Active-active horizontal scaling remains unsupported. [Render deployment sequence](https://render.com/docs/deploys)

## 4. Verify before sharing

Once dashboards are configured, have the assistant verify:

1. `/ready` returns `ok: true` and `storage: postgres`.
2. Accounts, saved profiles and sign-in survive a controlled server restart.
3. Two independent browsers can create/join a room on the HTTPS website. Test different networks, shared themes, refresh and reconnect.
4. A third visitor cannot enter an occupied room; pet names remain private per account.
5. Supabase browser roles cannot read the private state tables; backup/restore works on isolated hosted test data.

Online deployment and live Supabase verification have passed for this checkout. The assistant created the resources after account authorization and repository-access consent; see [the hosted release evidence](HOSTED_RELEASE.md).

## Optional: Google sign-in

Username sign-in is sufficient. For Google, follow [ACCOUNT_SETUP.md](ACCOUNT_SETUP.md): configure a Google OAuth client, Supabase's Google provider and exact application callbacks. Facebook is not implemented.

## Local testing today

Double-click `Start Just Us.cmd` and visit [localhost:3210](http://localhost:3210). The launcher waits until the app is ready or reuses a healthy existing server. Keep its server window open. No cloud account or database installation is needed. Use a private window for the second person's seat; ordinary tabs share an identity.
