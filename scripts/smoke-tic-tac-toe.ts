import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { ROOM_PROTOCOL_VERSION, type RoomCommand, type SessionView, type WireResult } from '../packages/protocol/src/index.js';

const origin = process.argv[2] || 'http://localhost:3210';
if (!['http://localhost:3210', 'https://just-us-c7ee609b.onrender.com'].includes(origin)) throw new Error('Use the known local or live Just Us origin.');
type Client = { cookie: string; view: SessionView; socket?: Socket };
async function request<T>(client: Client, path: string, body?: unknown): Promise<T> {
  const response = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { Cookie: client.cookie, Origin: origin, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': client.view?.csrf } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  client.cookie = response.headers.get('set-cookie')?.split(';')[0] || client.cookie;
  const wire = await response.json() as WireResult<T>;
  if (!wire.ok) throw new Error(`Smoke request failed: ${wire.error.code}`);
  return wire.data;
}
async function connect(): Promise<Client> {
  const client = { cookie: '', view: undefined as unknown as SessionView } as Client;
  client.view = await request(client, '/api/session');
  const socket = io(origin, { transports: ['websocket'], extraHeaders: { Cookie: client.cookie, Origin: origin }, auth: { csrf: client.view.csrf, protocolVersion: ROOM_PROTOCOL_VERSION }, reconnection: false }); client.socket = socket;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { socket.disconnect(); reject(new Error('Smoke socket timed out.')); }, 20000);
    socket.once('session', (view: SessionView) => { client.view = view; clearTimeout(timer); resolve(); });
    socket.once('connect_error', () => { clearTimeout(timer); socket.disconnect(); reject(new Error('Smoke socket could not connect.')); });
  });
  socket.on('session', (view: SessionView) => { client.view = view; }); return client;
}
async function command(client: Client, type: RoomCommand['type'], game?: RoomCommand['game']) {
  const fresh = await request<SessionView>(client, '/api/session'); client.view = fresh;
  if (!fresh.room) throw new Error('Smoke room is unavailable.');
  return request(client, '/api/command', { commandId: randomUUID(), roomId: fresh.room.id, expectedRevision: fresh.room.revision, type, ...(game ? { game } : {}) });
}
let a: Client | undefined, b: Client | undefined, created = false;
try {
  a = await connect(); b = await connect();
  await request(a, '/api/rooms', { commandId: randomUUID(), nickname: 'QA host', avatar: 'moss' }); created = true;
  const owner = await request<SessionView>(a, '/api/session');
  await request(b, '/api/join', { commandId: randomUUID(), nickname: 'QA partner', avatar: 'peach', invitation: owner.room!.code, asVisitor: true });
  const joined = await request<SessionView>(a, '/api/session');
  await command(a, 'ticTacToe', { action: 'start', players: joined.room!.players.map(p => p.id), mode: 'single' });
  for (const cell of [0, 3, 1, 4, 2]) {
    const view = await request<SessionView>(a, '/api/session'), match = view.room!.ticTacToe!.match!;
    const player = match.turn === 'X' ? match.x.id : match.o.id;
    const self = view.room!.players.find(p => p.isYou)!.id;
    await command(player === self ? a : b, 'ticTacToe', { action: 'move', matchId: match.id, cell, ply: match.board.filter(Boolean).length });
  }
  const result = (await request<SessionView>(a, '/api/session')).room!.ticTacToe!;
  if (result.match?.status !== 'won' || result.scores.length !== 2 || result.scores.some(s => s.played !== 1) || result.scores.reduce((sum, s) => sum + s.points, 0) !== 3) throw new Error('Smoke match result or scoreboard is incorrect.');
  console.log('Two independent live connections completed a validated tic-tac-toe match with one win and exactly three total points.');
} finally {
  try { if (a && created) { await command(a, 'close'); console.log('Temporary test room removed.'); } }
  finally { a?.socket?.disconnect(); b?.socket?.disconnect(); }
}
