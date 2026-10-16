# Just Us — non-game release checklist

Requested October 16, 2026. Work in order; no games in this release.

## 1. Production foundations

- [x] Audit session expiry, account/room ownership, CSRF, payload limits, and error paths.
- [x] Add password change and recovery with a private single-use recovery key (no email service required).
- [x] Back up state before schema upgrades; version and validate all new data.
- [x] Package a compiled production server, CI checks, deployment configuration, and backup/restore tools.
- [x] Verify security and restart behavior; document capacity and external launch gates honestly.

## 2. Profile and pixel-art studio

- [x] Build a responsive 24×24 original pixel editor with a fixed safe palette.
- [x] Pencil, eraser, fill, undo/redo, presets, keyboard controls, and live preview.
- [x] Save designs to account profiles; show saved designs in room/member UI.
- [x] Keep guests on presets; validate all custom art on the server.

## 3. Friends and one special person

- [x] Private, expiring, revocable invite links; explicit acceptance, no public user search.
- [x] One mutually accepted special-person connection per account, plus friends.
- [x] Rename your own two category headings; pet names stay private to the person assigning them.
- [x] Remove connections, revoke invitations, block/unblock accounts.
- [x] Handle duplicate acceptance, invitation races, existing special connections, self-invites, and account deletion.

## 4. Complete room design

- [x] Create/join stays straightforward on all viewports.
- [x] Actual illustrated room interior with two seats, live avatars, and connection indicators.
- [x] Shared room themes controlled by the owner; preserve invite, leave, close, and reconnect flows.
- [x] Fit phone, tablet, and desktop; respect zoom, keyboard navigation, and reduced motion.

## 5. Complete app experience

- [x] Preserve the landing design and honest guest/account messaging.
- [x] Profile navigation, pixel studio, people management, and security settings feel coherent.
- [x] Account-only actions enforced by the server; private pet names/relationships never leak through room projections.
- [x] Loading, empty, success, unavailable-provider, conflict, and offline states.

## 6. Verification and delivery

- [x] Unit and transport tests for every new rule and private projection.
- [x] Independent browser sessions for acceptance, special-person limit, custom avatars, and room updates.
- [x] Phone 320/390px, tablet, desktop screenshots; accessibility checks.
- [x] Production build, dependency audit, documented backup restore and rollout.
- [x] Record exactly what still needs external credentials: hosted PostgreSQL, live Google, HTTPS deployment, actual-device checks, production backups and policy/contact details.

“Production ready” requires live deployment and operational checks, not only a good-looking local build. Finish all locally verifiable work and list external gates; do not invent provider setup, legal details, or successful remote tests.

## External launch gates (still open)

- [ ] Connect and verify live PostgreSQL, HTTPS hosting and Google OAuth.
- [ ] Configure off-host backups, alerts, operator/contact and public policies.
- [ ] Test actual phones/tablets and two-location internet behavior.

See [RELEASE_READINESS.md](RELEASE_READINESS.md) for evidence, limits, and exact setup. Local completion is not a claim that the service has been deployed or all production gates have passed.
