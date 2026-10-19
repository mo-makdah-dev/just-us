# URL authentication and authorization guards

## Route policy

- Public: `/` (landing for guests; signed-in users return to their dashboard or current room).
- Guest-only: `/sign-in` and `/sign-up`. Signed-in users are redirected to a safe return destination or dashboard. `/login`, `/signin`, `/signup`, `/register` canonicalize to these routes.
- Authenticated: `/dashboard` and `/account` (profile, people, scores, security sections). Guests are redirected to `/sign-in?next=<internal destination>`; no protected content is mounted while authentication is pending or denied.
- Authorized: `/room/<id>`. An already admitted guest session may access its own room. A signed-in saved member can enter through the server-authorized membership action. All others see an access gate; an ID never grants admission. Existing owner-only server commands remain authoritative.
- Unknown paths and invalid account sections: explicit not-found state, not an accidental landing/dashboard fallback.

## Implementation

1. Add a centralized pure route resolver/guard with tests for each policy, loading, failure, malformed URLs and safe return URLs.
2. Route sign-in/sign-up through canonical URLs while retaining dialogs, guest create/join flows and invitation tokens.
3. Replace unauthorized history entries on redirects; preserve the requested safe destination across username and OAuth sign-in. Reject external/protocol-relative/backslash/control-character return destinations and authentication loops.
4. Re-evaluate guards on direct load, refresh, browser navigation, login/logout and session changes. Keep room authorization scoped to the requested ID so another room never flashes.
5. Verify guests cannot mount dashboard/profile/people/scores/settings, signed-in users cannot remain on guest-only URLs, valid room visitors retain access, and outsiders cannot enter by ID or perform owner actions.

No credentials or UI flags grant permissions. Server account/membership/owner checks remain the security boundary; browser guards provide routing and prevent protected UI exposure.
