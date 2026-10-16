import { chromium, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn } from 'node:child_process';

const local = join(process.env.LOCALAPPDATA || join(homedir(), '.local', 'share'), 'JustUs', 'deployment');
const state = JSON.parse(readFileSync(join(local, 'resources.json'), 'utf8'));
if (!state.url?.startsWith('https://') || !state.service?.startsWith('srv-')) throw new Error('A recorded HTTPS service is required.');
const url = state.url as string;
const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const outsider = await browser.newContext();
const a = await desktop.newPage(), b = await phone.newPage(), c = await outsider.newPage();
const accounts = new Map<Page, string>();
const password = randomBytes(32).toString('hex');
const errors: string[] = [];
for (const page of [a, b, c]) { page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message)); }
mkdirSync('test-results', { recursive: true });
async function register(page: Page, nickname: string) {
  const username = `qa_${randomBytes(6).toString('hex')}`; accounts.set(page, username);
  await page.goto(url); await page.getByRole('button', { name: /Join free/ }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Create a free account' });
  await dialog.getByLabel('Username', { exact: true }).fill(username);
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByLabel('Nickname', { exact: true }).fill(nickname);
  await dialog.getByRole('button', { name: 'Create my free account' }).click();
  await page.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
  await page.getByRole('button', { name: 'My account', exact: true }).first().click();
}
async function deploy() {
  await new Promise<void>((resolve, reject) => {
    const executable = join(homedir(), 'AppData/Local/Microsoft/WinGet/Links/render.exe');
    const child = spawn(executable, ['deploys', 'create', state.service, '--wait', '--output', 'json', '--confirm'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, RENDER_CLI_DISABLE_ANALYTICS: '1' } });
    let output = ''; child.stdout.on('data', value => { output += value; }); child.stderr.on('data', value => { output += value; });
    child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Render redeploy failed (${code}): ${output.slice(-1000)}`)));
  });
}
try {
  await register(a, 'Alex'); await register(b, 'Sam');
  await a.getByRole('button', { name: 'My people', exact: true }).click();
  await a.getByRole('button', { name: /Invite my special person/ }).click();
  const invitation = await a.getByLabel('Private invitation link', { exact: true }).inputValue();
  await b.goto(invitation); await b.getByRole('button', { name: 'Accept special-person invitation' }).click();
  await expect(b.getByRole('heading', { name: 'Alex', exact: true })).toBeVisible();
  await a.reload(); await a.getByRole('button', { name: 'My people', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Sam', exact: true })).toBeVisible();
  await a.getByLabel(/Your pet name for them/).fill('Sunshine'); await a.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Sunshine', exact: true })).toBeVisible();
  await b.reload(); await b.getByRole('button', { name: 'My people', exact: true }).click();
  await expect(b.getByText('Sunshine', { exact: true })).toHaveCount(0);
  await a.getByRole('button', { name: 'My profile & pixels', exact: true }).click();
  await a.getByRole('button', { name: 'Ink', exact: true }).click();
  await a.getByRole('group', { name: 'Pixel canvas', exact: true }).focus();
  await a.keyboard.press('ArrowRight'); await a.keyboard.press('Space');
  await a.getByRole('button', { name: 'Save my profile', exact: true }).click();
  await expect(a.getByText('Your pixel you is saved. Looking good.')).toBeVisible();
  await a.getByRole('button', { name: /Back to our little space/ }).click();
  await a.getByRole('button', { name: 'Create a room', exact: true }).click();
  await a.getByRole('button', { name: 'Create our little room' }).click();
  await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
  const code = await a.getByTestId('room-code').inputValue();
  await b.getByRole('button', { name: /Back to our little space/ }).click();
  await b.getByRole('button', { name: 'Join a room', exact: true }).click();
  await b.getByLabel('Room code or invite link').fill(code); await b.getByRole('button', { name: 'Join their room' }).click();
  await expect(a.getByRole('heading', { name: 'Good company, found.' })).toBeVisible();
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
  await expect(a.locator('.room-name').filter({ hasText: 'Sunshine' })).toBeVisible();
  await expect(b.locator('.room-name').filter({ hasText: 'Sunshine' })).toHaveCount(0);
  await expect(b.locator('.room-seat-1 .custom-avatar')).toBeVisible();
  await a.getByRole('button', { name: 'sunset room theme', exact: true }).click();
  await expect(b.locator('.room-interior.theme-sunset')).toBeVisible();
  await c.goto(url); await c.getByRole('button', { name: 'Join a room', exact: true }).click();
  await c.getByLabel('What should we call you?').fill('Third'); await c.getByLabel('Room code or invite link').fill(code);
  await c.getByRole('button', { name: 'Join their room' }).click();
  await expect(c.locator('.form-error')).toContainText('already has its two people');
  await b.reload(); await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
  expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const accessibility = await new AxeBuilder({ page: b }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(accessibility.violations.map(value => value.id)).toEqual([]);
  await a.screenshot({ path: 'test-results/hosted-room-desktop.png', fullPage: true });
  await b.screenshot({ path: 'test-results/hosted-room-phone.png', fullPage: true });
  console.log('PASS: live HTTPS signup, private relationships, profile art, two-browser room/theme updates, refresh, third-person refusal and automated phone accessibility.');
  console.log('Starting an actual Render redeploy while both independent browsers remain open.');
  await deploy();
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible({ timeout: 90000 });
  await a.reload(); await b.reload();
  await expect(a.getByTestId('room-code')).toHaveValue(code, { timeout: 60000 });
  await expect(b.getByTestId('room-code')).toHaveValue(code, { timeout: 60000 });
  await expect(b.locator('.room-interior.theme-sunset')).toBeVisible();
  const profile = await a.evaluate(async () => (await (await fetch('/api/session')).json()).data.account);
  expect(profile.username).toBe(accounts.get(a)); expect(profile.avatarDesign.pixels[1]).toBe(1);
  await expect(a.locator('.room-name').filter({ hasText: 'Sunshine' })).toBeVisible();
  expect(errors).toEqual([]);
  console.log('PASS: live Render redeploy preserves signed-in sessions, room seats/code, saved art, pet names and theme.');
} finally {
  try {
    await a.goto(url);
    const close = a.getByRole('button', { name: 'Close for both', exact: true });
    if (await close.isVisible()) { await close.click(); await a.getByRole('button', { name: 'Close the room', exact: true }).click(); }
    for (const [page, username] of accounts) {
      const session = (await (await page.context().request.get(`${url}/api/session`)).json()).data;
      if (session.account?.username !== username) throw new Error('Unexpected test account; refusing deletion.');
      const result = await page.context().request.post(`${url}/api/auth/delete`, { headers: { Origin: url, 'X-CSRF-Token': session.csrf }, data: { confirm: 'DELETE' } });
      if (!result.ok()) throw new Error('Synthetic account cleanup failed; inspect the test context before retrying.');
    }
    console.log('PASS: temporary smoke-test accounts removed and test room closed.');
  } finally { await browser.close(); }
}
