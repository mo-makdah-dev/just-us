# Room URLs and compact invitations

1. Expose existing opaque room IDs as /room/<id>. Keep this address stable when names/codes change. Direct links enter only for saved members or an already admitted session; all others see sign-in/code options.
2. Update creation, directory entry and accepted-invitation navigation to canonical room URLs. Show/copy the permanent address separately from admission links.
3. Generate visitor and membership codes on new saved rooms. Preserve one-use and expiry semantics; refresh invalidates only the replaced code and retains admitted occupants/members.
4. Replace large code-generation and copy buttons with labelled icon controls inside code fields. Refill consumed/expired codes lazily when the owner opens invitations, without undoing explicit revocation elsewhere.
5. Move accepted-friend selection into an accessible dialog with close, Escape and backdrop dismissal. Keep management/settings and conversation behavior intact.
6. Test direct-link access restrictions, stable IDs, code rotation, friend-modal behavior, and desktop/tablet/phone overflow. Deploy required backend updates and verify online readiness.
