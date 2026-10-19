import { safeReturnPath } from './routes.js';
export type AuthReturn = { page: 'home' | 'account' | 'rooms'; mode: 'create' | 'join' | null; returnPath?: string; invitation?: string; peopleToken?: string };
const key = 'just-us-auth-return';
type Store = Pick<Storage, 'setItem' | 'getItem' | 'removeItem'>;
export function saveAuthReturn(store: Store, intent: AuthReturn, now = Date.now()) {
  try { store.setItem(key, JSON.stringify({ ...intent, until: now + 10 * 60000 })); } catch { /* Sign-in still works without optional browser storage. */ }
}
export function takeAuthReturn(store: Store, now = Date.now()): AuthReturn | null {
  try {
    const raw = store.getItem(key); store.removeItem(key); if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.until !== 'number' || !Number.isFinite(value.until) || value.until <= now || value.until > now + 10 * 60000 || !['home', 'account', 'rooms'].includes(value.page) || ![null, 'create', 'join'].includes(value.mode)) return null;
    return { page: value.page, mode: value.mode,
      ...(safeReturnPath(value.returnPath) ? { returnPath: safeReturnPath(value.returnPath)! } : {}),
      ...(typeof value.invitation === 'string' && /^(?:[a-f0-9]{32}|[A-Z2-9]{10})$/.test(value.invitation) ? { invitation: value.invitation } : {}),
      ...(typeof value.peopleToken === 'string' && /^[a-f0-9]{48}$/.test(value.peopleToken) ? { peopleToken: value.peopleToken } : {}) };
  } catch { return null; }
}
