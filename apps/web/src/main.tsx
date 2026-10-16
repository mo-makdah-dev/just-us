import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io, type Socket } from 'socket.io-client';
import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import { AVATARS, type AvatarId, type CommandResult, type RoomCommand, type RoomView, type SessionView, type WireResult } from '../../../packages/protocol/src/index.js';
import './styles.css';
import './room.css';
import { AccessCards, AccountPage, AuthDialog, type AuthMode } from './Account.js';
import { RecoveryDialog } from './Security.js';
import { RoomInterior } from './RoomInterior.js';
import { GameLibrary } from './GameLibrary.js';
import { saveAuthReturn, takeAuthReturn } from './authReturn.js';
import { HelpDialog } from './Help.js';
import { RoomsDirectory, RoomTools } from './Rooms.js';

type Mode = 'create' | 'join';
const cache = {
  get(key: string, temporary = false) { try { return (temporary ? sessionStorage : localStorage).getItem(key); } catch { return null; } },
  set(key: string, value: string, temporary = false) { try { (temporary ? sessionStorage : localStorage).setItem(key, value); } catch { /* Optional browser cache; the server retains authoritative state. */ } },
  remove(key: string) { try { sessionStorage.removeItem(key); } catch { /* Optional cache. */ } },
};
class AppBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="loading-state"><div><h1>A little pause.</h1><p>We couldn’t display this page. Your saved account and room stay on the server.</p><button className="button primary submit-button" onClick={() => location.reload()}>Reload our little space</button></div></main> : this.props.children; }
}
class RequestError extends Error { constructor(public code: string, message: string) { super(message); } }
async function api<T>(path: string, csrf?: string, body?: unknown): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf || '' } : {}, body: body ? JSON.stringify(body) : undefined });
  const result: WireResult<T> = await response.json();
  if (!result.ok) throw new RequestError(result.error.code, result.error.message);
  return result.data;
}
function Icon({ name, size = 20 }: { name: 'arrow' | 'link' | 'lock' | 'copy' | 'close' | 'refresh' | 'check'; size?: number }) {
  const paths = { arrow: 'M4 10h12M11 5l5 5-5 5', link: 'M8 12l4-4M7 14H5a4 4 0 010-8h3m4 0h3a4 4 0 010 8h-3', lock: 'M6 9V6a4 4 0 018 0v3M4 9h12v9H4zM10 12v3', copy: 'M7 7h10v11H7zM4 14H3V3h10v1', close: 'M5 5l10 10M15 5L5 15', refresh: 'M16 7a7 7 0 10.5 6M16 3v5h-5', check: 'M4 10l4 4 8-8' };
  return <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
function RoomIllustration() {
  return <div className="room-art" aria-label="Two pixel avatars sharing a cosy little room" role="img">
    <div className="art-dots" /><div className="art-window"><span /><span /><span /><span /></div>
    <div className="art-star star-one">✦</div><div className="art-star star-two">✧</div>
    <div className="art-print"><span>YOU + ME</span><b>good<br />company.</b><i>any distance</i></div>
    <div className="art-shelf" /><div className="art-plant"><span /><span /><span /><i /></div>
    <div className="art-seat"><div className="seat-back" /><div className="art-person person-one"><Avatar id="moss" /></div><div className="art-person person-two"><Avatar id="peach" /></div><div className="seat-front" /><div className="seat-leg left" /><div className="seat-leg right" /></div>
    <div className="art-rug" /><div className="art-caption"><span className="presence-dot" /> Different places. Same little space.</div>
  </div>;
}

function App() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<Mode | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [peopleToken, setPeopleToken] = useState<string | undefined>();
  const [page, setPage] = useState<'home' | 'account' | 'rooms'>(() => location.pathname === '/account' ? 'account' : location.pathname === '/rooms' ? 'rooms' : 'home');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('moss');
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<'connecting' | 'online' | 'offline' | 'conflict'>('connecting');
  const [confirm, setConfirm] = useState<'leave' | 'close' | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [roomTab, setRoomTab] = useState<'room' | 'chat'>('room');
  const [unread, setUnread] = useState(0);
  const lastMessage = useRef<{ roomId: string; id?: string } | null>(null);
  const socket = useRef<Socket | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const roomRef = useRef<RoomView | null>(null);
  const busyRef = useRef(false);
  const authPending = useRef(false);
  const resumeMode = useRef<Mode | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const modalActive = mode !== null || confirm !== null;
  const room = session?.room ?? null;
  useEffect(() => { setLibraryOpen(false); setRoomTab('room'); }, [room?.id]);
  useEffect(() => {
    const latest = room?.messages.at(-1);
    if (!room || lastMessage.current?.roomId !== room.id || roomTab === 'chat') setUnread(0);
    else if (latest && latest.id !== lastMessage.current?.id && !latest.isYou) setUnread(count => count + 1);
    lastMessage.current = room ? { roomId: room.id, id: latest?.id } : null;
  }, [room?.id, room?.messages.at(-1)?.id, roomTab]);
  roomRef.current = room;
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 6000); return () => clearTimeout(timer); }, [notice]);

  async function reload() {
    let data: SessionView;
    for (let attempt = 0; ; attempt++) {
      try { data = await api<SessionView>('/api/session'); break; }
      catch (error) {
        if (!(error instanceof RequestError) || error.code !== 'SERVER_RESTARTING' || attempt >= 30) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    setSession(data); return data;
  }
  function navigate(value: 'home' | 'account' | 'rooms') {
    setPage(value); setMode(null); setConfirm(null); setError('');
    history.pushState(null, '', value === 'account' ? '/account' : value === 'rooms' ? '/rooms' : '/'); window.scrollTo({ top: 0 });
  }
  function openAuth(value: AuthMode = 'signup') { resumeMode.current = mode; setMode(null); setConfirm(null); setError(''); setAuthMode(value); }
  function signedSession(data: SessionView) {
    if (data.recoveryCode) { setRecoveryCode(data.recoveryCode); data = { ...data, recoveryCode: undefined }; }
    if (data.csrf !== session?.csrf) socket.current?.disconnect();
    setSession(data); setError('');
    if (resumeMode.current && !data.room) { setMode(resumeMode.current); resumeMode.current = null; }
    if (data.account && !session?.account) setNotice('Your free account is ready. Make yourself at home.');
    else if (!data.account && session?.account) setNotice('You’re now a guest. Your current room is still here.');
  }
  useEffect(() => {
    if (session?.account) { setNickname(session.account.nickname); setAvatar(session.account.avatar); }
  }, [session?.account?.id, session?.account?.nickname, session?.account?.avatar]);
  useEffect(() => {
    try { localStorage.removeItem('just-us-nickname'); localStorage.removeItem('just-us-avatar'); } catch {}
    const consumeLink = () => {
      const match = window.location.hash.match(/^#invite=([a-f0-9]{32}|[A-Z2-9]{10})$/);
      if (match) { setInvite(match[1]); setMode('join'); window.history.replaceState(null, '', window.location.pathname); }
      const peopleMatch = location.hash.match(/^#connect=([a-f0-9]{48})$/);
      if (peopleMatch) { setPeopleToken(peopleMatch[1]); setPage('account'); history.replaceState(null, '', '/account'); }
    };
    consumeLink();
    window.addEventListener('hashchange', consumeLink);
    const status = new URLSearchParams(location.search).get('auth');
    if (status) {
      let destination = location.pathname;
      try { const intent = takeAuthReturn(sessionStorage); if (intent) { setPage(intent.page); setMode(intent.mode); if (intent.invitation) setInvite(intent.invitation); if (intent.peopleToken) setPeopleToken(intent.peopleToken); destination = intent.page === 'home' ? '/' : `/${intent.page}`; } } catch {}
      history.replaceState(null, '', destination);
      if (status === 'success') setNotice('You’re signed in. Welcome to your little space.');
      else setError(status === 'conflict' ? 'This account already has a room in another browser. Your guest room has been kept.' : status === 'cancelled' ? 'Sign-in was cancelled. Your guest room is still here.' : 'Sign-in could not be completed. Your guest room is still here; please try again.');
    }
    reload().catch(e => setError(e.message)).finally(() => setLoading(false));
    const popstate = () => setPage(location.pathname === '/account' ? 'account' : location.pathname === '/rooms' ? 'rooms' : 'home');
    window.addEventListener('popstate', popstate);
    return () => { window.removeEventListener('popstate', popstate); window.removeEventListener('hashchange', consumeLink); };
  }, []);
  useEffect(() => {
    if (!session?.csrf) return;
    const client = io({ transports: ['websocket'], auth: { csrf: session.csrf, protocolVersion: 4 }, reconnectionDelay: 1000, reconnectionDelayMax: 5000 });
    socket.current = client;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    setConnection('connecting');
    client.on('session', (data: SessionView) => {
      const oldRoom = roomRef.current;
      if (oldRoom && !data.room && !busyRef.current) setNotice('Your room has ended or its reserved seat has expired. You can start a fresh one.');
      setSession(data); setConnection('online');
      window.dispatchEvent(new Event('just-us-session'));
    });
    client.on('disconnect', reason => { setConnection(v => v === 'conflict' ? v : 'offline'); if (reason === 'io server disconnect') client.disconnect(); });
    client.on('connect_error', e => {
      setConnection('offline'); setError(e.message === 'websocket error' ? 'The connection dropped. We will keep trying to reconnect.' : e.message);
      if ((e as Error & { data?: { code?: string } }).data?.code === 'SERVER_RESTARTING') {
        clearTimeout(restartTimer); restartTimer = setTimeout(() => client.connect(), 2000);
      }
    });
    client.on('sessionError', (message: string) => {
      if (authPending.current) return;
      if (/session expired/i.test(message)) {
        setSession(null); setRecoveryCode(null); setPeopleToken(undefined);
        setError('Your session ended. Sign in again to return to your saved rooms.');
        void reload().catch(() => {});
      } else { setConnection('conflict'); setError(message); }
    });
    client.on('connect', () => setError(''));
    const offline = () => { client.disconnect(); setConnection('offline'); };
    const online = () => { setConnection('connecting'); client.connect(); };
    const visible = () => { if (!document.hidden && !client.connected) client.connect(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => { clearTimeout(restartTimer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('offline', offline); window.removeEventListener('online', online); client.disconnect(); socket.current = null; };
  }, [session?.csrf]);
  useEffect(() => {
    if (!dialog.current) return;
    if (modalActive && !dialog.current.open) dialog.current.showModal();
    if (!modalActive && dialog.current.open) dialog.current.close();
  }, [modalActive]);
  useEffect(() => { if (room) { setMode(null); } }, [room?.id]);

  function begin(value: Mode) { setError(''); setMode(value); pending.current = null; }
  function remember() { cache.remove('just-us-nickname'); cache.remove('just-us-avatar'); }
  function result(data: CommandResult) {
    if (data.invitation && data.room) cache.set(`just-us-invite:${data.room.id}`, data.invitation, true);
    // An idempotent acknowledgement may be older than a newer socket snapshot.
    setSession(s => s ? { ...s, room: data.room && s.room?.id === data.room.id && s.room.revision > data.room.revision ? s.room : data.room } : s);
    pending.current = null;
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !mode) return;
    setBusy(true); busyRef.current = true; setError('');
    try {
      if (session.account && nickname.trim() !== session.account.nickname) {
        const updated = await api<SessionView>('/api/profile', session.csrf, { nickname: nickname.trim(), avatar: session.account.avatar, avatarDesign: session.account.avatarDesign });
        setSession(updated);
      }
      const cleaned = invite.trim();
      let invitation = cleaned;
      if (cleaned.includes('#invite=')) invitation = new URL(cleaned).hash.replace('#invite=', '');
      const key = JSON.stringify({ mode, nickname: nickname.trim(), avatar, invitation });
      if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
      const data = await api<CommandResult>(mode === 'create' ? '/api/rooms' : '/api/join', session.csrf,
        { commandId: pending.current.id, nickname: nickname.trim(), avatar, ...(mode === 'join' ? { invitation, asVisitor: !session.account } : {}) });
      result(data); remember(); navigate('home'); setMode(null); setNotice('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); busyRef.current = false; }
  }
  async function command(type: RoomCommand['type'], theme?: RoomCommand['theme'], details?: Partial<RoomCommand>) {
    if (!room || !session) return false;
    setBusy(true); busyRef.current = true; setError('');
    const input: RoomCommand = { type, roomId: room.id, expectedRevision: room.revision, commandId: crypto.randomUUID(), ...(theme ? { theme } : {}), ...details };
    try {
      if (!socket.current?.connected || connection !== 'online') throw new Error('Wait for the room to reconnect before making changes.');
      const response = await socket.current.timeout(8000).emitWithAck('command', input) as WireResult<CommandResult>;
      if (!response.ok) throw new RequestError(response.error.code, response.error.message);
      result(response.data); setConfirm(null);
      if (type === 'keepAlive') setNotice('Make yourself comfortable. Your room is staying open.');
      if (type === 'regenerateInvite' || type === 'reopen') setNotice('A fresh invitation is ready. The old link and code no longer work.');
      if (type === 'leave' || type === 'close') { cache.remove(`just-us-invite:${room.id}`); setNotice(type === 'leave' ? 'You left this visit. Saved memberships remain in My rooms.' : 'The room is deleted.'); }
      return true;
    } catch (e) {
      setError(e instanceof RequestError ? e.message : 'We could not confirm that change. Reconnecting will restore the saved room.');
      await reload().catch(() => {}); return false;
    } finally { setBusy(false); busyRef.current = false; }
  }
  async function copy(value: string, message: string) {
    try { await navigator.clipboard.writeText(value); setNotice(message); }
    catch { setNotice('Copy is unavailable in this browser. Select and copy the room code below.'); }
  }
  function invitationLink() {
    const token = room && cache.get(`just-us-invite:${room.id}`, true);
    return token ? `${window.location.origin}/#invite=${token}` : null;
  }
  const disabled = busy || connection !== 'online';

  return <>
    <header className="site-header"><a className="wordmark" href="/" onClick={event => { event.preventDefault(); navigate('home'); }} aria-label="Just Us home"><span className="brand-mark">ju<span>✦</span></span>just us<span className="brand-period">.</span></a><nav className="header-account" aria-label="Account"><span className="header-note"><Icon name="lock" size={14} /> a little space for your people</span>{session?.account ? <><button className="text-button" onClick={() => navigate('rooms')}>My rooms</button><button className="account-nav-button" onClick={() => navigate('account')}><Avatar id={session.account.avatar} design={session.account.avatarDesign} /><span>My account</span></button></> : <><button className="text-button header-signin" disabled={!session} onClick={() => openAuth('login')}>Sign in</button><button className="button header-join" disabled={!session} onClick={() => openAuth('signup')}>Join free <span aria-hidden="true">↗</span></button></>}</nav></header>
    <main id="main">{connection === 'conflict' && <div className="connection-banner" role="status">Your session changed or this seat is open in another tab. Close the other tab if needed, then refresh.<button className="text-button" onClick={() => location.reload()}>Refresh session</button></div>}
      {loading ? <section className="loading-state" role="status"><span className="loader" />Making a little room for you…</section> : page === 'rooms' ? <RoomsDirectory session={session} onAuth={() => openAuth('login')} onCreate={() => begin('create')} onJoin={() => begin('join')} onEntered={data => { result(data); navigate('home'); }} /> : page === 'account' ? <AccountPage inviteToken={peopleToken} onConsumed={() => setPeopleToken(undefined)} onRecovery={setRecoveryCode} session={session} onSession={signedSession} onAuth={openAuth} onHome={() => navigate('home')} onPending={value => { authPending.current = value; busyRef.current = value; }} /> : !room ? <>
        {session?.account && <section className="member-welcome"><Avatar id={session.account.avatar} design={session.account.avatarDesign} /><div><p className="eyebrow">YOUR LITTLE WORLD, REMEMBERED</p><h2>Lovely to see you, {session.account.nickname}.</h2><p>Your pixels, your people, and saved rooms to return to.</p></div><nav aria-label="Your space"><button className="text-button" onClick={() => navigate('account')}>Open my pixel studio →</button><button className="text-button" onClick={() => { navigate('account'); history.replaceState(null, '', '/account?section=people'); }}>Visit my people →</button></nav></section>}
        <section className="hero">
          <div className="hero-copy"><p className="eyebrow"><span /> A LITTLE CLOSER, WHEREVER YOU ARE</p><h1>Different places.<br /><em>Same us.</em></h1><p className="hero-description">Your own little corner of the internet.<br className="desktop-break" /> Bring your favourite person. We’ll save you a seat.</p>
            <div className="hero-actions"><button className="button primary" onClick={() => begin('create')} disabled={!session}>Create a room <Icon name="arrow" /></button><button className="button secondary" onClick={() => begin('join')} disabled={!session}>Join a room <Icon name="link" /></button></div>
            <p className="hero-footnote"><Icon name="lock" size={14} /> Up to four people. Guest rooms last one hour.</p>
            <div className="hero-account-note"><span aria-hidden="true">✦</span><p>{session?.account ? <>Your free account is ready for a bigger games shelf.<button className="text-button" onClick={() => navigate('account')}>Visit my account →</button></> : <>A free account makes room for a little more.<button className="text-button" onClick={() => openAuth('signup')}>Save your pixel you. More games to come. →</button></>}</p></div>
          </div><RoomIllustration />
        </section>
        <section className="how-section" aria-labelledby="how-title"><div className="section-heading"><p className="eyebrow">LESS PLANNING. MORE TOGETHER.</p><h2 id="how-title">A good time starts with a little space.</h2></div><div className="steps"><article><span className="step-number">01</span><h3>Make it yours</h3><p>Pick a name, choose a pixel you, and open your private room.</p></article><article><span className="step-number">02</span><h3>Send a little invite</h3><p>Share your room link or code. Your person can join from any device.</p></article><article><span className="step-number">03</span><h3>Settle in together</h3><p>One shared room, two comfy seats. Your time together starts here.</p></article></div></section>
        <AccessCards signedIn={!!session?.account} onJoin={() => session?.account ? navigate('account') : openAuth('signup')} onGuest={() => begin('create')} />
        <section className="coming-note"><span className="tiny-tiles" aria-hidden="true">▦</span><div><h3>Our little games shelf is on its way.</h3><p>{session?.account ? 'You’re on the full-shelf list. Games will arrive one at a time.' : 'Sign in for access to more games as they arrive. Guest games will be available too.'}</p></div><button className="text-button" onClick={() => session?.account ? navigate('account') : openAuth('login')}>{session?.account ? 'My free account →' : 'Sign in for more →'}</button></section>
      </> : <section className={`lobby calm-room ${roomTab === 'chat' ? 'mobile-chat-active' : 'mobile-room-active'}`}>
        <div className="lobby-heading"><div><p className="eyebrow">YOUR PRIVATE LITTLE CORNER</p><h1>A little time <em>together.</em></h1></div><span className={`connection-pill ${connection === 'online' ? '' : 'muted'}`} role="status"><span className="presence-dot" />{connection === 'online' ? 'Room connected' : connection === 'conflict' ? 'Check your session' : 'Reconnecting…'}</span></div>
        {connection !== 'online' && <div className="connection-banner" role="status">Your seat is saved while we reconnect. Room controls will return when you’re back.<button className="text-button" onClick={() => { setError(''); setConnection('connecting'); socket.current?.connect(); }}>Try reconnecting</button></div>}
        <div className="room-mobile-tabs" role="group" aria-label="Room view"><button aria-pressed={roomTab === 'room'} onClick={() => setRoomTab('room')}>Our room</button><button aria-pressed={roomTab === 'chat'} onClick={() => setRoomTab('chat')}>Chat {unread > 0 && <span className="chat-unread" role="status" aria-label={`${unread} unread messages`}>{unread > 9 ? '9+' : unread}</span>}</button></div>
        <div className="lobby-grid"><div className="lobby-main"><section className="people-panel"><div className="panel-heading"><div><p className="eyebrow">MAKE YOURSELF AT HOME</p><h2>{room.name}</h2></div><span className="small-label">{room.players.length} / 4 HERE</span></div><RoomInterior room={room} onLibrary={() => setLibraryOpen(true)} onTheme={theme => command('theme', theme)} disabled={disabled} /><div className="room-people-strip" aria-label="People in this room">{room.players.map(player => <div className="room-person-chip" key={player.id}><span className={`presence-dot ${player.connected ? '' : 'away-dot'}`} /><h3>{player.nickname}</h3>{player.isYou && <small>you</small>}{player.visitor && <span className="visitor-tag">visitor</span>}{!player.connected && <small>reconnecting</small>}</div>)}</div><p className="room-library-hint">Something to play? Open the games shelf in your room.</p></section>
        </div><RoomTools chatActive={roomTab === 'chat'} room={room} session={session} disabled={disabled} onCommand={(type, details) => command(type, undefined, details)} onAuth={() => openAuth('login')} onRooms={() => navigate('rooms')} /></div>
      </section>}
      {(error || notice) && <div className={`toast ${error ? 'error-toast' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}><Icon name="close" size={16} /></button></div>}
      {!loading && !session && <div className="retry-panel"><button className="button secondary" onClick={() => { setLoading(true); setError(''); reload().catch(e => setError(e.message)).finally(() => setLoading(false)); }}>Try connecting again</button></div>}
    </main>
    <GameLibrary open={libraryOpen && !!room} onClose={() => setLibraryOpen(false)} />
    <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} /><footer className="site-footer"><button className="text-button" onClick={() => setHelpOpen(true)}>Help & your data</button><span>just us. <span className="footer-dash">—</span> a little closer.</span><button className="text-button" onClick={() => navigate('account')}>{session?.account ? 'Your account' : 'A free account. A little more us. →'}</button></footer>
    <dialog ref={dialog} className="dialog" aria-label={confirm ? 'Confirm room action' : mode === 'create' ? 'Create a room' : 'Join a room'} onCancel={event => { if (busy) { event.preventDefault(); return; } setMode(null); setConfirm(null); setError(''); }}>
      <div className="dialog-inner"><button className="dialog-close icon-button" aria-label="Close dialog" disabled={busy} onClick={() => { setMode(null); setConfirm(null); setError(''); }}><Icon name="close" /></button>
        {confirm ? <><span className="eyebrow">UNTIL NEXT TIME</span><h2>{confirm === 'close' ? 'Close this little space?' : 'Heading out?'}</h2><p>{confirm === 'close' ? 'This deletes the room for everyone. You can always create a fresh one.' : 'You will give up your seat. Your person can stay and open a fresh invitation.'}</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full" disabled={busy} onClick={() => command(confirm)}>{busy ? 'One moment…' : confirm === 'close' ? 'Close the room' : 'Leave the room'}</button><button className="button quiet full" disabled={busy} onClick={() => setConfirm(null)}>Stay a little longer</button></> : <form onSubmit={submit}><p className="eyebrow">{mode === 'create' ? 'MAKE YOURSELF AT HOME' : 'YOUR SEAT IS WAITING'}</p><h2>{mode === 'create' ? 'Start with a little you.' : 'Come on in.'}</h2><p className="dialog-description">{mode === 'create' ? 'A nickname, a pixel you, and you’re ready.' : 'Your person is just a room code away.'}</p>
          {!session?.account && <div className="room-auth-prompt"><span>Temporary visitor · nickname only</span><button type="button" className="text-button" onClick={() => openAuth('login')}>Sign in for saved membership & chat →</button></div>}
          <label className="field-label" htmlFor="nickname">What should we call you?</label><input autoComplete="nickname" autoFocus id="nickname" placeholder="Your nickname" maxLength={24} required value={nickname} onChange={e => setNickname(e.target.value)} />
          <p className="input-help">{session?.account ? 'Your nickname will also update on your saved profile. Edit your pixels in My account.' : 'Visitors use a temporary nickname and a standard avatar.'}</p>
          {mode === 'join' && <><label className="field-label" htmlFor="invitation">Room code or invite link</label><input id="invitation" placeholder="e.g. AB23 CD45 EF" required value={invite} maxLength={300} autoComplete="off" spellCheck={false} onChange={e => setInvite(e.target.value)} /></>}
          {error && <p className="form-error" role="alert">{error}</p>}<button className="button primary full submit-button" disabled={busy || !nickname.trim()}>{busy ? 'Making room…' : mode === 'create' ? 'Create our little room' : (session?.account ? 'Join their room' : 'Join as a visitor')}{!busy && <Icon name="arrow" />}</button><p className="dialog-footnote"><Icon name="lock" size={13} /> Visitor codes are single-use. Membership needs sign-in; joining as a visitor saves no membership.</p>
        </form>}
      </div>
    </dialog>
    <AuthDialog onGoogleStart={() => { try { let code = invite.trim(); if (code.includes('#invite=')) code = new URL(code).hash.slice(8); saveAuthReturn(sessionStorage, { page, mode: resumeMode.current, invitation: code.replace(/[\s-]/g, '').toUpperCase().match(/^[A-Z2-9]{10}$/) ? code.replace(/[\s-]/g, '').toUpperCase() : code, peopleToken }); } catch {} }} mode={authMode} setMode={setAuthMode} session={session} initialNickname={nickname} initialAvatar={avatar} onSession={signedSession} onPending={value => { authPending.current = value; busyRef.current = value; }} />
    <RecoveryDialog code={recoveryCode} onClose={() => setRecoveryCode(null)} />
  </>;
}
createRoot(document.getElementById('root')!).render(<AppBoundary><App /></AppBoundary>);
