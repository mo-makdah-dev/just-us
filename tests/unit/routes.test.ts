import { describe, expect, it } from 'vitest';
import { guardRoute, resolveRoute, safeReturnPath } from '../../apps/web/src/routes.js';
import type { SessionView } from '../../packages/protocol/src/index.js';
const guest:SessionView={csrf:'csrf',serverTime:1,account:null,room:null,access:{tier:'guest',accountCatalogue:false},auth:{google:false}};
const member:SessionView={...guest,account:{id:'a',username:'member',nickname:'Member',avatar:'moss',provider:'password'},access:{tier:'account',accountCatalogue:true}};
const id='a'.repeat(32), other='b'.repeat(32);
describe('URL access policies',()=>{
  it.each(['/dashboard','/account','/account?section=people','/account?section=scores','/account?section=security'])('requires authentication for %s without mounting it',path=>{
    expect(guardRoute(path,guest,false)).toEqual({kind:'redirect',to:'/sign-in?next='+encodeURIComponent(path)});
    expect(guardRoute(path,member,false)).toEqual({kind:'allow'});
    expect(guardRoute(path,null,true)).toEqual({kind:'pending'});
    expect(guardRoute(path,null,false)).toEqual({kind:'unavailable'});
  });
  it.each(['/sign-in','/sign-up'])('keeps %s guest-only and safely returns verified accounts',path=>{
    expect(guardRoute(path,guest,false)).toEqual({kind:'allow'});
    expect(guardRoute(path,member,false)).toEqual({kind:'redirect',to:'/dashboard'});
    expect(guardRoute(path+'?next=%2Faccount%3Fsection%3Dpeople',member,false)).toEqual({kind:'redirect',to:'/account?section=people'});
    expect(guardRoute(path+'?next=https%3A%2F%2Fevil.example',member,false)).toEqual({kind:'redirect',to:'/dashboard'});
  });
  it('distinguishes account authentication from room authorization',()=>{
    expect(guardRoute('/room/'+id,member,false)).toEqual({kind:'authorize-room',roomId:id});
    expect(guardRoute('/room/'+id,guest,false)).toEqual({kind:'authorize-room',roomId:id});
    const admitted={...guest,room:{id} as NonNullable<SessionView['room']>};
    expect(guardRoute('/room/'+id,admitted,false)).toEqual({kind:'allow'});
    expect(guardRoute('/room/'+other,admitted,false)).toEqual({kind:'authorize-room',roomId:other});
  });
  it.each(['/unknown','/account?section=admin','/account?section=people&section=security','/room/not-an-id','//evil.example','/\\evil.example'])('rejects unknown/malformed route %s',path=>expect(resolveRoute(path).kind).toBe('not-found'));
  it.each(['https://evil.example','//evil.example','/\\evil.example','/%2f%2fevil.example','/sign-in','/signup','/dashboard#invite=x','/dashboard\n','javascript:alert(1)','/unknown'])('rejects unsafe or looping return paths %s',path=>expect(safeReturnPath(path)).toBeNull());
  it('canonicalizes aliases and permits only known protected return routes',()=>{
    expect(resolveRoute('/rooms')).toEqual({kind:'redirect',to:'/dashboard'});
    expect(resolveRoute('/login')).toEqual({kind:'redirect',to:'/sign-in'});
    expect(safeReturnPath('/rooms')).toBe('/dashboard');
    expect(safeReturnPath('/room/'+id)).toBe('/room/'+id);
    expect(guardRoute('/',guest,false)).toEqual({kind:'allow'});
    expect(guardRoute('/',member,false)).toEqual({kind:'redirect',to:'/dashboard'});
  });
});
