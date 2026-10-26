import { z } from 'zod';
import type { GameDefinition } from '../../../../packages/games/src/catalogue.js';
import type { GameContext } from './contracts.js';
/** Only the registry boundary handles opaque stored values. Modules stay fully typed. */
export interface GameModule<State, Action, View> {
    definition: GameDefinition;
    stateSchema: z.ZodType<State>;
    actionSchema: z.ZodType<Action>;
    create(): State;
    open(state: State, context: GameContext): void;
    start(state: State, mode: string, players: string[], context: GameContext): void;
    permission(action: Action): 'player' | 'configure' | 'owner';
    act(state: State, action: Action, context: GameContext): void;
    reconcile(state: State, context: GameContext): void;
    clear(state: State): void;
    anonymize(state: State, key: string): void;
    phase(state: State): 'waiting' | 'playing' | 'results';
    project(state: State, context: GameContext): View;
    legacy?: {
        command: string;
        projection: string;
        isOpen(state: State): boolean;
        act(state: State, action: unknown, context: GameContext, allowStarts: boolean): void;
    };
}
export type RegisteredGame = ReturnType<typeof registerGame>;
export function registerGame<S, A, V>(module: GameModule<S, A, V>) {
    function mutate(raw: unknown, action: (state: S) => void): unknown { const state = module.stateSchema.parse(raw); action(state); return state; }
    return {
        definition: module.definition,
        parse: (raw: unknown): unknown => module.stateSchema.parse(raw),
        create: (): unknown => module.create(),
        open: (raw: unknown, ctx: GameContext) => mutate(raw, state => module.open(state, ctx)),
        start: (raw: unknown, mode: string, players: string[], ctx: GameContext) => mutate(raw, state => module.start(state, mode, players, ctx)),
        permission: (action: unknown) => module.permission(module.actionSchema.parse(action)),
        act: (raw: unknown, action: unknown, ctx: GameContext) => mutate(raw, state => module.act(state, module.actionSchema.parse(action), ctx)),
        reconcile: (raw: unknown, ctx: GameContext) => mutate(raw, state => module.reconcile(state, ctx)),
        clear: (raw: unknown) => mutate(raw, state => module.clear(state)),
        anonymize: (raw: unknown, key: string) => mutate(raw, state => module.anonymize(state, key)),
        phase: (raw: unknown) => module.phase(module.stateSchema.parse(raw)),
        project: (raw: unknown, ctx: GameContext): unknown => module.project(module.stateSchema.parse(raw), ctx),
        legacy: module.legacy ? {
            command: module.legacy.command, projection: module.legacy.projection,
            isOpen: (raw: unknown) => module.legacy!.isOpen(module.stateSchema.parse(raw)),
            act: (raw: unknown, action: unknown, ctx: GameContext, allow: boolean) => mutate(raw, state => module.legacy!.act(state, action, ctx, allow)),
        } : undefined,
    };
}
