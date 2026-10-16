# Rooms, memberships and chat — implementation plan

October 16, 2026. This replaces the initial two-person, temporary-room product rules. Four occupants is a design choice for a small group and comfortable phone layouts, not a claimed psychological research finding. Games remain out of scope.

## Product rules

### Guests and visitors

- Guest-created rooms expire exactly one hour after creation; activity cannot extend the deadline. They are also removed after five consecutive minutes without anyone connected. Server sweeps perform physical cleanup; reads/actions reject expiry immediately.
- Four occupants maximum, including the creator. A disconnected seat has five minutes to reconnect, subject to the room's earlier absolute/empty deadline.
- Guests choose a temporary nickname and receive a fixed visitor avatar/tag. They cannot save profiles, customize artwork, create memberships, maintain people lists or read/send chat. Guest names/preferences are not saved in browser local storage.
- Ephemeral nickname/session state must exist server-side to support reconnects; it is removed with the expired visit/room. “Not stored” means no durable account/profile/room-membership record for guests, not an absence of temporary server persistence.

### Signed-in accounts

- Treat every account as fully entitled for now. No subscriptions or product room-count paywall. Global capacity and request limits remain abuse protection.
- Rooms created while signed in are saved until their owner deletes them. Empty saved rooms retain their name, owner, permanent membership and recent chat. Empty-room cleanup removes visits, not saved rooms.
- An account may own/join multiple saved rooms and switch between them. One active visit per browser session, with server-validated room entry. Saved membership survives leaving, refresh, sign-out and later sign-in.
- Four permanent members maximum and four active/reserved visits maximum. Offline permanent members need not occupy a live seat; if four visitors currently occupy the room, a returning member waits for a free seat.
- The saved-room owner can always return to manage the room: if four temporary visitors fill it, the newest temporary visitor yields a seat. Permanent members are never evicted for this; with four memberships including the owner, at most three other permanent members can be present.
- Account owners can rename/delete their room, remove members/visitors and invite accepted friends. Ownership does not transfer merely because a saved-room owner leaves. Guest-room ownership can transfer to another remaining occupant.
- A guest-room creator who signs in can explicitly choose **Save this room to my account**. This removes guest expiry and saves only the owner's membership; other visitors are not silently enrolled.
- A signed-in visitor can chat even in a guest-created room. A signed-in visitor is still not a permanent member unless they accept a membership invitation.

### Invitations and consent

- Both code types are single-use, consumed transactionally only on a successful admission. Membership is permanent; the code is not reusable. Code guessing is rate-limited and identifiers remain unpredictable.
- Visitor codes grant one temporary visit with cookie-based reconnect, not future saved membership. Owners can generate a fresh visitor code for each admission; issuing a new one invalidates the preceding unconsumed visitor code.
- Membership codes exist only for saved rooms. A signed-in recipient saves membership and can return without the code. A guest sees sign-in guidance and can explicitly choose a visitor visit instead; this consumes the code but saves no membership. Signing in during that visit does not silently convert consent into permanent membership.
- Code invitations expire after 24 hours, or sooner when the guest room expires. Membership codes are owner-only; visitors never receive invite secrets in projections.
- Friend invitations appear in the intended account's room inbox, expire after seven days, and require explicit acceptance. No automatic admission because two people are friends.
- Removing a member revokes their stored membership and active visits. A removed signed-in account cannot reuse old codes to return; an explicit new friend invitation can readmit them. Anonymous identities cannot be reliably banned across fresh browsers.
- Friends and the single special-person relationship remain mutually accepted. A special connection is also a friend with a special category. Each side's pet name stays private to that side; neither edits the other's label.

### Chat

- Plain text, up to 1,000 characters, no HTML, uploads or rich embeds. Only signed-in current occupants can read or send messages; server checks apply to HTTP and sockets.
- Saved members see up to 200 recent messages, retained for 30 days. Signed-in visitors see only messages from their current visit onward. Guests receive an empty chat projection and a polished sign-in gate.
- Message IDs deduplicate retries; sending is separately rate-limited. Room deletion removes its chat; account deletion anonymizes remaining authored messages and removes owned rooms/memberships/invitations. Retained offline backups follow the existing operations policy.

## Architecture and migration

Keep the existing React/Express/Socket.IO stack and fenced single-active-server storage. Extend the authoritative room schema with saved ownership, permanent member IDs, member/visitor codes and deadlines, removed-account IDs, visit timestamps, an empty-since timestamp and bounded messages. Add targeted room-invitation records to canonical state. Public protocol views explicitly distinguish members/visitors and omit chat/invite secrets unless authorized.

Migrate version 3 to version 4 transactionally, retaining credential hashes, recovery keys, relationships, profiles and active sessions. Existing rooms whose owner has an account become saved owner rooms; other occupants remain visitors until they explicitly accept membership. Other existing rooms receive the new guest expiry policy. The storage layer retains a pre-upgrade snapshot before the first version-4 save. Verify rollback/backup compatibility before hosted deployment.

## Delivery order

1. **Authoritative foundation:** schema/migration, four-seat admission, guest expiry, durable memberships and safe switching; focused clock/concurrency/privacy tests.
2. **Saved-room experience:** account room directory, names, owner controls, single-use visitor/member codes, consent-preserving guest fallback, targeted friend invitation inbox and removal.
3. **Chat and presence UI:** accessible phone-first chat, guest gate, member/visitor badges, responsive four-seat room, updated guest/account copy and no guest browser preference persistence.
4. **Verification and release:** independent guest/account browser contexts, multi-room return, invitation races, unauthorized actions, chat privacy, expiry, refresh/reconnect and deletion. Build, local PostgreSQL checks, then controlled hosted migration/deploy and synthetic-data cleanup. Preserve real account data and report any remaining external limitations.

## Additional product details included

Show clear expiry/countdown text on guest rooms, distinguish “leave this visit,” “leave membership” and “delete room,” make visitor status visible, offer confirmation before destructive owner actions, cap chat storage, and never advertise saved-room retention to a guest. Keep account features available without introducing payment logic. Future games declare their supported player counts independently of the four-person room capacity.
