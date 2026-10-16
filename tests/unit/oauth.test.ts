import { afterEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ exchange: vi.fn(), getUser: vi.fn(), begin: vi.fn(), create: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: fake.create }));
import { googleOAuth } from '../../apps/server/src/oauth.js';

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
function setup() {
  fake.begin.mockResolvedValue({ data: { url: 'https://sample.supabase.co/auth/v1/authorize?provider=google' }, error: null });
  fake.exchange.mockResolvedValue({ data: { session: { access_token: 'test-token-not-real' } }, error: null });
  fake.getUser.mockResolvedValue({ data: { user: { id: 'verified-subject', identities: [{ provider: 'google' }], user_metadata: { full_name: 'Alex' } } }, error: null });
  fake.create.mockReturnValue({ auth: { signInWithOAuth: fake.begin, exchangeCodeForSession: fake.exchange, getUser: fake.getUser } });
  return googleOAuth({ url: 'https://sample.supabase.co', key: 'public-test-key' }, 'http://localhost:3210');
}
it('does not offer Google authorization when no provider is configured', async () => {
  const oauth = googleOAuth(undefined, 'http://localhost:3210');
  expect(oauth.configured).toBe(false);
  await expect(oauth.start('session')).rejects.toMatchObject({ code: 'GOOGLE_UNAVAILABLE' });
});
it('uses server-side PKCE, validates the provider user remotely, and consumes callbacks once', async () => {
  const oauth = setup(); const flow = await oauth.start('original-guest-session');
  expect(fake.create.mock.calls[0][2].auth.flowType).toBe('pkce');
  expect(fake.begin).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'http://localhost:3210/auth/callback', skipBrowserRedirect: true } });
  expect(await oauth.finish(flow.id, 'provider-code')).toEqual({ sessionId: 'original-guest-session', subject: 'verified-subject', name: 'Alex' });
  expect(fake.getUser).toHaveBeenCalledWith('test-token-not-real');
  await expect(oauth.finish(flow.id, 'provider-code')).rejects.toMatchObject({ code: 'OAUTH_EXPIRED' });
});
it('rejects unknown and expired flows without exchanging a code', async () => {
  const oauth = setup(); const flow = await oauth.start('session');
  await expect(oauth.finish('forged-cookie', 'code')).rejects.toMatchObject({ code: 'OAUTH_EXPIRED' });
  vi.useFakeTimers(); vi.setSystemTime(Date.now() + 11 * 60000);
  await expect(oauth.finish(flow.id, 'code')).rejects.toMatchObject({ code: 'OAUTH_EXPIRED' });
  expect(fake.exchange).not.toHaveBeenCalled();
});
it('does not authorize an unverified or non-Google user', async () => {
  const oauth = setup(); const flow = await oauth.start('session');
  fake.getUser.mockResolvedValue({ data: { user: { id: 'other', identities: [{ provider: 'email' }], user_metadata: {} } }, error: null });
  await expect(oauth.finish(flow.id, 'code')).rejects.toMatchObject({ code: 'OAUTH_INVALID' });
});
