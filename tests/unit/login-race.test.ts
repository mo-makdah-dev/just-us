import { expect, it, vi } from 'vitest';
import * as passwords from '../../apps/server/src/passwords.js';
import { Rooms } from '../../apps/server/src/rooms.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';

it('refuses an old-password login whose verification overlaps a completed recovery', async () => {
  const storage = sqliteStorage(':memory:');
  const original = passwords.passwordMatches;
  let release!: () => void;
  let verified!: () => void;
  const paused = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { verified = resolve; });
  try {
    const rooms = new Rooms(storage); await rooms.init();
    const guest = await rooms.authenticate();
    const account = await rooms.signup(guest.sessionId, { username: 'race_user', password: 'original test password', nickname: 'A', avatar: 'moss' });
    const attacker = await rooms.authenticate();
    const recovering = await rooms.authenticate();
    vi.spyOn(passwords, 'passwordMatches').mockImplementationOnce(async (...args) => {
      const result = await original(...args); verified(); await paused; return result;
    });
    const login = rooms.login(attacker.sessionId, { username: 'race_user', password: 'original test password' });
    const rejected = expect(login).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
    await reached;
    await rooms.recover(recovering.sessionId, { username: 'race_user', recoveryCode: account.recoveryCode, password: 'replacement test password' });
    release(); await rejected;
    expect(rooms.view(attacker.sessionId).account).toBeNull();
  } finally { release?.(); vi.restoreAllMocks(); await storage.close(); }
});
