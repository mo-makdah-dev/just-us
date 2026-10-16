import { test, expect } from '@playwright/test';
test('Google cancellation restores a pending room invitation without storing credentials', async ({ page }) => {
  await page.routeWebSocket('**/socket.io/**', socket => socket.close());
  // Only the test intercept advertises a provider. No production mock/bypass exists.
  await page.route('**/api/session', async route => { const response = await route.fetch(); const body = await response.json(); if (body.ok) body.data.auth.google = true; await route.fulfill({ response, json: body }); });
  await page.route('**/api/auth/google', route => route.fulfill({ json: { ok: true, data: { url: 'http://localhost:3211/?auth=cancelled' } } }));
  await page.goto('/#invite=AB23CD45EF'); await page.getByRole('button', { name: 'Sign in for saved membership & chat →', exact: true }).click();
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Join a room', exact: true })).toBeVisible();
  await expect(page.getByLabel('Room code or invite link')).toHaveValue('AB23CD45EF');
  await expect(page.getByRole('dialog', { name: 'Join a room', exact: true }).getByRole('alert')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('just-us-auth-return'))).toBeNull();
});
