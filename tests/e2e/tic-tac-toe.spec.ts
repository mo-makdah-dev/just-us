import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { roomOptions } from './room-navigation.js';
async function create(page: Page, name: string) {
  await page.goto('/'); await page.getByRole('button', { name: 'Create a room', exact: true }).click();
  await page.getByLabel('What should we call you?').fill(name); await page.getByRole('button', { name: 'Create our little room' }).click();
  await expect(page.getByText('Room connected', { exact: true })).toBeVisible();
}
async function join(page: Page, code: string, name: string, signedIn = false) {
  await page.goto(`/#invite=${code}`); await page.getByLabel('What should we call you?').fill(name);
  await page.getByRole('button', { name: signedIn ? 'Join their room' : 'Join as a visitor', exact: true }).click();
  await expect(page.getByText('Room connected', { exact: true })).toBeVisible();
}
async function snapshot(page: Page) { return page.evaluate(async () => (await (await fetch('/api/session')).json()).data.room.ticTacToe); }
async function openGame(page: Page) { await page.getByRole('button', { name: 'Open game library' }).click(); await page.getByRole('button', { name: 'Play Tic-tac-toe', exact: true }).click(); await expect(page.getByLabel('Play mode')).toBeVisible(); }
async function signup(page: Page, name: string) {
  await page.goto('/'); await page.getByRole('button', { name: 'Join free', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Create a free account' });
  await dialog.getByLabel('Username', { exact: true }).fill(`ttt_${name}_${Date.now()}`);
  await dialog.getByLabel('Password', { exact: true }).fill('a unique game test password');
  await dialog.getByLabel('Nickname', { exact: true }).fill(name); await dialog.getByRole('button', { name: 'Create my free account' }).click();
  await page.getByRole('button', { name: 'I’ve saved my recovery key' }).click();
}
test('a guest owner selects two other players; spectators watch, refresh restores play and rematches swap sides', async ({ browser }) => {
  test.setTimeout(90000);
  const contexts = await Promise.all([browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), browser.newContext(), browser.newContext({ viewport: { width: 320, height: 740 } })]);
  const [a, b, c] = await Promise.all(contexts.map(c => c.newPage()));
  try {
    await create(a, 'Alex'); await join(b, await a.getByLabel('Visitor code', { exact: true }).inputValue(), 'Blair');
    await roomOptions(a, 'Invite someone'); await a.getByRole('button', { name: 'New visitor code', exact: true }).click();
    await expect(a.getByLabel('Visitor code', { exact: true })).toHaveValue(/^[A-Z2-9]{10}$/);
    await join(c, await a.getByLabel('Visitor code', { exact: true }).inputValue(), 'Casey');
    await openGame(a); await c.getByRole('button', { name: 'Raise my hand', exact: true }).click();
    await expect(a.getByText('Ready to play: Casey', { exact: true })).toBeVisible();
    await a.getByRole('checkbox', { name: /^Blair/ }).check(); await a.getByRole('checkbox', { name: /^Casey/ }).check();
    await a.getByRole('button', { name: 'Start selected match' }).click();
    await expect(a.getByRole('button', { name: 'Row 1, column 1: empty', exact: true })).toBeDisabled();
    let game = await snapshot(a); const pages: Record<string, Page> = { Blair: b, Casey: c };
    for (const [index, cell] of [0, 3, 1, 4, 2].entries()) {
      game = await snapshot(a); const player = pages[game.match.turn === 'X' ? game.match.x.name : game.match.o.name];
      await player.getByRole('button', { name: `Row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}: empty`, exact: true }).click();
      await expect(a.getByRole('button', { name: `Row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}: ${index % 2 ? 'O' : 'X'}`, exact: true })).toBeVisible();
      if (index === 1) { await c.reload(); await expect(c.getByText('Room connected', { exact: true })).toBeVisible(); await expect(c.getByRole('button', { name: 'Row 1, column 1: X', exact: true })).toBeVisible(); }
    }
    game = await snapshot(a); expect(game.match.status).toBe('won'); const originalX = game.match.x.id;
    await a.getByText('Room scoreboard', { exact: true }).click(); await expect(a.locator('.game-scores tbody tr')).toHaveCount(2);
    expect((await new AxeBuilder({ page: a }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await a.screenshot({ path: 'test-results/tic-tac-toe-phone.png', fullPage: true });
    expect(await c.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await a.getByRole('button', { name: 'Rematch · swap X/O' }).click(); game = await snapshot(a); expect(game.match.o.id).toBe(originalX);
    const resigning = pages[game.match.o.name]; await resigning.getByRole('button', { name: 'Resign this match' }).click(); await resigning.getByRole('button', { name: 'Confirm resign', exact: true }).click();
    await expect.poll(async () => (await snapshot(a)).match.status).toBe('forfeit');
    expect((await snapshot(a)).scores.every((s: { played: number }) => s.played === 2)).toBe(true);
    await a.getByRole('button', { name: 'Return everyone to the room' }).click(); await expect(a.getByRole('button', { name: 'Open game library' })).toBeVisible();
  } finally { await Promise.all(contexts.map(c => c.close())); }
});

test('a points league completes both sides, retains room scores and exposes only personal profile totals', async ({ browser }) => {
  test.setTimeout(90000);
  const ca = await browser.newContext(), cb = await browser.newContext(); const a = await ca.newPage(), b = await cb.newPage();
  try {
    await signup(a, 'Avery'); await signup(b, 'Blair'); await create(a, 'Avery');
    await join(b, await a.getByLabel('Visitor code', { exact: true }).inputValue(), 'Blair', true); await openGame(a);
    await a.getByLabel('Play mode').selectOption('league'); await a.getByRole('checkbox', { name: /^Avery/ }).check(); await a.getByRole('checkbox', { name: /^Blair/ }).check();
    await a.getByRole('button', { name: 'Start tournament', exact: true }).click();
    await expect(a.locator('.game-fixtures li')).toHaveCount(2);
    for (let round = 0; round < 2; round++) {
      await a.getByRole('button', { name: 'Next tournament match' }).click();
      for (const cell of [0, 3, 1, 4, 2]) {
        const game = await snapshot(a); const page = (game.match.turn === 'X' ? game.match.x.name : game.match.o.name) === 'Avery' ? a : b;
        await page.getByRole('button', { name: `Row ${Math.floor(cell / 3) + 1}, column ${cell % 3 + 1}: empty`, exact: true }).click();
        await expect.poll(async () => (await snapshot(a)).match.board[cell]).not.toBeNull();
      }
    }
    await expect(a.getByText('Avery & Blair share first place!', { exact: true }).or(a.getByText('Blair & Avery share first place!', { exact: true }))).toBeVisible();
    const personal = await a.evaluate(async () => (await (await fetch('/api/session')).json()).data.gameScores);
    expect(personal).toMatchObject({ played: 2, wins: 1, losses: 1, points: 3 });
    await a.getByRole('button', { name: 'My account', exact: true }).first().click(); await a.getByRole('button', { name: 'My game scores', exact: true }).click();
    await expect(a.locator('.game-scores tbody tr')).toHaveCount(1); await expect(a.getByText('2 games · 0 forfeits. Saved across your rooms.')).toBeVisible();
    await a.reload(); await a.getByRole('button', { name: 'My game scores', exact: true }).click(); await expect(a.locator('.game-scores tbody tr')).toHaveCount(1);
  } finally { await ca.close(); await cb.close(); }
});
