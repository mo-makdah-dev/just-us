import type { GameAction, GameSessionCommand, RoomView } from '../../../packages/protocol/src/index.js';
import { gameDefinition } from '../../../packages/games/src/catalogue.js';
import { clientGameModules } from './gameRegistry.js';
import { GameWaitingRoom } from './GameWaitingRoom.js';
import { useTurnSound } from './useMoveSound.js';
export function GameScreen({ room, disabled, onAction, onSession, onLibrary }: {
    room: RoomView;
    disabled: boolean;
    onAction: (action: GameAction) => Promise<boolean>;
    onSession: (command: GameSessionCommand) => Promise<boolean>;
    onLibrary: () => void;
}) {
    const session = room.gameSession;
    const module = session ? clientGameModules[session.gameId] : null;
    const sound = useTurnSound(session && module ? module.turnSignal(session) : null);
    if (!session || !module)
        return null;
    const definition = gameDefinition(session.gameId);
    return <section className="shared-game-screen" aria-label={`${definition.name} session`}>
    <header className="shared-game-heading"><div><p className="eyebrow">{session.phase === 'playing' ? 'PLAYING TOGETHER' : 'YOUR GAME NIGHT'}</p><h2>{definition.name}</h2></div><div>
      <button type="button" className="icon-button" aria-label={sound.enabled ? 'Mute game sounds' : 'Enable game sounds'} aria-pressed={sound.enabled} onClick={sound.toggle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/>{sound.enabled ? <path d="M17 8a6 6 0 010 8m3-11a10 10 0 010 14"/> : <path d="m17 9 5 6m0-6-5 6"/>}</svg></button>
      <button type="button" className="text-button" onClick={onLibrary}>Games ↗</button>
    </div></header>
    {session.phase !== 'playing' && <GameWaitingRoom room={room} session={session} definition={definition} disabled={disabled} onCommand={onSession}/>}
    {session.phase !== 'waiting' && module.render({ room, session, disabled, onAction })}
  </section>;
}
