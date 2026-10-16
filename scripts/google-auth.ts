import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { protectCredential } from './cloud.js';

const privateDir = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'deployment');
const state = JSON.parse(readFileSync(join(privateDir, 'resources.json'), 'utf8'));
if (!/^[a-z]{20}$/.test(state.project) || !/^srv-[a-z0-9]+$/.test(state.service) || state.url !== 'https://just-us-c7ee609b.onrender.com') throw new Error('Review the recorded Just Us deployment first.');
const supabaseUrl = `https://${state.project}.supabase.co`;
const callback = `${supabaseUrl}/auth/v1/callback`;
function cli(args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', ...args], { encoding: 'utf8', windowsHide: true, env: { ...process.env, ...env }, timeout: 60000 });
  if (result.status !== 0) throw new Error('Supabase CLI operation failed. No credential values have been printed.');
  return result.stdout;
}
function payload(raw: string): any { const data = JSON.parse(raw); if (data._tag === 'Error') throw new Error('Supabase rejected the operation.'); return data.data ?? data; }
async function publicKey() {
  const data = payload(cli(['projects', 'api-keys', '--project-ref', state.project, '--output-format', 'json']));
  const rows = Array.isArray(data) ? data : data.keys;
  const key = rows.find((row: any) => row.type === 'publishable')?.api_key;
  if (typeof key !== 'string' || !key.startsWith('sb_publishable_')) throw new Error('Expected the project publishable key.');
  return key;
}
async function enabled(key: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Could not read provider availability.'); return (await response.json() as any).external?.google === true;
}
async function renderVariable(name: string, value: string) {
  const config = readFileSync(join(homedir(), '.render', 'cli.yaml'), 'utf8');
  let token = config.match(/^\s+key:\s*(.+)$/m)?.[1]?.trim();
  if (token?.startsWith('"')) token = JSON.parse(token);
  else if (token?.startsWith("'")) token = token.slice(1, -1);
  if (!token || !/^[A-Za-z0-9_.-]+$/.test(token)) throw new Error('Refresh Render CLI authentication first.');
  const response = await fetch(`https://api.render.com/v1/services/${state.service}/env-vars/${name}`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ value }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Render configuration failed (${response.status}).`);
}
async function main() {
  const key = await publicKey(); const mode = process.argv[2] || 'status';
  if (mode === 'status') { console.log(`Google provider: ${await enabled(key) ? 'enabled' : 'not enabled'}\nGoogle callback: ${callback}\nLive app callback: ${state.url}/auth/callback\nLocal app callback: http://localhost:3210/auth/callback`); return; }
  if (mode !== 'enable' || !process.argv[3]) throw new Error('Use status, or enable <downloaded-Google-web-client.json>. Never paste credentials into chat.');
  const source = resolve(process.argv[3]);
  if (source.startsWith(resolve('.') + '\\') || source.startsWith(resolve('.') + '/')) throw new Error('Keep the Google credentials file outside the repository.');
  const web = JSON.parse(readFileSync(source, 'utf8')).web;
  if (!web || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(web.client_id) || typeof web.client_secret !== 'string' || !web.client_secret || !web.redirect_uris?.includes(callback)) throw new Error('Expected a Google Web application client JSON with the exact Supabase callback.');
  const work = join(privateDir, 'google-auth'); mkdirSync(join(work, 'supabase'), { recursive: true });
  writeFileSync(join(work, `client-${Date.now()}.dpapi`), await protectCredential(JSON.stringify(web)), { mode: 0o600, flag: 'wx' });
  writeFileSync(join(work, 'supabase', 'config.toml'), `project_id = "just-us-google"\n[auth]\nsite_url = ${JSON.stringify(state.url)}\nadditional_redirect_urls = [${JSON.stringify(state.url + '/auth/callback')}, "http://localhost:3210/auth/callback"]\n[auth.external.google]\nenabled = true\nclient_id = ${JSON.stringify(web.client_id)}\nsecret = "env(JUST_US_GOOGLE_CLIENT_SECRET)"\nskip_nonce_check = false\n`, { mode: 0o600 });
  const args = ['--project-ref', state.project, '--workdir', work, '--output-format', 'json'];
  const env = { JUST_US_GOOGLE_CLIENT_SECRET: web.client_secret };
  const diff = payload(cli(['config', 'diff', ...args], env));
  const allowed = new Set(['auth.site_url', 'auth.additional_redirect_urls', 'auth.external.google.enabled', 'auth.external.google.client_id', 'auth.external.google.secret', 'auth.external.google.skip_nonce_check']);
  if (diff.changes?.some((change: any) => change.class === 'update' && !allowed.has(change.path.join('.')))) throw new Error('Unexpected configuration changes; review before enabling.');
  const pushed = payload(cli(['config', 'push', ...args, '--yes'], env));
  if (pushed.declined_addons?.length || pushed.unsupported?.length) throw new Error('Provider configuration needs review.');
  if (!await enabled(key)) throw new Error('Google provider is not reporting enabled yet; retry status shortly.');
  await renderVariable('SUPABASE_URL', supabaseUrl); await renderVariable('SUPABASE_PUBLISHABLE_KEY', key);
  const localPath = resolve('.env'); let local = existsSync(localPath) ? readFileSync(localPath, 'utf8') : '';
  for (const [name, value] of [['SUPABASE_URL', supabaseUrl], ['SUPABASE_PUBLISHABLE_KEY', key]]) { const line = new RegExp(`^${name}=.*$`, 'm'); local = line.test(local) ? local.replace(line, `${name}=${value}`) : local.trimEnd() + `\n${name}=${value}\n`; }
  writeFileSync(localPath, local, { mode: 0o600 });
  console.log('Google provider enabled. Live and local app configuration saved. No Google secret was placed in app code or printed. Run npm run cloud -- deploy, then restart the local preview and complete a real Google sign-in.');
}
main().catch(() => { console.error('Google setup did not complete. Credentials were not printed. Check provider status and the private configuration before retrying.'); process.exitCode = 1; });
