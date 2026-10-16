import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Rooms } from '../../apps/server/src/rooms.js';
import { sqliteStorage, type Storage } from '../../apps/server/src/storage.js';
const stores: Storage[] = []; afterEach(async () => { for (const s of stores.splice(0)) await s.close(); });
async function setup() {
  const storage = sqliteStorage(':memory:'); stores.push(storage); let time = Date.now();
  const rooms = new Rooms(storage, () => time); await rooms.init();
  const accounts = [];
  for (const username of ['alex', 'sam', 'taylor']) { const guest = await rooms.authenticate(); const auth = await rooms.signup(guest.sessionId, { username, password: 'a safe test password', nickname: username, avatar: 'moss' }); accounts.push(auth); }
  const [a, b, c] = accounts;
  return { rooms, storage, a, b, c, advance: (ms: number) => { time += ms; } };
}
it('requires accepted invitations and atomically enforces one special person for both parties', async () => {
  const { rooms, a, b, c } = await setup();
  const first = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'special' });
  const second = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'special' });
  expect(rooms.people(a.sessionId).connections).toEqual([]);
  const accepted = await Promise.allSettled([rooms.peopleAction(b.sessionId, { type: 'accept', token: first.token }), rooms.peopleAction(c.sessionId, { type: 'accept', token: second.token })]);
  expect(accepted.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(rooms.people(a.sessionId).connections.filter(c => c.kind === 'special')).toHaveLength(1);
  expect(rooms.people(b.sessionId).connections).toHaveLength(1); expect(rooms.people(c.sessionId).connections).toHaveLength(0);
});
it('keeps pet names and category names private, including in personalized room views', async () => {
  const { rooms, a, b, c } = await setup();
  const invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'special' });
  await rooms.peopleAction(b.sessionId, { type: 'accept', token: invite.token });
  const connection = rooms.people(a.sessionId).connections[0];
  await rooms.peopleAction(a.sessionId, { type: 'label', id: connection.id, petName: 'Secret nickname' });
  await rooms.peopleAction(a.sessionId, { type: 'categories', special: 'My love', friends: 'My circle' });
  expect(rooms.people(a.sessionId).categories.special).toBe('My love');
  expect(JSON.stringify(rooms.people(b.sessionId))).not.toMatch(/Secret nickname|My love/);
  await expect(rooms.peopleAction(c.sessionId, { type: 'label', id: connection.id, petName: 'forged' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const created = await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'alex', avatar: 'moss' });
  await rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'sam', avatar: 'peach', invitation: created.room!.code });
  expect(JSON.stringify(rooms.view(a.sessionId).room)).toContain('Secret nickname');
  expect(JSON.stringify(rooms.view(b.sessionId).room)).not.toContain('Secret nickname');
});
it('rejects self acceptance, revoked/expired tokens and replay by another account', async () => {
  const { rooms, a, b, c, advance } = await setup();
  let invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'friend' });
  await expect(rooms.peopleAction(a.sessionId, { type: 'accept', token: invite.token })).rejects.toMatchObject({ code: 'SELF_INVITE' });
  await rooms.peopleAction(b.sessionId, { type: 'accept', token: invite.token });
  await rooms.peopleAction(b.sessionId, { type: 'accept', token: invite.token });
  expect(rooms.people(b.sessionId).connections).toHaveLength(1);
  await expect(rooms.peopleAction(c.sessionId, { type: 'accept', token: invite.token })).rejects.toMatchObject({ code: 'INVITE_UNAVAILABLE' });
  invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'friend' });
  await rooms.peopleAction(a.sessionId, { type: 'revoke', id: invite.people.invitations[0].id });
  await expect(rooms.peopleAction(c.sessionId, { type: 'accept', token: invite.token })).rejects.toMatchObject({ code: 'INVITE_UNAVAILABLE' });
  invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'friend' }); advance(8 * 86400000);
  const freshGuest = await rooms.authenticate(); const fresh = await rooms.signup(freshGuest.sessionId, { username: 'newbie', password: 'another test password', nickname: 'Newbie', avatar: 'sky' });
  await expect(rooms.peopleAction(fresh.sessionId, { type: 'accept', token: invite.token })).rejects.toMatchObject({ code: 'INVITE_UNAVAILABLE' });
});
it('allows friends beside the special person, removes both sides, and clears deleted accounts', async () => {
  const { rooms, a, b, c } = await setup();
  for (const [target, kind] of [[b, 'special'], [c, 'friend']] as const) { const invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind }); await rooms.peopleAction(target.sessionId, { type: 'accept', token: invite.token }); }
  expect(rooms.people(a.sessionId).connections).toHaveLength(2);
  const friend = rooms.people(a.sessionId).connections.find(p => p.kind === 'friend')!;
  await rooms.peopleAction(c.sessionId, { type: 'remove', id: friend.id });
  expect(rooms.people(a.sessionId).connections).toHaveLength(1); expect(rooms.people(c.sessionId).connections).toHaveLength(0);
  await rooms.deleteAccount(b.sessionId); expect(rooms.people(a.sessionId).connections).toHaveLength(0);
});
it('blocking removes a connection, leaves shared rooms and rejects future signed-in joins', async () => {
  const { rooms, a, b } = await setup(); const invite = await rooms.peopleAction(a.sessionId, { type: 'invite', kind: 'friend' });
  await rooms.peopleAction(b.sessionId, { type: 'accept', token: invite.token });
  const created = await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'alex', avatar: 'moss' });
  await rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'sam', avatar: 'moss', invitation: created.room!.code });
  await rooms.peopleAction(a.sessionId, { type: 'block', id: rooms.view(b.sessionId).account!.id });
  expect(rooms.view(a.sessionId).room!.isOwner).toBe(true); expect(rooms.view(b.sessionId).room).toBeNull(); expect(rooms.people(a.sessionId).connections).toHaveLength(0);
  const another = await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'alex', avatar: 'moss' });
  await expect(rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'sam', avatar: 'moss', invitation: another.room!.code })).rejects.toMatchObject({ code: 'ROOM_UNAVAILABLE' });
});
it('accepts only bounded pixel designs and projects saved art into a room', async () => {
  const { rooms, a } = await setup(); const avatarDesign = { version: 1, pixels: new Array(576).fill(11) };
  await rooms.saveProfile(a.sessionId, { nickname: 'Custom Alex', avatar: 'lilac', avatarDesign });
  await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'Custom Alex', avatar: 'lilac' });
  expect(rooms.view(a.sessionId).room!.players[0].avatarDesign).toEqual(avatarDesign);
  await expect(rooms.saveProfile(a.sessionId, { nickname: 'X', avatar: 'lilac', avatarDesign: { version: 1, pixels: [1] } })).rejects.toThrow();
  await expect(rooms.saveProfile(a.sessionId, { nickname: 'X', avatar: 'lilac', avatarDesign: { version: 1, pixels: new Array(576).fill(999) } })).rejects.toThrow();
});
it('theme changes are owner-authorized and shared with the partner', async () => {
  const { rooms, a, b } = await setup(); const room = (await rooms.create(a.sessionId, { commandId: randomUUID(), nickname: 'a', avatar: 'moss' })).room!;
  await rooms.join(b.sessionId, { commandId: randomUUID(), nickname: 'b', avatar: 'moss', invitation: room.code });
  let current = rooms.view(a.sessionId).room!;
  await expect(rooms.command(b.sessionId, { type: 'theme', theme: 'sunset', roomId: room.id, expectedRevision: current.revision, commandId: randomUUID() })).rejects.toMatchObject({ code: 'OWNER_ONLY' });
  await rooms.command(a.sessionId, { type: 'theme', theme: 'sunset', roomId: room.id, expectedRevision: current.revision, commandId: randomUUID() });
  expect(rooms.view(b.sessionId).room!.theme).toBe('sunset');
});
