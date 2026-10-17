import { describe, expect, it } from 'vitest';
import { actTicTacToe, emptyTicTacToe, projectTicTacToe, reconcileTicTacToe, winningLines } from '../../apps/server/src/games/tic-tac-toe.js';
import type { RoomCommand } from '../../packages/protocol/src/index.js';

function setup(count = 4) {
  const state = emptyTicTacToe(); const recorded: unknown[] = [];
  const ctx = { self: 'a', owner: true, now: 1000, players: ['a', 'b', 'c', 'd'].slice(0, count).map(id => ({ id, name: id.toUpperCase(), key: `account:${id}`, connected: true })), record: (...args: unknown[]) => { recorded.push(args); } };
  const act = (action: NonNullable<RoomCommand['game']>) => actTicTacToe(state, action.action === 'move' ? { ply: state.match?.board.filter(Boolean).length, ...action } : action, ctx);
  const move = (cell: number) => { ctx.self = state.match!.turn === 'X' ? state.match!.x.id : state.match!.o.id; act({ action: 'move', cell, matchId: state.match!.id }); };
  return { state, ctx, recorded, act, move };
}
describe('authoritative tic-tac-toe rules', () => {
  for (const line of winningLines) it(`recognises winning line ${line.join(',')}`, () => {
    const { state, act, move } = setup(); act({ action: 'start', players: ['a', 'b'] });
    const other = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !line.includes(i));
    [line[0], other[0], line[1], other[1], line[2]].forEach(move);
    expect(state.match?.status).toBe('won'); expect(state.match?.line).toEqual(line);
    expect(state.scores.map(s => s.points).sort()).toEqual([0, 3]);
  });
  it('validates turns, spectators, occupied cells, bounds and delayed rematch actions', () => {
    const { state, ctx, act, move, recorded } = setup(); act({ action: 'start', players: ['a', 'b'] });
    const old = state.match!.id; ctx.self = 'c';
    expect(() => act({ action: 'move', cell: 0, matchId: old })).toThrow(/watching/);
    ctx.self = state.match!.o.id; expect(() => act({ action: 'move', cell: 0, matchId: old })).toThrow(/opponent/);
    ctx.self = state.match!.x.id; expect(() => act({ action: 'move', cell: 9, matchId: old })).toThrow(/nine/);
    move(0); expect(() => act({ action: 'move', cell: 1, matchId: old })).toThrow(/opponent/);
    ctx.self = state.match!.o.id; expect(() => act({ action: 'move', cell: 0, matchId: old })).toThrow(/taken/);
    [3, 1, 4, 2].forEach(move); const x = state.match!.x.id;
    act({ action: 'rematch' }); expect(state.match!.o.id).toBe(x);
    expect(() => act({ action: 'move', cell: 5, matchId: old })).toThrow(/changed/);
    expect(recorded).toHaveLength(2);
  });
  it('draws, pauses on disconnect, resumes, and forfeits only after a player actually leaves', () => {
    const { state, ctx, act, move, recorded } = setup(); act({ action: 'start', players: ['a', 'b'] });
    ctx.players[0].connected = false; reconcileTicTacToe(state, ctx); expect(state.match?.status).toBe('playing');
    expect(() => move(0)).toThrow(/reconnect/); ctx.players[0].connected = true;
    [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(move); expect(state.match?.status).toBe('draw');
    expect(state.scores.every(s => s.points === 1 && s.draws === 1)).toBe(true);
    act({ action: 'rematch' }); const survivor = state.match!.x.id; ctx.players = ctx.players.filter(p => p.id === survivor);
    reconcileTicTacToe(state, ctx); reconcileTicTacToe(state, ctx);
    expect(state.match?.status).toBe('forfeit'); expect(state.match?.winner).toBe(survivor); expect(recorded).toHaveLength(4);
  });
  it('lets everyone signal interest but reserves match management for the owner', () => {
    const { state, ctx, act } = setup(); ctx.owner = false; ctx.self = 'c';
    act({ action: 'hand', raised: true }); act({ action: 'hand', raised: true }); expect(state.hands).toEqual(['c']);
    expect(() => act({ action: 'start', random: true })).toThrow(/owner/);
    ctx.owner = true; act({ action: 'start', players: ['a', 'b'] }); expect(state.match).not.toBeNull();
    const wire = JSON.stringify(projectTicTacToe(state, 'c', 'account:c')); expect(wire).not.toContain('account:');
    act({ action: 'cancel' }); expect(state.match?.status).toBe('void'); expect(state.scores).toHaveLength(0);
  });
  it('rejects delayed clicks even if the same player gets another turn', () => {
    const { state, ctx, act, move } = setup(); act({ action: 'start', players: ['a', 'b'] });
    const firstPlayer = state.match!.x.id, matchId = state.match!.id;
    move(0); move(3); ctx.self = firstPlayer;
    expect(() => act({ action: 'move', matchId, cell: 1, ply: 0 })).toThrow(/board changed/);
    expect(state.match!.board[1]).toBeNull();
  });
  it('constructs a balanced double round robin and finishes with correct shared ranks', () => {
    const { state, ctx, act, move } = setup(3); act({ action: 'start', mode: 'league', players: ['a', 'b', 'c'] });
    const c = state.competition!; expect(c.fixtures).toHaveLength(6);
    for (const a of ['a', 'b', 'c']) for (const b of ['a', 'b', 'c'].filter(b => b !== a)) expect(c.fixtures.filter(f => f.x === a && f.o === b)).toHaveLength(1);
    while (c.status === 'running') { ctx.owner = true; act({ action: 'next' }); [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(move); }
    expect(c.champions.sort()).toEqual(['a', 'b', 'c']); expect(state.scores.every(s => s.played === 4 && s.points === 4)).toBe(true);
    expect(() => act({ action: 'next' })).toThrow(/no running/);
  });
  it('handles odd knockout byes, draw replays with swapped marks, and a champion', () => {
    const { state, act, move, ctx } = setup(3); act({ action: 'start', mode: 'knockout', players: ['a', 'b', 'c'] });
    expect(state.competition!.fixtures.filter(f => !f.o)).toHaveLength(1); expect(state.scores).toHaveLength(0);
    act({ action: 'next' }); const oldX = state.match!.x.id;
    [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(move); expect(state.competition!.status).toBe('running');
    act({ action: 'next' }); expect(state.match!.o.id).toBe(oldX);
    [0, 3, 1, 4, 2].forEach(move); expect(state.competition!.round).toBe(2);
    act({ action: 'next' }); [0, 3, 1, 4, 2].forEach(move);
    expect(state.competition!.champions).toEqual([state.match!.x.id]); expect(state.competition!.status).toBe('completed');
    ctx.self = 'a'; expect(state.recent).toHaveLength(3);
  });
  it('resolves pending withdrawals and voids absent opponents without inventing wins', () => {
    const { state, ctx, act } = setup(); act({ action: 'start', mode: 'league', players: ['a', 'b', 'c', 'd'] });
    ctx.players = []; act({ action: 'next' }); expect(state.competition!.status).toBe('completed');
    expect(state.competition!.champions).toEqual([]); expect(state.scores).toEqual([]);
  });
});
