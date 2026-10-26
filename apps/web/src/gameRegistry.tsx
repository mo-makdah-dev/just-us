import type { GameAction, GameSessionCommand, GameSessionView, RoomView } from '../../../packages/protocol/src/index.js';
import type { ReactNode } from 'react';
import { TicTacToe } from './games/tic-tac-toe/Game.js';
export type GameRendererProps = {
    room: RoomView;
    session: GameSessionView;
    disabled: boolean;
    onAction: (action: GameAction) => Promise<boolean>;
};
export type ClientGameModule = {
    render: (props: GameRendererProps) => ReactNode;
    turnSignal: (session: GameSessionView) => {
        id: string;
        turn: number;
    } | null;
};
/** Each entry is a game-owned adapter. Shared screens do not inspect board data. */
export const clientGameModules = {
    'tic-tac-toe': {
        render: ({ room, session, disabled, onAction }: GameRendererProps) => session.gameId === 'tic-tac-toe' ? <TicTacToe room={room} game={session.game} disabled={disabled} onAction={action => onAction({ gameId: 'tic-tac-toe', action })}/> : null,
        turnSignal: (session: GameSessionView) => { if (session.gameId !== 'tic-tac-toe')
            return null; const match = session.game.match; return match ? { id: match.id, turn: match.board.filter(Boolean).length } : null; },
    },
} satisfies Record<GameSessionView['gameId'], ClientGameModule>;
