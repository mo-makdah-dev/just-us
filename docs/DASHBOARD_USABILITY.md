# Dashboard usability review

1. Remove header tagline, footer and manual room refresh.
2. Canonical dashboard URL /dashboard; account sections use /account?section=... with pushState, browser Back/Forward listeners, and a working dashboard return link. Room remains /.
3. Allow concurrent sockets in one session to share one seat; only the final socket disconnect changes presence. Cover parallel connects and partial disconnects in regression tests. Deploy this backend fix to the existing service after verification.
4. Close create/join and sign-in dialogs from their backdrop when idle.
5. Simplify account security to sign-in method and a collapsed password-change form with show/hide passwords. Remove export, other-session management and recovery-key UI; retain existing backend data and APIs.
6. Hide games without playing history. Put category rename controls inline beside each people category, replacing the separate category form.
7. Run build, unit/integration and focused browser checks, then verify the hosted backend and local online-data preview.

Colours are deferred. Password-form reference: https://design-system.service.gov.uk/components/password-input/
