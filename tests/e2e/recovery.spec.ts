import { expect, test } from '@playwright/test';

test('changes a password from compact settings without recovery or export UI', async ({ page }) => {
  const username = `settings_${Date.now()}`;
  await page.goto('/'); await page.getByRole('button', { name: 'Join free', exact: true }).click();
  const signup = page.getByRole('dialog', { name: 'Create a free account' });
  await signup.getByLabel('Username', { exact: true }).fill(username);
  await signup.getByLabel('Password', { exact: true }).fill('original browser password');
  await signup.getByLabel('Nickname', { exact: true }).fill('Remember me');
  await signup.getByRole('button', { name: 'Create my free account' }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await expect(page.getByRole('dialog', { name: 'Save your recovery key' })).toHaveCount(0);
  await page.getByRole('button', { name: /Account settings Security/ }).click();
  await expect(page.getByRole('button', { name: 'Download my data' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign out other sessions' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Change', exact: true }).click();
  await page.getByLabel('Current password', { exact: true }).fill('original browser password');
  await page.getByLabel('New password', { exact: true }).fill('replacement browser password');
  await page.getByRole('button', { name: 'Show passwords' }).click();
  await expect(page.getByLabel('New password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page.getByText('Password updated.', { exact: true })).toBeVisible();
  const login = await page.request.post('/api/auth/login', { headers: { Origin: 'http://localhost:3211', 'X-CSRF-Token': (await (await page.request.get('/api/session')).json()).data.csrf }, data: { username, password: 'replacement browser password' } });
  expect((await login.json()).ok).toBe(true);
});
