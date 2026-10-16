# Deployment automation results

October 16, 2026.

## Completed locally

- Installed official GitHub CLI 2.102.0 and Render CLI 2.29.0 through WinGet; pinned project Supabase CLI 2.121.0. No Docker installation is needed for this setup.
- Added `Connect Just Us.cmd` for sequential browser sign-ins and `npm run cloud -- ...` for status, private source publishing, dedicated Supabase project creation, free Render service creation/redeploy, and HTTPS PostgreSQL readiness checks.
- Deployment resource IDs are saved outside the repository. Passwords use Windows DPAPI and are uploaded through a short-lived server-only secret file, not frontend settings or Render CLI argument values. A PowerShell module compatibility failure was found by the test and fixed by invoking the .NET DPAPI API directly.
- Render origin now derives from its built-in `RENDER_EXTERNAL_URL`; no temporary incorrect origin or manual URL-copy step is needed.
- Replaced lifetime database ownership with a transactionally fenced token. New servers validate state before takeover. Replaced servers cannot write, mutation routes return a retryable unavailable response, and old socket transports close so clients can reconnect. Maintenance tools cannot replace a live server; a live maintenance operation blocks server takeover.
- Added read/session and socket retry behavior for handover without automatically resubmitting mutations.
- No longer requires suspending/recreating the Render service or changing URLs for routine updates. Still one desired instance, aggregate snapshots and private-beta scope.

## Verification

- TypeScript and production compilation/frontend build pass.
- 47 server/unit/integration checks, including real isolated PostgreSQL, CLI argument/secrets checks and an actual Windows DPAPI round-trip.
- Eight compiled Chromium browser scenarios pass, including two independent participants, private relationships, profile art, account recovery, refresh/reconnect and startup retry through two temporary 503 responses.
- Real PostgreSQL tests verify retired-writer refusal, failed-schema takeover rollback, maintenance exclusion, browser-role denial for all three private tables, session/account/room continuity across overlapping HTTP/socket servers, and continuing room actions after handover.
- Dependency audit at installation: zero known vulnerabilities.
- CLI `status`/`plan` executed without resource mutations. All three providers currently report sign-in required.
- Remote Render Blueprint validation was attempted but requires an authenticated workspace; not claimed as passed. CI configuration and hosted provisioning remain unexecuted externally.

## Remaining human/account steps

Open [CLI_SETUP.md](CLI_SETUP.md). Run `Connect Just Us.cmd`, approve GitHub/Supabase/Render sign-ins, and confirm a Free Supabase organization. Render may also require GitHub repository access consent. No provider credentials should be pasted in chat.

After that the assistant can provision and verify the real hosted system. CLI project creation, connection discovery and secret upload code are implemented but not live-verified without those accounts. Real Supabase TLS, hosted restarts/backups, HTTPS/WebSockets and actual-device/network behavior are still launch gates. Optional Google login also requires its separate provider setup.
