import { useState } from 'react';
import { Avatar } from '../../../packages/avatar/src/Avatar.js';
import type { GameSessionCommand, GameSessionView, RoomView } from '../../../packages/protocol/src/index.js';
import type { GameDefinition } from '../../../packages/games/src/catalogue.js';
export function GameWaitingRoom({ room, session, definition, disabled, onCommand }: {
    room: RoomView;
    session: GameSessionView;
    definition: GameDefinition;
    disabled: boolean;
    onCommand: (command: GameSessionCommand) => Promise<boolean>;
}) {
    const [pending, setPending] = useState(false);
    const [pendingMode,setPendingMode]=useState<string|null>(null);
    const self = room.players.find(p => p.isYou);
    const seat = session.participants.find(p => p.playerId === self?.id);
    const mode = definition.modes.find(m => m.id === session.mode)!;
    const full = session.participants.length >= mode.maxPlayers;
    const ready = session.participants.filter(p => p.ready && room.players.some(peer => peer.id === p.playerId && peer.connected)).length;
    const canStart = session.participants.length >= mode.minPlayers && ready === session.participants.length;
    const locked = disabled || pending;
    const spectators = room.players.filter(p => !session.participants.some(seat => seat.playerId === p.id));
    async function send(command:GameSessionCommand) {
        if(locked)return;
        if(command.action==='mode')setPendingMode(command.mode);
        setPending(true);
        try {await onCommand({...command,sessionId:session.id});}
        finally {setPending(false);setPendingMode(null);}
    }
    const reason = session.participants.length < mode.minPlayers ? `Waiting for ${mode.minPlayers - session.participants.length} more ${mode.minPlayers - session.participants.length === 1 ? 'player' : 'players'}.` : !canStart ? 'Waiting for everyone to be ready.' : session.canConfigure ? 'Everyone’s here. Let’s play.' : 'Ready. The admin can start the game.';
    return <section className="game-waiting-room" aria-label="Game waiting room">
    <div className="waiting-intro"><span className="waiting-symbol" aria-hidden="true">{definition.mark}</span><div><p className="eyebrow">BEFORE WE PLAY</p><h2>Make room for a little fun.</h2><p>Take a seat, get ready, and play together.</p></div></div>
    <fieldset className="waiting-modes" disabled={locked || !session.canConfigure}>
      <legend>How are we playing?</legend>
      {definition.modes.map(option => <label className={option.id === (pendingMode??mode.id) ? 'selected' : ''} key={option.id}>
        <input type="radio" name="session-mode" checked={(pendingMode??mode.id) === option.id} onChange={() => void send({ action: 'mode', mode: option.id })}/>
        <strong>{option.name}</strong><small>{option.minPlayers === option.maxPlayers ? option.minPlayers : `${option.minPlayers}–${option.maxPlayers}`} players</small>
      </label>)}
    </fieldset>
    <p className="waiting-mode-description">{mode.description}</p>
    <div className={`waiting-seats seats-${mode.maxPlayers}`} aria-label="Game seats">
      {Array.from({ length: mode.maxPlayers }, (_, index) => {
            const participant = session.participants[index], person = room.players.find(p => p.id === participant?.playerId);
            return person && participant ? <article className={`waiting-seat ${participant.ready && person.connected ? 'is-ready' : ''} ${person.isYou ? 'is-self' : ''}`} key={person.id}>
          <span className="seat-number">PLAYER {index + 1}</span><div className="seat-avatar"><Avatar id={person.avatar} design={person.avatarDesign}/><span aria-hidden="true">✦</span></div>
          <h3>{person.petName || person.nickname}{person.isYou && <small>you</small>}</h3>
          <span className="seat-state"><i aria-hidden="true"/>{!person.connected ? 'Reconnecting' : participant.ready ? 'Ready to play' : 'Getting ready'}</span>
          {person.isYou && <button type="button" className="seat-leave" aria-label="Leave my game seat" title="Leave seat" disabled={locked} onClick={() => void send({ action: 'leave' })}>×</button>}
        </article> : <button type="button" className="waiting-seat empty-seat" key={`empty-${index}`} disabled={locked || !!seat} onClick={() => void send({ action: 'join' })} aria-label={`Join game in seat ${index + 1}`}>
          <span className="seat-number">OPEN SEAT</span><span className="empty-seat-art" aria-hidden="true">+</span><strong>{seat ? 'Save a seat for a friend' : 'This could be you'}</strong><small>{seat ? 'Waiting for someone to join' : 'Tap to join the game'}</small>
        </button>;
        })}
    </div>
    <div className="waiting-ready-strip" role="status"><span className="waiting-presence" aria-hidden="true"/><span>{reason}</span><small>{ready} / {session.participants.length} ready</small></div>
    <div className="waiting-actions">
      {!seat ? <button type="button" className="button primary" disabled={locked || full} onClick={() => void send({ action: 'join' })}>{full ? 'Seats are full' : 'Join game'}</button> : <button type="button" className={`button ${seat.ready ? 'secondary' : 'primary'}`} disabled={locked} aria-pressed={seat.ready} onClick={() => void send({ action: 'ready', ready: !seat.ready })}>{seat.ready ? 'Ready ✓' : 'I’m ready'}</button>}
      {session.canConfigure && <button type="button" className="button primary start-shared-game" disabled={locked || !canStart} aria-busy={pending} onClick={() => void send({ action: 'start' })}>{pending ? 'One moment…' : session.phase === 'results' ? 'Play again' : 'Start game'}<span aria-hidden="true"> →</span></button>}
    </div>
    {spectators.length > 0 && <div className="waiting-watchers"><div>{spectators.map(person => <Avatar key={person.id} id={person.avatar} design={person.avatarDesign} label={person.nickname}/>)}</div><p>{spectators.map(person => person.isYou ? 'You' : person.petName || person.nickname).join(', ')}{spectators.length === 1 ? ' is' : ' are'} watching. {full ? 'Enjoy this round together.' : 'Anyone can take an open seat.'}</p></div>}
    <p className="waiting-fine-print">{seat ? 'Your seat is yours. You can leave it or change your ready status.' : 'Watching is welcome, too.'} {session.canConfigure ? '' : 'The admin chooses the mode and starts play.'}</p>
  </section>;
}
