# Rooms v2 — product and verification notes

October 16, 2026. Implements [ROOMS_V2_PLAN.md](ROOMS_V2_PLAN.md). Four people is the chosen small-group capacity; no psychological research claim is made.

## Final product behavior

- Guest-created rooms last one hour maximum and close after five empty minutes. The server rejects expired access immediately and sweeps physical records every 15 seconds. A stored presence timestamp prevents an abandoned room from being revived after server downtime.
- Guests have temporary nicknames, a standard avatar and visitor labels. They do not get saved membership, profile customization, people lists or chat access. No guest nickname/avatar preference is saved in browser local storage. Temporary server visit/session records support reconnects and are cleaned up; no durable guest profile is created.
- Signed-in accounts have the current full feature set without payments or a product room-count quota. Request-rate/global service-capacity controls still apply. Their rooms retain ownership, permanent members, name/theme and bounded recent chat while empty.
- **My rooms** lists owned/member rooms and targeted friend invitations. Entering another room switches the current visit. Leaving a visit retains membership; leaving membership removes future access. Owners can delete rooms, name them and remove members/visitors. Room-owner deletion removes the room; authored messages elsewhere are anonymized on account deletion.
- Both visitor and membership codes are single-use. Visitor codes grant a temporary visit and cookie-based reconnect; membership codes grant lasting account access. Codes expire after 24 hours or the guest-room deadline. A guest may explicitly redeem a membership code as a visitor; they are not saved, including if they subsequently sign in. Owners can issue a fresh code for each admission.
- Friend-room invitations are targeted to accepted connections and require recipient acceptance. Special-person relationships remain mutually accepted, unique per account and included among accepted friends; pet names are private to each side.
- Signed-in current occupants can chat regardless of who created the room. Guests receive neither message data nor a send capability. Saved members see recent history; signed-in visitors see messages from their current authenticated visit. Messages are plain text, max 1,000 characters, capped at 200 per room and 30 days; send rate is separately limited.
- A guest-room owner can sign in and explicitly save the room, without enrolling other visitors.
- The room illustration and roster have four seats. Phone chat precedes invitation management and the future games shelf. Games remain unimplemented; each future game will declare supported player counts separately.

## Data safety and migration

Canonical storage is version 4. Versions 1–3 migrate without replacing credential hashes, recovery keys, profiles or relationships. Existing account-owner rooms become saved owner rooms; other occupants remain visitors. PostgreSQL fencing still permits only one active authority, and pre-version-change snapshots remain transactional. Restoration clears ephemeral sessions, rooms, receipts and room/people invitations.

The cloud deployment command now writes a consistent encrypted pre-deploy snapshot outside Git/OneDrive before updating an existing service. This uses Windows DPAPI for the current Windows account. It is a local recovery checkpoint, not a portable off-host backup schedule. Physical room deletion also removes cached command results containing that room; operational snapshots retain their documented retention.

## Verification

The local server suite covers legacy migration, guest absolute/empty expiry and downtime, four-seat admission, invitation races, secret-free visitor projections, guest membership fallback, durable room return, targeted friend consent, removal/re-entry denial, chat privacy/retention, account deletion, provider auth and PostgreSQL handover. Compiled browser scenarios cover desktop/phone/tablet, four independent participants, saved-room switching/inbox acceptance, one-use membership fallback, guest chat gating, private labels, removal, reconnect and automated WCAG AA checks.

Hosted publication and its final smoke test are recorded after the controlled migration below. Actual phones and different networks still need your testing.

## Hosted verification

- The release was published to the existing Render Free URL, with an encrypted pre-deploy snapshot and a transactional version-three migration snapshot.
- Live PostgreSQL reports version 4. Pre-upgrade account identities, password/recovery hashes and provider bindings were compared and retained.
- TLS hostname/certificate verification, actual production-table RLS/browser-role denial and isolated snapshot export/restore pass against Supabase.
- Independent HTTPS desktop/phone accounts accepted a special relationship, privately named each other, edited artwork and redeemed a single-use membership code.
- Saved memberships, room identity/seats, a chat message/history, saved artwork, pet names and shared theme survived a real Render redeploy. Synthetic accounts and their test room were removed afterward.
- The final permission audit retires cached room/chat acknowledgement snapshots on departure, removal or deletion. Retried commands cannot expose revoked cached room data or recreate a room during the deduplication window.
- Local coverage includes 65 server/unit/integration cases and nine compiled browser scenarios; one DPAPI-specific case is Windows-only. GitHub's Linux build/audit/test/browser checks are part of publication.

The site remains at https://just-us-c7ee609b.onrender.com. Refresh existing tabs for the new interface. No additional provider setup is required for this release. Google login remains optional configuration, and real devices/networks still need your testing.
