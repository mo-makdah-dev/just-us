import { afterEach, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import { createApplication } from '../../apps/server/src/app.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';
import type { SessionView } from '../../packages/protocol/src/index.js';

const instances: Awaited<ReturnType<typeof createApplication>>[] = [];
const sockets: Socket[] = [];
afterEach(async () => { for (const socket of sockets.splice(0)) socket.disconnect(); for (const app of instances.splice(0)) await app.close(); });
const origin = 'http://localhost:3210';
async function setup() {
  const app = await createApplication(sqliteStorage(':memory:'), { origin }); instances.push(app);
  await new Promise<void>(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const port = (app.http.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  async function participant() {
    const response = await fetch(`${base}/api/session`);
    const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const session: SessionView = (await response.json()).data;
    const post = async (path: string, body: unknown, csrf = session.csrf, requestOrigin = origin) => {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { Cookie: cookie, Origin: requestOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    async function connect() {
      const socket = io(base, { transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: origin }, auth: { csrf: session.csrf }, reconnection: false }); sockets.push(socket);
      const first = await new Promise<SessionView>((resolve, reject) => { socket.once('session', resolve); socket.once('connect_error', reject); socket.once('sessionError', message => reject(new Error(message))); });
      return { socket, first };
    }
    return { cookie, session, post, connect };
  }
  return { base, participant };
}
it('authenticates independent HTTP/socket sessions and broadcasts membership only to members', async () => {
  const { participant } = await setup();
  const a = await participant(), b = await participant(), stranger = await participant();
  const created = await a.post('/api/rooms', { commandId: randomUUID(), nickname: 'A', avatar: 'moss' });
  const { socket: aSocket } = await a.connect();
  const { socket: strangerSocket, first } = await stranger.connect(); expect(first.room).toBeNull();
  let strangerRoom: unknown = null; strangerSocket.on('session', data => { strangerRoom = data.room; });
  const update = new Promise<SessionView>(resolve => aSocket.on('session', function listener(data: SessionView) { if (data.room?.players.length === 2) { aSocket.off('session', listener); resolve(data); } }));
  const joined = await b.post('/api/join', { commandId: randomUUID(), nickname: 'B', avatar: 'peach', invitation: created.body.data.room.code });
  expect(joined.status).toBe(200); expect((await update).room!.players).toHaveLength(2);
  expect(strangerRoom).toBeNull();
  const full = await stranger.post('/api/join', { commandId: randomUUID(), nickname: 'C', avatar: 'sky', invitation: created.body.data.room.code });
  expect(full.status).toBe(404); // The invitation was consumed by the successful admission.
  const view = (await b.connect()).first.room!;
  const forged = await strangerSocket.timeout(2000).emitWithAck('command', { type: 'close', roomId: view.id, expectedRevision: view.revision, commandId: randomUUID() });
  expect(forged.error.code).toBe('NOT_MEMBER');
});
it('rejects wrong origins, missing CSRF, malformed actions and unauthorized socket handshakes', async () => {
  const { base, participant } = await setup(); const a = await participant();
  const body = { commandId: randomUUID(), nickname: 'A', avatar: 'moss' };
  expect((await a.post('/api/rooms', body, '', origin)).status).toBe(403);
  expect((await a.post('/api/rooms', body, a.session.csrf, 'https://attacker.invalid')).status).toBe(403);
  expect((await a.post('/api/rooms', { ...body, extra: 'forged' })).status).toBe(400);
  const socket = io(base, { transports: ['websocket'], extraHeaders: { Origin: origin }, auth: { csrf: a.session.csrf }, reconnection: false }); sockets.push(socket);
  const message = await new Promise<string>(resolve => socket.once('connect_error', e => resolve(e.message)));
  expect(message).toMatch(/Refresh/);
});
