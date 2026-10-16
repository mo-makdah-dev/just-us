import { test, expect } from '@playwright/test';

test('selecting text beyond the room dialog keeps its draft open', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  const field = page.getByLabel('What should we call you?');
  await field.fill('My nickname');
  const box = await field.boundingBox();
  if (!box) throw new Error('Nickname field is missing');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(2, 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('dialog', { name: 'Create a room', exact: true })).toBeVisible();
  await expect(field).toHaveValue('My nickname');
  await field.fill('Edited nickname');
  await page.getByRole('button', { name: 'Create our little room' }).click();
  await expect(page.getByRole('heading', { name: /Edited nickname/ })).toBeVisible();
});

test('signed-in players can edit their nickname when creating a room', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Join free', exact: true }).click();
  const signup = page.getByRole('dialog', { name: 'Create a free account' });
  await signup.getByLabel('Username', { exact: true }).fill(`edit_${Date.now()}`);
  await signup.getByLabel('Password', { exact: true }).fill('a unique test password');
  await signup.getByLabel('Nickname', { exact: true }).fill('Original name');
  await signup.getByRole('button', { name: 'Create my free account' }).click();
  await page.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
  await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByLabel('What should we call you?').fill('Updated name');
  await page.getByRole('button', { name: 'Create our little room' }).click();
  await expect(page.getByRole('heading', { name: /Updated name/ })).toBeVisible();
  await page.getByRole('button', { name: 'My account', exact: true }).first().click();
  await expect(page.getByLabel('Nickname', { exact: true })).toHaveValue('Updated name');
});
