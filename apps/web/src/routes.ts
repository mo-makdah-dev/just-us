import type { SessionView } from '../../../packages/protocol/src/index.js';
export type Route =
  | { kind: 'public'; path: '/' }
  | { kind: 'guest'; path: '/sign-in' | '/sign-up'; authMode: 'login' | 'signup' }
  | { kind: 'authenticated'; path: string; page: 'rooms' | 'account' }
  | { kind: 'authorized'; path: string; roomId: string }
  | { kind: 'redirect'; to: string }
  | { kind: 'not-found' };
const aliases: Record<string,string> = { '/login':'/sign-in', '/signin':'/sign-in', '/signup':'/sign-up', '/register':'/sign-up', '/rooms':'/dashboard' };
export function resolveRoute(raw: string): Route {
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) return {kind:'not-found'};
  let url: URL; try {url=new URL(raw,'https://just-us.invalid');} catch {return {kind:'not-found'};}
  if(url.origin!=='https://just-us.invalid')return {kind:'not-found'};
  const path=url.pathname;
  if(path.length>1 && path.endsWith('/'))return {kind:'redirect',to:path.replace(/\/+$/,'')+url.search};
  if(aliases[path])return {kind:'redirect',to:aliases[path]+url.search};
  if(path==='/')return {kind:'public',path:'/'};
  if(path==='/sign-in'||path==='/sign-up')return {kind:'guest',path,authMode:path==='/sign-in'?'login':'signup'};
  if(path==='/dashboard')return {kind:'authenticated',path:path+url.search,page:'rooms'};
  if(path==='/account') {
    if(url.searchParams.getAll('section').length>1)return {kind:'not-found'};
    const section=url.searchParams.get('section');
    if(section!==null&&!['profile','people','scores','security'].includes(section))return {kind:'not-found'};
    return {kind:'authenticated',path:path+url.search,page:'account'};
  }
  const match=path.match(/^\/room\/([a-f0-9]{32})$/);
  return match ? {kind:'authorized',path:path+url.search,roomId:match[1]} : {kind:'not-found'};
}
export function safeReturnPath(raw: string | null | undefined): string | null {
  if(typeof raw !== 'string'||!raw||raw.includes('#')||raw.length>500||/[\\\u0000-\u001f\u007f]/.test(raw)||!raw.startsWith('/')||raw.startsWith('//'))return null;
  // Encoded separators/control characters must never change the interpretation of a return URL.
  if(/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(raw))return null;
  const target=resolveRoute(raw);
  if(target.kind==='redirect')return safeReturnPath(target.to);
  return ['authenticated','authorized'].includes(target.kind) ? raw : null;
}
export type RouteGuard = {kind:'allow'} | {kind:'pending'} | {kind:'unavailable'} | {kind:'not-found'} | {kind:'redirect';to:string} | {kind:'authorize-room';roomId:string};
export function guardRoute(raw: string, session: SessionView | null, loading: boolean): RouteGuard {
  const route=resolveRoute(raw);
  if(route.kind==='not-found')return {kind:'not-found'};
  if(route.kind==='redirect')return {kind:'redirect',to:route.to};
  if(loading)return {kind:'pending'};
  if(!session)return {kind:'unavailable'};
  const signed=!!session.account;
  if(route.kind==='guest')return signed?{kind:'redirect',to:safeReturnPath(new URL(raw,'https://just-us.invalid').searchParams.get('next'))||'/dashboard'}:{kind:'allow'};
  if(route.kind==='authenticated'&&!signed)return {kind:'redirect',to:'/sign-in?next='+encodeURIComponent(route.path)};
  if(route.kind==='authorized'&&session.room?.id!==route.roomId)return {kind:'authorize-room',roomId:route.roomId};
  if(route.kind==='public'&&session.room)return {kind:'redirect',to:'/room/'+session.room.id};
  if(route.kind==='public'&&signed)return {kind:'redirect',to:'/dashboard'};
  return {kind:'allow'};
}
