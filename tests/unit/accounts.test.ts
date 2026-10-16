import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Rooms, hash } from '../../apps/server/src/rooms.js';
import { sqliteStorage, type Storage } from '../../apps/server/src/storage.js';
import { passwordHash, passwordMatches } from '../../apps/server/src/passwords.js';

const opened: Storage[] = [];
afterEach(async () => { for (const s of opened.splice(0)) await s.close(); });
const details = { username: 'alex_test', password: 'a long sample password', nickname: 'Alex', avatar: 'lilac' };
async function setup() {
  const storage = sqliteStorage(':memory:'); opened.push(storage);
  const rooms = new Rooms(storage); await rooms.init();
  const guest = await rooms.authenticate();
  return { storage, rooms, guest };
}
it('hashes passwords with a unique salt and never accepts the wrong password', async () => {
  const first = await passwordHash(details.password), second = await passwordHash(details.password);
  expect(first).not.toBe(second); expect(first).not.toContain(details.password);
  expect(await passwordMatches(details.password, first)).toBe(true);
  expect(await passwordMatches('wrong password', first)).toBe(false);
  expect(await passwordMatches(details.password)).toBe(false);
});
it('upgrades a guest in-place, rotates credentials, and projects only the authenticated account', async () => {
  const { rooms, guest } = await setup();
  const created = await rooms.create(guest.sessionId, { commandId: randomUUID(), nickname: 'Guest Alex', avatar: 'sky' });
  const auth = await rooms.signup(guest.sessionId, details);
  expect(auth.token).not.toBe(guest.token); expect(rooms.validSession(guest.sessionId)).toBe(false);
  const view = rooms.view(auth.sessionId);
  expect(view.account!.username).toBe('alex_test'); expect(view.access.accountCatalogue).toBe(true);
  expect(view.room!.id).toBe(created.room!.id); expect(view.room!.players[0].id).toBe(created.room!.players[0].id);
  const outsider = await rooms.authenticate();
  expect(rooms.view(outsider.sessionId).account).toBeNull(); expect(rooms.view(outsider.sessionId).access.accountCatalogue).toBe(false);
  expect(JSON.stringify(view)).not.toMatch(/passwordHash|googleSubject|scrypt|a long sample password/);
});
it('keeps an existing guest room after a failed login and denies guest profile writes', async () => {
  const { rooms, guest } = await setup();
  await rooms.signup(guest.sessionId, details);
  const other = await rooms.authenticate();
  const created = await rooms.create(other.sessionId, { commandId: randomUUID(), nickname: 'Guest', avatar: 'sun' });
  await expect(rooms.login(other.sessionId, { username: details.username, password: 'wrong password value' })).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
  expect(rooms.view(other.sessionId).room!.id).toBe(created.room!.id);
  await expect(rooms.saveProfile(other.sessionId, { nickname: 'Forged', avatar: 'moss' })).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' });
});
it('restores a saved profile on login and signs out without losing the current room', async () => {
  const { rooms, guest } = await setup();
  let auth: { token: string; sessionId: string } = await rooms.signup(guest.sessionId, details);
  await rooms.saveProfile(auth.sessionId, { nickname: 'Saved Alex', avatar: 'rose' });
  const created = await rooms.create(auth.sessionId, { commandId: randomUUID(), nickname: 'Saved Alex', avatar: 'rose' });
  const signedOut = await rooms.logout(auth.sessionId);
  expect(rooms.validSession(auth.sessionId)).toBe(false);
  expect(rooms.view(signedOut.sessionId).account).toBeNull(); expect(rooms.view(signedOut.sessionId).room!.id).toBe(created.room!.id);
  auth = await rooms.login(signedOut.sessionId, { username: 'ALEX_TEST', password: details.password });
  expect(rooms.view(auth.sessionId).account!.nickname).toBe('Saved Alex');
  expect(rooms.view(auth.sessionId).account!.avatar).toBe('rose');
  expect(rooms.view(auth.sessionId).room!.id).toBe(created.room!.id);
});
it('recovers an offline account seat but cannot hijack an active seat from a different browser', async () => {
  const { rooms, guest } = await setup();
  const first = await rooms.signup(guest.sessionId, details);
  const created = await rooms.create(first.sessionId, { commandId: randomUUID(), nickname: 'Alex', avatar: 'moss' });
  await rooms.connect(first.sessionId, 'one');
  const second = await rooms.authenticate();
  await expect(rooms.login(second.sessionId, { username: details.username, password: details.password })).rejects.toMatchObject({ code: 'ACCOUNT_IN_USE' });
  await rooms.disconnect(first.sessionId, 'one');
  const recovered = await rooms.login(second.sessionId, { username: details.username, password: details.password });
  expect(rooms.view(recovered.sessionId).room!.id).toBe(created.room!.id);
  expect(rooms.view(first.sessionId).room).toBeNull();
});
it('removes a deleted account, revokes all account sessions, and cannot log in again', async () => {
  const { rooms, guest } = await setup();
  const auth = await rooms.signup(guest.sessionId, details);
  const other = await rooms.authenticate();
  const second = await rooms.login(other.sessionId, { username: details.username, password: details.password });
  const deleted = await rooms.deleteAccount(auth.sessionId);
  expect(rooms.validSession(second.sessionId)).toBe(false); expect(rooms.validSession(auth.sessionId)).toBe(false);
  expect(rooms.view(deleted.sessionId).account).toBeNull();
  await expect(rooms.login(deleted.sessionId, { username: details.username, password: details.password })).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
});
it('migrates version-one guest data without destroying existing rooms', async () => {
  const storage = sqliteStorage(':memory:'); opened.push(storage);
  const token = 'a'.repeat(64), id = hash(token);
  await storage.save({ version: 1, sessions: { [id]: { csrf: 'sample', expiresAt: Date.now() + 60000, roomId: null } }, rooms: {}, receipts: {} });
  const rooms = new Rooms(storage); await rooms.init();
  expect((await rooms.authenticate(token)).sessionId).toBe(id);
  expect(rooms.view(id).access.tier).toBe('guest');
  expect((await storage.load() as { version: number }).version).toBe(4);
});
it('trusts Google subjects only through the server binding and never silently merges by nickname', async () => {
  const { rooms, guest } = await setup();
  const password = await rooms.signup(guest.sessionId, details);
  const googleGuest = await rooms.authenticate();
  const google = await rooms.googleLogin(googleGuest.sessionId, 'verified-subject', details.nickname);
  expect(rooms.view(google.sessionId).account!.id).not.toBe(rooms.view(password.sessionId).account!.id);
  expect(rooms.view(google.sessionId).account!.provider).toBe('google');
});
