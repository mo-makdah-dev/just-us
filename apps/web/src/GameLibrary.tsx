import { useEffect, useRef } from 'react';

const catalogue = [
  { name: 'Matching answers', kind: 'match', mark: '“ ”', players: '2–6', description: 'Same question. What will you both say?' },
  { name: 'Colour Hue', kind: 'hue', mark: '◒', players: '2–6', description: 'A little clue. A world of colour.' },
  { name: 'Tic-tac-toe', kind: 'tiles', mark: '× ○', players: '2', description: 'A familiar favourite, one move at a time.' },
  { name: 'Bingo', kind: 'bingo', mark: '24', players: '2–6', description: 'Your lucky numbers, together.' },
  { name: 'Character guessing', kind: 'character', mark: '?', players: 'To be confirmed', description: 'Meet an original cast. Find the mystery face.' },
  { name: 'Social bluffing', kind: 'bluff', mark: '◐', players: 'To be confirmed', description: 'Someone is improvising. Can you spot them?' },
] as const;

export function GameLibrary({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open) dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="dialog game-library" aria-labelledby="library-title" onCancel={onClose}>
    <div className="library-heading"><div><p className="eyebrow">PICK A LITTLE ADVENTURE</p><h2 id="library-title">The games library.</h2><p>Our first games are on their way. All free while we experiment.</p></div><button className="icon-button" aria-label="Close game library" onClick={onClose}>×</button></div>
    <div className="library-grid">{catalogue.map(game => <article className="library-card" key={game.name} tabIndex={0} aria-label={`${game.name}, coming soon`}>
      <div className={`game-cover cover-${game.kind}`}><span className="cover-mark" aria-hidden="true">{game.mark}</span><span className="cover-status">Coming soon</span><button className="game-play" disabled aria-label={`Play ${game.name} — coming soon`}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg></button></div>
      <div className="game-card-heading"><h3>{game.name}</h3><span>{game.players}{game.players !== 'To be confirmed' && ' players'}</span></div><p>{game.description}</p>
    </article>)}</div>
  </dialog>;
}
