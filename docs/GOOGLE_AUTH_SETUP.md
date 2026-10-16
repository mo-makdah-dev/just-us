# Google authentication activation

Use the existing Supabase Auth server-side PKCE flow. Keep username/password accounts and Google identities separate; never merge accounts by nickname or email. Preserve guest seats, room invitations and people invitations across the external sign-in redirect.

1. Verify existing Supabase project/provider configuration and exact callback destinations.
2. Configure only the live and local application callbacks in Supabase. Leave unrelated Auth/database settings unchanged.
3. User signs into Google Cloud. Create a Web application OAuth client for Just Us using only openid, email and profile; configure the Supabase provider callback. No paid plan/domain or Gmail/Drive access is required.
4. Put Google client credentials directly in Supabase provider configuration or a private downloaded file outside the repository/chat. Enable only after callback/client configuration is valid.
5. Configure the existing Node service and local environment with the Supabase URL and publishable key. No Google client secret belongs in frontend code or app logs.
6. Verify authorization redirect, cancellation, replay/expiry rejection and room/invitation continuity. A real successful Google sign-in requires the user to complete Google account selection/consent. Deploy only the tested flow.

## Exact destinations

- Google redirects to Supabase: `https://wiwvucypkmwxqqcgmvnd.supabase.co/auth/v1/callback`
- Supabase redirects to the website: `https://just-us-c7ee609b.onrender.com/auth/callback`
- Supabase redirects to local preview: `http://localhost:3210/auth/callback`
- Website origin: `https://just-us-c7ee609b.onrender.com`
- Local origin: `http://localhost:3210`

See [Supabase's official Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google). Google Cloud credentials and actual consent are external prerequisites; having the code installed does not mean Google login is active.

## If Google Cloud must be configured in your normal browser

1. Select or create a dedicated **Just Us** project. Do not enable billing for this setup.
2. Open **Google Auth Platform** and use **Get started** if offered. Set the app name to **Just Us**, select your own support/contact email, and choose **External** for personal Google accounts. Complete Google's required confirmations yourself.
3. For the experiment, keep the audience in Testing and add the Google accounts you intend to test with where the console asks for test users.
4. Under **Clients**, create an OAuth client of type **Web application**, named **Just Us website**.
5. Authorized JavaScript origins: `https://just-us-c7ee609b.onrender.com` and `http://localhost:3210`.
6. Authorized redirect URI: `https://wiwvucypkmwxqqcgmvnd.supabase.co/auth/v1/callback`.
7. Download the client's JSON to a private local folder outside this repository/OneDrive. Do not paste the secret into chat. Give the assistant its file path so the remaining setup can use the authenticated CLIs.

The activation helper validates a Web client and its exact callback, backs up its configuration encrypted with Windows DPAPI, sets only the intended Supabase Auth options, checks provider availability, updates two specific Render environment variables, and writes the local app's Supabase URL/publishable key. Google client secrets stay with Supabase and the private local credential file/backup.

```powershell
npx tsx scripts/google-auth.ts status
npx tsx scripts/google-auth.ts enable "C:/private/path/downloaded-google-client.json"
npm run cloud -- deploy
```

Restart local preview after activation. The helper does not deploy by itself. It also does not create a Google Cloud project/client or complete consent on your behalf.

Google sign-in currently creates/uses a Google-specific Just Us profile. It does not automatically merge with an existing username/password profile. Existing profiles remain intact. Account linking would require a separate, explicitly authenticated linking flow.

## Current verification

Supabase's exact live/local redirects and site URL were applied successfully. The provider remains disabled until a valid Google Web client is configured. Provider PKCE/identity/replay/expiry tests and temporary OAuth-return-state tests pass; a compiled browser scenario confirms cancelled Google login restores the original room code. Actual Google consent is still pending external Google Cloud access and client creation.
