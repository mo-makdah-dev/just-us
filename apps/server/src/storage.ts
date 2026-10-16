import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

export interface Storage {
  load(): Promise<unknown | null>;
  save(value: unknown): Promise<void>;
  close(): Promise<void>;
  kind: string;
  assertOwnership?(): Promise<void>;
  readonly active?: boolean;
}

export function sqliteStorage(path: string): Storage {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=1000; PRAGMA locking_mode=EXCLUSIVE; PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_backups (version INTEGER PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  } catch (error) { db.close(); throw error; }
  return {
    kind: 'sqlite',
    async load() {
      const row = db.prepare('SELECT payload FROM app_state WHERE id=1').get() as { payload: string } | undefined;
      return row ? JSON.parse(row.payload) : null;
    },
    async save(value) {
      const serialized = JSON.stringify(value);
      db.exec('BEGIN IMMEDIATE');
      try {
        const previous = db.prepare('SELECT payload FROM app_state WHERE id=1').get() as { payload: string } | undefined;
        if (previous && JSON.parse(previous.payload).version !== (value as { version: number }).version) db.prepare('INSERT OR IGNORE INTO app_backups(version,payload) VALUES(?,?)').run(JSON.parse(previous.payload).version, previous.payload);
        db.prepare('INSERT INTO app_state(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(serialized);
        db.exec("DELETE FROM app_backups WHERE created_at < datetime('now','-30 days'); DELETE FROM app_backups WHERE version NOT IN (SELECT version FROM app_backups ORDER BY version DESC LIMIT 3); COMMIT");
      } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    async close() { db.close(); },
  };
}

export class OwnershipLost extends Error {
  constructor() { super('This server has been replaced. Reconnect to continue.'); }
}
export type PostgresOptions = { takeover?: boolean; validate?: (value: unknown) => Promise<void> };
export async function postgresStorage(connectionString: string, caFile?: string, options: PostgresOptions = {}): Promise<Storage> {
  // URL sslmode parameters can override pg's ssl object. Reject insecure modes.
  const url = new URL(connectionString);
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const pool = new pg.Pool({ connectionString: url.toString(), max: 3,
    ssl: { rejectUnauthorized: true, ...(caFile ? { ca: readFileSync(caFile, 'utf8') } : {}) },
    connectionTimeoutMillis: 10000 });
  return postgresStorageFromPool(pool, options);
}

// Separate pool entry point permits real local PostgreSQL tests without weakening hosted TLS.
export async function postgresStorageFromPool(pool: pg.Pool, options: PostgresOptions = {}): Promise<Storage> {
  const owner = randomUUID();
  let active = true;
  let closed = false;
  pool.on('error', () => { /* Requests fail closed until a fresh connection succeeds. */ });
  async function transaction<T>(operation: (client: pg.PoolClient) => Promise<T>) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
      // One lock order for ownership, startup DDL and state avoids takeover/write deadlocks.
      await client.query('SELECT pg_advisory_xact_lock(734105661)');
      const result = await operation(client);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }
  async function check(client: pg.PoolClient) {
    if (!active || closed) throw new OwnershipLost();
    const current = (await client.query('SELECT owner FROM just_us_owner WHERE id=1 FOR UPDATE')).rows[0];
    if (current?.owner !== owner) { active = false; throw new OwnershipLost(); }
    await client.query('UPDATE just_us_owner SET heartbeat=now() WHERE id=1');
  }
  try {
    await transaction(async client => {
      // Serializes first-run DDL and interoperates safely with the previous session-lock release.
      await client.query('CREATE TABLE IF NOT EXISTS just_us_state (id INTEGER PRIMARY KEY CHECK(id=1), payload JSONB NOT NULL)');
      await client.query('CREATE TABLE IF NOT EXISTS just_us_backups (version INTEGER PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())');
      await client.query("CREATE TABLE IF NOT EXISTS just_us_owner (id INTEGER PRIMARY KEY CHECK(id=1), owner TEXT, mode TEXT NOT NULL, heartbeat TIMESTAMPTZ NOT NULL DEFAULT now())");
      for (const table of ['just_us_state', 'just_us_backups', 'just_us_owner']) {
        await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; REVOKE ALL ON ${table} FROM PUBLIC`);
        await client.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON ${table} FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON ${table} FROM authenticated; END IF; END $$`);
      }
      await client.query("INSERT INTO just_us_owner(id,owner,mode) VALUES(1,NULL,'maintenance') ON CONFLICT(id) DO NOTHING");
      const previous = (await client.query("SELECT owner,mode,heartbeat > now() - interval '15 seconds' AS live FROM just_us_owner WHERE id=1 FOR UPDATE")).rows[0];
      if (previous.owner && previous.live && (!options.takeover || previous.mode === 'maintenance')) throw new Error('A live Just Us process owns this database. Stop it before maintenance.');
      const value = (await client.query('SELECT payload FROM just_us_state WHERE id=1')).rows[0]?.payload ?? null;
      // Validation failure rolls back ownership, leaving the previous release in charge.
      await options.validate?.(value);
      await client.query('UPDATE just_us_owner SET owner=$1,mode=$2,heartbeat=now() WHERE id=1', [owner, options.takeover ? 'server' : 'maintenance']);
    });
  } catch (error) { await pool.end(); throw error; }
  return {
    kind: 'postgres',
    get active() { return active && !closed; },
    async assertOwnership() { await transaction(check); },
    async load() { return transaction(async client => { await check(client); return (await client.query('SELECT payload FROM just_us_state WHERE id=1')).rows[0]?.payload ?? null; }); },
    async save(value) {
      await transaction(async client => {
        await check(client);
        const previous = (await client.query('SELECT payload FROM just_us_state WHERE id=1 FOR UPDATE')).rows[0]?.payload;
        if (previous && previous.version !== (value as { version: number }).version) await client.query('INSERT INTO just_us_backups(version,payload) VALUES($1,$2) ON CONFLICT(version) DO NOTHING', [previous.version, JSON.stringify(previous)]);
        await client.query('INSERT INTO just_us_state(id,payload) VALUES(1,$1) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload', [JSON.stringify(value)]);
        await client.query("DELETE FROM just_us_backups WHERE created_at < now() - interval '30 days' OR version NOT IN (SELECT version FROM just_us_backups ORDER BY version DESC LIMIT 3)");
      });
    },
    async close() {
      if (closed) return;
      try { await pool.query('UPDATE just_us_owner SET owner=NULL WHERE id=1 AND owner=$1', [owner]); }
      finally { closed = true; active = false; await pool.end(); }
    },
  };
}
