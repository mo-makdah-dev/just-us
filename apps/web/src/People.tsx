import { useEffect, useState } from 'react';
import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import type { AvatarDesign, AvatarId, PeopleView, SessionView, WireResult } from '../../../packages/protocol/src/index.js';

export async function accountRequest<T>(path: string, csrf: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf } : {}, body: body ? JSON.stringify(body) : undefined });
  const result: WireResult<T> = await res.json(); if (!result.ok) throw new Error(result.error.message); return result.data;
}
export function PeoplePanel({ session, inviteToken, onConsumed }: { session: SessionView; inviteToken?: string; onConsumed: () => void }) {
  const [people, setPeople] = useState<PeopleView | null>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [friends, setFriends] = useState('Friends'); const [special, setSpecial] = useState('My special person');
  const [link, setLink] = useState(''); const [invitePreview, setPreview] = useState<{ nickname: string; avatar: AvatarId; avatarDesign: AvatarDesign | null; kind: string; isYou: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ type: 'remove' | 'block'; id: string; name: string } | null>(null);
  useEffect(() => {
    let active = true;
    const reload = () => accountRequest<PeopleView>('/api/people', session.csrf).then(p => { if (active) { setPeople(p); } }).catch(e => { if (active) setError(e.message); });
    void reload().then(() => {});
    const timer = setInterval(reload, 15000);
    window.addEventListener('just-us-session', reload);
    window.addEventListener('focus', reload);
    return () => { active = false; clearInterval(timer); window.removeEventListener('just-us-session', reload); window.removeEventListener('focus', reload); };
  }, [session.csrf]);
  useEffect(() => { if (people) { setFriends(people.categories.friends); setSpecial(people.categories.special); } }, [people?.categories.friends, people?.categories.special]);
  useEffect(() => {
    setPreview(null);
    if (inviteToken) void accountRequest<typeof invitePreview>('/api/people/preview', session.csrf, { token: inviteToken }).then(setPreview).catch(e => setError(e.message));
  }, [inviteToken, session.csrf]);
  async function action(body: unknown) {
    setBusy(true); setError(''); setMessage('');
    try {
      const data = await accountRequest<{ people: PeopleView; token?: string }>('/api/people', session.csrf, body);
      setPeople(data.people); setConfirm(null);
      if (data.token) { setLink(`${location.origin}/#connect=${data.token}`); setMessage('Your private invitation is ready. It expires in seven days.'); }
      else { setMessage('Your people, updated.'); if ((body as { type: string }).type === 'accept') { setPreview(null); onConsumed(); } }
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  const specialPerson = people?.connections.find(p => p.kind === 'special');
  return <section className="people-page-panel"><div className="people-intro"><p className="eyebrow">GOOD COMPANY, KEPT CLOSE</p><h2>Your people.</h2><p>One special person. A circle of friends. Your own names for both.</p></div>
    {inviteToken && <section className="connection-invitation"><h3>{invitePreview ? `${invitePreview.nickname} saved you a place.` : 'A people invitation is waiting.'}</h3>{invitePreview && <><Avatar id={invitePreview.avatar} design={invitePreview.avatarDesign} /><p>{invitePreview.kind === 'special' ? 'Become each other’s one special person. You both need an available special place.' : 'Accept to join each other’s friends.'}</p><button className="button primary" disabled={busy || invitePreview.isYou} onClick={() => action({ type: 'accept', token: inviteToken })}>Accept {invitePreview.kind === 'special' ? 'special-person' : 'friend'} invitation</button></>}<button className="text-button" onClick={onConsumed}>Dismiss invitation</button></section>}
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="success-message" role="status">{message}</p>}
    <div className="people-category-grid">{(['special', 'friend'] as const).map(kind => {
      const rows = people?.connections.filter(c => c.kind === kind) || [];
      return <section className={`people-category ${kind}`} key={kind}><div className="panel-heading"><h3>{kind === 'special' ? people?.categories.special || 'My special person' : people?.categories.friends || 'Friends'}</h3><span className="pill">{kind === 'special' ? `${rows.length} / 1` : `${rows.length} FRIENDS`}</span></div>{rows.length === 0 && <div className="empty-people"><span aria-hidden="true">{kind === 'special' ? '✦' : '◌'}</span><p>{kind === 'special' ? 'A little place for your favourite person.' : 'There’s always room for good friends.'}</p></div>}{rows.map(person => <article className="connection-card" key={person.id}><div className="connection-identity"><Avatar id={person.avatar} design={person.avatarDesign} /><div><h4>{person.petName || person.nickname}</h4>{person.petName && <p>{person.nickname}</p>}</div></div><form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void action({ type: 'label', id: person.id, petName: String(data.get('petName') || '') }); }}><label className="field-label" htmlFor={`pet-${person.id}`}>Your pet name for them <span>(only you see this)</span></label><div className="pet-name-field"><input className="profile-input" id={`pet-${person.id}`} name="petName" defaultValue={person.petName} key={person.petName} maxLength={24} placeholder="A little name, just for you" /><button className="button secondary" disabled={busy}>Save</button></div></form><div className="connection-actions"><button className="text-button" disabled={busy} onClick={() => setConfirm({ type: 'remove', id: person.id, name: person.nickname })}>Remove connection</button><button className="text-button danger" disabled={busy} onClick={() => setConfirm({ type: 'block', id: person.accountId, name: person.nickname })}>Block</button></div></article>)}<button className="button secondary full" disabled={busy || (kind === 'special' && !!specialPerson)} onClick={() => action({ type: 'invite', kind })}>{kind === 'special' ? specialPerson ? 'Your special place is taken' : 'Invite my special person' : 'Invite a friend'} <span aria-hidden="true">↗</span></button></section>;
    })}</div>
    {link && <div className="people-share"><h3>A little link for your person.</h3><p>Share it privately. Only the first accepting account can use it.</p><label className="field-label" htmlFor="people-link">Private invitation link</label><input className="profile-input" id="people-link" readOnly value={link} onFocus={e => e.currentTarget.select()} /><button className="button primary" onClick={async () => { try { await navigator.clipboard.writeText(link); setMessage('Invitation link copied.'); } catch { setMessage('Select and copy the link above.'); } }}>Copy people invitation</button></div>}
    {confirm && <section className="people-confirm" role="alert"><h3>{confirm.type === 'block' ? 'Block' : 'Remove'} {confirm.name}?</h3><p>{confirm.type === 'block' ? 'This removes your connection and leaves any shared room. Account invitations from them will be blocked.' : 'This removes the connection for both of you. You can reconnect with a new accepted invitation.'}</p><button className="button secondary" disabled={busy} onClick={() => action({ type: confirm.type, id: confirm.id })}>Confirm {confirm.type}</button><button className="text-button" onClick={() => setConfirm(null)}>Keep things as they are</button></section>}
    <form className="category-settings" onSubmit={e => { e.preventDefault(); void action({ type: 'categories', friends, special }); }}><h3>Your names for your people.</h3><p>These category names are private to your account.</p><div><label className="field-label" htmlFor="category-special">Special-person category</label><input className="profile-input" id="category-special" value={special} onChange={e => setSpecial(e.target.value)} required maxLength={24} placeholder="My love" /><label className="field-label" htmlFor="category-friends">Friends category</label><input className="profile-input" id="category-friends" value={friends} onChange={e => setFriends(e.target.value)} required maxLength={24} placeholder="My people" /></div><button className="button primary" disabled={busy}>Save category names</button></form>
    {!!people?.invitations.length && <section className="people-invites"><h3>Open invitations</h3>{people.invitations.map(i => <div key={i.id}><span>{i.kind === 'special' ? 'Special person' : 'Friend'} · expires {new Date(i.expiresAt).toLocaleDateString()}</span><button className="text-button" disabled={busy} onClick={() => action({ type: 'revoke', id: i.id })}>Revoke invitation</button></div>)}</section>}
    {!!people?.blocked.length && <section className="people-invites"><h3>Blocked accounts</h3>{people.blocked.map(p => <div key={p.id}><span>{p.nickname}</span><button className="text-button" disabled={busy} onClick={() => action({ type: 'unblock', id: p.id })}>Unblock</button></div>)}</section>}
    <p className="input-help">Connections never grant automatic room access. Blocking applies to signed-in identities; anonymous guests cannot be reliably identified as a blocked account.</p>
  </section>;
}
