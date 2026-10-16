import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, X509Certificate } from 'node:crypto';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
const local = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'deployment');
type State = { repository?: string; org?: string; project?: string; projectName?: string; service?: string; serviceName?: string; url?: string };
const statePath = join(local, 'resources.json');
const passwordPath = join(local, 'database-password.dpapi');
const supabase = [process.execPath, join(root, 'node_modules/supabase/dist/supabase.js')];
const gh = process.platform === 'win32' && existsSync('C:/Program Files/GitHub CLI/gh.exe') ? 'C:/Program Files/GitHub CLI/gh.exe' : 'gh';
const renderPath = join(homedir(), 'AppData/Local/Microsoft/WinGet/Links/render.exe');
const render = process.platform === 'win32' && existsSync(renderPath) ? renderPath : 'render';
const hidden: string[] = [];
export const redact = (text: string, secrets: string[]) => secrets.filter(Boolean).reduce((value, secret) => value.split(secret).join('[redacted]'), text)
  .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database URL redacted]').replace(/\b(?:gh[pousr]_|sbp_)[A-Za-z0-9_]+/g, '[token redacted]');
export function sessionUrl(raw: string, password: string) {
  const url = new URL(raw.trim());
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.pooler.supabase.com') || !url.username.startsWith('postgres.')) throw new Error('Expected the dedicated Supabase shared pooler connection. Copy Session pooler from Connect if discovery changed.');
  url.port = '5432'; url.password = password; url.search = ''; return url.toString();
}
export function renderArguments(repository: string, name: string, secretFile: string) {
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(repository)) throw new Error('A GitHub repository URL is required.');
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Invalid service name.');
  return ['services', 'create', '--name', name, '--type', 'web_service', '--runtime', 'node', '--plan', 'free', '--num-instances', '1',
    '--region', 'virginia', '--repo', repository, '--auto-deploy=false', '--build-command', 'npm ci --include=dev && npm run build && npm prune --omit=dev',
    '--start-command', 'npm start', '--health-check-path', '/ready', '--secret-file', `just-us.env:${secretFile}`,
    '--env-var', 'NODE_VERSION=24', '--env-var', 'NODE_ENV=production', '--env-var', 'HOST=0.0.0.0', '--env-var', 'TRUST_PROXY=1', '--output', 'json', '--confirm'];
}
async function run(command: string[], interactive = false, extraEnv: Record<string, string> = {}) {
  return new Promise<string>((resolveResult, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: root, windowsHide: !interactive, shell: false,
      env: { ...process.env, RENDER_CLI_DISABLE_ANALYTICS: '1', ...extraEnv }, stdio: interactive ? 'inherit' : ['ignore', 'pipe', 'pipe'] });
    let output = '', error = '';
    child.stdout?.on('data', value => { output += value; }); child.stderr?.on('data', value => { error += value; });
    child.on('error', error => reject(new Error(`${command[0]} is unavailable: ${error.message}`)));
    child.on('exit', code => code === 0 ? resolveResult(output.trim()) : reject(new Error(redact(`${command[0]} failed (${code}). ${error || output}`, hidden).slice(-1500))));
  });
}
// CLI JSON envelopes changed in Supabase 2.121. Validate identities before saving resources.
function json(raw: string): any {
  const result = JSON.parse(raw);
  if (result?._tag === 'Error') throw new Error('The provider rejected the command. Check account authorization and free quotas.');
  return result?._tag === 'Success' ? result.data ?? result.result ?? result.value : result;
}
const list = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.projects) ? value.projects : Array.isArray(value?.organizations) ? value.organizations : [];
const save = (state: State) => { mkdirSync(local, { recursive: true }); writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 }); };
export async function protectCredential(value: string, decrypt = false) {
  if (process.platform !== 'win32') throw new Error('This setup assistant protects its password with Windows DPAPI. Use the manual guide on other platforms.');
  const script = decrypt
    ? '$null=[Reflection.Assembly]::LoadWithPartialName("System.Security"); $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); [Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))'
    : '$null=[Reflection.Assembly]::LoadWithPartialName("System.Security"); $bytes=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); [Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))';
  const output = await new Promise<string>((resolveResult, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let output = ''; child.stdout.on('data', data => { output += data; }); child.on('error', reject);
    child.on('exit', code => code === 0 ? resolveResult(output.trim()) : reject(new Error('Windows credential protection failed.')));
    child.stdin.end(value);
  });
  return output;
}
async function password(value?: string) {
  mkdirSync(local, { recursive: true });
  if (value === undefined) return protectCredential(readFileSync(passwordPath, 'utf8'), true);
  const encrypted = await protectCredential(value); writeFileSync(passwordPath, encrypted, { mode: 0o600 }); return encrypted;
}
async function status(state: State) {
  const checks: Array<[string, string[]]> = [ ['GitHub', [gh, 'auth', 'status']], ['Supabase', [...supabase, 'projects', 'list', '--output-format', 'json']], ['Render', [render, 'whoami', '--output', 'json']] ];
  for (const [name, command] of checks) {
    try { await run(command); console.log(`${name}: authorized`); } catch { console.log(`${name}: sign-in required (or CLI/network unavailable)`); }
  }
  console.log(`Repository: ${state.repository || 'not created'}`);
  console.log(`Database project: ${state.project || 'not created'}`);
  console.log(`Website: ${state.url || state.service || 'not created'}`);
}
async function repository(state: State) {
  const user = json(await run([gh, 'api', 'user']));
  if (!/^[A-Za-z0-9-]+$/.test(user.login)) throw new Error('Could not determine the signed-in GitHub user.');
  const target = `${user.login}/just-us`;
  const url = `https://github.com/${target}`;
  let remote = ''; try { remote = await run(['git', 'remote', 'get-url', 'origin']); } catch { /* New repository. */ }
  if (remote && remote.replace(/\.git$/, '') !== url) throw new Error('This checkout has another origin remote. Ask the assistant to review it before publishing.');
  let existing: any;
  try { existing = json(await run([gh, 'repo', 'view', target, '--json', 'url,isPrivate'])); }
  catch { /* Creation below will fail safely if unavailable or already owned. */ }
  if (existing && !existing.isPrivate) throw new Error('Expected a private repository. No source was pushed.');
  for (const [key, value] of [['user.name', user.name || user.login], ['user.email', `${user.id}+${user.login}@users.noreply.github.com`]]) {
    try { await run(['git', 'config', '--get', key]); } catch { await run(['git', 'config', '--local', key, value]); }
  }
  await run(['git', 'add', '--', '.dockerignore', '.env.example', '.github', '.gitignore', 'Dockerfile', 'PROJECT_PLAN.md', 'README.md', 'Start Just Us.cmd', 'Connect Just Us.cmd', 'apps', 'docs', 'package-lock.json', 'package.json', 'packages', 'playwright.config.ts', 'render.yaml', 'scripts', 'tests', 'tsconfig.json', 'tsconfig.server.json', 'vitest.config.ts']);
  const staged = await run(['git', 'diff', '--cached', '--name-only']);
  if (staged.split('\n').some(path => /(^|\/)(?:\.env(?:\..+)?|.*\.sqlite(?:-wal|-shm)?|.*\.secret)$/.test(path) && !path.endsWith('.env.example'))) throw new Error('A private runtime file was staged. No source was pushed.');
  const patch = await run(['git', 'diff', '--cached']);
  if (/(?:ghp_[A-Za-z0-9]{30,}|sbp_[A-Za-z0-9]{30,})/.test(patch)) throw new Error('A possible provider credential was staged. No source was pushed.');
  if (staged) await run(['git', 'commit', '-m', 'Prepare Just Us accounts, rooms and free deployment']);
  if (!existing) await run([gh, 'repo', 'create', target, '--private', '--source', root, '--remote', 'origin']);
  else if (!remote) await run(['git', 'remote', 'add', 'origin', url]);
  await run([gh, 'auth', 'setup-git']);
  const branch = await run(['git', 'branch', '--show-current']); if (!branch) throw new Error('Select a branch before publishing.');
  await run(['git', 'push', '-u', 'origin', branch]); state.repository = url; save(state); console.log(`Private source published: ${url}`);
}
async function database(state: State, freeOrg?: string) {
  if (!freeOrg || !/^[a-zA-Z0-9_-]+$/.test(freeOrg)) throw new Error('First confirm your organization is on Free in Supabase billing. Then use: npm run cloud -- database --free-org ORGANIZATION_ID');
  if (state.org && state.org !== freeOrg) throw new Error('A different organization is already recorded; review the existing project first.');
  const organizations = list(json(await run([...supabase, 'orgs', 'list', '--output-format', 'json'])));
  const org = organizations.find(value => value.id === freeOrg || value.slug === freeOrg);
  if (!org) throw new Error('The selected organization is not accessible with this Supabase login.');
  const plan = org.plan ?? org.subscription?.plan ?? org.tier;
  if (plan && String(plan).toLowerCase() !== 'free') throw new Error('This organization reports a paid plan. No project was created.');
  if (!existsSync(passwordPath)) { if (state.project) throw new Error('Saved database password is missing. Do not reset a live database automatically.'); await password(randomBytes(32).toString('hex')); }
  const secret = await password(); hidden.push(secret);
  state.org = freeOrg; state.projectName ||= `just-us-${randomBytes(4).toString('hex')}`; save(state);
  const projects = list(json(await run([...supabase, 'projects', 'list', '--output-format', 'json'])));
  const matches = projects.filter(value => value.name === state.projectName && (value.organization_id === freeOrg || value.organization_slug === freeOrg));
  if (matches.length > 1) throw new Error('Multiple matching projects found. Review them instead of creating another.');
  if (!state.project && matches[0]) state.project = matches[0].id ?? matches[0].ref;
  if (!state.project) {
    const result = json(await run([...supabase, 'projects', 'create', state.projectName, '--org-id', freeOrg, '--region', 'us-east-1', '--db-password', secret, '--output-format', 'json']));
    const project = result?.project ?? result;
    state.project = project.id ?? project.ref;
    if (!state.project) throw new Error('Creation returned an unfamiliar response. Rerun to discover the recorded project name; do not create manually.');
  }
  if (!/^[a-z]{20}$/.test(state.project!)) throw new Error('Unrecognized Supabase project ID.');
  save(state); console.log(`Database project recorded: ${state.project}. Provisioning can take a few minutes.`);
}
async function deploy(state: State) {
  if (!state.repository || !state.project || !existsSync(passwordPath)) throw new Error('Complete repository and database setup first.');
  if (state.service) {
    await run([render, 'deploys', 'create', state.service, '--wait', '--output', 'json', '--confirm']); console.log('Deployment completed. Run npm run cloud -- verify.'); return;
  }
  const secret = await password(); hidden.push(secret);
  const work = join(local, 'supabase-link'); mkdirSync(work, { recursive: true });
  if (!existsSync(join(work, 'supabase/config.toml'))) await run([...supabase, 'init', '--workdir', work, '--yes']);
  await run([...supabase, 'link', '--project-ref', state.project, '--workdir', work, '--yes'], false, { SUPABASE_DB_PASSWORD: secret });
  const poolerPath = join(work, 'supabase/.temp/pooler-url');
  if (!existsSync(poolerPath)) throw new Error('CLI connection discovery changed. Ask the assistant to use the Connect → Session pooler URL, stored privately.');
  const connection = sessionUrl(readFileSync(poolerPath, 'utf8'), secret); hidden.push(connection);
  // Same public CA download used by Supabase's official dashboard configuration.
  const caPath = join(local, 'supabase-ca.crt');
  const caResponse = await fetch('https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt', { signal: AbortSignal.timeout(15000) });
  if (!caResponse.ok) throw new Error('Could not download the official Supabase CA. No service was created.');
  const ca = await caResponse.text(); const certificate = new X509Certificate(ca);
  if (!certificate.ca || !certificate.subject.includes('Supabase') || Date.parse(certificate.validTo) <= Date.now()) throw new Error('Unexpected or expired Supabase CA.');
  writeFileSync(caPath, ca, { mode: 0o600 });
  // TLS must verify before any service is created. There is no insecure fallback.
  const probe = new pg.Pool({ connectionString: connection, ssl: { rejectUnauthorized: true, ca }, connectionTimeoutMillis: 10000 });
  try { await probe.query('SELECT 1'); } finally { await probe.end(); }
  state.serviceName ||= state.projectName!; save(state);
  const services = list(json(await run([render, 'services', '--output', 'json']))).map(value => value.service ?? value);
  const found = services.filter(value => value.name === state.serviceName);
  if (found.length) {
    if (found.length !== 1 || found[0].repo?.replace(/\.git$/, '') !== state.repository) throw new Error('A matching service exists with unfamiliar configuration. Review it instead of creating another.');
    state.service = found[0].id; state.url = found[0].serviceDetails?.url; save(state);
    console.log('Existing service recovered. Rerun deploy to retry it.'); return;
  }
  const envFile = join(local, 'upload.env');
  writeFileSync(envFile, `DATABASE_URL=${connection}\n`, { mode: 0o600, flag: 'wx' });
  try {
    const response = json(await run([render, ...renderArguments(state.repository, state.serviceName!, envFile), '--secret-file', `supabase-ca.crt:${caPath}`, '--env-var', 'DATABASE_CA_FILE=/etc/secrets/supabase-ca.crt']));
    const service = response.service ?? response;
    if (!service.id?.startsWith('srv-')) throw new Error('Unfamiliar Render response. Rerun to discover the existing service before retrying.');
    state.service = service.id; state.url = service.serviceDetails?.url ?? service.url; save(state);
    console.log(`Free service created: ${state.service}. Check the initial deployment with npm run cloud -- verify.`);
  } finally { unlinkSync(envFile); }
}
async function verify(state: State) {
  if (!state.service) throw new Error('No service is recorded yet.');
  const services = list(json(await run([render, 'services', '--output', 'json']))).map(value => value.service ?? value);
  const service = services.find(value => value.id === state.service);
  const url = service?.serviceDetails?.url ?? state.url;
  if (!url || new URL(url).protocol !== 'https:') throw new Error('The service does not have a valid HTTPS address yet.');
  state.url = url; save(state);
  const response = await fetch(`${url}/ready`, { signal: AbortSignal.timeout(90000) });
  const ready = await response.json() as { ok?: boolean; storage?: string };
  if (!response.ok || !ready.ok || ready.storage !== 'postgres') throw new Error('Hosted PostgreSQL readiness is not confirmed yet. Check the deployment logs and retry.');
  console.log(`Hosted PostgreSQL is ready: ${url}\nNext: verify two independent browsers, restart persistence and actual phones before sharing publicly.`);
}
export async function main(args = process.argv.slice(2)) {
  const state: State = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {};
  const command = args[0] || 'status';
  if (command === 'status') await status(state);
  else if (command === 'login') {
    for (const [name, tool] of [['GitHub', [gh, 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web']], ['Supabase', [...supabase, 'login']], ['Render', [render, 'login']]] as Array<[string, string[]]>) {
      console.log(`Authorize ${name} in your browser. Create a Free account if needed.`); await run(tool, true);
    }
    await status(state);
  } else if (command === 'repository') await repository(state);
  else if (command === 'database') { const flag = args.indexOf('--free-org'); await database(state, flag >= 0 ? args[flag + 1] : undefined); }
  else if (command === 'deploy') await deploy(state);
  else if (command === 'verify') await verify(state);
  else if (command === 'plan') console.log('Free-only plan: private GitHub just-us → dedicated Supabase Free organization → Render Free Node web service. No resource mutations performed.');
  else throw new Error('Choose status, login, repository, database --free-org ID, deploy, verify, or plan.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(redact(error instanceof Error ? error.message : 'Setup failed.', hidden)); process.exitCode = 1; });
