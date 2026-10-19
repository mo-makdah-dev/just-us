import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import type { AccountView } from '../../../packages/protocol/src/index.js';
export type NavIconName = 'home' | 'people' | 'scores' | 'settings' | 'arrow' | 'spark';
export function NavIcon({ name }: { name: NavIconName }) {
  const paths = { home: 'M3 10l9-7 9 7v10H3zM9 20v-7h6v7', people: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', scores: 'M8 21h8M12 17v4M7 3h10v6a5 5 0 01-10 0zM7 5H3v3a4 4 0 004 4M17 5h4v3a4 4 0 01-4 4', settings: 'M12 8a4 4 0 100 8 4 4 0 000-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z', arrow: 'M5 12h14M13 6l6 6-6 6', spark: 'M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z' };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
export function AppNavigation({ account, current, onNavigate, onProfile }: { account: AccountView; current: string; onNavigate: (href: string) => void; onProfile: () => void }) {
  const items: { label: string; short: string; href: string; icon: NavIconName }[] = [
    { label: 'Dashboard', short: 'Lounge', href: '/dashboard', icon: 'home' },
    { label: 'Your people', short: 'People', href: '/account?section=people', icon: 'people' },
    { label: 'Your scores', short: 'Scores', href: '/account?section=scores', icon: 'scores' },
    { label: 'Account settings', short: 'Settings', href: '/account?section=security', icon: 'settings' },
  ];
  return <nav className="header-account modern-member-nav" aria-label="Account"><div className="member-links">{items.map(item => <a key={item.href} className="header-nav-link" href={item.href} aria-label={item.label} aria-current={current === item.href ? 'page' : undefined} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onNavigate(item.href); }}><NavIcon name={item.icon}/><span className="nav-full-label">{item.label}</span><span className="nav-short-label">{item.short}</span></a>)}</div><button className="account-nav-button" onClick={onProfile} aria-label={'Profile for ' + account.nickname}><Avatar id={account.avatar} design={account.avatarDesign}/><span>{account.nickname}</span></button></nav>;
}
