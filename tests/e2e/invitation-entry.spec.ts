import { test, expect } from '@playwright/test';

test('invitation links offer guest entry or login and keep the code out of the form', async ({page,browser})=>{
  await page.goto('/'); await page.getByRole('button',{name:'Create a room',exact:true}).click();
  await page.getByLabel('What should we call you?',{exact:true}).fill('Host');
  await page.getByRole('button',{name:'Create our little room',exact:true}).click();
  await expect(page.getByText('Room connected',{exact:true})).toBeVisible();
  const code=await page.evaluate(async()=>(await(await fetch('/api/session')).json()).data.room.code);
  const guestContext=await browser.newContext(), accountContext=await browser.newContext();
  try {
    const guest=await guestContext.newPage(); await guest.goto('/#invite='+code);
    await expect(guest.getByRole('button',{name:'Log in',exact:true})).toBeVisible();
    await expect(guest.getByLabel('What should we call you?',{exact:true})).toHaveCount(0);
    await guest.getByRole('button',{name:'Join as a guest',exact:true}).click();
    await expect(guest.getByLabel('Room code or invite link',{exact:true})).toHaveCount(0);
    await guest.getByLabel('What should we call you?',{exact:true}).fill('Guest');
    await guest.getByRole('button',{name:'Join as a visitor',exact:true}).click();
    await expect(guest.getByText('Room connected',{exact:true})).toBeVisible();
    const account=await accountContext.newPage(),username=`invited_${Date.now()}`,password='a long invitation password';
    await account.goto('/'); await account.getByRole('button',{name:'Join free',exact:true}).click();
    let dialog=account.getByRole('dialog',{name:'Create a free account',exact:true});
    await dialog.getByLabel('Username',{exact:true}).fill(username);await dialog.getByLabel('Password',{exact:true}).fill(password);await dialog.getByLabel('Nickname',{exact:true}).fill('Member');
    await dialog.getByRole('button',{name:'Create my free account',exact:true}).click();
    await account.locator('.account-nav-button').click();await account.getByRole('button',{name:'Sign out',exact:true}).click();
    await page.getByText('Room options',{exact:false}).first().click(); await page.locator('summary').filter({hasText:'Invite someone'}).click();
    await page.getByRole('button',{name:'Refresh visitor code',exact:true}).click();
    await expect(page.getByLabel('Visitor code',{exact:true})).toHaveValue(/^[A-Z2-9]{10}$/);
    const nextCode=await page.getByLabel('Visitor code',{exact:true}).inputValue();
    await account.goto('/#invite='+nextCode);await account.getByRole('button',{name:'Log in',exact:true}).click();
    dialog=account.getByRole('dialog',{name:'Sign in to Just Us',exact:true});
    await dialog.getByLabel('Username',{exact:true}).fill(username);await dialog.getByLabel('Password',{exact:true}).fill(password);await dialog.getByRole('button',{name:'Sign in to my account',exact:true}).click();
    await expect(account.getByRole('dialog',{name:'Join a room',exact:true})).toBeVisible();
    await expect(account.getByLabel('Room code or invite link',{exact:true})).toHaveCount(0);
    await expect(account.getByLabel('What should we call you?',{exact:true})).toHaveValue('Member');
    await account.getByRole('button',{name:'Join their room',exact:true}).click();
    await expect(account.getByText('Room connected',{exact:true})).toBeVisible();
    await expect(page.locator('.room-person-chip')).toHaveCount(3);
  } finally {await guestContext.close();await accountContext.close();}
});
