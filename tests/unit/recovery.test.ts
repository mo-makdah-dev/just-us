import { expect, it } from 'vitest';
import { Rooms } from '../../apps/server/src/rooms.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';
import { makeSnapshot, readSnapshot } from '../../apps/server/src/snapshots.js';
import { fillPixels, presetPixels } from '../../packages/avatar/src/pixels.js';
it('uses a recovery key once, rotates it, and revokes previous sessions', async () => {
  const storage = sqliteStorage(':memory:');
  try {
    const rooms = new Rooms(storage); await rooms.init();
    const guest = await rooms.authenticate();
    const auth = await rooms.signup(guest.sessionId, { username: 'recovery_user', password: 'original test password', nickname: 'A', avatar: 'moss' });
    expect(rooms.view(auth.sessionId).recoveryCode).toBeUndefined();
    expect(JSON.stringify(await storage.load())).not.toContain(auth.recoveryCode);
    const recovering = await rooms.authenticate();
    const reset = await rooms.recover(recovering.sessionId, { username: 'recovery_user', recoveryCode: auth.recoveryCode, password: 'a completely new password' });
    expect(rooms.validSession(auth.sessionId)).toBe(false); expect(reset.recoveryCode).not.toBe(auth.recoveryCode);
    const stranger = await rooms.authenticate();
    await expect(rooms.recover(stranger.sessionId, { username: 'recovery_user', recoveryCode: auth.recoveryCode, password: 'another new password' })).rejects.toMatchObject({ code: 'INVALID_RECOVERY' });
    await expect(rooms.login(stranger.sessionId, { username: 'recovery_user', password: 'original test password' })).rejects.toMatchObject({ code: 'INVALID_LOGIN' });
    const changed = await rooms.changePassword(reset.sessionId, { currentPassword: 'a completely new password', password: 'third unique password here' });
    expect(rooms.validSession(reset.sessionId)).toBe(false); expect(rooms.view(changed.sessionId).account).not.toBeNull();
  } finally { await storage.close(); }
});
it('validates backup checksums before restoration', () => {
  const original = makeSnapshot({ version: 3, marker: 'saved' }); expect(readSnapshot(original)).toEqual(original.state);
  expect(() => readSnapshot({ ...original, state: { version: 3, marker: 'tampered' } })).toThrow('Backup checksum failed');
});
it('fills only connected pixels and retains fixed-size original presets', () => {
  const design = presetPixels('moss'); expect(design.pixels).toHaveLength(576);
  const p = new Array(576).fill(0); for (let y = 0; y < 24; y++) p[y * 24 + 12] = 1;
  const filled = fillPixels(p, 0, 5); expect(filled[0]).toBe(5); expect(filled[12]).toBe(1); expect(filled[13]).toBe(0);
});
