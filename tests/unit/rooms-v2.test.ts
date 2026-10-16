import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Rooms, policy } from '../../apps/server/src/rooms.js';
import { sqliteStorage, type Storage } from '../../apps/server/src/storage.js';
import type { RoomCommand } from '../../packages/protocol/src/index.js';
const opened: Storage[] = [];
afterEach(async () => { for (const store of opened.splice(0)) await store.close(); });
async function setup() {
  let now = 1800000000000; const store = sqliteStorage(':memory:'); opened.push(store); const rooms = new Rooms(store, () => now); await rooms.init();
  const guest = async () => { const actor = await rooms.authenticate(); await rooms.connect(actor.sessionId, randomUUID()); return actor; };
  const account = async () => { const actor = await guest(); const auth = await rooms.signup(actor.sessionId, { username: `u_${randomUUID().replaceAll('-', '').slice(0, 12)}`, password: 'a unique rooms password', nickname: 'Member', avatar: 'rose' }); await rooms.connect(auth.sessionId, randomUUID()); return auth; };
  const create = (id: string) => rooms.create(id, { commandId: randomUUID(), nickname: 'Visitor', avatar: 'sun' });
  const command = (id: string, type: RoomCommand['type'], rest: Partial<RoomCommand> = {}) => { const room = rooms.view(id).room!; return rooms.command(id, { commandId: randomUUID(), roomId: room.id, expectedRevision: room.revision, type, ...rest }); };
  const saved = (id: string, type: string, roomId?: string, targetId?: string) => rooms.savedAction(id, { type, roomId, targetId, commandId: randomUUID() });
  const join = (id: string, code: string, asVisitor?: boolean) => rooms.join(id, { commandId: randomUUID(), invitation: code, nickname: 'Visitor', avatar: 'sun', asVisitor });
  return { rooms, store, guest, account, create, command, saved, join, advance: (ms: number) => { now += ms; } };
}
it('expires guest rooms at exactly one hour regardless of activity and after five empty minutes', async () => {
  const t = await setup(); const a = await t.guest(); await t.create(a.sessionId);
  t.advance(policy.absolute - 1); await t.command(a.sessionId, 'keepAlive'); expect(t.rooms.view(a.sessionId).room).not.toBeNull();
  t.advance(1); expect(t.rooms.view(a.sessionId).room).toBeNull(); await t.rooms.sweep();
  const b = await t.guest(); await t.create(b.sessionId); await t.command(b.sessionId, 'leave');
  t.advance(policy.absent - 1); await t.rooms.sweep(); expect(Object.keys((await t.store.load() as any).rooms)).toHaveLength(1);
  t.advance(1); await t.rooms.sweep(); expect(Object.keys((await t.store.load() as any).rooms)).toHaveLength(0);
});
it('keeps multiple empty saved rooms and ownership after leaving and reconnecting later', async () => {
  const t = await setup(); const a = await t.account(); const first = await t.create(a.sessionId); const second = await t.create(a.sessionId);
  expect(t.rooms.directory(a.sessionId).rooms).toHaveLength(2); expect(t.rooms.view(a.sessionId).room!.expiresAt).toBeNull();
  await t.command(a.sessionId, 'leave'); t.advance(3 * 3600000); await t.rooms.sweep();
  expect(t.rooms.directory(a.sessionId).rooms).toHaveLength(2); await t.saved(a.sessionId, 'enter', first.room!.id);
  expect(t.rooms.view(a.sessionId).room!.isOwner).toBe(true); expect(t.rooms.view(a.sessionId).room!.id).not.toBe(second.room!.id);
});
it('admits four occupants with separate single-use codes and refuses a fifth without consuming its code', async () => {
  const t = await setup(); const a = await t.guest(); await t.create(a.sessionId);
  for (let i = 0; i < 3; i++) { const code = t.rooms.view(a.sessionId).room!.code; const b = await t.guest(); await t.join(b.sessionId, code); if (i < 2) await t.command(a.sessionId, 'regenerateInvite'); }
  expect(t.rooms.view(a.sessionId).room!.players.map(p => p.seat).sort()).toEqual([1, 2, 3, 4]);
  await expect(t.command(a.sessionId, 'regenerateInvite')).rejects.toMatchObject({ code: 'NOT_READY' });
});
it('consumes a code once under simultaneous joins and keeps secrets out of visitor projections', async () => {
  const t = await setup(); const a = await t.account(); const created = await t.create(a.sessionId); const b = await t.guest(), c = await t.guest();
  await t.command(a.sessionId, 'memberInvite'); const secret = t.rooms.view(a.sessionId).room!.memberCode;
  const results = await Promise.allSettled([t.join(b.sessionId, created.room!.code), t.join(c.sessionId, created.room!.code)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  const winner = t.rooms.view(b.sessionId).room ? b : c; const view = t.rooms.view(winner.sessionId).room!;
  expect(view.code).toBe(''); expect(view.memberCode).toBe(''); expect(view.members).toEqual([]); expect(JSON.stringify(view)).not.toContain(secret);
});
it('requires explicit guest fallback and saves lasting access only for signed-in membership redemption', async () => {
  const t = await setup(); const a = await t.account(), b = await t.guest(), c = await t.account(); const room = await t.create(a.sessionId);
  await t.command(a.sessionId, 'memberInvite'); const code = t.rooms.view(a.sessionId).room!.memberCode;
  await expect(t.join(b.sessionId, code)).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' });
  await t.join(b.sessionId, code, true); expect(t.rooms.view(b.sessionId).room!.players.find(p => p.isYou)?.visitor).toBe(true);
  await t.command(a.sessionId, 'memberInvite'); await t.join(c.sessionId, t.rooms.view(a.sessionId).room!.memberCode);
  expect(t.rooms.directory(c.sessionId).rooms).toHaveLength(1); await t.command(c.sessionId, 'leave');
  await t.saved(c.sessionId, 'enter', room.room!.id); expect(t.rooms.view(c.sessionId).room!.players.find(p => p.isYou)?.visitor).toBe(false);
});
it('lets signed-in visitors chat in guest-created rooms but never projects chat to guests', async () => {
  const t = await setup(); const a = await t.guest(), b = await t.account(); const room = await t.create(a.sessionId); await t.join(b.sessionId, room.room!.code);
  await t.command(b.sessionId, 'chat', { text: '<script>plain text only</script>' });
  expect(t.rooms.view(b.sessionId).room!.messages).toHaveLength(1); expect(t.rooms.view(a.sessionId).room!.messages).toEqual([]);
  await expect(t.command(a.sessionId, 'chat', { text: 'Guest cannot send' })).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' });
  await expect(t.command(a.sessionId, 'theme', { theme: 'sunset' })).rejects.toMatchObject({ code: 'SIGN_IN_REQUIRED' });
  expect(t.rooms.view(a.sessionId).room!.players[0].avatar).toBe('moss');
});
it('keeps chat history for saved members while signed-in visitors see only their visit', async () => {
  const t = await setup(); const a = await t.account(), b = await t.account(); await t.create(a.sessionId);
  await t.command(a.sessionId, 'chat', { text: 'Earlier private history' }); t.advance(1);
  await t.join(b.sessionId, t.rooms.view(a.sessionId).room!.code); expect(t.rooms.view(b.sessionId).room!.messages).toEqual([]);
  await t.command(a.sessionId, 'chat', { text: 'During this visit' }); expect(t.rooms.view(b.sessionId).room!.messages.map(m => m.text)).toEqual(['During this visit']);
});
it('revokes removed membership, ejects its visit and rejects old-account readmission', async () => {
  const t = await setup(); const a = await t.account(), b = await t.account(); await t.create(a.sessionId); await t.command(a.sessionId, 'memberInvite');
  await t.join(b.sessionId, t.rooms.view(a.sessionId).room!.memberCode); const id = t.rooms.view(b.sessionId).account!.id;
  await t.command(a.sessionId, 'remove', { targetId: id }); expect(t.rooms.view(b.sessionId).room).toBeNull(); expect(t.rooms.directory(b.sessionId).rooms).toEqual([]);
  await expect(t.join(b.sessionId, t.rooms.view(a.sessionId).room!.code)).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
});
it('requires accepted friendship and targeted consent before saving a friend room invitation', async () => {
  const t = await setup(); const a = await t.account(), b = await t.account(), c = await t.account(); const room = await t.create(a.sessionId);
  const target = t.rooms.view(b.sessionId).account!.id;
  await expect(t.saved(a.sessionId, 'inviteFriend', room.room!.id, target)).rejects.toMatchObject({ code: 'NOT_FRIEND' });
  const invite = await t.rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'friend' }); await t.rooms.peopleAction(b.sessionId, { type: 'accept', token: invite.token });
  await t.saved(a.sessionId, 'inviteFriend', room.room!.id, target); const request = t.rooms.directory(b.sessionId).invitations[0];
  expect(t.rooms.directory(b.sessionId).rooms).toHaveLength(0); await expect(t.saved(c.sessionId, 'acceptInvite', undefined, request.id)).rejects.toMatchObject({ code: 'INVITE_UNAVAILABLE' });
  await t.saved(b.sessionId, 'acceptInvite', undefined, request.id); expect(t.rooms.directory(b.sessionId).rooms).toHaveLength(1);
});
it('migrates version-three account rooms without changing credentials and backs up before upgrade', async () => {
  const t = await setup(); const a = await t.account(); await t.create(a.sessionId); const raw = await t.store.load() as any; raw.version = 3;
  for (const room of Object.values(raw.rooms) as any[]) { delete room.ownerAccountId; delete room.members; }
  await t.store.save(raw); const restored = new Rooms(t.store); await restored.init();
  expect((await t.store.load() as any).version).toBe(4); expect(restored.view(a.sessionId).account!.id).toBe(t.rooms.view(a.sessionId).account!.id);
  expect(restored.directory(a.sessionId).rooms).toHaveLength(1);
});
it('does not revive an abandoned guest room after the server was down for more than five minutes', async () => {
  const t = await setup(); const a = await t.guest(); await t.create(a.sessionId);
  const now = t.rooms.view(a.sessionId).serverTime + policy.absent + 1;
  const restarted = new Rooms(t.store, () => now); await restarted.init();
  expect(restarted.view(a.sessionId).room).toBeNull();
});
it('only lets a signed-in owner explicitly save a guest room without enrolling its visitors', async () => {
  const t = await setup(); const a = await t.guest(), b = await t.account(); const created = await t.create(a.sessionId);
  await t.join(b.sessionId, created.room!.code);
  await expect(t.command(b.sessionId, 'saveRoom')).rejects.toMatchObject({ code: 'OWNER_ONLY' });
  const upgraded = await t.rooms.signup(a.sessionId, { username: 'save_my_guest_room', password: 'a unique upgrade password', nickname: 'Owner', avatar: 'rose' });
  await t.command(upgraded.sessionId, 'saveRoom');
  expect(t.rooms.view(upgraded.sessionId).room!.expiresAt).toBeNull(); expect(t.rooms.directory(upgraded.sessionId).rooms).toHaveLength(1);
  expect(t.rooms.directory(b.sessionId).rooms).toHaveLength(0);
});
it('bounds chat history and removes expired messages without deleting a saved room', async () => {
  const t = await setup(); const a = await t.account(); await t.create(a.sessionId);
  for (let i = 0; i < 201; i++) await t.command(a.sessionId, 'chat', { text: `Message ${i}` });
  expect(t.rooms.view(a.sessionId).room!.messages).toHaveLength(200);
  expect(t.rooms.view(a.sessionId).room!.messages[0].text).toBe('Message 1');
  t.advance(30 * 86400000 + 1); await t.rooms.sweep();
  const state = await t.store.load() as any; expect(Object.values(state.rooms)).toHaveLength(1);
  expect((Object.values(state.rooms) as any[])[0].messages).toEqual([]);
  expect((Object.values(state.rooms) as any[])[0].players).toEqual([]);
});
it('anonymizes authored messages on deletion and deletes rooms belonging to a deleted owner', async () => {
  const t = await setup(); const a = await t.account(), b = await t.account(); await t.create(a.sessionId); await t.command(a.sessionId, 'memberInvite');
  await t.join(b.sessionId, t.rooms.view(a.sessionId).room!.memberCode); await t.command(b.sessionId, 'chat', { text: 'An old message' });
  await t.rooms.deleteAccount(b.sessionId);
  expect(t.rooms.view(a.sessionId).room!.messages[0].nickname).toBe('Former member');
  expect(t.rooms.view(a.sessionId).room!.members).toHaveLength(1);
  await t.rooms.deleteAccount(a.sessionId); expect(Object.keys((await t.store.load() as any).rooms)).toHaveLength(0);
});
it('lets a returning owner reclaim control of a room filled with temporary visitors', async () => {
  const t = await setup(); const a = await t.account(); const created = await t.create(a.sessionId);
  await t.command(a.sessionId, 'memberInvite'); const lastCode = t.rooms.view(a.sessionId).room!.memberCode;
  for (let i = 0; i < 3; i++) { const guest = await t.guest(); await t.join(guest.sessionId, t.rooms.view(a.sessionId).room!.code); if (i < 2) await t.command(a.sessionId, 'regenerateInvite'); }
  await t.command(a.sessionId, 'leave');
  const lastGuest = await t.guest(); await t.join(lastGuest.sessionId, lastCode, true);
  await t.saved(a.sessionId, 'enter', created.room!.id);
  expect(t.rooms.view(a.sessionId).room!.isOwner).toBe(true); expect(t.rooms.view(a.sessionId).room!.players).toHaveLength(4);
  expect(t.rooms.view(lastGuest.sessionId).room).toBeNull();
});
it('upgrades an existing signed-in visitor to membership without requiring an extra seat', async () => {
  const t = await setup(); const a = await t.account(), b = await t.account(); await t.create(a.sessionId);
  await t.command(a.sessionId, 'memberInvite'); const code = t.rooms.view(a.sessionId).room!.memberCode;
  await t.join(b.sessionId, t.rooms.view(a.sessionId).room!.code);
  for (let i = 0; i < 2; i++) { await t.command(a.sessionId, 'regenerateInvite'); const guest = await t.guest(); await t.join(guest.sessionId, t.rooms.view(a.sessionId).room!.code); }
  await t.join(b.sessionId, code); expect(t.rooms.directory(b.sessionId).rooms).toHaveLength(1);
  expect(t.rooms.view(a.sessionId).room!.players).toHaveLength(4);
});
