import { request } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, randomUUID } from 'node:crypto';
const local = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'deployment');
const { url } = JSON.parse(readFileSync(join(local, 'resources.json'), 'utf8'));
if (!url?.startsWith('https://')) throw new Error('Expected the recorded HTTPS website.');
const actors: Array<{ ctx: Awaited<ReturnType<typeof request.newContext>>; username: string }> = [];
async function session(actor: typeof actors[number]) { const response = await actor.ctx.get('/api/session'); assert.equal(response.status(), 200); return (await response.json()).data; }
async function post(actor: typeof actors[number], path: string, body: object) { const current = await session(actor); return actor.ctx.post(path, { headers: { Origin: url, 'X-CSRF-Token': current.csrf }, data: body }); }
async function command(actor: typeof actors[number], type: string, fields: object = {}) { const current = await session(actor); const body = { commandId: randomUUID(), roomId: current.room.id, expectedRevision: current.room.revision, type, ...fields }; const response = await post(actor, '/api/command', body); assert.equal(response.status(), 200); return { body, result: (await response.json()).data }; }
try {
  for (let i = 0; i < 2; i++) {
    const actor = { ctx: await request.newContext({ baseURL: url }), username: `qa_revoke_${randomBytes(5).toString('hex')}` }; actors.push(actor);
    const response = await post(actor, '/api/auth/signup', { username: actor.username, password: randomBytes(32).toString('hex'), nickname: `Verification ${i + 1}`, avatar: 'moss' }); assert.equal(response.status(), 200);
  }
  const [a, b] = actors;
  assert.equal((await post(a, '/api/rooms', { commandId: randomUUID(), nickname: 'Verification 1', avatar: 'moss' })).status(), 200);
  const invite = await command(a, 'memberInvite');
  assert.equal((await post(b, '/api/join', { commandId: randomUUID(), invitation: invite.result.room.memberCode, nickname: 'Verification 2', avatar: 'moss' })).status(), 200);
  const original = await command(b, 'chat', { text: 'Synthetic private revocation check' });
  await command(a, 'remove', { targetId: (await session(b)).account.id });
  const replay = await post(b, '/api/command', original.body); assert.equal(replay.status(), 200); assert.deepEqual((await replay.json()).data, { room: null });
  const fresh = await post(b, '/api/command', { ...original.body, commandId: randomUUID() }); assert.equal(fresh.status(), 403); assert.equal((await fresh.json()).error.code, 'NOT_MEMBER');
  assert.equal((await session(b)).room, null);
  console.log('PASS: live member removal ejects the visit, redacts cached chat/room acknowledgements and rejects fresh unauthorized actions.');
} finally {
  for (const actor of [...actors].reverse()) {
    try { const current = await session(actor); if (current.account) { assert.equal(current.account.username, actor.username); assert.equal((await post(actor, '/api/auth/delete', { confirm: 'DELETE' })).status(), 200); } }
    finally { await actor.ctx.dispose(); }
  }
  console.log('Temporary revocation-check accounts and owned room cleaned up.');
}
