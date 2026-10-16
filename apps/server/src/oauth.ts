import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { AppError } from './rooms.js';

export type GoogleConfig = { url: string; key: string };
export function googleOAuth(config: GoogleConfig | undefined, origin: string) {
  if (config && (!config.url.startsWith('https://') || new URL(config.url).pathname !== '/')) throw new Error('SUPABASE_URL must be an HTTPS project origin without a path.');
  const flows = new Map<string, { sessionId: string; createdAt: number; client: SupabaseClient }>();
  function expire() { for (const [id, flow] of flows) if (flow.createdAt + 10 * 60000 <= Date.now()) flows.delete(id); }
  return {
    configured: !!config,
    async start(sessionId: string) {
      if (!config) throw new AppError('GOOGLE_UNAVAILABLE', 'Google sign-in is not connected yet. You can create a free account with a username instead.', 503);
      expire();
      if (flows.size >= 300) throw new AppError('BUSY', 'Please try Google sign-in again in a moment.', 503);
      const storage = new Map<string, string>();
      const client = createClient(config.url, config.key, {
        auth: { flowType: 'pkce', autoRefreshToken: false, persistSession: true, detectSessionInUrl: false,
          storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); }, removeItem: key => { storage.delete(key); } } },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
      });
      const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true } });
      if (error || !data.url) throw new AppError('GOOGLE_UNAVAILABLE', 'Google sign-in is temporarily unavailable. Your room is safe.', 503);
      const id = randomBytes(32).toString('hex');
      flows.set(id, { sessionId, client, createdAt: Date.now() });
      return { id, url: data.url };
    },
    async finish(id: string | undefined, code: unknown) {
      expire();
      const flow = id ? flows.get(id) : undefined;
      if (id) flows.delete(id); // One attempt only, including failed/cancelled callbacks.
      if (!flow || typeof code !== 'string' || code.length > 2048) throw new AppError('OAUTH_EXPIRED', 'That sign-in attempt expired. Please start again.', 400);
      const { data, error } = await flow.client.auth.exchangeCodeForSession(code);
      if (error || !data.session) throw new AppError('OAUTH_INVALID', 'Google sign-in could not be completed. Please try again.', 400);
      // Verify remotely; never authorize an account from unverified browser JWT claims.
      const checked = await flow.client.auth.getUser(data.session.access_token);
      if (checked.error || !checked.data.user || !checked.data.user.identities?.some(i => i.provider === 'google')) throw new AppError('OAUTH_INVALID', 'Google identity could not be verified.', 400);
      return { sessionId: flow.sessionId, subject: checked.data.user.id, name: String(checked.data.user.user_metadata.full_name || 'Your person') };
    },
  };
}
