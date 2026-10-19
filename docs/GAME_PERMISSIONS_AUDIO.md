# Game permissions, library cards, scores and audio

- Add a persisted room setting, enabled by default: everyone in the room may open and set up games. Only the owner may change this setting or end games for everyone. Existing sessions remain watchable when the setting is disabled; server checks enforce permissions.
- Make the whole available game card an accessible button and remove its play overlay. Keep unavailable games clearly disabled.
- Record and project scoreboard rows only for account identities. Remove old guest rows during state loading; keep guest participation in games and tournament fixtures.
- Play a short, gentle Web Audio cue when a newly received turn changes the live board. Unlock audio after user interaction, avoid sounds on initial load/reconnect snapshots, and provide a persistent sound toggle.
- Test permissions and persistence, mixed guest/account scoring, card keyboard/click interactions, multiplayer audio and mute, plus build and existing responsive checks. Deploy the verified changes.
