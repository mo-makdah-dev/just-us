# Living room and live game sessions

- Always enter a room in its living room; opening a game is a personal navigation choice.
- Show a television with the current game and player names. Keep it off when no session is open.
- Allow returning to the living room without ending another person's game.
- Track game-view presence per authenticated socket, including spectators. End the session immediately when its last viewer returns to the living room, navigates away, disconnects, or leaves the room. Clear the board, tournament, and recent game details; retain only scores. A process restart also begins with the TV off. Room seats keep their existing reconnect grace independently of game sessions.
- Verify lifecycle rules, build, and browser navigation before publishing to the existing hosting.
