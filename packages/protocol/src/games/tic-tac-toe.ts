import type { GameTotals } from '../index.js';
export type TicTacToeMode = 'single' | 'knockout' | 'league';
export type TicTacToeEntry = {
    id: string;
    name: string;
    signedIn?: boolean;
};
export type TicTacToeMatch = {
    id: string;
    x: TicTacToeEntry;
    o: TicTacToeEntry;
    board: ('X' | 'O' | null)[];
    turn: 'X' | 'O';
    status: 'playing' | 'won' | 'draw' | 'forfeit' | 'void';
    winner: string | null;
    line: number[];
    fixtureId: string | null;
    endedAt: number | null;
};
export type TicTacToeFixture = {
    id: string;
    x: string;
    o: string | null;
    status: 'pending' | 'done' | 'void';
    winner: string | null;
    draw: boolean;
    round: number;
    attempt: number;
};
export type TicTacToeCompetition = {
    id: string;
    mode: 'knockout' | 'league';
    status: 'running' | 'completed' | 'cancelled';
    entrants: TicTacToeEntry[];
    fixtures: TicTacToeFixture[];
    round: number;
    champions: string[];
};
export type TicTacToeView = {
    open: boolean;
    hands: string[];
    match: TicTacToeMatch | null;
    competition: TicTacToeCompetition | null;
    scores: (GameTotals & {
        id: string;
        name: string;
        isYou: boolean;
    })[];
    recent: {
        id: string;
        x: string;
        o: string;
        outcome: string;
        winner: string | null;
    }[];
};
export type TicTacToeAction = {
    action: 'open' | 'hand' | 'start' | 'move' | 'next' | 'rematch' | 'resign' | 'cancel' | 'lobby';
    mode?: TicTacToeMode;
    players?: string[];
    random?: boolean;
    matchId?: string;
    cell?: number;
    ply?: number;
    raised?: boolean;
    fixtureId?: string;
};

/** Only board/round actions travel through the new game-action channel. */
export type TicTacToeGameAction={action:'move'|'resign'|'next'|'cancel';matchId?:string;cell?:number;ply?:number;fixtureId?:string};
