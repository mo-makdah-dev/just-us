# Just Us — live experimental release

Verified October 16, 2026.

**Website:** https://just-us-c7ee609b.onrender.com

**Private source:** https://github.com/mo-makdah-dev/just-us

**Hosting dashboard:** https://dashboard.render.com/web/srv-db94vhc9v7es739i7u70

**Database dashboard:** https://supabase.com/dashboard/project/wiwvucypkmwxqqcgmvnd

## What you do now

Open the website. Use **Join free** to create your online username account and save its recovery key, or continue as a guest. Local accounts remain separate from the hosted database. Create a room and send its link/code to your partner. Test with actual phones/tablets and different networks; the assistant's hosted tests used independent Chromium desktop/phone contexts from this computer.

No additional hosting setup or domain purchase is required for this experiment. Google sign-in still needs optional provider configuration; username sign-in is already available. Games have not been added.

## Provisioned resources

- Private GitHub repository `mo-makdah-dev/just-us`.
- Dedicated Supabase project `just-us-c7ee609b`, in your confirmed Free organization. The unrelated existing project was untouched.
- Render **Free** Node web service, one desired instance, Virginia region, with automatic deployments initially disabled.
- Server-only database secret file and the official Supabase root CA. Certificate and hostname verification remain enabled. The website origin derives from Render's assigned HTTPS URL.
- Database password encrypted locally with Windows DPAPI; resource IDs stored under `%LOCALAPPDATA%/JustUs/deployment`. No credentials are recorded here.

## Verified on the actual hosted system

- Render Blueprint validation and GitHub Actions build, server tests, audit and browser suite passed for the initial release.
- Public `/ready` reports healthy PostgreSQL storage.
- Actual Supabase TLS, persistence through a fresh connection and isolated snapshot export/restore passed. Verification schemas were removed afterward.
- RLS is enabled and Supabase `anon`/`authenticated` roles cannot read the actual live state, backup or ownership tables.
- Independent desktop and phone browser contexts registered random-password test accounts, accepted a special-person connection, kept pet names private, edited/saved pixel art and joined a shared room.
- Live Socket.IO theme updates, occupied-room rejection for a third visitor, browser refresh, narrow-screen overflow and automated phone WCAG AA checks passed.
- A real Render redeploy with both browser contexts open preserved sessions, room seats/code, artwork, theme and pet names. The same website URL remained usable.
- Synthetic test accounts were deleted and the smoke-test room was closed.

Screenshots are in ignored `test-results/hosted-room-desktop.png` and `test-results/hosted-room-phone.png`. Verification scripts: `scripts/hosted-database-check.ts` and `scripts/hosted-smoke.ts`. The smoke script performs a real redeploy and deletes only its own synthetic accounts; do not run it casually during someone else's date.

## Updates

After code changes, run the appropriate build/tests, then `npm run cloud -- repository` to commit/push and `npm run cloud -- deploy` to update this service. `npm run cloud -- verify` checks public readiness. No manual service suspension or recreation is needed. A short reconnect is expected during handover; no zero-downtime guarantee is claimed.

## Remaining scope and limits

Free services may sleep, pause or reach quotas. Accounts are real and persistent, but this is a private experiment with bounded aggregate storage and one active authority. Google consent, actual iOS/Android/tablet/network testing, scheduled off-host encrypted backups, alerts, a least-privileged runtime database role, operator/contact information and public policies remain public-launch work. Snapshot migration backups are not an off-host backup schedule. No games, payments, subscriptions, Facebook or voice/video are enabled.
