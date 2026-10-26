import { z } from 'zod';
import { ticTacToeModule, ticTacToeActionSchema } from './tic-tac-toe/module.js';
import type { RegisteredGame } from './module.js';
import type { GameId } from '../../../../packages/protocol/src/index.js';
export const legacyGameActionSchema = ticTacToeActionSchema;
export const gameModules = { 'tic-tac-toe': ticTacToeModule } satisfies Record<GameId, RegisteredGame>;
export type GameRegistry = Record<string, RegisteredGame>;
export const gameIdSchema = z.enum(Object.keys(gameModules) as [
    keyof typeof gameModules
]);
export const sessionCommandSchema = z.discriminatedUnion('action', [
    z.object({ action: z.literal('open'), gameId: gameIdSchema,sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict(),
    z.object({ action: z.enum(['join', 'leave', 'start']),sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict(),
    z.object({ action: z.literal('ready'), ready: z.boolean(),sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict(),
    z.object({ action: z.literal('mode'), mode: z.string().max(40),sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict(),
]);
export const gameActionSchema = z.object({ gameId: gameIdSchema, action: z.unknown(),sessionId:z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict();
/** Migration is centralized here, away from room orchestration. */
export function migrateGameStates(value: unknown, legacy?: unknown): Record<string, unknown> {
    const stored = z.record(z.string(), z.unknown()).parse(value ?? {});
    if (legacy && !stored['tic-tac-toe'])
        stored['tic-tac-toe'] = legacy;
    return Object.fromEntries(Object.entries(stored).map(([id,raw])=>[id,Object.hasOwn(gameModules,id)?gameModules[id as keyof typeof gameModules].parse(raw):raw]));
}
export const DEFAULT_GAME_ID = 'tic-tac-toe' as const;
export function legacyAccountScore<T>(scores: Record<string, T>) { return scores[DEFAULT_GAME_ID]; }
export function migrateAccountScores(raw: unknown): unknown { const state = z.record(z.string(), z.unknown()).parse(raw); if (!state.gameScoresByGame) {
    const old = z.record(z.string(), z.unknown()).parse(state.gameScores ?? {});
    state.gameScoresByGame = Object.fromEntries(Object.entries(old).map(([id, score]) => [id, { [DEFAULT_GAME_ID]: score }]));
} return state; }
export function migrateGameRoom(raw: unknown): unknown { const row = z.record(z.string(), z.unknown()).parse(raw); return { ...row, gameStates: migrateGameStates(row.gameStates, row.ticTacToe) }; }
