import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('shared waiting room synchronizes self-joining, readiness and modes before live play',async({page,browser})=>{
  test.setTimeout(90000);
  const trackAudio=()=>{const Original=window.AudioContext;(window as unknown as {turnSounds:number}).turnSounds=0;window.AudioContext=class extends Original {createOscillator(){const oscillator=super.createOscillator(),start=oscillator.start.bind(oscillator);oscillator.start=(when?:number)=>{(window as unknown as {turnSounds:number}).turnSounds++;start(when);};return oscillator;}};};
  await page.addInitScript(trackAudio);
  await page.goto('/');await page.getByRole('button',{name:'Create a room',exact:true}).click();await page.getByLabel('What should we call you?',{exact:true}).fill('Alex');await page.getByRole('button',{name:'Create our little room',exact:true}).click();await expect(page.getByText('Room connected',{exact:true})).toBeVisible();
  const state=(p:Page)=>p.evaluate(async()=>(await(await fetch('/api/session')).json()).data);
  const code=(await state(page)).room.code;
  const context=await browser.newContext();try{
    await context.addInitScript(trackAudio);const other=await context.newPage();await other.goto('/#invite='+code);await other.getByRole('button',{name:'Join as a guest',exact:true}).click();await other.getByLabel('What should we call you?',{exact:true}).fill('Jamie');await other.getByRole('button',{name:'Join as a visitor',exact:true}).click();await expect(page.locator('.room-person-chip')).toHaveCount(2);
    await page.getByRole('button',{name:'Open game library',exact:true}).click();await page.getByRole('button',{name:'Play Tic-tac-toe',exact:true}).click();await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeDisabled();
    await expect(page.locator('.waiting-seat.is-self')).toHaveCount(1);await expect(page.getByRole('checkbox')).toHaveCount(0);
    await other.getByRole('button',{name:'Watch Tic-tac-toe',exact:true}).click();await other.getByRole('button',{name:'Join game',exact:true}).click();await expect(page.locator('.waiting-seat.is-ready')).toHaveCount(2);
    await other.getByRole('button',{name:'Ready ✓',exact:true}).click();await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeDisabled();
    await other.getByRole('button',{name:'I’m ready',exact:true}).click();await expect(page.getByRole('button',{name:'Start game',exact:true})).toBeEnabled();
    for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844},{width:360,height:800}]){await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/waiting-room-${viewport.width}.png`,fullPage:true});}
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.map(v=>v.id)).toEqual([]);
    await page.getByRole('button',{name:'Start game',exact:true}).click();await expect(page.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();
    const original=(await state(page)).room.gameSession.game.match;
    for(const cell of [0,3,1,4,2]){const match=(await state(page)).room.gameSession.game.match;const actor=(match.turn==='X'?match.x:match.o).name==='Alex'?page:other;const button=actor.getByRole('button',{name:`Row ${Math.floor(cell/3)+1}, column ${cell%3+1}: empty`,exact:true});await expect(button).toBeEnabled();await button.click();await expect(actor.locator('.ttt-board .mark-x,.ttt-board .mark-o')).toHaveCount(match.board.filter(Boolean).length+1);}
    await expect(page.locator('.ttt-cell.winning')).toHaveCount(3);await expect.poll(()=>page.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);await expect.poll(()=>other.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);
    await page.getByRole('button',{name:'Mute game sounds',exact:true}).click();await page.getByRole('button',{name:'Play again',exact:true}).click();await expect.poll(async()=>(await state(page)).room.gameSession.game.match.x.id).toBe(original.o.id);
    const rematch=(await state(page)).room.gameSession.game.match;const nextPlayer=rematch.x.name==='Alex'?page:other;await nextPlayer.getByRole('button',{name:'Row 1, column 1: empty',exact:true}).click();await expect.poll(()=>other.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(6);expect(await page.evaluate(()=>(window as unknown as {turnSounds:number}).turnSounds)).toBe(5);
    await page.getByRole('button',{name:'End this match',exact:true}).click();await page.getByRole('button',{name:'Confirm end game',exact:true}).click();
    await page.getByRole('radio',{name:/League/}).check();await expect(other.getByRole('radio',{name:/League/})).toBeChecked();await expect(page.getByRole('button',{name:'Play again',exact:true})).toBeDisabled();await other.getByRole('button',{name:'I’m ready',exact:true}).click();await page.getByRole('button',{name:'Play again',exact:true}).click();
    await expect(page.locator('.visual-fixtures li')).toHaveCount(2);await page.getByRole('button',{name:'Next tournament match',exact:true}).click();await expect(page.getByRole('group',{name:'Tic-tac-toe board',exact:true})).toBeVisible();
  }finally{await context.close();}
});
