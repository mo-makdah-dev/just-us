import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { roomOptions, roomView } from './room-navigation.js';

test('calm mobile room keeps the library and conversation separate, with live messages', async ({ browser }) => {
  const aContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const bContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const a = await aContext.newPage(), b = await bContext.newPage();
  try {
    for (const [page, name] of [[a, 'Avery'], [b, 'Blair']] as const) {
      await page.goto('/'); await page.getByRole('button', { name: 'Join free', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create a free account' });
      await dialog.getByLabel('Username', { exact: true }).fill(`design_${name}_${Date.now()}`);
      await dialog.getByLabel('Password', { exact: true }).fill('a unique design password');
      await dialog.getByLabel('Nickname', { exact: true }).fill(name);
      await dialog.getByRole('button', { name: 'Create my free account' }).click();
    }
    await a.getByRole('button', { name: 'Create a room', exact: true }).click();
    await a.getByRole('button', { name: 'Create our little room' }).click();
    await expect(a.getByText('Room connected', { exact: true })).toBeVisible();
    await expect(a.getByLabel('Your message', { exact: true })).toBeHidden();
    await expect(a.getByRole('button', { name: 'New visitor code', exact: true })).toBeHidden();
    await a.screenshot({ path: 'test-results/redesign-room-phone.png', fullPage: true });
    await a.getByRole('button', { name: 'Open game library' }).click();
    const library = a.getByRole('dialog', { name: 'The games library.' });
    await expect(library).toBeVisible();
    await expect(library.getByRole('heading', { name: 'Colour Hue' })).toBeVisible();
    await expect(library.getByRole('button', { name: 'Play Colour Hue — coming soon' })).toBeDisabled();
    expect((await new AxeBuilder({ page: a }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await a.screenshot({ path: 'test-results/redesign-library-phone.png', fullPage: true });
    await a.getByRole('button', { name: 'Close game library' }).click();
    await roomOptions(a, 'Invite someone');
    const code = await a.getByLabel('Visitor code', { exact: true }).inputValue();
    await b.getByRole('button', { name: 'Join a room', exact: true }).click();
    await b.getByLabel('Room code or invite link').fill(code);
    await b.getByRole('button', { name: 'Join their room', exact: true }).click();
    await b.getByLabel('Your message', { exact: true }).fill('Hello from the other screen');
    await b.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(a.getByLabel('1 unread messages')).toBeVisible();
    await roomView(a, 'chat');
    await expect(a.getByText('Hello from the other screen', { exact: true })).toBeVisible();
    await expect(a.getByRole('button', { name: 'Open game library' })).toBeHidden();
    const sendPosition = await a.getByRole('button', { name: 'Send message', exact: true }).boundingBox();
    expect(sendPosition).not.toBeNull();
    expect(sendPosition!.y + sendPosition!.height).toBeLessThanOrEqual(844);
    await expect(a.getByRole('button', { name: /Delete message:/ })).toBeHidden();
    await a.getByLabel('Your message', { exact: true }).fill('Hello back');
    await a.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(b.getByText('Hello back', { exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page: a }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.screenshot({ path: 'test-results/redesign-chat-phone.png', fullPage: true });
    await b.screenshot({ path: 'test-results/redesign-room-desktop.png', fullPage: true });
    await a.setViewportSize({ width: 320, height: 740 }); await roomView(a, 'room');
    expect(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.screenshot({ path: 'test-results/redesign-room-small.png', fullPage: true });
  } finally { await aContext.close(); await bContext.close(); }
});
