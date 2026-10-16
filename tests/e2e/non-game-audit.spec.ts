import { roomOptions, roomView } from './room-navigation.js';
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function register(page: Page, nickname: string) {
  await page.goto('/'); await page.getByRole('button', { name: /Join free/ }).first().click();
  const form = page.getByRole('dialog', { name: 'Create a free account' });
  await form.getByLabel('Username', { exact: true }).fill(`audit_${nickname.toLowerCase()}_${Date.now()}`);
  await form.getByLabel('Password', { exact: true }).fill('a unique audit account password');
  await form.getByLabel('Nickname', { exact: true }).fill(nickname); await form.getByRole('button', { name: 'Create my free account' }).click();
  await page.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
}
test('owners revoke invites and moderate chat; private exports and session controls work on phones', async ({ browser }) => {
  test.setTimeout(120000);
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const bContext = await browser.newContext();
  try {
    const a = await aContext.newPage(), b = await bContext.newPage(); await register(a, 'Avery'); await register(b, 'Blair');
    await a.getByRole('button', { name: 'Help & your data', exact: true }).click(); await expect(a.getByRole('dialog', { name: 'Help & your data' })).toBeVisible();
    expect((await new AxeBuilder({ page: a }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await a.getByRole('button', { name: 'Close help' }).click();
    await a.getByRole('button', { name: 'My account', exact: true }).first().click(); await a.getByRole('button', { name: 'My people', exact: true }).click(); await a.getByRole('button', { name: /Invite a friend/ }).click();
    const link = await a.getByLabel('Private invitation link').inputValue(); await b.goto(link); await b.getByRole('button', { name: 'Accept friend invitation' }).click();
    await a.getByRole('button', { name: 'My rooms', exact: true }).click(); await a.getByRole('button', { name: 'Create a room', exact: true }).click(); await a.getByRole('button', { name: 'Create our little room' }).click(); await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
    await roomOptions(a, 'Invite someone');
    await a.getByLabel('Invite an accepted friend').selectOption({ label: 'Blair' }); await a.getByRole('button', { name: 'Send room invitation', exact: true }).click();
    await expect(a.getByRole('button', { name: 'Cancel invitation', exact: true })).toBeVisible(); await a.getByRole('button', { name: 'Cancel invitation', exact: true }).click(); await expect(a.getByRole('button', { name: 'Cancel invitation', exact: true })).toHaveCount(0);
    await a.getByRole('button', { name: 'New membership code', exact: true }).click(); await expect(a.getByLabel('Membership code', { exact: true })).toHaveValue(/^[A-Z2-9]{10}$/);
    const code = await a.getByLabel('Membership code', { exact: true }).inputValue(); await a.getByRole('button', { name: 'Revoke open codes' }).click(); await expect(a.getByLabel('Membership code', { exact: true })).toHaveValue('');
    await b.goto(`/#invite=${code}`); await b.getByRole('button', { name: 'Join their room', exact: true }).click(); await expect(b.getByRole('dialog').getByRole('alert')).toContainText('invalid or has expired'); await b.getByRole('button', { name: 'Close dialog', exact: true }).click();
    await a.getByRole('button', { name: 'New membership code', exact: true }).click(); await expect(a.getByLabel('Membership code', { exact: true })).toHaveValue(/^[A-Z2-9]{10}$/); const fresh = await a.getByLabel('Membership code', { exact: true }).inputValue();
    await b.goto(`/#invite=${fresh}`); await b.getByRole('button', { name: 'Join their room', exact: true }).click(); await expect(b.getByText('Room connected', { exact: true })).toBeVisible();
    await roomView(a, 'chat'); await roomView(b, 'chat');
    await b.getByLabel('Your message', { exact: true }).fill('Remove my message'); await b.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(a.getByText('Remove my message', { exact: true })).toBeVisible();
    await b.getByLabel('Options for message by Blair', { exact: true }).click();
    await b.getByRole('button', { name: 'Delete message: Remove my message', exact: true }).click(); await expect(a.getByText('Remove my message', { exact: true })).toHaveCount(0);
    await roomView(a, 'chat');
    await a.getByLabel('Your message', { exact: true }).fill('Clear this history'); await a.getByRole('button', { name: 'Send message', exact: true }).click(); await expect(b.getByText('Clear this history', { exact: true })).toBeVisible();
    await roomOptions(a, 'Room settings');
    await a.getByRole('button', { name: 'Clear room chat', exact: true }).click(); await a.getByRole('button', { name: 'Confirm clear chat', exact: true }).click(); await expect(b.getByText('Clear this history', { exact: true })).toHaveCount(0);
    await roomView(a, 'chat');
    await a.getByLabel('Your message', { exact: true }).fill('Do not carry me into another room'); await a.getByRole('button', { name: 'My rooms', exact: true }).click(); await a.getByRole('button', { name: 'Create a room', exact: true }).click(); await a.getByRole('button', { name: 'Create our little room' }).click(); await roomView(a, 'chat'); await expect(a.getByLabel('Your message', { exact: true })).toHaveValue('');
    await a.getByRole('button', { name: 'My account', exact: true }).first().click(); await a.getByRole('button', { name: 'Account security', exact: true }).click();
    const download = a.waitForEvent('download'); await a.getByRole('button', { name: 'Download my data', exact: true }).click(); expect((await download).suggestedFilename()).toBe('just-us-my-data.json');
    await a.getByRole('button', { name: 'Sign out other sessions', exact: true }).click(); await a.getByRole('button', { name: 'Confirm sign out other sessions', exact: true }).click(); await expect(a.getByText('Other sessions are signed out. Your saved rooms and memberships are safe.')).toBeVisible();
    expect((await new AxeBuilder({ page: a }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await a.screenshot({ path: 'test-results/non-game-security-phone.png', fullPage: true });
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.getByRole('button', { name: 'My rooms', exact: true }).click(); await a.locator('.saved-room-card').first().getByRole('button', { name: 'Enter room', exact: true }).click(); await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
    await roomOptions(b);
    await b.locator('.room-safety summary').click(); await b.getByRole('button', { name: 'Block Avery', exact: true }).click(); await b.getByRole('button', { name: 'Confirm block', exact: true }).click(); await expect(b.getByLabel('Your message', { exact: true })).toHaveCount(0);
    await b.getByRole('button', { name: 'My rooms', exact: true }).click(); await expect(b.locator('.saved-room-card').filter({ hasText: 'SAVED MEMBER' })).toHaveCount(0);
  } finally { await aContext.close(); await bContext.close(); }
});
