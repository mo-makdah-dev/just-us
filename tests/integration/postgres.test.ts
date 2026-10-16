import { afterAll, beforeAll, expect, it } from 'vitest';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createServer } from 'node:net';
import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import { postgresStorageFromPool, OwnershipLost, sqliteStorage } from '../../apps/server/src/storage.js';
import { createApplication } from '../../apps/server/src/app.js';
import { hash, Rooms } from '../../apps/server/src/rooms.js';
import type { SessionView } from '../../packages/protocol/src/index.js';

let database: EmbeddedPostgres;
let directory: string;
let config: pg.PoolConfig;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'just-us-postgres-'));
  const socket = createServer(); await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = (socket.address() as { port: number }).port; await new Promise<void>(resolve => socket.close(() => resolve()));
  const password = randomUUID();
  database = new EmbeddedPostgres({ databaseDir: join(directory, 'data'), user: 'postgres', password, port, persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], postgresFlags: ['-h', '127.0.0.1'], onLog: () => {}, onError: () => {} });
  await database.initialise(); await database.start();
  config = { user: 'postgres', password, database: 'postgres', host: '127.0.0.1', port, ssl: false };
  const admin = new pg.Pool(config);
  try { await admin.query('CREATE ROLE anon; CREATE ROLE authenticated'); } finally { await admin.end(); }
}, 60000);
afterAll(async () => {
  await database?.stop();
  if (directory) {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected PostgreSQL test directory; refusing cleanup.');
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);

const open = (takeover = true, validate?: (value: unknown) => Promise<void>) => postgresStorageFromPool(new pg.Pool(config), { takeover, validate });
it('fences stale writers, preserves snapshots, and refuses maintenance while a server is live', async () => {
  const first = await open(); let second;
  try {
    await first.save({ version: 3, marker: 'before' });
    await expect(open(false)).rejects.toThrow('live Just Us process');
    await expect(open(true, async () => { throw new Error('Unsupported future schema'); })).rejects.toThrow('future schema');
    await expect(first.load()).resolves.toMatchObject({ marker: 'before' });
    second = await open();
    await second.save({ version: 3, marker: 'after' });
    await expect(first.save({ version: 3, marker: 'stale' })).rejects.toBeInstanceOf(OwnershipLost);
    await expect(first.load()).rejects.toBeInstanceOf(OwnershipLost);
    await first.close(); // A retired process must not release the successor's ownership.
    await expect(second.load()).resolves.toMatchObject({ marker: 'after' });
  } finally { await first.close(); await second?.close(); }
  const maintenance = await open(false);
  try { await expect(open()).rejects.toThrow('live Just Us process'); } finally { await maintenance.close(); }
});

it('denies browser roles access to state, backups and ownership', async () => {
  const storage = await open(); const admin = new pg.Pool(config);
  try {
    for (const role of ['anon', 'authenticated']) for (const table of ['just_us_state', 'just_us_backups', 'just_us_owner']) {
      const client = await admin.connect();
      try { await client.query(`SET ROLE ${role}`); await expect(client.query(`SELECT * FROM ${table}`)).rejects.toMatchObject({ code: '42501' }); }
      finally { await client.query('RESET ROLE'); client.release(); }
    }
  } finally { await storage.close(); await admin.end(); }
});

it('moves a two-person room between overlapping HTTP/socket servers and preserves account sessions', async () => {
  const clean = await open();
  const empty = sqliteStorage(':memory:'); await new Rooms(empty).init(); await clean.save(await empty.load()); await empty.close(); await clean.close();
  const validate = async (value: unknown) => { const temporary = sqliteStorage(':memory:'); try { if (value) await temporary.save(value); await new Rooms(temporary).init(); } finally { await temporary.close(); } };
  const first = await createApplication(await open(true, validate), { origin: 'http://localhost:3210' });
  let second: typeof first | undefined;
  const sockets: Socket[] = [];
  try {
    const listen = async (app: typeof first) => { await new Promise<void>(resolve => app.http.listen(0, '127.0.0.1', resolve)); return `http://127.0.0.1:${(app.http.address() as { port: number }).port}`; };
    const base = await listen(first);
    const participants = await Promise.all([0, 1].map(async () => { const response = await fetch(`${base}/api/session`); return { cookie: response.headers.get('set-cookie')!.split(';')[0], session: (await response.json()).data as SessionView }; }));
    const post = async (base: string, person: typeof participants[number], path: string, body: object) => {
      const response = await fetch(`${base}${path}`, { method: 'POST', headers: { Cookie: person.cookie, Origin: 'http://localhost:3210', 'X-CSRF-Token': person.session.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { response, data: await response.json() };
    };
    const signed = await post(base, participants[0], '/api/auth/signup', { username: 'pg_handover', password: 'postgres integration password', nickname: 'Alex', avatar: 'moss' });
    expect(signed.response.status).toBe(200);
    participants[0] = { cookie: signed.response.headers.get('set-cookie')!.split(';')[0], session: signed.data.data };
    const created = await post(base, participants[0], '/api/rooms', { commandId: randomUUID(), nickname: 'Alex', avatar: 'moss' });
    expect(created.response.status).toBe(200);
    await post(base, participants[1], '/api/join', { commandId: randomUUID(), nickname: 'Sam', avatar: 'peach', invitation: created.data.data.room.code });
    const connect = async (url: string, person: typeof participants[number]) => {
      const socket = io(url, { transports: ['websocket'], extraHeaders: { Cookie: person.cookie, Origin: 'http://localhost:3210' }, auth: { csrf: person.session.csrf }, reconnection: false }); sockets.push(socket);
      const view = await new Promise<SessionView>((resolve, reject) => { socket.once('session', resolve); socket.once('connect_error', reject); socket.once('sessionError', reject); });
      return { socket, view };
    };
    const a = await connect(base, participants[0]); await connect(base, participants[1]);
    const disconnected = new Promise(resolve => a.socket.once('disconnect', resolve));
    second = await createApplication(await open(true, validate), { origin: 'http://localhost:3210' });
    const next = await listen(second);
    await disconnected;
    expect((await fetch(`${base}/ready`)).status).toBe(503);
    expect((await fetch(`${base}/api/session`, { headers: { Cookie: participants[0].cookie } })).status).toBe(503);
    const resumed = await connect(next, participants[0]); await connect(next, participants[1]);
    expect(resumed.view.account?.username).toBe('pg_handover');
    expect(resumed.view.room?.id).toBe(created.data.data.room.id);
    expect(resumed.view.room?.players).toHaveLength(2);
    const current = second.rooms.view(hash(participants[0].cookie.slice('just_us='.length))).room!;
    const result = await resumed.socket.timeout(3000).emitWithAck('command', { type: 'theme', roomId: current.id, expectedRevision: current.revision, commandId: randomUUID(), theme: 'sunset' });
    expect(result.ok).toBe(true);
  } finally { for (const socket of sockets) socket.disconnect(); await first.close(); await second?.close(); }
}, 20000);
