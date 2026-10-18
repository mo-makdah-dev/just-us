import { test, expect } from '@playwright/test';
test('names a room at creation and preserves it after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Create a room',exact:true}).click();
  await page.getByLabel('Room name',{exact:true}).fill('Our Friday games');
  await page.getByLabel('What should we call you?',{exact:true}).fill('Host');
  await page.getByRole('button',{name:'Create our little room',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Our Friday games',exact:true}).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Our Friday games',exact:true}).first()).toBeVisible();
});
