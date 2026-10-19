import { PersonalGameScores } from './TicTacToe.js';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import { AVATARS, type AvatarDesign, type AvatarId, type SessionView, type WireResult } from '../../../packages/protocol/src/index.js';
import { PixelStudio } from './PixelStudio.js';
import { presetPixels } from '../../../packages/avatar/src/pixels.js';
import { PeoplePanel } from './People.js';
import { SecurityPanel } from './Security.js';

export type AuthMode = 'login' | 'signup' | 'recover';
async function request<T>(path: string, csrf: string, body: unknown): Promise<T> {
  const response = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) });
  const result = await response.json() as WireResult<T>;
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
export function GoogleMark() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 01-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" /><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.6A10 10 0 0012 22Z" /><path fill="#fbbc05" d="M6.3 13.9a6 6 0 010-3.8V7.5H3a10 10 0 000 9l3.3-2.6Z" /><path fill="#ea4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0012 2a10 10 0 00-9 5.5l3.3 2.6A6 6 0 0112 5.9Z" /></svg>;
}
function AvatarPicker({ value, onChange, customDesign, onDraw }: { value: AvatarId; onChange: (v: AvatarId) => void; customDesign?: AvatarDesign | null; onDraw?: () => void }) {
  return <fieldset className="avatar-picker"><legend>Your avatar</legend><div>{AVATARS.map(id => <button type="button" key={id} className={`avatar-option ${value === id && !customDesign ? 'selected' : ''}`} aria-label={`${id} avatar`} aria-pressed={value === id && !customDesign} onClick={() => onChange(id)}><Avatar id={id} /></button>)}{onDraw && <button type="button" className={`avatar-option custom-avatar-option ${customDesign ? 'selected' : ''}`} aria-label={customDesign ? 'Edit custom avatar' : 'Draw custom avatar'} aria-pressed={!!customDesign} onClick={onDraw}>{customDesign ? <><Avatar id={value} design={customDesign} /><span className="custom-avatar-pencil" aria-hidden="true">✎</span></> : <svg className="custom-avatar-plus" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" rx="11" fill="#eee7f0" /><path d="M36 23v26M23 36h26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>}</button>}</div></fieldset>;
}

export function AuthDialog({ mode, setMode, session, onSession, initialNickname, initialAvatar, onPending, onGoogleStart }: {
  mode: AuthMode | null; setMode: (v: AuthMode | null) => void; session: SessionView | null;
  onSession: (s: SessionView) => void; initialNickname: string; initialAvatar: AvatarId; onPending: (v: boolean) => void; onGoogleStart: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState(initialNickname); const [avatar, setAvatar] = useState(initialAvatar);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [recovery, setRecovery] = useState('');
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { setBusy(false); onPending(false); } };
    window.addEventListener('pageshow', restore);
    return () => window.removeEventListener('pageshow', restore);
  }, [onPending]);
  useEffect(() => {
    if (mode) { ref.current?.showModal(); setError(''); setPassword(''); setNickname(initialNickname); setAvatar(initialAvatar); }
    else { ref.current?.close(); setPassword(''); }
  }, [mode]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!session || !mode) return;
    setBusy(true); onPending(true); setError('');
    try {
      const data = await request<SessionView>(`/api/auth/${mode}`, session.csrf,
        { username, password, ...(mode === 'signup' ? { nickname, avatar } : {}), ...(mode === 'recover' ? { recoveryCode: recovery.trim() } : {}) });
      onSession(data); setMode(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); onPending(false); }
  }
  async function google() {
    if (!session) return;
    setBusy(true); onPending(true); setError('');
    try { const data = await request<{ url: string }>('/api/auth/google', session.csrf, {}); onGoogleStart(); window.location.assign(data.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setBusy(false); onPending(false); }
  }
  return <dialog ref={ref} onPointerDown={event => { const r = event.currentTarget.getBoundingClientRect(); backdropPress.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom); }} onClick={event => { if (backdropPress.current && event.target === event.currentTarget && !busy) { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) setMode(null); } }} className="dialog auth-dialog" aria-label={mode === 'signup' ? 'Create a free account' : 'Sign in to Just Us'} onCancel={e => { if (busy) e.preventDefault(); else setMode(null); }}>
    <div className="dialog-inner"><button className="dialog-close icon-button" aria-label="Close sign-in dialog" disabled={busy} onClick={() => setMode(null)}>×</button>
      <p className="eyebrow">{mode === 'signup' ? 'A LITTLE MORE YOU. ALWAYS FREE.' : 'YOUR LITTLE SPACE, REMEMBERED.'}</p>
      <h2>{mode === 'signup' ? 'Create your account' : mode === 'recover' ? 'Reset your password' : 'Welcome back'}</h2>
      <p className="auth-intro">{mode === 'signup' ? 'Save your pixel you and get access to more games as our shelf grows.' : 'Your saved profile and a little more to look forward to.'}</p>
      <button className="button google-button full" disabled={busy || !session?.auth.google} onClick={google}><GoogleMark /> Continue with Google</button>
      {!session?.auth.google && <p className="provider-note">Google sign-in is coming soon. A username account works now.</p>}
      <div className="auth-divider"><span />or use a username<span /></div>
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="auth-username">Username</label><input id="auth-username" autoComplete="username" placeholder={mode === 'signup' ? 'your_little_corner' : undefined} minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]{3,24}" required value={username} onChange={e => setUsername(e.target.value)} aria-describedby={mode === 'signup' ? 'username-help' : undefined} />
        {mode === 'signup' && <p id="username-help" className="input-help">3–24 letters, numbers, or underscores.</p>}
        {mode === 'recover' && <><label className="field-label" htmlFor="auth-recovery">Recovery key</label><input id="auth-recovery" autoComplete="off" required minLength={48} maxLength={48} value={recovery} onChange={e => setRecovery(e.target.value)} /><p className="input-help">Use the private key saved when you registered or from account security. It works once and signs out other sessions.</p></>}
        <label className="field-label" htmlFor="auth-password">{mode === 'recover' ? 'New password' : 'Password'}</label><input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={12} maxLength={128} placeholder={mode === 'login' ? undefined : 'At least 12 characters'} required value={password} onChange={e => setPassword(e.target.value)} />
        {mode === 'signup' && <><label className="field-label" htmlFor="auth-nickname">Nickname</label><input id="auth-nickname" autoComplete="nickname" maxLength={24} required placeholder="What your person calls you" value={nickname} onChange={e => setNickname(e.target.value)} /><AvatarPicker value={avatar} onChange={setAvatar} /></>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary full submit-button" aria-busy={busy} disabled={busy || !session}>{busy ? 'One little moment…' : mode === 'signup' ? 'Create my free account' : mode === 'recover' ? 'Reset my password' : 'Sign in to my account'}</button>
      </form>
      <p className="auth-switch">{mode === 'signup' ? 'Already one of us?' : 'New around here?'} <button className="text-button" disabled={busy} onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create a free account'}</button></p>
      <button className="guest-link text-button" disabled={busy} onClick={() => setMode(null)}>I’ll stay as a guest for now</button>
    </div>
  </dialog>;
}

export function AccessCards({ signedIn, onJoin, onGuest }: { signedIn: boolean; onJoin: () => void; onGuest: () => void }) {
  return <section className="access-section" aria-labelledby="access-title"><div className="section-heading"><p className="eyebrow">COME AS YOU ARE. STAY A LITTLE LONGER.</p><h2 id="access-title">Two ways to feel right at home.</h2><p className="section-description">Start as a guest, or make it yours with a free account.</p></div><div className="access-cards">
    <article className="access-card"><span className="eyebrow">JUST DROPPING IN</span><h3>The guest seat</h3><p>A little together-time, without signing up.</p><ul><li>Create and join private rooms</li><li>Temporary nickname · one-hour rooms</li><li>Four seats · no saved access or chat</li><li>Guest games as they arrive <span>coming soon</span></li></ul><button className="button secondary full" onClick={onGuest}>{signedIn ? 'Open a room' : 'Continue as a guest'} <span aria-hidden="true">↗</span></button></article>
    <article className="access-card account-card"><span className="account-free-tag">FREE ACCOUNT</span><span className="eyebrow">YOUR OWN LITTLE CORNER</span><h3>A seat with your name on it.</h3><p>Same cosy space. A little more to call yours.</p><ul><li>A profile that remembers you</li><li>Saved rooms, pixel art and room chat</li><li>Friends and one mutual special person</li><li>Access to more games as they arrive <span>coming soon</span></li></ul><button className="button primary full" onClick={onJoin}>{signedIn ? 'Visit my account' : 'Make it mine — join free'} <span aria-hidden="true">↗</span></button><p className="account-no-payment">No subscription. No card. Just a free account.</p></article>
  </div></section>;
}

export function AccountPage({ session, onSession, onAuth, onHome, onPending, inviteToken, onConsumed, onRecovery }: { session: SessionView | null; onSession: (s: SessionView) => void; onAuth: (v: AuthMode) => void; onHome: () => void; onPending: (v: boolean) => void; inviteToken?: string; onConsumed: () => void; onRecovery: (code: string) => void }) {
  const account = session?.account;
  const [nickname, setNickname] = useState(account?.nickname || ''); const [avatar, setAvatar] = useState<AvatarId>(account?.avatar || 'moss');
  const [design, setDesign] = useState<AvatarDesign | null>(account?.avatarDesign || null);
  const [drawing, setDrawing] = useState(false);
  const [draftDesign, setDraftDesign] = useState<AvatarDesign | null>(null);
  const [tab, setTab] = useState<'profile' | 'people' | 'security' | 'scores'>(inviteToken ? 'people' : (['people', 'scores', 'security'] as const).find(section => section === new URLSearchParams(location.search).get('section')) ?? 'profile');
  useEffect(() => { if (inviteToken) setTab('people'); }, [inviteToken]);
  useEffect(() => { const sync = () => setTab((['people', 'scores', 'security'] as const).find(section => section === new URLSearchParams(location.search).get('section')) ?? 'profile'); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync); }, []);


  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [deleting, setDeleting] = useState(false); const [confirmation, setConfirmation] = useState('');
  useEffect(() => { setNickname(account?.nickname || ''); setAvatar(account?.avatar || 'moss'); setDesign(account?.avatarDesign || null); setDrawing(false); setMessage(''); setDeleting(false); setConfirmation(''); }, [account?.id]);
  async function action(type: 'profile' | 'logout' | 'delete', event?: React.FormEvent) {
    event?.preventDefault(); if (!session) return;
    setBusy(true); onPending(true); setError(''); setMessage('');
    try {
      const data = await request<SessionView>(type === 'profile' ? '/api/profile' : `/api/auth/${type}`, session.csrf,
        type === 'profile' ? { nickname, avatar, avatarDesign: design } : type === 'delete' ? { confirm: confirmation } : {});
      onSession(data); setMessage(type === 'profile' ? 'Your pixel you is saved. Looking good.' : 'You’re now browsing as a guest.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); onPending(false); }
  }
  async function saveDrawing() {
    if (!session || !account) return;
    setBusy(true); onPending(true); setError(''); setMessage('');
    const finished = draftDesign || presetPixels(avatar);
    try {
      const data = await request<SessionView>('/api/profile', session.csrf, { nickname: nickname.trim() || account.nickname, avatar, avatarDesign: finished });
      onSession(data); setDesign(finished); setDrawing(false); setMessage('Your custom avatar is saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); onPending(false); }
  }
  return <section className="account-page">
    <div className="account-page-heading"><p className="eyebrow">YOUR CORNER OF JUST US</p><h1>{!account ? 'Make yourself at home' : tab === 'people' ? 'Your favourite people.' : tab === 'scores' ? 'A little friendly competition.' : tab === 'security' ? 'Account settings' : 'Make it you.'}</h1><p>{tab === 'people' ? 'Keep the good company close.' : tab === 'scores' ? 'Your games. Your wins. Your next rematch.' : tab === 'security' ? 'Simple controls for your sign-in.' : 'Your name, your pixels, your presence.'}</p></div>

    {account && tab === 'scores' ? <PersonalGameScores score={session?.gameScores} /> : account && tab === 'people' && session ? <PeoplePanel session={session} inviteToken={inviteToken} onConsumed={onConsumed} /> : account && tab === 'security' && session ? <SecurityPanel session={session} onSession={onSession} onRecovery={onRecovery} onPending={onPending} /> : account ? <div className="account-page-grid"><section className="profile-panel"><div className="profile-heading"><Avatar id={avatar} design={design} /><div><span className="pill">FREE ACCOUNT</span><h2>Your pixel you</h2><p>{account.username ? `@${account.username}` : 'Connected with Google'}</p></div></div>
      <form onSubmit={event => action('profile', event)}><label className="field-label" htmlFor="profile-nickname">Nickname</label><input className="profile-input" id="profile-nickname" maxLength={24} required value={nickname} onChange={e => setNickname(e.target.value)} /><AvatarPicker value={avatar} customDesign={design} onChange={id => { setAvatar(id); setDesign(null); setDrawing(false); }} onDraw={() => { setDraftDesign(design || presetPixels(avatar)); setDrawing(true); setError(''); }} />{drawing ? <section className="avatar-drawing-mode" aria-label="Draw your avatar"><PixelStudio value={draftDesign} preset={avatar} onChange={setDraftDesign} /><div className="settings-actions"><button type="button" className="button primary" disabled={busy} onClick={() => void saveDrawing()}>{busy ? 'Saving…' : 'Done — save avatar'}</button><button type="button" className="text-button" disabled={busy} onClick={() => setDrawing(false)}>Cancel drawing</button></div></section> : <button className="button primary full submit-button" disabled={busy}>Save my profile</button>}</form>
      {message && <p className="success-message" role="status">{message}</p>}{error && <p className="form-error" role="alert">{error}</p>}
      <div className="account-management"><button className="text-button" disabled={busy} onClick={() => action('logout')}>{session?.room ? 'Sign out & keep my guest seat' : 'Sign out'}</button><button className="text-button danger" disabled={busy} onClick={() => setDeleting(!deleting)}>Delete account</button></div>
      {deleting && <form className="delete-account-form" onSubmit={event => action('delete', event)}><p>This permanently deletes your account, profile, connections and every room you own, including their chat. Memberships elsewhere are removed and your messages there are labelled Former member. Older backups follow their retention policy. This cannot be undone.</p><label className="field-label" htmlFor="delete-confirmation">Type DELETE to confirm</label><input className="profile-input" id="delete-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" required pattern="DELETE" /><button className="button secondary full" disabled={busy || confirmation !== 'DELETE'}>Delete my account permanently</button></form>}
    </section></div> : <>{inviteToken && <p className="connection-invitation">A people invitation is waiting. Sign in or create a free account, then accept it from My people.</p>}<div className="account-welcome"><div className="account-welcome-avatars"><Avatar id="lilac" /><Avatar id="sun" /></div><h2>Save a little piece of you.</h2><p>Make a free account with a username and password, or use Google when it’s connected. Guest rooms are always an option.</p><div className="hero-actions"><button className="button primary" disabled={!session} onClick={() => onAuth('signup')}>Create a free account</button><button className="button secondary" disabled={!session} onClick={() => onAuth('login')}>Sign in</button></div><button className="text-button" onClick={onHome}>Continue as a guest instead</button></div><AccessCards signedIn={false} onJoin={() => onAuth('signup')} onGuest={onHome} /></>}
  </section>;
}
