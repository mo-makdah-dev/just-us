import type { GameId } from '../../protocol/src/index.js';
export type GameModeDefinition = {
    id: string;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    symbol: string;
};
export type GameDefinition = {
    id: string;
    name: string;
    description: string;
    mark: string;
    cover: string;
    modes: readonly GameModeDefinition[];
};
export const gameDefinitions = {
    'tic-tac-toe': {
        id: 'tic-tac-toe', name: 'Tic-tac-toe', description: 'A familiar favourite, one move at a time.', mark: '× ○', cover: 'tiles',
        modes: [
            { id: 'single', name: 'Quick match', description: 'Two players. One little rivalry.', minPlayers: 2, maxPlayers: 2, symbol: '× ○' },
            { id: 'knockout', name: 'Knockout', description: 'A bracket. One champion.', minPlayers: 2, maxPlayers: 4, symbol: '♜' },
            { id: 'league', name: 'League', description: 'Everyone plays. Every point counts.', minPlayers: 2, maxPlayers: 4, symbol: '✦' },
        ],
    },
} as const satisfies Record<GameId, GameDefinition>;
export function gameDefinition(id: GameId): GameDefinition { return gameDefinitions[id]; }
