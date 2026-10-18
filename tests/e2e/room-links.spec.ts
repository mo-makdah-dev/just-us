import { expect, test } from '@playwright/test';
test('stable room URLs, compact code controls and friend invitation dialog', async ({page,browser}) => {
  await page.goto('/'); await page.getByRole('button',{name:'Join free',exact:true}).click();
  const signup=page.getByRole('dialog',{name:'Create a free account'});
  await signup.getByLabel('Username',{exact:true}).fill(`links_${Date.now()}`);
  await signup.getByLabel('Password',{exact:true}).fill('a unique test password');
  await signup.getByLabel('Nickname',{exact:true}).fill('Room Host');
  await signup.getByRole('button',{name:'Create my free account'}).click();
  await page.getByRole('button',{name:'Create a room',exact:true}).click();
  await page.getByLabel('Room name',{exact:true}).fill('Our linked room');
  await page.getByRole('button',{name:'Create our little room',exact:true}).click();
  await expect(page).toHaveURL(/\/room\/[a-f0-9]{32}$/);
  const permanent=page.url();
  await page.getByText('Room options',{exact:false}).first().click();
  await expect(page.getByLabel('Room URL',{exact:true})).toHaveCount(0);
  await page.locator('summary').filter({hasText:'People & access'}).click();
  await expect(page.locator('.room-roster').getByText('Admin',{exact:true})).toBeVisible();
  await expect(page.locator('.room-roster').getByText('Room Host',{exact:false})).toBeVisible();
  await page.locator('summary').filter({hasText:'Invite someone'}).click();
  const visitor=page.getByLabel('Visitor code',{exact:true}), member=page.getByLabel('Membership code',{exact:true});
  await expect(visitor).toHaveValue(/^[A-Z2-9]{10}$/); await expect(member).toHaveValue(/^[A-Z2-9]{10}$/);
  const oldVisitor=await visitor.inputValue(), oldMember=await member.inputValue();
  await page.getByRole('button',{name:'Refresh visitor code',exact:true}).click();
  await expect(visitor).not.toHaveValue(oldVisitor);
  await page.getByRole('button',{name:'Refresh membership code',exact:true}).click();
  await expect(member).not.toHaveValue(oldMember); expect(page.url()).toBe(permanent);
  await expect(page.getByRole('button',{name:'New visitor code',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Invite a friend',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Invite a friend',exact:true}); await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Choose a friend',{exact:true})).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await page.getByRole('button',{name:'Invite a friend',exact:true}).click(); await page.mouse.click(2,2); await expect(dialog).not.toBeVisible();
  for(const width of [1280,820,390]) {await page.setViewportSize({width,height:900}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); await page.screenshot({path:`test-results/room-invites-${width}.png`,fullPage:true});}
  const context=await browser.newContext(); try {const outsider=await context.newPage();await outsider.goto(permanent);await expect(outsider.getByRole('heading',{name:'A room for your people.',exact:true})).toBeVisible();await expect(outsider.getByRole('heading',{name:'Our linked room',exact:true})).toHaveCount(0);}finally{await context.close();}
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('Room name',{exact:true}).fill('Second room');await page.getByRole('button',{name:'Create our little room',exact:true}).click();await expect(page).not.toHaveURL(permanent);
  await page.goto(permanent);await expect(page.getByRole('heading',{name:'Our linked room',exact:true}).first()).toBeVisible();await expect(page).toHaveURL(permanent);
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();
  const card=page.locator('.visual-lounge-card').filter({hasText:'Our linked room'});
  await expect(card.locator('.lounge-member-tile')).toHaveCount(1);
  await expect(card.getByText('Room Host',{exact:true})).toBeVisible();
  await expect(card.getByText('1 here now',{exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:'Delete room',exact:true})).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Enter room',exact:true})).toHaveCount(0);
  for(const width of [1280,820,390]) {await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/lounge-cards-${width}.png`,fullPage:true});}
  await card.getByRole('link',{name:'Return to Our linked room',exact:true}).click();
  await expect(page).toHaveURL(permanent);
});
