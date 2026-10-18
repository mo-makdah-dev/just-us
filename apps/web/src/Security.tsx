import { useEffect, useRef, useState } from 'react';
import type { SessionView } from '../../../packages/protocol/src/index.js';
import { accountRequest } from './People.js';
export function RecoveryDialog({ code, onClose }: { code: string | null; onClose: () => void }) {
  useEffect(() => { if (code) onClose(); }, [code]);
  return null;
}
export function SecurityPanel({ session, onSession, onPending }: { session: SessionView; onSession: (s: SessionView) => void; onRecovery: (code: string) => void; onPending: (v: boolean) => void }) {
  const [editing, setEditing] = useState(false), [show, setShow] = useState(false);
  const [current, setCurrent] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  function cancel() { setEditing(false); setCurrent(''); setPassword(''); setShow(false); setError(''); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); onPending(true); setError(''); setMessage('');
    try {
      const data = await accountRequest<SessionView>('/api/auth/password', session.csrf, { currentPassword: current, password });
      onSession(data); cancel(); setMessage('Password updated.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); onPending(false); }
  }
  const google = session.account?.provider === 'google';
  return <section className="security-panel settings-panel"><h2>Sign-in & security</h2>
    <div className="settings-row"><div><h3>Sign-in method</h3><p>{google ? 'Google account' : 'Username and password'}</p></div><span>{session.account?.username ? '@' + session.account.username : 'Google'}</span></div>
    <div className="settings-row"><div><h3>Password</h3><p>{google ? 'Managed by your Google account.' : 'Update the password you use to sign in.'}</p></div>{google ? <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">Manage</a> : !editing && <button className="text-button" onClick={() => { setEditing(true); setMessage(''); }}>Change</button>}</div>
    {editing && <form className="password-settings-form" onSubmit={save}><label className="field-label" htmlFor="current-password">Current password</label><input className="profile-input" id="current-password" type={show ? 'text' : 'password'} autoComplete="current-password" autoFocus required maxLength={128} value={current} onChange={e => setCurrent(e.target.value)} /><label className="field-label" htmlFor="new-password">New password</label><input className="profile-input" id="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="password-requirements" /><p id="password-requirements" className="input-help">At least 12 characters.</p><button type="button" className="text-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'Hide passwords' : 'Show passwords'}</button><div className="settings-actions"><button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button><button type="button" className="text-button" disabled={busy} onClick={cancel}>Cancel</button></div></form>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
  </section>;
}
