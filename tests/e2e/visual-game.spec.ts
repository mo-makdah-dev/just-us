import { test,expect,type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('visual character and mode cards lead into live play, rematches and tournaments',async({page,browser})=>{
  test.setTimeout(90000);
  const trackAudio=()=>{const Original=window.AudioContext;(window as unknown as {turnSounds:number}).turnSounds=0;window.AudioContext=class extends Original {createOscillator(){const oscillator=super.createOscillator(),start=oscillator.start.bind(oscillator);oscillator.start=(when?:number)=>{(window as unknown as {turnSounds:number}).turnSounds++;start(when);};return oscillator;}};};
  await page.addInitScript(trackAudio);
  await page.goto('/');await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('What should we call you?',{exact:true}).fill('Alex');await page.getByRole('button',{name:'Create our little room',exact:true}).click();await expect(page.getByText('Room connected',{exact:true})).toBeVisible();
  const session=(p:Page)=>p.evaluate(async()=>(await(await fetch('/api/session')).json()).data);
  const code=(await session(page)).room.code;
  const context=await browser.newContext();try{
    await context.addInitScript(trackAudio);const other=await context.newPage();await other.goto('/#invite='+code);await other.getByRole('button',{name:'Join as a guest',exact:true}).click();await other.getByLabel('What should we call you?',{exact:true}).fill('Jamie');await other.getByRole('button',{name:'Join as a visitor',exact:true}).click();await expect(page.locator('.room-person-chip')).toHaveCount(2);
    await page.getByRole('button',{name:'Open game library',exact:true}).click();await page.getByRole('button',{name:'Play Tic-tac-toe',exact:true}).click();
    await expect(page.locator('.game-mode-cards label')).toHaveCount(3);await expect(page.locator('.character-card .avatar')).toHaveCount(2);
    await page.getByRole('radio',{name:/League/}).check();await page.getByRole('checkbox',{name:/Alex/}).check();await page.getByRole('checkbox',{name:/Jamie/}).check();await expect(page.getByText('2 entrants · 2 scheduled matches.',{exact:true})).toBeVisible();
    await page.getByRole('radio',{name:/Quick match/}).check();await expect(page.getByRole('checkbox',{name:/Alex/})).not.toBeChecked();
    await page.getByRole('checkbox',{name:/Alex/}).check();await page.getByRole('checkbox',{name:/Jamie/}).check();await expect(page.locator('.lineup-preview .avatar')).toHaveCount(2);
    await page.getByRole('button',{name:'Start selected match',exact:true}).click();await expect(page.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();
    await other.getByRole('button',{name:'Watch Tic-tac-toe',exact:true}).click();
    const original=(await session(page)).room.ticTacToe.match;
    for(const cell of [0,3,1,4,2]) {
      const m=(await session(page)).room.ticTacToe.match;
      const player=(m.turn==='X'?m.x:m.o).name==='Alex'?page:other;
      const button=player.getByRole('button',{name:`Row ${Math.floor(cell/3)+1}, column ${cell%3+1}: empty`,exact:true});await expect(button).toBeEnabled();await button.click();await expect(player.locator('.ttt-board .mark-x,.ttt-board .mark-o')).toHaveCount(m.board.filter(Boolean).length+1);
    }
    await expect.poll(()=>page.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);
    await expect.poll(()=>other.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);
    await page.getByRole('button',{name:'Mute game sounds',exact:true}).click();
    await expect(page.getByRole('button',{name:'Enable game sounds',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>localStorage.getItem('just-us-game-sound'))).toBe('off');
    await expect(page.locator('.match-character.is-winner')).toHaveCount(1);await expect(page.locator('.ttt-cell.winning')).toHaveCount(3);
    const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(scan.violations.map(v=>v.id)).toEqual([]);
    await page.screenshot({path:'test-results/game-winner.png',fullPage:true});
    await page.getByRole('button',{name:'Rematch · swap X/O',exact:true}).click();await expect.poll(async()=>(await session(page)).room.ticTacToe.match.x.id).toBe(original.o.id);
    const rematch=(await session(page)).room.ticTacToe.match;
    const nextPlayer=rematch.x.name==='Alex'?page:other;await nextPlayer.getByRole('button',{name:'Row 1, column 1: empty',exact:true}).click();await expect.poll(()=>other.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(6);expect(await page.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);
    await page.getByRole('button',{name:'End this match',exact:true}).click();await page.getByRole('button',{name:'Confirm end game',exact:true}).click();await page.locator('.game-setup > summary').click();
    await page.getByRole('radio',{name:/League/}).check();await page.getByRole('checkbox',{name:/Alex/}).check();await page.getByRole('checkbox',{name:/Jamie/}).check();await page.getByRole('button',{name:'Start tournament',exact:true}).click();
    await expect(page.locator('.visual-fixtures li')).toHaveCount(2);await page.getByRole('button',{name:'Next tournament match',exact:true}).click();await expect(page.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();
    await page.setViewportSize({width:360,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }finally{await context.close();}
});
