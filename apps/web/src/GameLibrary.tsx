import type {GameId} from '../../../packages/protocol/src/index.js';
import {gameDefinitions} from '../../../packages/games/src/catalogue.js';
import { useEffect, useRef } from 'react';

const catalogue = [
  ...Object.values(gameDefinitions).map(game=>({id:game.id,name:game.name,kind:game.cover,mark:game.mark,players:String(game.modes[0].minPlayers),description:game.description})),
  { name: 'Matching answers', kind: 'match', mark: '“ ”', players: '2–6', description: 'Same question. What will you both say?' },
  { name: 'Colour Hue', kind: 'hue', mark: '◒', players: '2–6', description: 'A little clue. A world of colour.' },
  { name: 'Bingo', kind: 'bingo', mark: '24', players: '2–6', description: 'Your lucky numbers, together.' },
  { name: 'Character guessing', kind: 'character', mark: '?', players: 'To be confirmed', description: 'Meet an original cast. Find the mystery face.' },
  { name: 'Social bluffing', kind: 'bluff', mark: '◐', players: 'To be confirmed', description: 'Someone is improvising. Can you spot them?' },
] as const;

export function GameLibrary({ open, onClose, canPlay, onPlay }: { open: boolean; onClose: () => void; canPlay: boolean; onPlay: (gameId:GameId) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open) dialog.current?.close(); }, [open]);
  return <dialog ref={dialog} className="dialog game-library" aria-labelledby="library-title" onCancel={onClose}>
    <div className="library-heading"><div><p className="eyebrow">PICK A LITTLE ADVENTURE</p><h2 id="library-title">The games library.</h2><p>Choose something to play together. More games are on their way.</p></div><button className="icon-button" aria-label="Close game library" onClick={onClose}>×</button></div>
    {!canPlay && <p className="game-help">The room owner chooses the game. Everyone can join a seat or watch.</p>}
    <div className="library-grid">{catalogue.map(game => <button type="button" className="library-card" key={game.name} disabled={!('id' in game) || !canPlay} onClick={()=>{'id' in game&&onPlay(game.id);}} aria-label={'id' in game ? `Play ${game.name}` : `Play ${game.name} — coming soon`}>
      <div className={`game-cover cover-${game.kind}`}><span className="cover-mark" aria-hidden="true">{game.mark}</span><span className="cover-status">{'id' in game ? 'Free · ready to play' : 'Coming soon'}</span></div>
      <div className="game-card-heading"><strong>{game.name}</strong><span>{game.players}{game.players !== 'To be confirmed' && ' players'}</span></div><p>{game.description}</p>
    </button>)}</div>
  </dialog>;
}
