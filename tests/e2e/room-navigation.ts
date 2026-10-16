import type { Page } from '@playwright/test';

export async function roomView(page: Page, view: 'room' | 'chat') {
  if ((page.viewportSize()?.width ?? 1200) <= 760) await page.getByRole('button', { name: view === 'room' ? 'Our room' : /^Chat/, exact: view === 'room' }).click();
}
export async function roomOptions(page: Page, section?: 'Invite someone' | 'People & access' | 'Room settings') {
  await roomView(page, 'room');
  const menu = page.locator('.room-options');
  if (await menu.getAttribute('open') === null) await menu.locator(':scope > summary').click();
  if (section) {
    const group = page.locator('.room-option-group').filter({ has: page.locator('summary', { hasText: section }) });
    if (await group.getAttribute('open') === null) await group.locator(':scope > summary').click();
  }
}
