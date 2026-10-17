import { ROOM_PROTOCOL_VERSION } from '../../packages/protocol/src/index.js';
import { expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createApplication } from '../../apps/server/src/app.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';
it('asks old production tabs to refresh and accepts the current game protocol', async () => {
  const origin = 'https://just-us.example';
  const app = await createApplication(sqliteStorage(':memory:'), { origin, production: true });
  const sockets: Socket[] = [];
  try {
    await new Promise<void>(resolve => app.http.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
    const response = await fetch(`${url}/api/session`); const cookie = response.headers.get('set-cookie')!.split(';')[0];
    const session = (await response.json()).data;
    const legacy = io(url, { transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: origin }, auth: { csrf: session.csrf, protocolVersion: 4 }, reconnection: false }); sockets.push(legacy);
    const error = await new Promise<Error>(resolve => legacy.once('connect_error', resolve));
    expect(error.message).toContain('Refresh this page');
    const current = io(url, { transports: ['websocket'], extraHeaders: { Cookie: cookie, Origin: origin }, auth: { csrf: session.csrf, protocolVersion: ROOM_PROTOCOL_VERSION }, reconnection: false }); sockets.push(current);
    const view = await new Promise<any>((resolve, reject) => { current.once('session', resolve); current.once('connect_error', reject); });
    expect(view.csrf).toBe(session.csrf);
  } finally { for (const socket of sockets) socket.disconnect(); await app.close(); }
});
