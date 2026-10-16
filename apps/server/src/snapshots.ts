import { createHash } from 'node:crypto';
import { z } from 'zod';
const envelope = z.object({ format: z.literal(1), createdAt: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), state: z.unknown() }).strict();
const digest = (state: unknown) => createHash('sha256').update(JSON.stringify(state)).digest('hex');
export function makeSnapshot(state: unknown) { return { format: 1 as const, createdAt: new Date().toISOString(), sha256: digest(state), state }; }
export function readSnapshot(raw: unknown) {
  const parsed = envelope.parse(raw);
  if (digest(parsed.state) !== parsed.sha256) throw new Error('Backup checksum failed. Nothing has been restored.');
  return parsed.state;
}
