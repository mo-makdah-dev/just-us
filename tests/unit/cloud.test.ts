import { expect, it } from 'vitest';
import { protectCredential, redact, renderArguments, sessionUrl } from '../../scripts/cloud.js';

it('creates a free one-instance service without putting database credentials in CLI arguments', () => {
  const args = renderArguments('https://github.com/example/just-us', 'just-us-example', 'C:/private/upload.env');
  expect(args[args.indexOf('--plan') + 1]).toBe('free');
  expect(args[args.indexOf('--num-instances') + 1]).toBe('1');
  expect(args).toContain('--auto-deploy=false');
  expect(args.join(' ')).not.toContain('DATABASE_URL=');
  expect(args).toContain('just-us.env:C:/private/upload.env');
});
it('discovers only a Supabase session pooler and URL-encodes passwords', () => {
  const result = new URL(sessionUrl('postgresql://postgres.abcdefghijklmnopqrst@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true', 'private:@/password'));
  expect(result.port).toBe('5432'); expect(decodeURIComponent(result.password)).toBe('private:@/password'); expect(result.search).toBe('');
  expect(() => sessionUrl('https://example.com', 'secret')).toThrow();
  expect(() => sessionUrl('postgres://postgres.ref@attacker.example:5432/postgres', 'secret')).toThrow();
});
it('redacts credentials from CLI failure messages', () => {
  expect(redact('Oops private-password postgres://user:pass@example.com/db sbp_exampletoken', ['private-password'])).toBe('Oops [redacted] [database URL redacted] [token redacted]');
});
it.skipIf(process.platform !== 'win32')('round-trips the generated password through Windows credential protection', async () => {
  const original = 'test-only-generated-password';
  const encrypted = await protectCredential(original);
  expect(encrypted).not.toContain(original);
  expect(await protectCredential(encrypted, true)).toBe(original);
});
