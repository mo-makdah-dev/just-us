import { useEffect, useRef, useState } from 'react';
import type { SessionView } from '../../../packages/protocol/src/index.js';
import { accountRequest } from './People.js';
export function RecoveryDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (code) ref.current?.showModal(); else ref.current?.close(); }, [code]);
  return <dialog className="dialog" aria-label="Save your recovery key" ref={ref} onCancel={e => e.preventDefault()}><div className="dialog-inner"><p className="eyebrow">ONE LITTLE KEY. KEEP IT SAFE.</p><h2>Your way back in.</h2><p className="auth-intro">Save this private recovery key in your password manager. It lets you reset a forgotten password without email, and is shown only once here.</p><label className="field-label" htmlFor="recovery-code">Your recovery key</label><input id="recovery-code" readOnly value={code || ''} onFocus={e => e.currentTarget.select()} /><button className="button secondary full submit-button" onClick={() => {
    const blob = new Blob([`Just Us recovery key\n\n${code}\n\nKeep this private. It resets your password and can only be used once.\n`], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'just-us-recovery-key.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }}>Download recovery key</button><button className="button primary full submit-button" onClick={onClose}>I’ve saved my recovery key</button></div></dialog>;
}
export function SecurityPanel({ session, onSession, onRecovery, onPending }: { session: SessionView; onSession: (s: SessionView) => void; onRecovery: (code: string) => void; onPending: (v: boolean) => void }) {
  const [current, setCurrent] = useState(''), [password, setPassword] = useState(''); const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function action(type: 'password' | 'recovery-key', event: React.FormEvent) {
    event.preventDefault(); setBusy(true); onPending(true); setError('');
    try {
      if (type === 'password') { const data = await accountRequest<SessionView>('/api/auth/password', session.csrf, { currentPassword: current, password }); onSession(data); setMessage('Your password is changed. Other account sessions have been signed out.'); }
      else { const data = await accountRequest<{ recoveryCode: string }>('/api/auth/recovery-key', session.csrf, { currentPassword: current }); onRecovery(data.recoveryCode); setMessage('A fresh key is ready. Your previous recovery key no longer works.'); }
      setCurrent(''); setPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); onPending(false); }
  }
  return <section className="security-panel"><p className="eyebrow">YOUR LITTLE SPACE, PROTECTED</p><h2>Account security.</h2>{session.account?.provider === 'google' ? <p>You sign in with Google. Manage your password and recovery in your Google account. Signing out here ends your Just Us session.</p> : <><p>Use a unique password and keep a recovery key in your password manager.</p><form onSubmit={e => action('password', e)}><label className="field-label" htmlFor="current-password">Current password</label><input className="profile-input" id="current-password" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} /><label className="field-label" htmlFor="new-password">New password</label><input className="profile-input" id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /><button className="button primary submit-button" disabled={busy}>Change password</button></form><form onSubmit={e => action('recovery-key', e)}><h3>A fresh recovery key</h3><p>Generating a new key invalidates your old one.</p><label className="field-label" htmlFor="recovery-password">Confirm current password</label><input className="profile-input" id="recovery-password" type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} /><button className="button secondary submit-button" disabled={busy}>Generate a new recovery key</button></form></>}{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}</section>;
}
