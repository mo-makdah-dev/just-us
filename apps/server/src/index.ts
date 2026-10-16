import { resolve, join, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { existsSync, mkdirSync } from 'node:fs';
import { backup, DatabaseSync } from 'node:sqlite';
import { createApplication } from './app.js';
import { postgresStorage, sqliteStorage } from './storage.js';
import { Rooms } from './rooms.js';

if (existsSync('.env')) process.loadEnvFile('.env');
// Render uploads this server-only secret file through its authenticated CLI.
if (existsSync('/etc/secrets/just-us.env')) process.loadEnvFile('/etc/secrets/just-us.env');
const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3210);
const origin = process.env.APP_ORIGIN || (production ? process.env.RENDER_EXTERNAL_URL : undefined) || `http://localhost:${port}`;
if (new URL(origin).origin !== origin || !Number.isInteger(port) || port < 1 || port > 65535 || ![0, 1].includes(Number(process.env.TRUST_PROXY || 0))) throw new Error('Check APP_ORIGIN, PORT, and TRUST_PROXY settings.');
if (production && process.argv.includes('--dev')) throw new Error('The development server cannot run in production mode.');
if (production && (!process.env.DATABASE_URL || !origin.startsWith('https://'))) throw new Error('Production requires DATABASE_URL and an HTTPS APP_ORIGIN.');
const dbPath = process.env.SQLITE_PATH || join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'rooms.sqlite');
const legacyPath = join(tmpdir(), 'just-us-development', 'rooms.sqlite');
if (!process.env.DATABASE_URL && !process.env.SQLITE_PATH && !existsSync(dbPath) && existsSync(legacyPath)) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const source = new DatabaseSync(legacyPath, { readOnly: true });
  try { await backup(source, dbPath); } finally { source.close(); }
  console.log('Copied the experimental room database to durable local storage. The original is retained.');
}
const storage = process.env.DATABASE_URL
  ? await postgresStorage(process.env.DATABASE_URL, process.env.DATABASE_CA_FILE, { takeover: true, validate: async value => {
      const temporary = sqliteStorage(':memory:');
      try { if (value !== null) await temporary.save(value); await new Rooms(temporary).init(); }
      finally { await temporary.close(); }
    } })
  : sqliteStorage(dbPath);
const application = await createApplication(storage, { origin, production,
  // The whole browser suite shares localhost; keep its synthetic accounts from
  // spending one shared IP's production authentication budget. Never used live.
  testAuthIpLimit: process.env.NODE_ENV === 'test' ? 200 : undefined,
  google: process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY ? { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_PUBLISHABLE_KEY } : undefined,
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  frontend: process.argv.includes('--dev') ? undefined : resolve('dist/web'),
});
let vite: Awaited<ReturnType<typeof import('vite')['createServer']>> | undefined;
if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite');
  vite = await createServer({ configFile: resolve('apps/web/vite.config.ts'), server: { middlewareMode: true, hmr: { server: application.http } }, appType: 'spa' });
  application.app.use(vite.middlewares);
}
application.http.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`Just Us is ready at ${origin} (${storage.kind}).`);
  if (storage.kind === 'sqlite') console.log(`Local experimental database: ${dbPath}`);
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  await vite?.close();
  await application.close();
  process.exit(0);
}
process.on('SIGINT', () => { void shutdown(); });
process.on('SIGTERM', () => { void shutdown(); });
