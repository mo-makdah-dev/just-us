import { z } from 'zod';
import type { GameTotals } from '../../../../packages/protocol/src/index.js';
export const totalsSchema = z.object({ played: z.number().int().nonnegative(), wins: z.number().int().nonnegative(), draws: z.number().int().nonnegative(), losses: z.number().int().nonnegative(), points: z.number().int().nonnegative(), forfeits: z.number().int().nonnegative() });
export const emptyTotals = (): GameTotals => ({ played: 0, wins: 0, draws: 0, losses: 0, points: 0, forfeits: 0 });
export type GameIdentity = {
    id: string;
    name: string;
    key: string | null;
};
export type GamePlayer = GameIdentity & {
    connected: boolean;
};
export type GameContext = {
    players: GamePlayer[];
    self: string;
    owner: boolean;
    now: number;
    record: (entry: GameIdentity, delta: GameTotals) => void;
};
export class GameRuleError extends Error {
    constructor(public code: string, message: string) { super(message); }
}
export function requireGame(condition: unknown, code: string, message: string): asserts condition { if (!condition)
    throw new GameRuleError(code, message); }
