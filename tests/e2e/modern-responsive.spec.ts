import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const sizes = [{width:1440,height:1000},{width:1024,height:900},{width:820,height:1180},{width:390,height:844},{width:360,height:800}];
async function capture(page:Page, name:string, widths=sizes) {
  for(const viewport of widths) { await page.setViewportSize(viewport); await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({path:`test-results/redesign-preview/${name}-${viewport.width}.png`,fullPage:true}); }
}
test('cozy modern surfaces adapt to laptop, tablet and mobile with accessible controls', async ({page,browser})=>{
  test.setTimeout(180000);
  const issues:{page:string;id:string;nodes:string[]}[]=[];
  const audit=async(name:string)=>{const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();for(const v of result.violations)issues.push({page:name,id:v.id,nodes:v.nodes.map(n=>n.target.join(' '))});};
  await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();await capture(page,'landing');await page.setViewportSize(sizes[0]);await audit('landing');
  await page.getByRole('button',{name:'Join free',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Create a free account'});
  await dialog.getByLabel('Username',{exact:true}).fill(`cozy_${Date.now()}`);await dialog.getByLabel('Password',{exact:true}).fill('a unique cozy test password');await dialog.getByLabel('Nickname',{exact:true}).fill('Alex');await dialog.getByRole('button',{name:'Create my free account'}).click();await expect(page).toHaveURL(/dashboard$/);await page.getByRole('button',{name:'Dismiss message',exact:true}).click();
  await capture(page,'dashboard');
  const nav=page.getByRole('link',{name:'Your people',exact:true});const box=await nav.boundingBox();expect(box!.y).toBeGreaterThan(650);await nav.click();await expect(page.getByRole('heading',{name:'Your favourite people.',exact:true})).toBeVisible();
  await capture(page,'people');await page.setViewportSize(sizes[0]);await audit('people');
  await page.getByRole('link',{name:'Account settings',exact:true}).click();await page.getByRole('button',{name:'Change',exact:true}).click();await capture(page,'settings');await page.setViewportSize(sizes[0]);await audit('settings');
  await page.locator('.account-nav-button').click();await capture(page,'profile');await page.getByRole('button',{name:'Draw custom avatar',exact:true}).click();await capture(page,'studio',[sizes[0],sizes[3]]);await page.getByRole('button',{name:'Cancel drawing',exact:true}).click();await page.setViewportSize(sizes[0]);await audit('profile');
  await page.getByRole('link',{name:'Dashboard',exact:true}).click();await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('Room name',{exact:true}).fill('Our cozy corner');await page.getByRole('button',{name:'Create our little room',exact:true}).click();await expect(page.getByText('Room connected',{exact:true})).toBeVisible();
  const code=await page.evaluate(async()=> (await (await fetch('/api/session')).json()).data.room.code);
  const other=await browser.newContext();try{const guest=await other.newPage();await guest.goto('/#invite='+code);await guest.getByRole('button',{name:'Join as a guest',exact:true}).click();await guest.getByLabel('What should we call you?',{exact:true}).fill('Jamie');await guest.getByRole('button',{name:'Join as a visitor',exact:true}).click();await expect(page.locator('.room-person-chip')).toHaveCount(2);
    await capture(page,'room');await page.setViewportSize(sizes[0]);await audit('room');
    await page.getByRole('button',{name:'Open game library',exact:true}).click();await capture(page,'games',[sizes[0],sizes[2],sizes[3]]);await page.setViewportSize(sizes[0]);await audit('games');
    const disabled=page.getByRole('button',{name:'Play Bingo — coming soon',exact:true});await expect(disabled).toBeDisabled();expect(await disabled.evaluate(el=>getComputedStyle(el).cursor)).toBe('default');
    await page.getByRole('button',{name:'Play Tic-tac-toe',exact:true}).click();await capture(page,'character-select',[sizes[0],sizes[2],sizes[3],sizes[4]]);await page.setViewportSize(sizes[0]);await audit('character-select');await page.getByRole('checkbox',{name:/Alex/}).check();await page.getByRole('checkbox',{name:/Jamie/}).check();await page.getByRole('button',{name:'Start selected match',exact:true}).click();await expect(page.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();await capture(page,'playing',[sizes[0],sizes[2],sizes[3]]);
    await expect(guest.getByRole('button',{name:'Watch Tic-tac-toe',exact:true})).toBeVisible();
    await expect(guest.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toHaveCount(0);
    await guest.getByRole('button',{name:'Watch Tic-tac-toe',exact:true}).click();
    await expect(guest.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole('button',{name:'Watch Tic-tac-toe',exact:true})).toBeVisible();
    await expect(guest.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toHaveCount(0);
    await page.getByRole('button',{name:'← Living room',exact:true}).click();
    await expect(page.getByRole('button',{name:'TV off — no game in progress',exact:true})).toBeVisible();
    await expect.poll(async()=>page.evaluate(async()=> (await (await fetch('/api/session')).json()).data.room.ticTacToe.match)).toBeNull();
  }finally{await other.close();}
  console.log(JSON.stringify(issues));expect(issues).toEqual([]);
});
