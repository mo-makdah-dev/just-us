import { expect, it } from 'vitest';
import { saveAuthReturn, takeAuthReturn } from '../../apps/web/src/authReturn.js';
function storage() { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } }; }
it('restores a room invitation once after OAuth and expires it after ten minutes', () => {
  const store = storage(); const intent = { page: 'home' as const, mode: 'join' as const, invitation: 'AB23CD45EF' };
  saveAuthReturn(store, intent, 1000); expect(takeAuthReturn(store, 1001)).toEqual(intent); expect(takeAuthReturn(store, 1002)).toBeNull();
  saveAuthReturn(store, intent, 1000); expect(takeAuthReturn(store, 601000)).toBeNull();
});
it('keeps people invitations and rejects arbitrary routes, malformed storage and invalid tokens', () => {
  const store = storage(); const intent = { page: 'account' as const, mode: null, peopleToken: 'a'.repeat(48) }; saveAuthReturn(store, intent, 1000); expect(takeAuthReturn(store, 1001)).toEqual(intent);
  store.setItem('just-us-auth-return', JSON.stringify({ ...intent, page: 'https://elsewhere.invalid', until: 5000 })); expect(takeAuthReturn(store, 1001)).toBeNull();
  store.setItem('just-us-auth-return', JSON.stringify({ ...intent, until: null })); expect(takeAuthReturn(store, 1001)).toBeNull();
  store.setItem('just-us-auth-return', '{'); expect(takeAuthReturn(store, 1001)).toBeNull();
  saveAuthReturn(store, { page: 'home', mode: 'join', invitation: '<script>' }, 1000); expect(takeAuthReturn(store, 1001)).toEqual({ page: 'home', mode: 'join' });
});
it('does not break Google sign-in when optional session storage is blocked', () => {
  const store = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  expect(() => saveAuthReturn(store, { page: 'home', mode: null })).not.toThrow(); expect(takeAuthReturn(store)).toBeNull();
});

it('restores only known safe protected destinations after OAuth', () => {
  const store=storage();
  saveAuthReturn(store,{page:'account',mode:null,returnPath:'/account?section=people'},1000);
  expect(takeAuthReturn(store,1001)).toEqual({page:'account',mode:null,returnPath:'/account?section=people'});
  saveAuthReturn(store,{page:'home',mode:null,returnPath:'https://evil.example'},1000);
  expect(takeAuthReturn(store,1001)).toEqual({page:'home',mode:null});
  saveAuthReturn(store,{page:'home',mode:null,returnPath:'/sign-in'},1000);
  expect(takeAuthReturn(store,1001)).toEqual({page:'home',mode:null});
});
