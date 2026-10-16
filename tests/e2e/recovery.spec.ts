import { expect, test } from '@playwright/test';

test('recovers an account in another browser and changes its password without losing the profile', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    const a = await first.newPage(), b = await second.newPage();
    const username = `recover_${Date.now()}`;
    await a.goto('/');
    await a.getByRole('button', { name: 'Join free', exact: false }).first().click();
    const signup = a.getByRole('dialog', { name: 'Create a free account' });
    await signup.getByLabel('Username', { exact: true }).fill(username);
    await signup.getByLabel('Password', { exact: true }).fill('original browser password');
    await signup.getByLabel('Nickname', { exact: true }).fill('Remember me');
    await signup.getByRole('button', { name: 'Create my free account' }).click();
    await expect(a.getByRole('dialog', { name: 'Save your recovery key' })).toBeVisible();
    await expect(a.getByLabel('Your recovery key', { exact: true })).toHaveValue(/^[a-f0-9]{48}$/);
    const key = await a.getByLabel('Your recovery key', { exact: true }).inputValue();
    await a.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
    await a.getByRole('button', { name: 'My account', exact: true }).first().click();
    await expect(a.getByLabel('Nickname', { exact: true })).toHaveValue('Remember me');
    await b.goto('/account');
    await b.getByRole('button', { name: 'Sign in', exact: true }).first().click();
    await b.getByRole('button', { name: 'Forgot password? Use a recovery key' }).click();
    await b.getByLabel('Username', { exact: true }).fill(username);
    await b.getByLabel('Recovery key', { exact: true }).fill(key);
    await b.getByLabel('New password', { exact: true }).fill('replacement browser password');
    await b.getByRole('button', { name: 'Reset my password' }).click();
    await expect(b.getByLabel('Your recovery key', { exact: true })).not.toHaveValue(key);
    await b.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
    await expect(b.getByLabel('Nickname', { exact: true })).toHaveValue('Remember me');
    await expect(a.getByRole('heading', { name: 'A space that remembers you.' })).toBeVisible();
    await a.reload();
    await expect(a.getByRole('heading', { name: 'A space that remembers you.' })).toBeVisible();
    await b.getByRole('button', { name: 'Account security', exact: true }).click();
    await b.getByLabel('Current password', { exact: true }).fill('replacement browser password');
    await b.getByLabel('New password', { exact: true }).fill('third browser password here');
    await b.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(b.getByText('Your password is changed. Other account sessions have been signed out.')).toBeVisible();
    expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await first.close(); await second.close(); }
});
