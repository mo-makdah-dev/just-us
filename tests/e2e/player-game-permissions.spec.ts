import {test,expect} from '@playwright/test';

test('any player opens a game card by default and only the owner can disable starting games',async({page,browser})=>{
  await page.goto('/');await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('What should we call you?',{exact:true}).fill('Host');await page.getByRole('button',{name:'Create our little room',exact:true}).click();await expect(page.getByText('Room connected',{exact:true})).toBeVisible();
  const code=await page.evaluate(async()=>(await(await fetch('/api/session')).json()).data.room.code);
  const context=await browser.newContext();try{const guest=await context.newPage();await guest.goto('/#invite='+code);await guest.getByRole('button',{name:'Join as a guest',exact:true}).click();await guest.getByLabel('What should we call you?',{exact:true}).fill('Guest');await guest.getByRole('button',{name:'Join as a visitor',exact:true}).click();
    await guest.getByRole('button',{name:'Open game library',exact:true}).click();await expect(guest.locator('.game-play')).toHaveCount(0);await guest.getByRole('button',{name:'Play Tic-tac-toe',exact:true}).locator('.cover-mark').click();await expect(guest.locator('.waiting-modes')).toBeVisible();
    await guest.getByRole('button',{name:'← Living room',exact:true}).click();await expect(page.getByRole('button',{name:'TV off — no game in progress',exact:true})).toBeVisible();
    await page.getByText('Room options',{exact:false}).first().click();await page.locator('summary').filter({hasText:'Room settings'}).click();const setting=page.getByRole('switch',{name:/Let everyone start games/});await expect(setting).toBeChecked();await setting.uncheck();await expect(setting).not.toBeChecked();
    await guest.getByRole('button',{name:'Open game library',exact:true}).click();await expect(guest.getByRole('button',{name:'Play Tic-tac-toe',exact:true})).toBeDisabled();await guest.getByRole('button',{name:'Close game library',exact:true}).click();
    await page.getByRole('button',{name:'Open game library',exact:true}).click();await page.getByRole('button',{name:'Play Tic-tac-toe',exact:true}).click();await guest.getByRole('button',{name:'Watch Tic-tac-toe',exact:true}).click();await expect(guest.locator('.waiting-modes')).toBeVisible();await expect(guest.getByRole('radio').first()).toBeDisabled();await guest.getByRole('button',{name:'Join game',exact:true}).click();await expect(page.locator('.waiting-seat.is-ready')).toHaveCount(2);
    await page.reload();await page.getByText('Room options',{exact:false}).first().click();await page.locator('summary').filter({hasText:'Room settings'}).click();await expect(page.getByRole('switch',{name:/Let everyone start games/})).not.toBeChecked();
  }finally{await context.close();}
});
