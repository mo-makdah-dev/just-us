import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const findings = (violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) => violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => `${n.target.join(' ')}: ${n.failureSummary}`) }));

test('initial session waits through a deployment handover without losing guest access', async ({ page }) => {
  let attempts = 0;
  await page.route('**/api/session', async route => {
    if (++attempts <= 2) await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'SERVER_RESTARTING', message: 'Our space is reconnecting.' } }) });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toBeVisible({ timeout: 12000 });
  expect(attempts).toBeGreaterThanOrEqual(3);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Create a room' })).toBeVisible();
});

test('desktop and phone join independently, refresh, recover, and close the shared room', async ({ browser }) => {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const outsider = await browser.newContext();
  const a = await desktop.newPage(); const b = await phone.newPage(); const c = await outsider.newPage();
  const errors: string[] = []; a.on('pageerror', e => errors.push(e.message)); b.on('pageerror', e => errors.push(e.message));
  await a.goto('/'); await expect(a.getByRole('heading', { name: /Different places/ })).toBeVisible();
  await a.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await a.getByRole('button', { name: 'Create a room', exact: true }).click();
  await a.getByLabel('What should we call you?').fill('Alex');
  await a.getByRole('button', { name: 'Create our little room' }).click();
  await expect(a.getByRole('heading', { name: 'Three seats for your favourite people.' })).toBeVisible();
  await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
  const code = await a.getByTestId('room-code').inputValue();
  await b.goto('/'); await b.getByRole('button', { name: 'Join a room', exact: true }).click();
  await b.getByLabel('What should we call you?').fill('Sam'); await b.getByLabel('Room code or invite link').fill(code);
  
  await b.getByRole('button', { name: 'Join as a visitor' }).click();
  await expect(a.getByRole('heading', { name: 'Good company, found.' })).toBeVisible();
  await expect(b.getByRole('heading', { name: 'Good company, found.' })).toBeVisible();
  await expect(a.getByRole('heading', { name: /Sam/ })).toBeVisible();
  await expect(b.getByRole('heading', { name: /Alex/ })).toBeVisible();
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
  await expect.poll(() => b.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await b.screenshot({ path: 'test-results/lobby-phone.png', fullPage: true });
  await a.screenshot({ path: 'test-results/lobby-desktop.png', fullPage: true });
  expect(findings((await new AxeBuilder({ page: b }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations)).toEqual([]);
  await c.goto('/'); await c.getByRole('button', { name: 'Join a room', exact: true }).click();
  await c.getByLabel('What should we call you?').fill('Third'); await c.getByLabel('Room code or invite link').fill(code);
  await c.getByRole('button', { name: 'Join as a visitor' }).click();
  await expect(c.locator('.form-error')).toContainText('invalid or has expired');
  await b.reload(); await expect(b.getByRole('heading', { name: 'Good company, found.' })).toBeVisible();
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
  await phone.setOffline(true);
  // Chromium's network emulation may leave established WebSockets intact.
  // Signal the browser's offline event as a real OS connectivity change would.
  await b.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(a.getByText(/Reconnecting ·/)).toBeVisible({ timeout: 15000 });
  await phone.setOffline(false);
  await b.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(a.getByText(/Reconnecting ·/)).toHaveCount(0);
  await a.getByRole('button', { name: 'Delete room for everyone', exact: true }).click();
  await a.getByRole('button', { name: 'Confirm delete', exact: true }).click();
  await expect(a.getByRole('heading', { name: /Different places/ })).toBeVisible();
  await expect(b.getByRole('heading', { name: /Different places/ })).toBeVisible();
  expect(errors).toEqual([]);
  await desktop.close(); await phone.close(); await outsider.close();
});

test('invitation links join on a 320px screen and dialogs support keyboard navigation', async ({ browser }) => {
  const creator = await browser.newContext(); const mobile = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const a = await creator.newPage(); const b = await mobile.newPage();
  await a.goto('/');
  await a.getByRole('button', { name: 'Create a room', exact: true }).click();
  await a.getByLabel('What should we call you?').fill('Taylor'); await a.getByRole('button', { name: 'Create our little room' }).click();
  await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
  const token = await a.evaluate(() => { const key = Object.keys(sessionStorage).find(k => k.startsWith('just-us-invite:'))!; return sessionStorage.getItem(key); });
  await b.goto(`/#invite=${token}`); await expect(b.getByRole('dialog')).toBeVisible();
  await expect(b).not.toHaveURL(/#invite/);
  await b.getByLabel('What should we call you?').fill('Robin');
  await b.getByRole('button', { name: 'Join as a visitor' }).click();
  await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
  await expect.poll(() => b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await b.getByRole('button', { name: 'Leave this visit', exact: true }).click();
  await expect(b.getByRole('alert').filter({ hasText: 'Leave this visit?' })).toBeVisible(); await b.getByRole('button', { name: 'Cancel', exact: true }).focus(); await b.keyboard.press('Enter');
  await expect(b.getByRole('button', { name: 'Confirm leave', exact: true })).not.toBeVisible();
  await creator.close(); await mobile.close();
});

test('home and identity dialog pass automated WCAG AA checks', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Create a room', exact: true })).toBeEnabled();
  const home = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(findings(home.violations)).toEqual([]);
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  const dialog = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(findings(dialog.violations)).toEqual([]);
});
