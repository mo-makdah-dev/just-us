import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import {recordGameScore,scoreRowSchema} from '../scores.js';
import type { GameTotals, TicTacToeAction, TicTacToeView } from '../../../../../packages/protocol/src/index.js';

const id = () => randomBytes(16).toString('hex');
import {GameRuleError, type GameContext} from '../contracts.js';
export {emptyTotals, totalsSchema, GameRuleError} from '../contracts.js';
export type {GamePlayer} from '../contracts.js';
const entrySchema = z.object({ id: z.string(), name: z.string(), key: z.string().nullable() });
const matchSchema = z.object({ id: z.string(), x: entrySchema, o: entrySchema, board: z.array(z.enum(['X', 'O']).nullable()).length(9), turn: z.enum(['X', 'O']), status: z.enum(['playing', 'won', 'draw', 'forfeit', 'void']), winner: z.string().nullable(), line: z.array(z.number().int().min(0).max(8)).max(3), fixtureId: z.string().nullable(), endedAt: z.number().nullable() });
const fixtureSchema = z.object({ id: z.string(), x: z.string(), o: z.string().nullable(), status: z.enum(['pending', 'done', 'void']), winner: z.string().nullable(), draw: z.boolean(), round: z.number(), attempt: z.number() });
const competitionSchema = z.object({ id: z.string(), mode: z.enum(['knockout', 'league']), status: z.enum(['running', 'completed', 'cancelled']), entrants: z.array(entrySchema).min(2).max(4), fixtures: z.array(fixtureSchema).max(12), round: z.number(), champions: z.array(z.string()).max(4) });
export const ticTacToeSchema = z.object({ open: z.boolean(), hands: z.array(z.string()).max(4), match: matchSchema.nullable(), competition: competitionSchema.nullable(), scores: z.array(scoreRowSchema).max(256), recent: z.array(z.object({ id: z.string(), x: z.string(), o: z.string(), outcome: z.string(), winner: z.string().nullable() })).max(40) });
export type TicTacToeState = z.infer<typeof ticTacToeSchema>;
type Entry = z.infer<typeof entrySchema>;
type Match = z.infer<typeof matchSchema>;
type Fixture = z.infer<typeof fixtureSchema>;

type Context = GameContext;
function requireRule(condition: unknown, code: string, message: string): asserts condition { if (!condition) throw new GameRuleError(code, message); }
export function emptyTicTacToe(): TicTacToeState { return { open: false, hands: [], match: null, competition: null, scores: [], recent: [] }; }
export const winningLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function shuffle<T>(items: T[]): T[] { const output = [...items]; for (let i = output.length - 1; i > 0; i--) { const j = randomInt(i + 1); [output[i], output[j]] = [output[j], output[i]]; } return output; }
function newMatch(x: Entry, o: Entry, fixtureId: string | null = null): Match { return { id: id(), x: { id: x.id, name: x.name, key: x.key }, o: { id: o.id, name: o.name, key: o.key }, board: Array(9).fill(null), turn: 'X', status: 'playing', winner: null, line: [], fixtureId, endedAt: null }; }
function fixture(x: string, o: string | null, round: number): Fixture { return { id: id(), x, o, status: o ? 'pending' : 'done', winner: o ? null : x, draw: false, round, attempt: 0 }; }
function pairRound(ids: string[], round: number) { const rows: Fixture[] = []; for (let i = 0; i < ids.length; i += 2) rows.push(fixture(ids[i], ids[i + 1] || null, round)); return rows; }
function pointsFor(c: NonNullable<TicTacToeState['competition']>, player: string) { return c.fixtures.reduce((sum, f) => sum + (f.status === 'done' && f.o && (f.x === player || f.o === player) ? f.winner === player ? 3 : f.draw ? 1 : 0 : 0), 0); }
function progress(g: TicTacToeState) {
  const c = g.competition; if (!c || c.status !== 'running') return;
  if (c.mode === 'league') {
    if (c.fixtures.some(f => f.status === 'pending')) return;
    c.status = 'completed';
    if (!c.fixtures.some(f => f.status === 'done')) return;
    const best = Math.max(...c.entrants.map(e => pointsFor(c, e.id)));
    c.champions = c.entrants.filter(e => pointsFor(c, e.id) === best).map(e => e.id); return;
  }
  const round = c.fixtures.filter(f => f.round === c.round);
  if (round.some(f => f.status === 'pending')) return;
  const winners = round.flatMap(f => f.winner ? [f.winner] : []);
  if (winners.length <= 1) { c.status = 'completed'; c.champions = winners; }
  else { c.round++; c.fixtures.push(...pairRound(winners, c.round)); }
}
function finish(g: TicTacToeState, m: Match, ctx: Context, status: Match['status'], winner: string | null, line: number[] = []) {
  requireRule(m.status === 'playing', 'GAME_FINISHED', 'This match has already ended.');
  m.status = status; m.winner = winner; m.line = line; m.endedAt = ctx.now;
  if (status !== 'void') for (const e of [m.x, m.o]) {
    const draw = status === 'draw', win = e.id === winner;
    const delta: GameTotals = { played: 1, wins: win ? 1 : 0, draws: draw ? 1 : 0, losses: !draw && !win ? 1 : 0, points: win ? 3 : draw ? 1 : 0, forfeits: status === 'forfeit' && !win ? 1 : 0 };
    recordGameScore(g,e,delta,ctx);
  }
  g.recent.unshift({ id: m.id, x: m.x.name, o: m.o.name, outcome: status, winner: winner === m.x.id ? m.x.name : winner === m.o.id ? m.o.name : null }); g.recent = g.recent.slice(0, 40);
  const c = g.competition, f = c?.fixtures.find(f => f.id === m.fixtureId);
  if (c?.status === 'running' && f) {
    if (status === 'draw' && c.mode === 'knockout') { [f.x, f.o] = [f.o!, f.x]; f.attempt++; }
    else { f.status = status === 'void' ? 'void' : 'done'; f.winner = winner; f.draw = status === 'draw'; progress(g); }
  }
}
export function stopTicTacToe(g: TicTacToeState) {
  g.open = false; g.match = null; g.competition = null; g.hands = []; g.recent = [];
}
export function reconcileTicTacToe(g: TicTacToeState, ctx: Context) {
  g.hands = g.hands.filter(id => ctx.players.some(p => p.id === id));
  const m = g.match;
  if (m?.status === 'playing') {
    const x = ctx.players.some(p => p.id === m.x.id), o = ctx.players.some(p => p.id === m.o.id);
    if (!x || !o) finish(g, m, ctx, x || o ? 'forfeit' : 'void', x ? m.x.id : o ? m.o.id : null);
  }
  // Explicit departures end abandoned sessions; network interruptions retain
  // the room's existing reconnect grace. Spectators do not count as players.
  const participants = g.competition?.status === 'running' ? g.competition.entrants.map(e => e.id) : m ? [m.x.id, m.o.id] : ctx.players.map(p => p.id);
  if (g.open && !participants.some(id => ctx.players.some(p => p.id === id))) {
    stopTicTacToe(g);
  }
}
export function actTicTacToe(g: TicTacToeState, action: TicTacToeAction, ctx: Context) {
  const m = g.match;
  if (action.action === 'hand') { g.hands = g.hands.filter(id => id !== ctx.self); if (action.raised) g.hands.push(ctx.self); return; }
  if (action.action === 'move' || action.action === 'resign') {
    requireRule(m && m.status === 'playing' && m.id === action.matchId, 'GAME_CHANGED', 'This match ended or changed. Use the current board.');
    requireRule(m.x.id === ctx.self || m.o.id === ctx.self, 'SPECTATOR', 'You are watching this match. Raise your hand to play next.');
    if (action.action === 'resign') { finish(g, m, ctx, 'forfeit', m.x.id === ctx.self ? m.o.id : m.x.id); return; }
    requireRule(action.ply === m.board.filter(Boolean).length, 'STALE_MOVE', 'The board changed. Choose a square on the current board.');
    requireRule(ctx.players.some(p => p.id === m.x.id && p.connected) && ctx.players.some(p => p.id === m.o.id && p.connected), 'GAME_PAUSED', 'Waiting for both players to reconnect.');
    requireRule((m.turn === 'X' ? m.x.id : m.o.id) === ctx.self, 'NOT_YOUR_TURN', 'It is your opponent’s turn.');
    requireRule(Number.isInteger(action.cell) && action.cell! >= 0 && action.cell! < 9, 'INVALID_CELL', 'Choose one of the nine squares.');
    requireRule(m.board[action.cell!] === null, 'CELL_TAKEN', 'That square is already taken.');
    m.board[action.cell!] = m.turn;
    const line = winningLines.find(line => line.every(cell => m.board[cell] === m.turn));
    if (line) finish(g, m, ctx, 'won', ctx.self, line);
    else if (m.board.every(Boolean)) finish(g, m, ctx, 'draw', null);
    else m.turn = m.turn === 'X' ? 'O' : 'X';
    return;
  }
  requireRule(ctx.owner, 'OWNER_ONLY', 'Only the room owner can choose matches and manage a tournament.');
  if (action.action === 'open') { if (!g.open) { g.match = null; g.competition = null; g.hands = []; } g.open = true; return; }
  if (action.action === 'cancel') { if (g.competition?.status === 'running') g.competition.status = 'cancelled'; if (m?.status === 'playing') finish(g, m, ctx, 'void', null); return; }
  if (action.action === 'lobby') { requireRule(m?.status !== 'playing', 'GAME_ACTIVE', 'Finish or cancel the current match first.'); g.open = false; return; }
  requireRule(m?.status !== 'playing', 'GAME_ACTIVE', 'Finish the current match first.');
  g.open = true;
  if (action.action === 'next') {
    requireRule(g.competition?.status === 'running', 'NO_TOURNAMENT', 'There is no running tournament.');
    const c = g.competition;
    if (action.fixtureId) requireRule(c.fixtures.some(f => f.id === action.fixtureId && f.status === 'pending'), 'INVALID_FIXTURE', 'Choose a pending fixture.');
    // Resolve withdrawals without leaving a bracket or a league permanently stuck.
    for (let guard = 0; guard < 16 && c.status === 'running'; guard++) {
      const pending = c.fixtures.filter(f => f.status === 'pending');
      const f = pending.find(f => f.id === action.fixtureId) || pending[0];
      if (!f) { progress(g); continue; }
      const x = c.entrants.find(e => e.id === f.x)!, o = c.entrants.find(e => e.id === f.o)!;
      const presentX = ctx.players.find(p => p.id === x.id), presentO = ctx.players.find(p => p.id === o.id);
      const game = newMatch(x, o, f.id); g.match = game;
      if (!presentX || !presentO) { finish(g, game, ctx, presentX || presentO ? 'forfeit' : 'void', presentX ? x.id : presentO ? o.id : null); continue; }
      requireRule(presentX.connected && presentO.connected, 'GAME_PAUSED', 'Both scheduled players need to reconnect before this match starts.');
      return;
    }
    return;
  }
  requireRule(g.competition?.status !== 'running', 'TOURNAMENT_ACTIVE', 'Finish or cancel the tournament before starting another match.');
  if (action.action === 'rematch') {
    requireRule(m && m.status !== 'void', 'NO_REMATCH', 'Finish a single match before requesting a rematch.');
    const x = ctx.players.find(p => p.id === m.o.id && p.connected), o = ctx.players.find(p => p.id === m.x.id && p.connected);
    requireRule(x && o, 'PLAYERS_MISSING', 'Both players must be here for a rematch.'); g.competition = null; g.match = newMatch(x, o); return;
  }
  requireRule(action.action === 'start', 'INVALID_ACTION', 'Choose a game action.');
  const mode = action.mode || 'single';
  let selected = action.random ? shuffle(ctx.players.filter(p => p.connected)).slice(0, 2) : (action.players || []).map(id => ctx.players.find(p => p.id === id && p.connected));
  requireRule(selected.every(Boolean) && new Set(selected.map(p => p!.id)).size === selected.length && selected.length >= 2 && selected.length <= (mode === 'single' ? 2 : 4), 'PLAYERS_REQUIRED', 'Choose two different connected players, or 2–4 tournament entrants.');
  const entries: Entry[] = selected.map(p => ({ id: p!.id, name: p!.name, key: p!.key }));
  if (mode === 'single') { g.competition = null; if (randomInt(2)) entries.reverse(); g.match = newMatch(entries[0], entries[1]); return; }
  const entrants = shuffle(entries);
  const fixtures: Fixture[] = [];
  if (mode === 'league') for (let a = 0; a < entrants.length; a++) for (let b = a + 1; b < entrants.length; b++) { fixtures.push(fixture(entrants[a].id, entrants[b].id, 1), fixture(entrants[b].id, entrants[a].id, 1)); }
  g.match = null;
  g.competition = { id: id(), mode, status: 'running', entrants, fixtures: mode === 'league' ? shuffle(fixtures) : pairRound(entrants.map(e => e.id), 1), round: 1, champions: [] };
}
export function projectTicTacToe(g: TicTacToeState, self: string, accountKey: string | null): TicTacToeView {
  const entry = (e: Entry) => ({ id: e.id, name: e.name, signedIn: !!e.key?.startsWith('account:') });
  return { open: g.open, hands: [...g.hands], match: g.match ? { ...g.match, x: entry(g.match.x), o: entry(g.match.o) } : null, competition: g.competition ? { ...g.competition, entrants: g.competition.entrants.map(entry) } : null, scores: g.scores.filter(row => row.key?.startsWith('account:')).map(({ key, ...row }) => ({ ...row, isYou: key === (accountKey || 'guest:' + self) })).sort((a, b) => b.points - a.points || b.wins - a.wins), recent: g.recent };
}
export function anonymizeTicTacToe(g: TicTacToeState, accountKey: string) {
  const rename = (e: Entry) => { if (e.key === accountKey) { e.key = null; e.name = 'Former player'; } };
  for (const row of g.scores) rename(row);
  if (g.match) { rename(g.match.x); rename(g.match.o); }
  g.competition?.entrants.forEach(rename);
  // Recent summaries carry display names only; discard them on account deletion.
  g.recent = [];
}
