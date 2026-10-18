import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Rooms, policy } from '../../apps/server/src/rooms.js';
import { sqliteStorage, type Storage } from '../../apps/server/src/storage.js';
import type { RoomCommand } from '../../packages/protocol/src/index.js';

const opened: Storage[] = [];
const dirs: string[] = [];
afterEach(async () => { for (const storage of opened.splice(0)) await storage.close(); for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
async function setup() {
  let now = 1_800_000_000_000;
  const storage = sqliteStorage(':memory:'); opened.push(storage);
  const rooms = new Rooms(storage, () => now); await rooms.init();
  const a = await rooms.authenticate(); const b = await rooms.authenticate(); const c = await rooms.authenticate();
  await rooms.connect(a.sessionId, 'a');
  const input = { commandId: randomUUID(), nickname: 'Alex', avatar: 'moss' };
  const created = await rooms.create(a.sessionId, input);
  const joinInput = { commandId: randomUUID(), nickname: 'Sam', avatar: 'peach', invitation: created.room!.code };
  return { rooms, a, b, c, created, input, joinInput, advance: (ms: number) => { now += ms; } };
}
const cmd = (rooms: Rooms, sessionId: string, type: RoomCommand['type']): RoomCommand => {
  const room = rooms.view(sessionId).room!;
  return { type, roomId: room.id, expectedRevision: room.revision, commandId: randomUUID() };
};

describe('authoritative room lifecycle', () => {
  it('claims exactly two seats under simultaneous joins', async () => {
    const { rooms, a, b, c, joinInput } = await setup();
    const results = await Promise.allSettled([rooms.join(b.sessionId, joinInput), rooms.join(c.sessionId, { ...joinInput, commandId: randomUUID() })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(rooms.view(a.sessionId).room!.players).toHaveLength(2);
    expect(rooms.view(a.sessionId).room!.admissionsOpen).toBe(false);
  });
  it('deduplicates creation and rejects reusing a command ID with a different body', async () => {
    const { rooms, a, input, created } = await setup();
    expect(await rooms.create(a.sessionId, input)).toEqual(created);
    await expect(rooms.create(a.sessionId, { ...input, nickname: 'Imposter' })).rejects.toMatchObject({ code: 'COMMAND_REUSED' });
    expect(rooms.view(a.sessionId).room!.players[0].nickname).toBe('Alex');
  });
  it('does not expose credentials, session hashes, receipts, or invitation hashes', async () => {
    const { rooms, b, joinInput, created } = await setup();
    await rooms.join(b.sessionId, joinInput);
    const wire = JSON.stringify(rooms.view(b.sessionId));
    for (const secret of ['sessionId', 'invitationHash', 'receipts', created.invitation!]) expect(wire).not.toContain(secret);
    expect(rooms.view(b.sessionId).room!.games).toEqual([]);
  });
  it('enforces membership, owner permissions, revisions, and input schemas', async () => {
    const { rooms, a, b, c, joinInput } = await setup();
    await rooms.join(b.sessionId, joinInput);
    await expect(rooms.command(c.sessionId, cmd(rooms, a.sessionId, 'close'))).rejects.toMatchObject({ code: 'NOT_MEMBER' });
    await expect(rooms.command(b.sessionId, cmd(rooms, b.sessionId, 'close'))).rejects.toMatchObject({ code: 'OWNER_ONLY' });
    const stale = cmd(rooms, a.sessionId, 'keepAlive');
    await rooms.command(a.sessionId, { ...stale, commandId: randomUUID() });
    await expect(rooms.command(a.sessionId, stale)).rejects.toMatchObject({ code: 'STALE' });
    await expect(rooms.command(a.sessionId, { ...cmd(rooms, a.sessionId, 'keepAlive'), playerId: 'forged' })).rejects.toThrow();
  });
  it('rotates invitations and rejects old links/codes', async () => {
    const { rooms, a, b, c, created } = await setup();
    const changed = await rooms.command(a.sessionId, cmd(rooms, a.sessionId, 'regenerateInvite'));
    expect(changed.room!.code).not.toBe(created.room!.code);
    for (const invitation of [created.room!.code, created.invitation!]) await expect(rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'B', avatar: 'sky', invitation })).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
    await rooms.join(c.sessionId, { commandId: randomUUID(), nickname: 'C', avatar: 'sky', invitation: changed.invitation });
    expect(rooms.view(c.sessionId).room!.id).toBe(created.room!.id);
  });
  it('shares one seat across concurrent tabs and stays online until the last closes', async () => {
    const { rooms, a } = await setup();
    await Promise.all([rooms.connect(a.sessionId, 'a2'), rooms.connect(a.sessionId, 'a3')]);
    expect(rooms.view(a.sessionId).room!.players).toHaveLength(1);
    await rooms.disconnect(a.sessionId, 'a');
    await rooms.disconnect(a.sessionId, 'a2');
    expect(rooms.view(a.sessionId).room!.players[0].connected).toBe(true);
    await rooms.disconnect(a.sessionId, 'a3');
    expect(rooms.view(a.sessionId).room!.players[0].connected).toBe(false);
    await Promise.all([rooms.connect(a.sessionId, 'a4'), rooms.connect(a.sessionId, 'a5')]);
    expect(rooms.view(a.sessionId).room!.players).toHaveLength(1);
    expect(rooms.view(a.sessionId).room!.players[0].connected).toBe(true);
  });
  it('removes an absent seat after grace and transfers ownership without admitting strangers', async () => {
    const { rooms, a, b, joinInput, advance } = await setup();
    await rooms.join(b.sessionId, joinInput); await rooms.connect(b.sessionId, 'b');
    await rooms.disconnect(a.sessionId, 'a'); advance(policy.grace + 1); await rooms.sweep();
    const room = rooms.view(b.sessionId).room!;
    expect(room.isOwner).toBe(true); expect(room.players).toHaveLength(1); expect(room.admissionsOpen).toBe(false); expect(room.canReopen).toBe(true);
    expect(rooms.view(a.sessionId).room).toBeNull();
    await rooms.command(b.sessionId, cmd(rooms, b.sessionId, 'reopen'));
    expect(rooms.view(b.sessionId).room!.admissionsOpen).toBe(true);
  });
  it('expires abandoned rooms and rejects expired invitations even without a timer', async () => {
    const { rooms, a, b, created, advance } = await setup();
    await rooms.disconnect(a.sessionId, 'a'); advance(policy.absent + 1);
    expect(rooms.view(a.sessionId).room).toBeNull();
    await expect(rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'B', avatar: 'rose', invitation: created.invitation })).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
  });
  it('does not let heartbeats or repeated keep-alive extend the absolute lifetime', async () => {
    const { rooms, a, advance } = await setup();
    for (let i = 0; i < 5; i++) { advance(10 * 60000); await rooms.command(a.sessionId, cmd(rooms, a.sessionId, 'keepAlive')); }
    advance(10 * 60000); await rooms.sweep(); expect(rooms.view(a.sessionId).room).toBeNull();
  });
  it('lets a participant leave and closes the room for both on owner command', async () => {
    const { rooms, a, b, joinInput } = await setup();
    await rooms.join(b.sessionId, joinInput);
    const action = cmd(rooms, a.sessionId, 'close');
    await rooms.command(a.sessionId, action);
    expect(await rooms.command(a.sessionId, action)).toEqual({ room: null });
    expect(rooms.view(a.sessionId).room).toBeNull(); expect(rooms.view(b.sessionId).room).toBeNull();
  });
  it('restores the same credentials, seat, and room after the database is reopened', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'just-us-restart-test-')); dirs.push(dir);
    const path = join(dir, 'state.sqlite');
    let storage = sqliteStorage(path);
    let rooms = new Rooms(storage); await rooms.init();
    const a = await rooms.authenticate();
    const created = await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'A', avatar: 'sun' });
    expect(() => sqliteStorage(path)).toThrow(/locked/);
    await storage.close();
    storage = sqliteStorage(path); opened.push(storage);
    rooms = new Rooms(storage); await rooms.init();
    expect((await rooms.authenticate(a.token)).sessionId).toBe(a.sessionId);
    expect(rooms.view(a.sessionId).room!.id).toBe(created.room!.id);
    await rooms.connect(a.sessionId, 'new-transport');
    expect(rooms.view(a.sessionId).room!.players[0].connected).toBe(true);
  });

  it('rolls back a failed save and does not publish uncommitted changes', async () => {
    const base = sqliteStorage(':memory:'); opened.push(base);
    let fail = false;
    const store: Storage = { ...base, async save(value) { if (fail) throw new Error('simulated disk failure'); await base.save(value); } };
    const rooms = new Rooms(store); await rooms.init();
    const auth = await rooms.authenticate(); let published = 0; rooms.onChange = () => { published++; };
    fail = true;
    await expect(rooms.create(auth.sessionId, { commandId: randomUUID(), nickname: 'A', avatar: 'moss' })).rejects.toThrow('simulated disk failure');
    expect(published).toBe(0); expect(rooms.view(auth.sessionId).room).toBeNull();
  });
});
