import { test, expect } from '@playwright/test';
test('authentication guards apply to direct loads, return URLs and browser history',async({page})=>{
  await page.goto('/account?section=people');
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount%3Fsection%3Dpeople$/);
  await expect(page.locator('.people-page-panel')).toHaveCount(0);await expect(page.locator('.account-page')).toHaveCount(0);
  await expect(page.getByRole('dialog',{name:'Sign in to Just Us',exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('dialog',{name:'Sign in to Just Us',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Create a free account',exact:true}).click();
  await expect(page).toHaveURL(/\/sign-up\?next=%2Faccount%3Fsection%3Dpeople$/);
  const dialog=page.getByRole('dialog',{name:'Create a free account',exact:true});
  await dialog.getByLabel('Username',{exact:true}).fill(`guard_${Date.now()}`);await dialog.getByLabel('Password',{exact:true}).fill('a unique route test password');await dialog.getByLabel('Nickname',{exact:true}).fill('Guard Player');await dialog.getByRole('button',{name:'Create my free account'}).click();
  await expect(page).toHaveURL(/\/account\?section=people$/);await expect(page.locator('.people-page-panel')).toBeVisible();
  await page.goto('/sign-in');await expect(page).toHaveURL(/\/dashboard$/);await expect(page.getByRole('dialog',{name:'Sign in to Just Us',exact:true})).not.toBeVisible();
  await page.goto('/sign-up?next=https%3A%2F%2Fevil.example');await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/account?section=admin');await expect(page.getByRole('heading',{name:'This page isn’t here.',exact:true})).toBeVisible();await expect(page.locator('.account-page')).toHaveCount(0);
  await page.goto('/account');await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/$/);
  await page.goBack();await expect(page.locator('.account-page')).toHaveCount(0);await expect(page.locator('.dashboard')).toHaveCount(0);
  await page.goto('/dashboard');await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);await expect(page.locator('.dashboard')).toHaveCount(0);
});

test('every private account URL is guarded for a guest',async({page})=>{
  for(const path of ['/dashboard','/account','/account?section=profile','/account?section=people','/account?section=scores','/account?section=security']){
    await page.goto(path);await expect(page).toHaveURL('/sign-in?next='+encodeURIComponent(path));
    await expect(page.locator('.dashboard,.account-page,.people-page-panel,.settings-panel,.personal-game-scores')).toHaveCount(0);
  }
  await page.goto('/unknown-page');await expect(page.getByRole('heading',{name:'This page isn’t here.',exact:true})).toBeVisible();
});
