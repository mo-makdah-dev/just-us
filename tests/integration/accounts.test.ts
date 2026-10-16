import { expect, it } from 'vitest';
import { createApplication } from '../../apps/server/src/app.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';
import { randomUUID } from 'node:crypto';

it('rotates HttpOnly sessions on login/logout and refuses client-selected account privileges', async () => {
  const origin = 'http://localhost:3210';
  const app = await createApplication(sqliteStorage(':memory:'), { origin });
  await new Promise<void>(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  try {
    let response = await fetch(`${base}/api/session`);
    let cookie = response.headers.get('set-cookie')!.split(';')[0];
    let session = (await response.json()).data;
    const initialCookie = cookie, initialCsrf = session.csrf;
    async function post(path: string, body: unknown, overriddenCookie = cookie, overriddenCsrf = session.csrf) {
      return fetch(`${base}${path}`, { method: 'POST', headers: { Origin: origin, Cookie: overriddenCookie, 'X-CSRF-Token': overriddenCsrf, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    const room = await (await post('/api/rooms', { commandId: randomUUID(), nickname: 'Guest', avatar: 'moss' })).json();
    expect((await post('/api/profile', { nickname: 'X', avatar: 'moss' })).status).toBe(403);
    const credentials = { username: 'http_account', password: 'test password for http', nickname: 'Alex', avatar: 'rose' };
    expect((await post('/api/auth/signup', { ...credentials, accountId: 'administrator' })).status).toBe(400);
    response = await post('/api/auth/signup', credentials);
    expect(response.status).toBe(200); expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    cookie = response.headers.get('set-cookie')!.split(';')[0]; session = (await response.json()).data;
    expect(cookie).not.toBe(initialCookie); expect(session.room.id).toBe(room.data.room.id);
    expect(session.access.tier).toBe('account');
    expect((await post('/api/profile', { nickname: 'Stolen', avatar: 'moss' }, initialCookie, initialCsrf)).status).toBe(401);
    response = await post('/api/auth/google', {}); expect(response.status).toBe(503);
    const callback = await fetch(`${base}/auth/callback?code=forged&next=https://attacker.invalid`, { redirect: 'manual', headers: { Cookie: cookie } });
    expect(callback.headers.get('location')).toBe('/?auth=failed');
    expect((await (await fetch(`${base}/api/session`, { headers: { Cookie: cookie } })).json()).data.account.username).toBe('http_account');
    response = await post('/api/auth/logout', {});
    const signedOut = (await response.json()).data; expect(signedOut.access.tier).toBe('guest'); expect(signedOut.room.id).toBe(room.data.room.id);
    expect((await post('/api/profile', { nickname: 'Old cookie', avatar: 'moss' })).status).toBe(401);
  } finally { await app.close(); }
});
