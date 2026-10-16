# Accounts: what works now, and what needs external setup

Updated October 16, 2026. Current provider activation: [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md).

## No external setup: free username accounts

At http://localhost:3210 choose **Join free**, pick a username, a password of at least 12 characters, a nickname, and a pixel avatar. Your profile is saved locally on the server; sign in again with the same username/password. No email, credit card, Supabase account, or subscription is required.

Local data now lives at `%LOCALAPPDATA%/JustUs/rooms.sqlite` on Windows (or `~/.local/share/JustUs/rooms.sqlite` elsewhere). The first run copies existing temporary guest data there and retains the original. This file is private application data; keep it out of Git and shared cloud folders. A local account does not automatically become available on a separately deployed database. Use that deployed website's registration after remote setup; migrating real accounts to a new database should be a deliberate, backed-up operation.

Username accounts support password changes and single-use private recovery keys. Save the key shown at signup in your password manager; generating a fresh key in account security invalidates the old one. “Forgot password?” resets the password with that key and signs out old sessions. There is no email reset or username-to-Google account linking. Account deletion requires a recent sign-in and removes this app's live profile/connections and other sessions; it does not delete your Google identity, Supabase user, or older retained backups. Deleting/signing out keeps your current room seat as a new guest session. See `RELEASE_READINESS.md` for retention and launch gates.

## Optional: enable Google sign-in

Google integration is implemented using the official Supabase SDK, server-side PKCE and server-verified user identity. It stays disabled until configured. There is no simulated provider login or bypass flag in the app.

1. Create a free Supabase project or use your dedicated Just Us experiment project. Google OAuth setup can use Supabase Auth while local account/room storage remains SQLite; a hosted deployment still needs PostgreSQL separately.
2. In Google Cloud, create a project, configure the OAuth consent screen for your intended audience, and add yourself/testers if the app is in testing mode.
3. Create an OAuth client of type **Web application**. Copy the Supabase Google provider callback shown in its dashboard into Google's **Authorized redirect URIs** (normally `https://YOUR-PROJECT.supabase.co/auth/v1/callback`). Use your actual project URL, not the placeholder. Add local/deployed website origins if required for your chosen Google client settings.
4. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Google client ID and client secret. Never put the Google secret in the website bundle or repository.
5. In Supabase URL configuration, set the site URL and add the exact application callback to the redirect allowlist: `http://localhost:3210/auth/callback` locally, and later `https://YOUR-SITE/auth/callback` for deployment. Use exact URLs rather than broad wildcards.
6. Copy the Supabase project URL and publishable API key into your ignored local `.env`:

```dotenv
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR-PROJECT-PUBLISHABLE-KEY
```

7. Restart the server. The Google button becomes available. The assistant can handle the restart and configuration once your provider dashboard is ready; do not paste secrets into chat.
8. Test a successful consent, cancelled consent, and a login while already in a guest room. The existing seat should remain. If the application restarts during consent, that attempt expires safely: start sign-in again.

The application callback and Google's callback are **different**: Google returns to Supabase; Supabase returns to Just Us. Provider configuration and instructions are based on [Supabase's Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google) and [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow). Check current provider dashboard labels and policies when setting up.

## Verification status

Rooms v2 keeps memberships separate from visits. Signing out makes the current seat a visitor and removes chat access. Deleting an account deletes its owned saved rooms, removes memberships/invitations and anonymizes authored messages in other surviving rooms. See [ROOMS_V2_RELEASE.md](ROOMS_V2_RELEASE.md) for the current rules; older seat-preservation notes above apply only where a surviving room remains.

Username signup/signin, profile persistence, guest-seat continuity, logout, deletion, session rotation, access isolation, and callback rejection are tested locally. The Google SDK flow is tested with mocked provider responses. **Live Google consent is not verified** until the external Google client is configured. Hosted PostgreSQL, migration/persistence and deployment have been verified; see HOSTED_RELEASE.md and NON_GAME_AUDIT.md.

No payment integration, subscription, Facebook, or game has been added. Guest and account game catalogues are future options; the page labels the additional games as coming soon.
