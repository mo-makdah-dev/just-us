import {it,expect} from 'vitest';
import {recordAccountScore,recordGameScore} from '../../apps/server/src/games/scores.js';
import {emptyTotals,type GameContext} from '../../apps/server/src/games/contracts.js';
import type {GameTotals} from '../../packages/protocol/src/index.js';
it('isolates totals by game and account while reusing the score policy',()=>{
  const scores:Record<string,Record<string,GameTotals>>={},delta={...emptyTotals(),played:1,wins:1,points:3};
  recordAccountScore(scores,'one','a',delta);recordAccountScore(scores,'two','a',{...emptyTotals(),played:1,losses:1});recordAccountScore(scores,'one','b',delta);
  expect(scores.a.one).toMatchObject({wins:1,played:1});expect(scores.a.two).toMatchObject({wins:0,losses:1});expect(scores.b.one).toMatchObject({wins:1});
});
it('does not retain guest identities or send guest totals to account storage',()=>{
  const ledger={scores:[]},recorded:unknown[]=[],ctx:GameContext={self:'a',players:[],owner:true,now:0,record:(...args)=>recorded.push(args)};
  recordGameScore(ledger,{id:'guest',name:'Guest',key:'guest:one'},emptyTotals(),ctx);expect(ledger.scores).toEqual([]);expect(recorded).toEqual([]);
});
