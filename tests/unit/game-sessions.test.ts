import {describe,it,expect} from 'vitest';
import {z} from 'zod';
import {GameSessions,type GameRoom} from '../../apps/server/src/games/sessions.js';
import {registerGame,type GameModule} from '../../apps/server/src/games/module.js';
import type {GameContext} from '../../apps/server/src/games/contracts.js';

const schema=z.object({running:z.boolean(),starts:z.number(),roster:z.array(z.string())});
function testModule(id:string) {
  const module:GameModule<z.infer<typeof schema>,{action:'finish'},z.infer<typeof schema>>={
    definition:{id,name:id,description:'Test-only game',mark:'✦',cover:'test',modes:[{id:'pair',name:'Pair',description:'Two',minPlayers:2,maxPlayers:2,symbol:'✦'},{id:'party',name:'Party',description:'Four',minPlayers:2,maxPlayers:4,symbol:'✦'}]},
    stateSchema:schema,actionSchema:z.object({action:z.literal('finish')}).strict(),create:()=>({running:false,starts:0,roster:[]}),
    open:()=>{},start:(state,mode,players)=>{state.running=true;state.starts++;state.roster=[...players];},permission:()=> 'player',
    act:state=>{state.running=false;},reconcile:()=>{},clear:state=>{state.running=false;state.roster=[];},anonymize:()=>{},phase:state=>state.running?'playing':state.starts?'results':'waiting',project:state=>({...state}),
  };
  return registerGame(module);
}
function setup(){
  const modules={first:testModule('first'),second:testModule('second')},engine=new GameSessions(modules);
  const room:GameRoom={id:'room',allowPlayerGames:true,gameStates:{},gameSession:null};
  const people=['a','b','c','d'].map(id=>({id,name:id,key:`account:${id}`,connected:true}));
  const ctx=(id='a',owner=id==='a'):GameContext=>({players:people,self:id,owner,now:10,record:()=>{}});
  return {engine,room,ctx,people};
}
describe('shared game sessions with independent game modules',()=>{
  for(const id of ['first','second'])it(`uses exactly the same joining, readiness, modes and starts for ${id}`,()=>{
    const {engine,room,ctx}=setup();engine.command(room,{action:'open',gameId:id},ctx());
    expect(room.gameSession!.participants).toEqual([{playerId:'a',ready:true}]);
    engine.command(room,{action:'join'},ctx('b'));engine.command(room,{action:'join'},ctx('b'));
    expect(room.gameSession!.participants).toHaveLength(2);
    engine.command(room,{action:'ready',ready:false},ctx('b'));
    expect(()=>engine.command(room,{action:'start'},ctx())).toThrow(/ready/);
    engine.command(room,{action:'ready',ready:true},ctx('b'));engine.command(room,{action:'start'},ctx('b'));
    expect(room.gameStates[id]).toMatchObject({running:true,starts:1,roster:['a','b']});
    expect(()=>engine.command(room,{action:'join'},ctx('c'))).toThrow(/finish/);
    expect(()=>engine.command(room,{action:'open',gameId:id==='first'?'second':'first'},ctx())).toThrow(/Finish/);
    engine.action(room,id,{action:'finish'},ctx('b'));
    engine.command(room,{action:'mode',mode:'party'},ctx());
    expect(room.gameSession!.participants.find(p=>p.playerId==='b')!.ready).toBe(false);
    engine.command(room,{action:'join'},ctx('c'));engine.command(room,{action:'join'},ctx('d'));
    expect(()=>engine.command(room,{action:'mode',mode:'pair'},ctx())).toThrow(/extra seats/);
    engine.command(room,{action:'ready',ready:true},ctx('b'));engine.command(room,{action:'start'},ctx());
    expect(room.gameStates[id]).toMatchObject({running:true,starts:2,roster:['a','b','c','d']});
    engine.clear(room);expect(room.gameSession).toBeNull();expect(room.gameStates[id]).toMatchObject({running:false,starts:2,roster:[]});
  });
  it('lets anyone join when game management is restricted, but never assigns someone else’s readiness',()=>{
    const {engine,room,ctx}=setup();room.allowPlayerGames=false;
    expect(()=>engine.command(room,{action:'open',gameId:'first'},ctx('b'))).toThrow(/admin/);
    engine.command(room,{action:'open',gameId:'first'},ctx());engine.command(room,{action:'join'},ctx('b'));
    expect(()=>engine.command(room,{action:'mode',mode:'party'},ctx('b'))).toThrow(/admin/);
    engine.command(room,{action:'ready',ready:false},ctx('b'));
    expect(room.gameSession!.participants.find(p=>p.playerId==='a')!.ready).toBe(true);
    expect(()=>engine.command(room,{action:'ready',ready:true},ctx('c'))).toThrow(/Join a seat/);
  });
  it('enforces capacity, supported modes and connected players',()=>{
    const {engine,room,ctx,people}=setup();engine.command(room,{action:'open',gameId:'first'},ctx());
    engine.command(room,{action:'join'},ctx('b'));
    expect(()=>engine.command(room,{action:'join'},ctx('c'))).toThrow(/full/);
    expect(()=>engine.command(room,{action:'mode',mode:'bogus'},ctx())).toThrow(/supported/);
    people[1].connected=false;expect(()=>engine.command(room,{action:'start'},ctx())).toThrow(/reconnect/);
    engine.command(room,{action:'leave'},ctx());expect(room.gameSession!.participants.map(p=>p.playerId)).toEqual(['b']);
  });
  it('counts views per socket, releases a seat only after the last explicit view leaves and clears only the session',()=>{
    const {engine,room,ctx}=setup();engine.command(room,{action:'open',gameId:'first'},ctx(),'one','session-a');
    engine.watch(room,ctx(),'session-a','two',true);engine.watch(room,ctx('b'),'session-b','other',true);
    engine.watch(room,ctx(),'session-a','one',false);expect(room.gameSession!.participants).toHaveLength(1);
    engine.watch(room,ctx(),'session-a','two',false);expect(room.gameSession!.participants).toHaveLength(0);
    engine.reconcile(room,ctx());expect(room.gameSession).not.toBeNull();
    engine.disconnect('other');engine.reconcile(room,ctx());expect(room.gameSession).toBeNull();
    expect(room.gameStates.first).toBeDefined();
  });
  it('ignores a delayed exit from the preceding game session',()=>{
    const {engine,room,ctx}=setup();engine.command(room,{action:'open',gameId:'first'},ctx(),'socket','a');const old=room.gameSession!.id;
    engine.clear(room);engine.command(room,{action:'open',gameId:'second'},ctx(),'socket','a');
    expect(()=>engine.command(room,{action:'join',sessionId:old},ctx('b'))).toThrow(/changed/);
    engine.watch(room,ctx(),'a','socket',false,old);engine.reconcile(room,ctx());expect(room.gameSession!.gameId).toBe('second');
  });
  it('checkpoints presence for transaction rollback and rejects unknown games/actions',()=>{
    const {engine,room,ctx}=setup();const checkpoint=engine.checkpoint();engine.command(room,{action:'open',gameId:'first'},ctx(),'one','a');
    engine.restore(checkpoint);engine.reconcile(room,ctx());expect(room.gameSession).not.toBeNull();
    expect(()=>engine.command(room,{action:'open',gameId:'missing'},ctx())).toThrow(/not available/);
    expect(()=>engine.action(room,'second',{action:'finish'},ctx())).toThrow(/changed/);
    expect(()=>engine.action(room,'first',{action:'arbitrary'},ctx())).toThrow();
  });
});
