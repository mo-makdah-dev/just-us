# Deployment automation phase

October 16, 2026. Authorized scope: install official GitHub/Supabase/Render CLIs, remove the manual replacement requirement, automate free hosting setup where authenticated access permits, and clearly identify remaining account consent.

## Database handover

Keep one active authoritative server. Replace the lifetime PostgreSQL ownership lock with a private owner record, a unique per-process token and a heartbeat. Claiming ownership and every save lock that record in a transaction. A replaced token cannot write, even before its heartbeat detects replacement. New application processes explicitly request takeover; backup/restore tools refuse to replace a live owner. The old HTTP process remains running long enough for Render to retire it and returns a retryable unavailable response. Existing sockets reconnect automatically with their original session cookies. This permits rolling replacement with a brief reconnect, not active-active scaling or guaranteed zero downtime.

Validate the current schema before transferring ownership. Preserve existing state and migration backups. Verify the SQL with a real, isolated PostgreSQL process locally, including stale-writer refusal, rollback, mutual exclusion with maintenance tools, private browser-role denial and two-server room continuity.

## Setup tooling

Install GitHub and Render official Windows CLIs and a pinned project Supabase CLI. Add a local setup entry point for status, browser authorization, private repository publishing, Supabase project provisioning, Render free-service creation and post-deploy checks. Record only resource IDs/URLs in deployment state. Store database credentials outside the repository/OneDrive; never echo them. Resume existing resources instead of silently provisioning duplicates. Fix the free plan explicitly and refuse known paid organizations before creating resources.

## Verification and delivery

Run type/build checks, focused real PostgreSQL tests, existing server/browser regressions and CLI dry runs. Update deployment instructions to the actual installed CLI versions. No hosted service is considered verified until real authenticated setup, certificate validation, HTTPS/WebSockets and hosted persistence checks pass. External account creation, plan consent and browser OAuth approval remain human actions.
