import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { Rooms } from '../../apps/server/src/rooms.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';

it('backs up and restores validated accounts without reviving old sessions, and rejects corrupt backups', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'just-us-backup-check-'));
  if (!resolve(dir).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory');
  const path = join(dir, 'database.sqlite'), snapshot = join(dir, 'snapshot.json'), corrupt = join(dir, 'corrupt.json');
  const cli = process.env.STATE_TOOL_COMPILED === '1' ? [resolve('dist/server/scripts/state-tool.js')] : [resolve('node_modules/tsx/dist/cli.mjs'), resolve('scripts/state-tool.ts')];
  const run = (...args: string[]) => execFileSync(process.execPath, [...cli, ...args], { env: { ...process.env, SQLITE_PATH: path, LOCALAPPDATA: dir, DATABASE_URL: '', NODE_ENV: 'test' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    let store = sqliteStorage(path); let rooms = new Rooms(store); await rooms.init(); const guest = await rooms.authenticate();
    await rooms.signup(guest.sessionId, { username: 'backup_test', password: 'a backup test password', nickname: 'Original', avatar: 'moss' }); await store.close();
    expect(run('backup', snapshot)).toContain('Backup saved');
    const tampered = JSON.parse(readFileSync(snapshot, 'utf8')); tampered.state.accounts = {}; writeFileSync(corrupt, JSON.stringify(tampered));
    expect(() => run('restore', corrupt, '--confirm-restore')).toThrow();
    store = sqliteStorage(path); expect(Object.keys((await store.load() as { accounts: object }).accounts)).toHaveLength(1); await store.close();
    expect(run('restore', snapshot, '--confirm-restore')).toContain('Validated snapshot restored');
    store = sqliteStorage(path); const restored = await store.load() as { accounts: object; sessions: object }; expect(Object.keys(restored.accounts)).toHaveLength(1); expect(Object.keys(restored.sessions)).toHaveLength(0); await store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
