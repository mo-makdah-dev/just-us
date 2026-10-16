# Just Us: automated free setup

October 16, 2026. GitHub CLI 2.102.0, Supabase CLI 2.121.0 and Render CLI 2.29.0 are installed. Local rooms/accounts already work without signing into any provider.

## Your remaining steps

1. Open **Connect Just Us.cmd** in the project folder. It runs the three official sign-in flows, one at a time. Approve GitHub, Supabase and Render in your browser. Follow any short terminal prompt. Create the Supabase/Render accounts if needed; GitHub sign-in is available where offered. Do not send passwords or tokens in chat.
2. In Supabase, create/select an organization whose billing page says **Free**. Do not select Pro/Team or add a paid upgrade. In Render, keep the workspace and eventual service on their Free options. If Render asks for GitHub repository installation consent later, approve access to **just-us**.
3. Tell the assistant: **“The three sign-ins are complete; my Supabase organization is Free.”** Share the organization name or ID if several exist. The assistant handles repository creation, database provisioning, hosting settings, deployment and verification. You do not need to create the repository or project manually.

That is all the account work expected from you. A provider may still require ownership verification, account terms or additional consent; those cannot be bypassed by a CLI. Google sign-in for people using Just Us is optional and separate from these infrastructure sign-ins.

## Commands the assistant runs afterward

```powershell
npm run cloud -- status
npm run cloud -- repository
npm run cloud -- database --free-org YOUR_CONFIRMED_FREE_ORGANIZATION_ID
npm run cloud -- deploy
npm run cloud -- verify
```

- `status` is read-only and reports authorization/resource state without printing credentials.
- `repository` publishes this project to the signed-in user's private `just-us` repository. It preserves an unrelated origin by refusing to replace it. Runtime databases and credentials are excluded. Initial commits use your configured Git identity, or your GitHub name and no-reply address locally.
- `database` requires an explicitly confirmed Free organization. The CLI does not consistently expose its billing plan: the assistant must verify the Free selection before supplying `--free-org`. Known non-Free metadata is refused. The command generates and encrypts a database password, records the project name before creation, and looks for that existing name on retries.
- `deploy` uses the CLI's discovered Supabase shared pooler on **5432**, validates TLS, creates a single **Render Free Node web service**, and uploads a server-only secret file. Passwords are not placed in Render command arguments. If a deployment already exists, it deploys the recorded service rather than creating another. Existing service recovery requires matching repository/name; unfamiliar provider responses stop safely for review.
- `verify` checks the public HTTPS readiness endpoint and requires PostgreSQL. It does not claim browser multiplayer, hosted backups, or Google consent have passed.

On later updates run build/tests, `repository` to commit/push changes, and `deploy` to update the same service. Automatic deploys are initially off to keep the pilot deliberate; they can be enabled after live verification. The database handover supports overlapping replacement, so there is no longer a requirement to suspend or recreate the service for each update. Expect a brief reconnect, not a zero-downtime promise.

## Secrets and local records

Deployment records are outside OneDrive/Git at `%LOCALAPPDATA%/JustUs/deployment`. `resources.json` holds only resource identifiers and the website/repository URLs. The database password file is encrypted with Windows DPAPI for your Windows account. Official CLI login credentials remain in their own user configuration/keychain stores.

For initial Render creation, `upload.env` exists briefly in that private directory, is uploaded as `just-us.env`, and is deleted in a `finally` block. If power loss interrupts creation, the assistant should remove a leftover `upload.env` before retrying after inspecting recorded resources; the tool refuses to overwrite it. Supabase linking caches stay in that same private deployment directory. Do not delete the encrypted password or reset the database password casually.

The app reads `/etc/secrets/just-us.env` server-side and derives its allowed HTTPS origin from Render's `RENDER_EXTERNAL_URL`. You need not copy the website URL into settings manually. An explicit `APP_ORIGIN` remains available for other hosts. No secret is bundled into the frontend.

## Verification status

Installed CLI versions, local authorization detection, command construction, secret redaction, actual Windows DPAPI round-trip and real local PostgreSQL handover are checked. No provider is authenticated yet. Resource creation, Supabase pooler discovery, Render secret-file upload and live deployment are implemented but cannot be fully verified until account access is granted. The blueprint validation command also requires an authenticated Render workspace.

After provisioning the assistant must verify hosted TLS, database-role privacy, persistence/restart, independent browser room flows and backup/restore on isolated hosted data. You should test actual phones and separate networks. This remains a single-active-server beta with bounded aggregate storage; horizontal scaling, operational backups and public-service policies remain separate launch work.

See [the free hosting overview](FREE_DEPLOYMENT.md) and [optional Google setup](ACCOUNT_SETUP.md).
