import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { protectCredential, sessionUrl } from './cloud.js';
import { postgresStorageFromPool, type Storage } from '../apps/server/src/storage.js';
import { makeSnapshot, readSnapshot } from '../apps/server/src/snapshots.js';

const local = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'deployment');
const password = await protectCredential(readFileSync(join(local, 'database-password.dpapi'), 'utf8'), true);
const connectionString = sessionUrl(readFileSync(join(local, 'supabase-link/supabase/.temp/pooler-url'), 'utf8'), password);
const config = { connectionString, max: 1, ssl: { rejectUnauthorized: true, ca: readFileSync(join(local, 'supabase-ca.crt'), 'utf8') }, connectionTimeoutMillis: 10000 };
const schema = `just_us_verify_${randomBytes(8).toString('hex')}`;
const admin = new pg.Pool(config);
const scoped = () => {
  const pool = new pg.Pool(config);
  // pg queues this query before queries from the acquired connection; reconnects repeat it.
  pool.on('connect', client => { void client.query(`SET search_path TO "${schema}", public`).catch(() => client.end()); });
  return pool;
};
let store: Storage | undefined;
try {
  if (process.argv.includes('--verify-v4-migration')) {
    const current = (await admin.query('SELECT payload FROM public.just_us_state WHERE id=1')).rows[0]?.payload;
    const before = (await admin.query('SELECT payload FROM public.just_us_backups WHERE version=3')).rows[0]?.payload;
    assert.equal(current?.version, 4); assert.equal(before?.version, 3);
    for (const [id, account] of Object.entries(before.accounts) as Array<[string, any]>) {
      assert.ok(current.accounts[id], 'A pre-upgrade account must remain present.');
      for (const field of ['passwordHash', 'recoveryHash', 'googleSubject']) assert.deepEqual(current.accounts[id][field], account[field]);
    }
    console.log('PASS: version-four migration retained pre-upgrade account identities and credential hashes, with its version-three snapshot available.');
  }
  await admin.query(`CREATE SCHEMA "${schema}"`);
  store = await postgresStorageFromPool(scoped());
  const value = { version: 3, verification: randomBytes(8).toString('hex') };
  await store.save(value);
  const snapshot = makeSnapshot(await store.load());
  await store.close(); store = undefined;
  store = await postgresStorageFromPool(scoped());
  assert.deepEqual(await store.load(), value);
  await store.save({ version: 3, verification: 'changed' });
  await store.save(readSnapshot(snapshot));
  assert.deepEqual(await store.load(), value);
  for (const table of ['just_us_state', 'just_us_backups', 'just_us_owner']) {
    const result = await admin.query("SELECT c.relrowsecurity AS rls, has_table_privilege('anon',c.oid,'SELECT') AS anon, has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2", [schema, table]);
    assert.equal(result.rows[0]?.rls, true); assert.equal(result.rows[0]?.anon, false); assert.equal(result.rows[0]?.authenticated, false);
    const production = await admin.query("SELECT c.relrowsecurity AS rls, has_table_privilege('anon',c.oid,'SELECT') AS anon, has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=$1", [table]);
    assert.equal(production.rows.length, 1, 'The live application tables must already exist.');
    assert.equal(production.rows[0].rls, true); assert.equal(production.rows[0].anon, false); assert.equal(production.rows[0].authenticated, false);
  }
  console.log('PASS: hosted TLS hostname/certificate verification, restart persistence, isolated snapshot export/restore, RLS and browser-role denial.');
} finally {
  await store?.close();
  if (!/^just_us_verify_[a-f0-9]{16}$/.test(schema)) throw new Error('Unexpected verification schema; refusing cleanup.');
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
}
