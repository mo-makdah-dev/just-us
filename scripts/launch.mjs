import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
if (existsSync('.env')) process.loadEnvFile('.env');
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
const url = `http://localhost:${port}`;
async function probe() {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1500) });
    const body = await response.json().catch(() => null);
    return body?.ok === true && body?.service === 'just-us' ? (body.mode === 'online-data' ? 'ours' : 'isolated') : 'occupied';
  } catch (error) {
    return error?.cause?.code === 'ECONNREFUSED' ? 'absent' : 'occupied';
  }
}
function openBrowser() {
  console.log(`Just Us is ready: ${url}`);
  if (process.env.JUST_US_NO_OPEN === '1') return;
  const args = ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `Start-Process '${url}'`];
  const opener = spawn('powershell.exe', args, { windowsHide: true, stdio: 'ignore' });
  opener.on('error', () => console.log(`Open ${url} in your browser.`));
  opener.unref();
}
const status = await probe();
if (status === 'ours') {
  console.log('Just Us is already running. Reusing the existing server.');
  openBrowser();
} else if (status === 'isolated') {
  console.error('The isolated server is running. Close it and start Just Us again to use online data.');
  process.exitCode = 1;
} else if (status === 'occupied') {
  console.error(`Another service is using port ${port}, or the existing server is not responding. Close it and try again.`);
  process.exitCode = 1;
} else {
  console.log('Starting Just Us. Keep this window open while testing.');
  const server = spawn(process.execPath, ['--import', 'tsx', 'scripts/live-preview.ts'], { stdio: 'inherit', windowsHide: true });
  let stopped = false;
  server.on('exit', code => { stopped = true; process.exitCode = code ?? 1; });
  server.on('error', error => { stopped = true; console.error(error.message); process.exitCode = 1; });
  process.on('SIGINT', () => server.kill('SIGINT'));
  process.on('SIGTERM', () => server.kill('SIGTERM'));
  let ready = false;
  for (let attempt = 0; attempt < 120 && !stopped; attempt++) {
    if (await probe() === 'ours') { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (ready && !stopped) openBrowser();
  else if (!stopped) { console.error('Startup timed out. See the server error above.'); server.kill(); process.exitCode = 1; }
}
