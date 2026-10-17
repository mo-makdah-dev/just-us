import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Rooms, policy } from '../../apps/server/src/rooms.js';
import { sqliteStorage, type Storage } from '../../apps/server/src/storage.js';
import type { RoomCommand } from '../../packages/protocol/src/index.js';
const opened: Storage[] = [];
afterEach(async () => { for (const storage of opened.splice(0)) await storage.close(); });
async function setup(accounts = false) {
  const storage = sqliteStorage(':memory:'); opened.push(storage); let now = 1_800_000_000_000;
  const rooms = new Rooms(storage, () => now); await rooms.init();
  let a = await rooms.authenticate(), b = await rooms.authenticate(); const spectator = await rooms.authenticate();
  if (accounts) {
    a = await rooms.signup(a.sessionId, { username: 'player_a', password: 'a long testing password', nickname: 'Alex', avatar: 'moss' });
    b = await rooms.signup(b.sessionId, { username: 'player_b', password: 'a long testing password', nickname: 'Blair', avatar: 'peach' });
  }
  await rooms.connect(a.sessionId, 'a'); await rooms.connect(b.sessionId, 'b'); await rooms.connect(spectator.sessionId, 's');
  await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'Alex', avatar: 'moss' });
  await rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'Blair', avatar: 'peach', invitation: rooms.view(a.sessionId).room!.code });
  const send = (session: string, type: RoomCommand['type'], extra: Partial<RoomCommand> = {}) => { const room = rooms.view(session).room!; return rooms.command(session, { commandId: randomUUID(), roomId: room.id, expectedRevision: room.revision, type, ...extra }); };
  await send(a.sessionId, 'regenerateInvite');
  await rooms.join(spectator.sessionId, { commandId: randomUUID(), nickname: 'Casey', avatar: 'sky', invitation: rooms.view(a.sessionId).room!.code });
  const game = (session: string, action: NonNullable<RoomCommand['game']>) => send(session, 'ticTacToe', { game: action.action === 'move' ? { ply: rooms.view(session).room!.ticTacToe!.match!.board.filter(Boolean).length, ...action } : action });
  const ids = () => rooms.view(a.sessionId).room!.players;
  return { rooms, storage, a, b, spectator, game, send, ids, advance: (ms: number) => { now += ms; }, now: () => now };
}
it('keeps spectators read-only, enforces turns, scores exactly once and restores a finished board', async () => {
  const { rooms, storage, a, b, spectator, game, ids, now } = await setup(true);
  const players = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await expect(game(spectator.sessionId, { action: 'start', players })).rejects.toMatchObject({ code: 'OWNER_ONLY' });
  await game(spectator.sessionId, { action: 'hand', raised: true });
  await game(a.sessionId, { action: 'start', players });
  let match = rooms.view(a.sessionId).room!.ticTacToe!.match!;
  const sessionFor = (id: string) => id === ids().find(p => p.nickname === 'Alex')!.id ? a.sessionId : b.sessionId;
  await expect(game(spectator.sessionId, { action: 'move', matchId: match.id, cell: 0 })).rejects.toMatchObject({ code: 'SPECTATOR' });
  await expect(game(sessionFor(match.o.id), { action: 'move', matchId: match.id, cell: 0 })).rejects.toMatchObject({ code: 'NOT_YOUR_TURN' });
  for (const cell of [0, 3, 1, 4]) { match = rooms.view(a.sessionId).room!.ticTacToe!.match!; await game(sessionFor(match.turn === 'X' ? match.x.id : match.o.id), { action: 'move', matchId: match.id, cell }); }
  const before = rooms.view(a.sessionId).room!;
  const terminal: RoomCommand = { type: 'ticTacToe', commandId: randomUUID(), roomId: before.id, expectedRevision: before.revision, game: { action: 'move', matchId: match.id, cell: 2, ply: 4 } };
  await rooms.command(sessionFor(match.x.id), terminal); await rooms.command(sessionFor(match.x.id), terminal);
  const view = rooms.view(spectator.sessionId).room!.ticTacToe!;
  expect(view.match!.status).toBe('won'); expect(view.scores.map(s => s.played)).toEqual([1, 1]);
  expect(JSON.stringify(view)).not.toContain('account:'); expect(JSON.stringify(view)).not.toContain(a.sessionId);
  const winnerSession = sessionFor(match.x.id); expect(rooms.view(winnerSession).gameScores?.wins).toBe(1);
  const restored = new Rooms(storage, now); await restored.init();
  expect(restored.view(winnerSession).gameScores?.wins).toBe(1);
  expect(restored.view(a.sessionId).room!.ticTacToe?.match?.board).toEqual(view.match!.board);
});
it('pauses during reconnect grace, then forfeits once; leaving resolves immediately', async () => {
  const { rooms, a, b, game, send, ids, advance } = await setup();
  const players = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await game(a.sessionId, { action: 'start', players });
  await rooms.disconnect(b.sessionId, 'b');
  await rooms.sweep(); expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.status).toBe('playing');
  advance(policy.grace + 1); await rooms.sweep(); await rooms.sweep();
  expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.status).toBe('forfeit');
  expect(rooms.view(a.sessionId).room!.ticTacToe!.scores.map(s => s.played)).toEqual([1, 1]);
  await send(a.sessionId, 'regenerateInvite');
  await rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'Blair', avatar: 'peach', invitation: rooms.view(a.sessionId).room!.code }); await rooms.connect(b.sessionId, 'b2');
  await game(a.sessionId, { action: 'start', players: ids().filter(p => p.nickname !== 'Casey').map(p => p.id) });
  await send(b.sessionId, 'leave'); expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.status).toBe('forfeit');
});

it('keeps personal totals after room deletion, exports only the caller’s totals and removes them on account deletion', async () => {
  const { rooms, a, b, spectator, game, send, ids } = await setup(true);
  await game(a.sessionId, { action: 'start', players: ids().filter(p => p.nickname !== 'Casey').map(p => p.id) });
  const match = rooms.view(b.sessionId).room!.ticTacToe!.match!;
  await game(b.sessionId, { action: 'resign', matchId: match.id });
  expect(rooms.exportAccount(a.sessionId).gameScores).toMatchObject({ wins: 1, points: 3 });
  expect(rooms.exportAccount(b.sessionId).gameScores).toMatchObject({ wins: 0, losses: 1, points: 0 });
  expect(rooms.view(spectator.sessionId).gameScores).toBeUndefined();
  await send(a.sessionId, 'close');
  expect(rooms.view(a.sessionId).gameScores?.wins).toBe(1);
  const deleted = await rooms.deleteAccount(b.sessionId);
  expect(rooms.view(deleted.sessionId).gameScores).toBeUndefined();
  expect(rooms.view(a.sessionId).gameScores?.wins).toBe(1);
});

it('separates guest and account scoring identities when someone signs up without leaving their seat', async () => {
  const { rooms, a, b, game, ids } = await setup();
  let participants = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await game(a.sessionId, { action: 'start', players: participants });
  await game(b.sessionId, { action: 'resign', matchId: rooms.view(a.sessionId).room!.ticTacToe!.match!.id });
  const upgraded = await rooms.signup(b.sessionId, { username: 'upgraded_player', password: 'a long testing password', nickname: 'New Blair', avatar: 'peach' });
  await rooms.connect(upgraded.sessionId, 'upgraded-b');
  participants = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await game(a.sessionId, { action: 'start', players: participants });
  await game(upgraded.sessionId, { action: 'resign', matchId: rooms.view(a.sessionId).room!.ticTacToe!.match!.id });
  const rows = rooms.view(upgraded.sessionId).room!.ticTacToe!.scores;
  expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
  expect(rows.filter(row => row.isYou)).toHaveLength(1);
  expect(rooms.view(upgraded.sessionId).gameScores?.played).toBe(1);
});

it('does not reject a valid move because a spectator raised a hand, but rejects an old board position', async () => {
  const { rooms, a, b, spectator, game, ids } = await setup();
  await game(a.sessionId, { action: 'start', players: ids().filter(p => p.nickname !== 'Casey').map(p => p.id) });
  const room = rooms.view(a.sessionId).room!, match = room.ticTacToe!.match!;
  const x = room.players.find(p => p.isYou)!.id === match.x.id ? a : b;
  await game(spectator.sessionId, { action: 'hand', raised: true });
  await rooms.command(x.sessionId, { type: 'ticTacToe', commandId: randomUUID(), roomId: room.id, expectedRevision: room.revision, game: { action: 'move', cell: 0, matchId: match.id, ply: 0 } });
  expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.board[0]).toBe('X');
  const o = x === a ? b : a;
  await expect(game(o.sessionId, { action: 'move', cell: 1, matchId: match.id, ply: 0 })).rejects.toMatchObject({ code: 'STALE_MOVE' });
});
