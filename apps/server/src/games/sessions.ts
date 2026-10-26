import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { GameContext } from './contracts.js';
import { requireGame } from './contracts.js';
import type { GameRegistry } from './registry.js';
export const gameSessionSchema = z.object({ id: z.string(), gameId: z.string(), mode: z.string(), participants: z.array(z.object({ playerId: z.string(), ready: z.boolean() })).max(4) });
export type GameSessionState = z.infer<typeof gameSessionSchema>;
export type GameRoom = {
    id: string;
    allowPlayerGames: boolean;
    gameStates: Record<string, unknown>;
    gameSession: GameSessionState | null;
};
export type SessionAction = ({
    action: 'open';
    gameId: string;
} | {
    action: 'join' | 'leave' | 'start';
} | {
    action: 'ready';
    ready: boolean;
} | {
    action: 'mode';
    mode: string;
}) & {sessionId?:string};
type Viewer = {
    roomId: string;
    sessionId: string;
    playerId: string;
};
/** Shared orchestration. This class has no knowledge of a board, marks, rounds or winners. */
export class GameSessions {
    private viewers = new Map<string, Viewer>();
    private tracked = new Set<string>();
    constructor(private modules: GameRegistry) {
        for(const [id,module] of Object.entries(modules)) {
            requireGame(id===module.definition.id,'INVALID_MODULE','The registered game ID must match its definition.');
            const modes=module.definition.modes;
            requireGame(modes.length>0&&new Set(modes.map(mode=>mode.id)).size===modes.length&&modes.every(mode=>Number.isInteger(mode.minPlayers)&&Number.isInteger(mode.maxPlayers)&&mode.minPlayers>0&&mode.maxPlayers>=mode.minPlayers),'INVALID_MODULE','Games need unique modes and valid player limits.');
        }
    }
    checkpoint() { return { viewers: new Map(this.viewers), tracked: new Set(this.tracked) }; }
    restore(snapshot: ReturnType<GameSessions['checkpoint']>) { this.viewers = snapshot.viewers; this.tracked = snapshot.tracked; }
    private module(id: string) { const module = Object.hasOwn(this.modules,id)?this.modules[id]:undefined; requireGame(module, 'UNKNOWN_GAME', 'This game is not available.'); return module; }
    private current(room: GameRoom) { requireGame(room.gameSession, 'NO_GAME', 'Choose a game from the shelf first.'); return room.gameSession; }
    private canConfigure(room: GameRoom, ctx: GameContext) { return ctx.owner || room.allowPlayerGames; }
    private requireConfigure(room: GameRoom, ctx: GameContext) { requireGame(this.canConfigure(room, ctx), 'OWNER_ONLY', 'The admin has limited starting and configuring games.'); }
    private mode(session: GameSessionState) { const mode = this.module(session.gameId).definition.modes.find(m => m.id === session.mode); requireGame(mode, 'INVALID_MODE', 'Choose a supported mode.'); return mode; }
    private waiting(room: GameRoom) { const session = this.current(room); requireGame(this.module(session.gameId).phase(room.gameStates[session.gameId]) !== 'playing', 'GAME_ACTIVE', 'Wait for the current game to finish.'); return session; }
    private players(room: GameRoom, ctx: GameContext) { const ids = new Set(room.gameSession?.participants.map(p => p.playerId)); return { ...ctx, players: ctx.players.filter(p => ids.has(p.id)) }; }
    command(room: GameRoom, action: SessionAction, ctx: GameContext, connectionId?: string, sessionId?: string) {
        requireGame(ctx.players.some(p => p.id === ctx.self && p.connected), 'NOT_MEMBER', 'Reconnect to your room first.');
        if (action.action === 'open') {
            const module = this.module(action.gameId);
            if (room.gameSession) {
                requireGame(room.gameSession.gameId === action.gameId, 'GAME_ACTIVE', 'Finish the current game before choosing another.');
            }
            else {
                this.requireConfigure(room, ctx);
                const mode = module.definition.modes[0];
                requireGame(mode, 'INVALID_MODE', 'This game needs a play mode.');
                room.gameStates[action.gameId] = module.open(room.gameStates[action.gameId] ?? module.create(), ctx);
                room.gameSession = { id: randomBytes(16).toString('hex'), gameId: action.gameId, mode: mode.id, participants: [{ playerId: ctx.self, ready: true }] };
            }
            if (connectionId && sessionId)
                this.track(room.id, ctx.self, sessionId, connectionId);
            return;
        }
        const session = this.current(room), module = this.module(session.gameId);
        requireGame(!action.sessionId||action.sessionId===session.id,'GAME_CHANGED','This game session has ended or changed.');
        if (action.action === 'leave') {
            session.participants = session.participants.filter(p => p.playerId !== ctx.self);
            return;
        }
        if (action.action === 'join') {
            this.waiting(room);
            if (session.participants.some(p => p.playerId === ctx.self))
                return;
            requireGame(session.participants.length < this.mode(session).maxPlayers, 'GAME_FULL', 'The seats are full. You can watch this round.');
            session.participants.push({ playerId: ctx.self, ready: true });
            return;
        }
        this.waiting(room);
        if (action.action === 'ready') {
            const player = session.participants.find(p => p.playerId === ctx.self);
            requireGame(player, 'NOT_PLAYING', 'Join a seat first.');
            player.ready = action.ready;
            return;
        }
        this.requireConfigure(room, ctx);
        if (action.action === 'mode') {
            const mode = module.definition.modes.find(m => m.id === action.mode);
            requireGame(mode, 'INVALID_MODE', 'Choose a supported mode.');
            requireGame(session.participants.length <= mode.maxPlayers, 'TOO_MANY_PLAYERS', 'People need to leave the extra seats before switching to this mode.');
            if (session.mode !== mode.id) {
                session.mode = mode.id;
                session.participants.forEach(p => { p.ready = p.playerId === ctx.self; });
            }
            return;
        }
        const mode = this.mode(session);
        requireGame(session.participants.length >= mode.minPlayers && session.participants.length <= mode.maxPlayers, 'PLAYERS_REQUIRED', `This mode needs ${mode.minPlayers}–${mode.maxPlayers} players.`);
        requireGame(session.participants.every(p => p.ready), 'PLAYERS_NOT_READY', 'Wait until everyone is ready.');
        requireGame(session.participants.every(p => ctx.players.some(peer => peer.id === p.playerId && peer.connected)), 'GAME_PAUSED', 'Wait for your players to reconnect.');
        room.gameStates[session.gameId] = module.start(room.gameStates[session.gameId], session.mode, session.participants.map(p => p.playerId), this.players(room, ctx));
    }
    action(room: GameRoom, id: string, action: unknown, ctx: GameContext,expectedSessionId?:string) {
        const session = this.current(room);
        requireGame(session.gameId === id&&(!expectedSessionId||session.id===expectedSessionId), 'GAME_CHANGED', 'This game has ended or changed.');
        const module = this.module(id), permission = module.permission(action);
        if(permission==='player')requireGame(session.participants.some(p=>p.playerId===ctx.self)&&ctx.players.some(p=>p.id===ctx.self&&p.connected),'NOT_PLAYING','Join a game seat before playing.');
        if (permission === 'configure')
            this.requireConfigure(room, ctx);
        if (permission === 'owner')
            requireGame(ctx.owner, 'OWNER_ONLY', 'Only the room admin can end a game for everyone.');
        room.gameStates[id] = module.act(room.gameStates[id], action, { ...this.players(room, ctx), owner: permission !== 'player' || ctx.owner });
    }
    project(room: GameRoom, ctx: GameContext) {
        if (!room.gameSession)
            return null;
        const session = room.gameSession, module = this.module(session.gameId);
        return { ...session, phase: module.phase(room.gameStates[session.gameId]), canConfigure: this.canConfigure(room, ctx), game: module.project(room.gameStates[session.gameId], ctx) };
    }
    reconcile(room: GameRoom, ctx: GameContext) {
        if (this.tracked.has(room.id) && ![...this.viewers.values()].some(v => v.roomId === room.id)) {
            this.clear(room);
            return;
        }
        if (room.gameSession) {
            room.gameSession.participants = room.gameSession.participants.filter(p => ctx.players.some(peer => peer.id === p.playerId));
            const id = room.gameSession.gameId;
            room.gameStates[id] = this.module(id).reconcile(room.gameStates[id], this.players(room, ctx));
        }
        else
            for (const [id, state] of Object.entries(room.gameStates))
                if (Object.hasOwn(this.modules,id))
                    room.gameStates[id] = this.modules[id].reconcile(state, ctx);
    }
    clear(room: GameRoom) {
        for (const [id, state] of Object.entries(room.gameStates))
            if (Object.hasOwn(this.modules,id))
                room.gameStates[id] = this.modules[id].clear(state);
        room.gameSession = null;
    }
    private track(roomId: string, playerId: string, sessionId: string, connectionId: string) { this.viewers.set(connectionId, { roomId, playerId, sessionId }); this.tracked.add(roomId); }
    watch(room: GameRoom, ctx: GameContext, sessionId: string, connectionId: string, watching: boolean, expectedSessionId?:string) {
        if(expectedSessionId&&room.gameSession?.id!==expectedSessionId){requireGame(!watching,'GAME_CHANGED','This game session has ended.');return;}
        if (watching) {
            requireGame(this.isOpen(room), 'GAME_ENDED', 'The TV is off. Choose a new game.');
            this.track(room.id, ctx.self, sessionId, connectionId);
        }
        else if (this.viewers.get(connectionId)?.roomId === room.id) {
            this.viewers.delete(connectionId);
            if (![...this.viewers.values()].some(v => v.roomId === room.id && v.playerId === ctx.self) && room.gameSession)
                room.gameSession.participants = room.gameSession.participants.filter(p => p.playerId !== ctx.self);
        }
    }
    disconnect(connectionId: string) { this.viewers.delete(connectionId); }
    prune(valid: (sessionId: string, connectionId: string, roomId: string) => boolean) { for (const [id, v] of this.viewers)
        if (!valid(v.sessionId, id, v.roomId))
            this.viewers.delete(id); }
    forget(roomId: string) { this.tracked.delete(roomId); for (const [id, v] of this.viewers)
        if (v.roomId === roomId)
            this.viewers.delete(id); }
    isOpen(room: GameRoom) { return !!room.gameSession || Object.entries(room.gameStates).some(([id, state]) => this.modules[id]?.legacy?.isOpen(state)); }
    validate(room: GameRoom) { for (const [id, state] of Object.entries(room.gameStates))
        if (Object.hasOwn(this.modules,id))
            room.gameStates[id] = this.modules[id].parse(state); }
    anonymize(room: GameRoom, key: string) { for (const [id, state] of Object.entries(room.gameStates))
        if (Object.hasOwn(this.modules,id))
            room.gameStates[id] = this.modules[id].anonymize(state, key); }
    legacy(room: GameRoom, type: string, action: unknown, ctx: GameContext, connectionId?: string, sessionId?: string) {
        const module = Object.values(this.modules).find(m => m.legacy?.command === type);
        if (!module?.legacy)
            return false;
        const id = module.definition.id;
        requireGame(!room.gameSession, 'SESSION_ACTION', 'Use the shared game session controls.');
        room.gameStates[id] = module.legacy.act(room.gameStates[id] ?? module.create(), action, ctx, room.allowPlayerGames);
        if (module.legacy.isOpen(room.gameStates[id]) && connectionId && sessionId)
            this.track(room.id, ctx.self, sessionId, connectionId);
        return true;
    }
    legacyProjection(room: GameRoom, ctx: GameContext) { return Object.fromEntries(Object.entries(room.gameStates).flatMap(([id, state]) => { const module = this.modules[id]; return module?.legacy ? [[module.legacy.projection, module.project(state, ctx)]] : []; })); }
}
