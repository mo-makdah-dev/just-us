import { z } from 'zod';
import { gameDefinitions } from '../../../../../packages/games/src/catalogue.js';
import type { GameContracts, TicTacToeGameAction } from '../../../../../packages/protocol/src/index.js';
import { actTicTacToe, anonymizeTicTacToe, emptyTicTacToe, projectTicTacToe, reconcileTicTacToe, stopTicTacToe, ticTacToeSchema, type TicTacToeState } from './rules.js';
import { registerGame, type GameModule } from '../module.js';

export const ticTacToeActionSchema = z.object({
    action: z.enum(['open', 'hand', 'start', 'move', 'next', 'rematch', 'resign', 'cancel', 'lobby']),
    mode: z.enum(['single', 'knockout', 'league']).optional(), players: z.array(z.string().regex(/^[a-f0-9]{32}$/)).min(2).max(4).optional(),
    random: z.boolean().optional(), matchId: z.string().regex(/^[a-f0-9]{32}$/).optional(), cell: z.number().int().min(0).max(8).optional(),
    ply: z.number().int().min(0).max(8).optional(), raised: z.boolean().optional(), fixtureId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
}).strict();
const boardActionSchema=z.object({action:z.enum(['move','resign','next','cancel']),matchId:z.string().regex(/^[a-f0-9]{32}$/).optional(),cell:z.number().int().min(0).max(8).optional(),ply:z.number().int().min(0).max(8).optional(),fixtureId:z.string().regex(/^[a-f0-9]{32}$/).optional()}).strict();
const ticTacToe: GameModule<TicTacToeState, TicTacToeGameAction, GameContracts['tic-tac-toe']['view']> = {
    definition: gameDefinitions['tic-tac-toe'], stateSchema: ticTacToeSchema, actionSchema: boardActionSchema,
    create: emptyTicTacToe,
    open: (state, ctx) => actTicTacToe(state, { action: 'open' }, { ...ctx, owner: true }),
    start: (state, mode, players, ctx) => {
        const previous = state.match;
        const rematch = mode === 'single' && previous && previous.status !== 'playing' && previous.status !== 'void' && players.length === 2 && players.includes(previous.x.id) && players.includes(previous.o.id);
        actTicTacToe(state, rematch ? { action: 'rematch' } : { action: 'start', mode: z.enum(['single', 'knockout', 'league']).parse(mode), players }, { ...ctx, owner: true });
    },
    permission: action => action.action === 'next' ? 'configure' : action.action==='cancel' ? 'owner' : 'player',
    act: (state, action, ctx) => {
        actTicTacToe(state, action, ctx);
    },
    reconcile: reconcileTicTacToe,
    clear: state => { stopTicTacToe(state); state.scores = state.scores.filter(row => row.key?.startsWith('account:')); },
    anonymize: anonymizeTicTacToe,
    phase: state => state.match?.status === 'playing' || state.competition?.status === 'running' ? 'playing' : state.match ? 'results' : 'waiting',
    project: (state, ctx) => projectTicTacToe(state, ctx.self, ctx.players.find(p => p.id === ctx.self)?.key || null),
    legacy: { command: 'ticTacToe', projection: 'ticTacToe', isOpen: state => state.open, act: (state, raw, ctx, allow) => {
            const action = ticTacToeActionSchema.parse(raw);
            actTicTacToe(state, action, { ...ctx, owner: ctx.owner || (allow && ['open', 'start', 'next', 'rematch'].includes(action.action)) });
        } },
};
export const ticTacToeModule = registerGame(ticTacToe);
