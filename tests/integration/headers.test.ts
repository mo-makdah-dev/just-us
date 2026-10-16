import { expect, it } from 'vitest';
import { createApplication } from '../../apps/server/src/app.js';
import { sqliteStorage } from '../../apps/server/src/storage.js';
it('enables production security headers and Secure HttpOnly cookies without exposing secrets', async () => {
  const app = await createApplication(sqliteStorage(':memory:'), { origin: 'https://just-us.example', production: true });
  await new Promise<void>(resolve => app.http.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(app.http.address() as { port: number }).port}`;
  try {
    const response = await fetch(`${base}/api/session`);
    expect(response.headers.get('set-cookie')).toMatch(/HttpOnly.*Secure.*SameSite=Strict/);
    expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(response.headers.get('strict-transport-security')).toContain('max-age');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const denied = await fetch(`${base}/api/session`, { headers: { Origin: 'https://attacker.invalid' } });
    expect(denied.status).toBe(403);
  } finally { await app.close(); }
});
