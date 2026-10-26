import { useEffect, useState } from 'react';
import type { PeopleView, RoomDirectoryView, SessionView } from '../../../packages/protocol/src/index.js';
import { accountRequest } from './People.js';

export function DashboardStats({ session }: { session: SessionView }) {
  const [counts, setCounts] = useState<{ rooms: number; people: number } | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [rooms, people] = await Promise.all([accountRequest<RoomDirectoryView>('/api/saved-rooms', session.csrf), accountRequest<PeopleView>('/api/people', session.csrf)]);
        if (active) { setCounts({ rooms: rooms.rooms.length, people: people.connections.length }); setError(false); }
      } catch { if (active) setError(true); }
    };
    void refresh(); window.addEventListener('just-us-session', refresh); window.addEventListener('focus', refresh);
    return () => { active = false; window.removeEventListener('just-us-session', refresh); window.removeEventListener('focus', refresh); };
  }, [session.account?.id, session.csrf]);
  const unknown = error ? 'Unavailable' : '…';
  return <section aria-label="Your statistics"><dl className="dashboard-stats">
    <div><dt>Saved rooms</dt><dd>{error ? unknown : counts?.rooms ?? unknown}</dd></div>
    <div><dt>Your people</dt><dd>{error ? unknown : counts?.people ?? unknown}</dd></div>
    <div><dt>Games played</dt><dd>{Object.values(session.scoresByGame || {}).reduce((total,score)=>total+(score?.played||0),0)}</dd></div>
    <div><dt>Wins</dt><dd>{Object.values(session.scoresByGame || {}).reduce((total,score)=>total+(score?.wins||0),0)}</dd></div>
  </dl>{error && <p className="input-help" role="status">Room and people totals couldn’t load. They’ll retry when you return to this window.</p>}</section>;
}
