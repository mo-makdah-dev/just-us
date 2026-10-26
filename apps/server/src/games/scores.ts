import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { GameContext, GameIdentity } from './contracts.js';
import { emptyTotals, totalsSchema } from './contracts.js';
import type { GameTotals } from '../../../../packages/protocol/src/index.js';
export const scoreRowSchema = totalsSchema.extend({ id: z.string(), key: z.string().nullable(), name: z.string() });
export type ScoreRow = z.infer<typeof scoreRowSchema>;
/** Shared identity, retention and account-only score policy for every game. */
export function recordGameScore(ledger: {
    scores: ScoreRow[];
}, entry: GameIdentity, delta: GameTotals, context: GameContext) {
    if (!entry.key?.startsWith('account:'))
        return;
    let row = ledger.scores.find(row => row.key === entry.key);
    if (!row) {
        row = { ...emptyTotals(), id: randomBytes(16).toString('hex'), key: entry.key, name: entry.name };
        ledger.scores.push(row);
    }
    row.name = entry.name;
    for (const key of Object.keys(delta) as (keyof GameTotals)[])
        row[key] += delta[key];
    if (ledger.scores.length > 256)
        ledger.scores.splice(0, ledger.scores.length - 256);
    context.record(entry, delta);
}
export function recordAccountScore(scores: Record<string, Record<string, GameTotals>>, gameId: string, accountId: string, delta: GameTotals) {
    const games = scores[accountId] ||= {}, score = games[gameId] ||= emptyTotals();
    for (const key of Object.keys(delta) as (keyof GameTotals)[])
        score[key] += delta[key];
}
