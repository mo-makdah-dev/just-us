# Local frontend with online data

Run `npm run dev` or double-click `Start Just Us.cmd`, then open http://localhost:3210.

The local frontend forwards API and Socket.IO traffic over verified HTTPS to the hosted service. That server remains the sole writer to the live PostgreSQL database. Accounts, rooms and profile changes use real online data. No database credentials are copied into frontend code.

Sign in locally with your online username/password. Google sign-in is enabled and uses the hosted OAuth callback, returning to the hosted domain. Sign-in fields have no registration examples or password-creation hints.

Frontend edits refresh locally. Backend edits need deployment. For separate offline/backend experimentation use `npm run dev:isolated`; automated browser tests use that mode with temporary SQLite data.

The proxy binds to loopback, rejects foreign origins and hosts, retains CSRF checks and verifies upstream TLS. Session cookies remain HttpOnly. Local and hosted browser cookies are separate; sign in once on localhost.

Verified in Chromium: session cookie persistence through refresh, live Socket.IO sessions, origin rejection and hosted PostgreSQL readiness. Dashboard usability tests also cover section URLs, browser history, settings, category editing and shared-seat concurrent tabs.
