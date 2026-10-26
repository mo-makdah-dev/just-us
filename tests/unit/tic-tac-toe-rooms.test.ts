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
it('keeps spectators read-only, enforces turns, scores exactly once and restarts with the TV off', async () => {
  const { rooms, storage, a, b, spectator, game, send, ids, now } = await setup(true);
  const players = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await send(a.sessionId,'gameSettings',{allowPlayerGames:false});
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
  await rooms.watchGame(a.sessionId, 'a', before.id, true);
  await rooms.watchGame(a.sessionId, 'a', before.id, false);
  expect(rooms.view(a.sessionId).room!.ticTacToe!.scores.map(s => s.played)).toEqual([1, 1]);
  expect(rooms.view(a.sessionId).room!.ticTacToe!.recent).toEqual([]);
  const restored = new Rooms(storage, now); await restored.init();
  expect(restored.view(winnerSession).gameScores?.wins).toBe(1);
  expect(restored.view(a.sessionId).room!.ticTacToe?.match).toBeNull(); expect(restored.view(a.sessionId).room!.ticTacToe?.open).toBe(false);
});
it('pauses during reconnect grace, then forfeits once; leaving resolves immediately', async () => {
  const { rooms, a, b, game, send, ids, advance } = await setup();
  const players = ids().filter(p => p.nickname !== 'Casey').map(p => p.id);
  await game(a.sessionId, { action: 'start', players });
  await rooms.disconnect(b.sessionId, 'b');
  await rooms.sweep(); expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.status).toBe('playing');
  advance(policy.grace + 1); await rooms.sweep(); await rooms.sweep();
  expect(rooms.view(a.sessionId).room!.ticTacToe!.match!.status).toBe('forfeit');
  expect(rooms.view(a.sessionId).room!.ticTacToe!.scores.map(s => s.played)).toEqual([]);
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

it('ends a game when its last TV viewer exits, even with everyone still in the room', async () => {
  const {rooms,a,b,spectator,game,ids}=await setup();
  const roomId=rooms.view(a.sessionId).room!.id;
  await game(a.sessionId,{action:'start',players:ids().filter(p=>p.nickname!=='Casey').map(p=>p.id)});
  await rooms.watchGame(a.sessionId,'a',roomId,true);
  await rooms.watchGame(b.sessionId,'b',roomId,true);
  await rooms.watchGame(a.sessionId,'a',roomId,false);
  expect(rooms.view(spectator.sessionId).room!.ticTacToe!.open).toBe(true);
  await rooms.watchGame(b.sessionId,'b',roomId,false);
  const room=rooms.view(spectator.sessionId).room!;
  expect(room.players).toHaveLength(3); expect(room.ticTacToe!.open).toBe(false);
  expect(room.ticTacToe!.match).toBeNull(); expect(room.ticTacToe!.competition).toBeNull();
  expect(room.ticTacToe!.recent).toEqual([]); expect(room.ticTacToe!.scores).toEqual([]);
});
it('counts TV viewers per tab and clears the board on the last viewer disconnect', async () => {
  const {rooms,a,game,ids}=await setup(); const roomId=rooms.view(a.sessionId).room!.id;
  await game(a.sessionId,{action:'start',players:ids().slice(0,2).map(p=>p.id)});
  await rooms.connect(a.sessionId,'second');
  await rooms.watchGame(a.sessionId,'a',roomId,true); await rooms.watchGame(a.sessionId,'second',roomId,true);
  await rooms.disconnect(a.sessionId,'a'); expect(rooms.view(a.sessionId).room!.ticTacToe!.open).toBe(true);
  await rooms.disconnect(a.sessionId,'second'); expect(rooms.view(a.sessionId).room!.ticTacToe!.match).toBeNull();
});


it('lets players start games by default and reserves the setting and destructive controls for the owner', async () => {
  const {rooms,a,b,send,game,ids,storage,now}=await setup();
  expect(rooms.view(b.sessionId).room!.allowPlayerGames).toBe(true);
  await game(b.sessionId,{action:'open'});
  await game(b.sessionId,{action:'start',players:ids().slice(0,2).map(p=>p.id)});
  await expect(game(b.sessionId,{action:'cancel'})).rejects.toMatchObject({code:'OWNER_ONLY'});
  await expect(send(b.sessionId,'gameSettings',{allowPlayerGames:false})).rejects.toMatchObject({code:'OWNER_ONLY'});
  await game(a.sessionId,{action:'cancel'});await game(a.sessionId,{action:'lobby'});
  await send(a.sessionId,'gameSettings',{allowPlayerGames:false});
  await expect(game(b.sessionId,{action:'open'})).rejects.toMatchObject({code:'OWNER_ONLY'});
  await expect(game(b.sessionId,{action:'start',players:ids().slice(0,2).map(p=>p.id)})).rejects.toMatchObject({code:'OWNER_ONLY'});
  const restored=new Rooms(storage,now);await restored.init();expect(restored.view(a.sessionId).room!.allowPlayerGames).toBe(false);
});
it('uses self-service shared sessions with concurrent joins, strict commands and saved game-scoped scores', async()=>{
  const {rooms,a,b,spectator,send,storage,now}=await setup(true);
  await send(a.sessionId,'gameSession',{sessionCommand:{action:'open',gameId:'tic-tac-toe'}});
  await send(a.sessionId,'gameSession',{sessionCommand:{action:'mode',mode:'league'}});
  const base=rooms.view(b.sessionId).room!;
  const join=(sessionId:string)=>rooms.command(sessionId,{type:'gameSession',roomId:base.id,expectedRevision:base.revision,commandId:randomUUID(),sessionCommand:{action:'join'}});
  await Promise.all([join(b.sessionId),join(spectator.sessionId)]);
  expect(rooms.view(a.sessionId).room!.gameSession!.participants).toHaveLength(3);
  await send(b.sessionId,'gameSession',{sessionCommand:{action:'ready',ready:false}});
  await expect(send(a.sessionId,'gameSession',{sessionCommand:{action:'start'}})).rejects.toMatchObject({code:'PLAYERS_NOT_READY'});
  await expect(rooms.command(a.sessionId,{type:'gameSession',roomId:base.id,expectedRevision:base.revision,commandId:randomUUID(),sessionCommand:{action:'ready',ready:true,playerId:'someone-else'}})).rejects.toThrow();
  await expect(send(a.sessionId,'ticTacToe',{game:{action:'start',players:base.players.slice(0,2).map(p=>p.id)}})).rejects.toMatchObject({code:'SESSION_ACTION'});
  await expect(rooms.command(a.sessionId,{type:'gameAction',roomId:base.id,expectedRevision:base.revision,commandId:randomUUID(),gameAction:{gameId:'tic-tac-toe',action:{action:'start',players:base.players.slice(0,2).map(p=>p.id)}}})).rejects.toThrow();
  await send(spectator.sessionId,'gameSession',{sessionCommand:{action:'leave'}});
  await send(a.sessionId,'gameSession',{sessionCommand:{action:'mode',mode:'single'}});
  await send(b.sessionId,'gameSession',{sessionCommand:{action:'ready',ready:true}});
  const input={type:'gameSession',roomId:base.id,expectedRevision:rooms.view(a.sessionId).room!.revision,commandId:randomUUID(),sessionCommand:{action:'start'}};
  await rooms.command(a.sessionId,input);const match=rooms.view(a.sessionId).room!.gameSession!;
  await rooms.command(a.sessionId,input);expect(rooms.view(a.sessionId).room!.gameSession!.game.match!.id).toBe(match.game.match!.id);
  await expect(send(spectator.sessionId,'gameAction',{gameAction:{gameId:'tic-tac-toe',action:{action:'move',cell:0,ply:0,matchId:match.game.match!.id}}})).rejects.toMatchObject({code:'NOT_PLAYING'});
  await send(b.sessionId,'gameAction',{gameAction:{gameId:'tic-tac-toe',action:{action:'resign',matchId:match.game.match!.id}}});
  expect(rooms.view(a.sessionId).scoresByGame?.['tic-tac-toe']).toMatchObject({wins:1,played:1});
  const restored=new Rooms(storage,now);await restored.init();expect(restored.view(a.sessionId).room!.gameSession).toBeNull();expect(restored.view(a.sessionId).scoresByGame?.['tic-tac-toe']?.wins).toBe(1);
});

it('migrates old game data and account totals without mixing game identities',async()=>{
  const {rooms,storage,a,game,ids,now}=await setup(true);
  await game(a.sessionId,{action:'start',players:ids().slice(0,2).map(p=>p.id)});
  const raw=await storage.load() as {gameScoresByGame?:Record<string,Record<string,unknown>>;gameScores?:Record<string,unknown>;rooms:Record<string,{gameStates?:Record<string,unknown>;gameSession:unknown;ticTacToe?:unknown}>};
  const accountId=rooms.view(a.sessionId).account!.id;
  raw.gameScores={[accountId]:{played:4,wins:2,draws:1,losses:1,points:7,forfeits:0}};delete raw.gameScoresByGame;
  for(const room of Object.values(raw.rooms)){room.ticTacToe=room.gameStates!['tic-tac-toe'];delete room.gameStates;delete (room as {gameSession?:unknown}).gameSession;}
  await storage.save(raw);const migrated=new Rooms(storage,now);await migrated.init();
  expect(migrated.view(a.sessionId).scoresByGame?.['tic-tac-toe']).toMatchObject({played:4,wins:2,points:7});
  expect(migrated.view(a.sessionId).room!.gameSession).toBeNull();
  const saved=await storage.load() as typeof raw;
  expect(saved.gameScores).toBeUndefined();expect(saved.gameScoresByGame?.[accountId]?.['tic-tac-toe']).toMatchObject({played:4});
  expect(Object.values(saved.rooms)[0].ticTacToe).toBeUndefined();expect(Object.values(saved.rooms)[0].gameStates?.['tic-tac-toe']).toMatchObject({open:false,match:null});
});
