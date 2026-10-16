import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { postgresStorage, sqliteStorage } from '../apps/server/src/storage.js';
import { Rooms } from '../apps/server/src/rooms.js';
import { makeSnapshot, readSnapshot } from '../apps/server/src/snapshots.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const base = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs');
const command = process.argv[2], file = process.argv[3];
if (!['backup', 'restore'].includes(command)) throw new Error('Choose backup or restore. Stop the application before using this tool.');
let restored: unknown;
if (command === 'restore') {
  if (!file || !process.argv.includes('--confirm-restore')) throw new Error('Usage: npm run restore -- PATH --confirm-restore. Stop the application first.');
  restored = readSnapshot(JSON.parse(readFileSync(resolve(file), 'utf8')));
  if (!restored) throw new Error('The backup has no application state to restore.');
  // Validate and migrate on an isolated database before touching the real store.
  const temporary = sqliteStorage(':memory:');
  try {
    await temporary.save(restored); await new Rooms(temporary).init(); restored = await temporary.load();
    // Restored backups must not revive old browser credentials or stale rooms/invitations.
    Object.assign(restored as object, { sessions: {}, rooms: {}, receipts: {}, invitations: {} });
  }
  finally { await temporary.close(); }
}
const storage = process.env.DATABASE_URL ? await postgresStorage(process.env.DATABASE_URL, process.env.DATABASE_CA_FILE) : sqliteStorage(process.env.SQLITE_PATH || join(base, 'rooms.sqlite'));
try {
  const current = await storage.load();
  const backupPath = command === 'backup' && file ? resolve(file) : join(base, 'backups', `just-us-${Date.now()}.json`);
  mkdirSync(dirname(backupPath), { recursive: true });
  writeFileSync(backupPath, JSON.stringify(makeSnapshot(current)), { flag: 'wx', mode: 0o600 });
  console.log(`Backup saved: ${backupPath}`);
  if (command === 'restore') { await storage.save(restored); console.log('Validated snapshot restored. The previous state was backed up first. Restart the application.'); }
} finally { await storage.close(); }
