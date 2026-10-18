import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AVATARS, PIXEL_COLORS, type RoomDirectoryView, type PeopleView, type CommandResult, type RoomCommand, type RoomView, type SessionView } from '../../../packages/protocol/src/index.js';
import type { Storage } from './storage.js';
import { actTicTacToe, anonymizeTicTacToe, emptyTicTacToe, emptyTotals, GameRuleError, projectTicTacToe, reconcileTicTacToe, ticTacToeSchema, totalsSchema } from './games/tic-tac-toe.js';
import { passwordHash, passwordMatches } from './passwords.js';

const minute = 60_000;
export const policy = { grace: 5 * minute, absent: 5 * minute, idle: 60 * minute, absolute: 60 * minute, session: 7 * 24 * 60 * minute, capacity: 4 };
const identity = z.object({ nickname: z.string().trim().min(1).max(24).refine(s => !/[\p{Cc}\p{Cf}]/u.test(s), 'Use a visible nickname.'), avatar: z.enum(AVATARS) });
export const createSchema = identity.extend({ commandId: z.string().uuid(), name: z.string().trim().min(1).max(40).refine(s => !/[\p{Cc}\p{Cf}]/u.test(s), 'Use a visible room name.').optional() }).strict();
export const joinSchema = createSchema.omit({ name: true }).extend({ invitation: z.string().trim().min(1).max(100), asVisitor: z.boolean().optional() }).strict();
export const commandSchema = z.object({ commandId: z.string().uuid(), roomId: z.string().regex(/^[a-f0-9]{32}$/), expectedRevision: z.number().int().nonnegative(), type: z.enum(['keepAlive', 'leave', 'close', 'regenerateInvite', 'reopen', 'theme', 'memberInvite', 'remove', 'rename', 'chat', 'saveRoom', 'revokeCodes', 'deleteMessage', 'clearChat', 'ticTacToe']), game: z.object({ action: z.enum(['open', 'hand', 'start', 'move', 'next', 'rematch', 'resign', 'cancel', 'lobby']), mode: z.enum(['single', 'knockout', 'league']).optional(), players: z.array(z.string().regex(/^[a-f0-9]{32}$/)).min(2).max(4).optional(), random: z.boolean().optional(), matchId: z.string().regex(/^[a-f0-9]{32}$/).optional(), cell: z.number().int().min(0).max(8).optional(), ply: z.number().int().min(0).max(8).optional(), raised: z.boolean().optional(), fixtureId: z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict().optional(), messageId: z.string().regex(/^[a-f0-9]{32}$/).optional(), theme: z.enum(['sage', 'sunset', 'midnight']).optional(), targetId: z.string().regex(/^[a-f0-9]{32}$/).optional(), name: z.string().trim().min(1).max(40).refine(s => !/[\p{Cc}\p{Cf}]/u.test(s)).optional(), text: z.string().trim().min(1).max(1000).refine(s => !/[\u0000-\u0008\u000b-\u001f\u007f]/u.test(s)).optional() }).strict();
const designSchema = z.object({ version: z.literal(1), pixels: z.array(z.number().int().min(0).max(PIXEL_COLORS.length - 1)).length(576) }).strict().nullable();

const memberSchema = z.object({ id: z.string(), sessionId: z.string(), nickname: z.string(), avatar: z.enum(AVATARS), avatarDesign: designSchema.default(null), seat: z.number(), disconnectedAt: z.number().nullable(), joinedAt: z.number().default(0) });
const roomSchema = z.object({ id: z.string(), ownerId: z.string(), invitationHash: z.string(), code: z.string(), players: z.array(memberSchema).max(4), revision: z.number(), createdAt: z.number(), lastActive: z.number(), admissionsOpen: z.boolean(), theme: z.enum(['sage', 'sunset', 'midnight']).default('sage'), ownerAccountId: z.string().nullable().default(null), name: z.string().default('Our little room'), members: z.array(z.string()).max(4).default([]), banned: z.array(z.string()).default([]), memberCode: z.string().default(''), memberUntil: z.number().default(0), visitorUntil: z.number().default(0), emptySince: z.number().nullable().default(null), lastPresenceAt: z.number().default(0), messages: z.array(z.object({ id: z.string(), accountId: z.string().nullable(), nickname: z.string(), text: z.string().max(1000), createdAt: z.number() })).max(200).default([]), ticTacToe: ticTacToeSchema.nullable().default(null) });
const sessionSchema = z.object({ csrf: z.string(), expiresAt: z.number(), roomId: z.string().nullable(), accountId: z.string().nullable().default(null), authenticatedAt: z.number().nullable().default(null) });
const accountSchema = z.object({ id: z.string(), username: z.string().nullable(), passwordHash: z.string().nullable(), recoveryHash: z.string().nullable().default(null), googleSubject: z.string().nullable(), nickname: z.string(), avatar: z.enum(AVATARS), avatarDesign: designSchema.default(null), provider: z.enum(['password', 'google']), categories: z.object({ friends: z.string(), special: z.string() }).default({ friends: 'Friends', special: 'My special person' }), createdAt: z.number() });
const receiptSchema = z.record(z.string(), z.object({ fingerprint: z.string(), result: z.unknown(), at: z.number() }));
const connectionSchema = z.object({ id: z.string(), a: z.string(), b: z.string(), kind: z.enum(['friend', 'special']), labels: z.record(z.string(), z.string()), createdAt: z.number() });
const inviteSchema = z.object({ id: z.string(), creator: z.string(), tokenHash: z.string(), kind: z.enum(['friend', 'special']), expiresAt: z.number(), acceptedBy: z.string().nullable() });
const stateSchema = z.object({ gameScores: z.record(z.string(), totalsSchema).default({}), version: z.literal(4), sessions: z.record(z.string(), sessionSchema), rooms: z.record(z.string(), roomSchema), receipts: receiptSchema, accounts: z.record(z.string(), accountSchema), connections: z.record(z.string(), connectionSchema), invitations: z.record(z.string(), inviteSchema), blocks: z.array(z.object({ owner: z.string(), other: z.string() })), roomRequests: z.record(z.string(), z.object({ id: z.string(), roomId: z.string(), inviter: z.string(), target: z.string(), expiresAt: z.number() })).default({}) });
const legacySchema = z.object({ version: z.literal(1), sessions: z.record(z.string(), sessionSchema), rooms: z.record(z.string(), roomSchema), receipts: receiptSchema });
export const credentialsSchema = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letters, numbers, or underscores.'), password: z.string().min(12, 'Use at least 12 characters.').max(128, 'Use no more than 128 characters.') }).strict();
export const signupSchema = credentialsSchema.extend({ nickname: identity.shape.nickname, avatar: identity.shape.avatar });
export const profileSchema = identity.extend({ avatarDesign: designSchema.optional() }).strict();
type State = z.infer<typeof stateSchema>;
type Room = z.infer<typeof roomSchema>;
type Member = z.infer<typeof memberSchema>;
export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const random = () => randomBytes(16).toString('hex');
function roomCode() {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return [...randomBytes(10)].map(b => alphabet[b & 31]).join('');
}

export class Rooms {
  private state: State = { gameScores: {}, version: 4, sessions: {}, rooms: {}, receipts: {}, accounts: {}, connections: {}, invitations: {}, blocks: [], roomRequests: {} };
  private tail: Promise<unknown> = Promise.resolve();
  private online = new Map<string, Set<string>>();
  private connecting = new Set<string>();
  onChange: () => void = () => {};
  constructor(private storage: Storage, private clock = () => Date.now(), private googleEnabled = false) {}

  async init() {
    const value = await this.storage.load();
    if (value !== null) {
      if ((value as { version?: number }).version === 1) {
        const legacy = legacySchema.parse(value);
        this.state = stateSchema.parse({ ...legacy, version: 4, accounts: {}, connections: {}, invitations: {}, blocks: [] });
      } else if ((value as { version?: number }).version === 2) {
        const migrated = { ...(value as object), version: 4, connections: {}, invitations: {}, blocks: [] };
        this.state = stateSchema.parse(migrated);
      } else this.state = stateSchema.parse({ ...(value as object), version: (value as { version: number }).version === 3 ? 4 : (value as { version: number }).version });
      if ((value as { version: number }).version < 4) for (const room of Object.values(this.state.rooms)) {
        const ownerSession = room.players.find(p => p.id === room.ownerId)?.sessionId;
        room.ownerAccountId = ownerSession ? this.state.sessions[ownerSession]?.accountId || null : null;
        room.members = room.ownerAccountId ? [room.ownerAccountId] : [];
        room.visitorUntil = Math.min(this.clock() + 86400000, room.ownerAccountId ? Infinity : room.createdAt + policy.absolute);
      }
    }
    for (const room of Object.values(this.state.rooms)) { room.lastPresenceAt ||= this.clock(); room.emptySince ??= room.lastPresenceAt; for (const p of room.players) p.disconnectedAt ??= room.lastPresenceAt; }
    await this.storage.save(this.state);
    await this.transact(() => {});
  }

  private transact<T>(operation: () => T): Promise<T> {
    const task = this.tail.then(async () => {
      await this.storage.assertOwnership?.();
      const previous = structuredClone(this.state);
      try {
        this.cleanup();
        const result = operation();
        this.reconcileGames();
        if (JSON.stringify(previous) !== JSON.stringify(this.state)) await this.storage.save(this.state);
        this.onChange();
        return result;
      } catch (error) { this.state = previous; throw error; }
    });
    this.tail = task.catch(() => {});
    return task;
  }

  private gameContext(room: Room, sessionId = '') {
    return { self: room.players.find(p => p.sessionId === sessionId)?.id || '', owner: this.owns(room, sessionId), now: this.clock(),
      players: room.players.map(p => ({ id: p.id, name: p.nickname, key: this.state.sessions[p.sessionId]?.accountId ? 'account:' + this.state.sessions[p.sessionId].accountId : 'guest:' + p.id, connected: this.isOnline(p) })),
      record: (entry: { key: string | null }, delta: ReturnType<typeof emptyTotals>) => {
        if (!entry.key?.startsWith('account:')) return;
        const accountId = entry.key.slice(8); if (!this.state.accounts[accountId]) return;
        const score = this.state.gameScores[accountId] ||= emptyTotals();
        for (const key of Object.keys(delta) as (keyof typeof delta)[]) score[key] += delta[key];
      } };
  }
  private reconcileGames() {
    for (const room of Object.values(this.state.rooms)) if (room.ticTacToe) {
      const before = JSON.stringify(room.ticTacToe); reconcileTicTacToe(room.ticTacToe, this.gameContext(room));
      if (before !== JSON.stringify(room.ticTacToe)) room.revision++;
    }
  }
  private isOnline(member: Member) { return this.validSession(member.sessionId) && !!this.online.get(member.sessionId)?.size; }
  private expiry(room: Room) {
    if (room.ownerAccountId) return Infinity;
    const offline = room.players.every(p => !this.isOnline(p));
    return Math.min(room.createdAt + policy.absolute, offline ? (room.emptySince ?? this.clock()) + policy.absent : Infinity);
  }
  private removeRoom(room: Room) {
    for (const p of room.players) { const session = this.state.sessions[p.sessionId]; if (session?.roomId === room.id) session.roomId = null; }
    delete this.state.rooms[room.id];
    for (const receipt of Object.values(this.state.receipts)) if ((receipt.result as { room?: { id?: string } } | null)?.room?.id === room.id) receipt.result = { room: null };
    for (const [id, invite] of Object.entries(this.state.roomRequests)) if (invite.roomId === room.id) delete this.state.roomRequests[id];
  }
  private cleanup() {
    const now = this.clock();
    for (const room of Object.values(this.state.rooms)) {
      if (room.players.some(p => this.isOnline(p))) room.lastPresenceAt = now;
      else room.emptySince ??= room.lastPresenceAt || now;
      for (const p of room.players) if (!this.isOnline(p)) p.disconnectedAt ??= room.lastPresenceAt || now;
      if (this.expiry(room) <= now) { this.removeRoom(room); continue; }
      room.messages = room.messages.filter(m => m.createdAt + 30 * 86400000 > now);
      if (room.memberUntil <= now) room.memberCode = '';
      if (room.visitorUntil <= now) { room.code = ''; room.invitationHash = ''; room.admissionsOpen = false; }
      {
        const removed = room.players.filter(p => !this.isOnline(p) && p.disconnectedAt !== null && p.disconnectedAt + policy.grace <= now);
        for (const p of removed) {
          this.retireRoomReceipts(p.sessionId, room.id);
          this.state.sessions[p.sessionId] && (this.state.sessions[p.sessionId].roomId = null);
          room.players = room.players.filter(x => x.id !== p.id);
          room.revision++;
        }
        if (!room.ownerAccountId && !room.players.some(p => p.id === room.ownerId)) room.ownerId = room.players[0]?.id || '';
      }
    }
    for (const [id, s] of Object.entries(this.state.sessions)) if (s.expiresAt <= now && !s.roomId) delete this.state.sessions[id];
    for (const [key, receipt] of Object.entries(this.state.receipts)) if (receipt.at + policy.absent < now) delete this.state.receipts[key];
    for (const [id, invitation] of Object.entries(this.state.invitations)) if (invitation.expiresAt <= now) delete this.state.invitations[id];
    for (const [id, invitation] of Object.entries(this.state.roomRequests)) if (invitation.expiresAt <= now || !this.state.rooms[invitation.roomId]) delete this.state.roomRequests[id];
  }

  async sweep() { await this.transact(() => {}); }
  async settled() { await this.tail; await this.storage.assertOwnership?.(); }
  async authenticate(token?: string): Promise<{ token: string; sessionId: string }> {
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const id = hash(token);
      await this.tail;
      if (this.state.sessions[id]?.expiresAt > this.clock()) return { token, sessionId: id };
    }
    return this.transact(() => {
      if (Object.keys(this.state.sessions).length >= 3000) throw new AppError('BUSY', 'Our little space is full right now. Please try later.', 503);
      const token = randomBytes(32).toString('hex');
      const sessionId = hash(token);
      this.state.sessions[sessionId] = { csrf: random(), expiresAt: this.clock() + policy.session, roomId: null, accountId: null, authenticatedAt: null };
      return { token, sessionId };
    });
  }
  validSession(sessionId: string) { return !!this.state.sessions[sessionId] && this.state.sessions[sessionId].expiresAt > this.clock(); }
  validCsrf(sessionId: string, csrf: unknown) { return this.validSession(sessionId) && this.state.sessions[sessionId].csrf === csrf; }

  view(sessionId: string): SessionView {
    const session = this.state.sessions[sessionId];
    if (!session || session.expiresAt <= this.clock()) throw new AppError('SESSION_EXPIRED', 'Your session expired. Refresh to start again.', 401);
    const room = session.roomId ? this.state.rooms[session.roomId] : undefined;
    const stored = session.accountId ? this.state.accounts[session.accountId] : undefined;
    const account = stored ? { id: stored.id, username: stored.username, nickname: stored.nickname, avatar: stored.avatar, avatarDesign: stored.avatarDesign, provider: stored.provider } : null;
    return { csrf: session.csrf, room: room && this.expiry(room) > this.clock() ? this.project(room, sessionId) : null, serverTime: this.clock(), account,
      access: { tier: account ? 'account' : 'guest', accountCatalogue: !!account }, auth: { google: this.googleEnabled }, ...(account ? { gameScores: this.state.gameScores[account.id] || emptyTotals() } : {}) };
  }

  private rotateSession(sessionId: string, accountId: string | null) {
    this.view(sessionId);
    const old = this.state.sessions[sessionId];
    if (accountId) {
      const others = Object.entries(this.state.sessions).filter(([id, s]) => id !== sessionId && s.accountId === accountId && s.roomId && this.state.rooms[s.roomId]);
      for (const [otherId, other] of others) {
        if (old.roomId && old.roomId !== other.roomId) throw new AppError('ROOM_CONFLICT', 'This account already has another room. Leave that room before signing in here.', 409);
        if (this.online.get(otherId)?.size) {
          if (old.roomId) throw new AppError('ACCOUNT_IN_USE', 'This account is in a room on another browser. Leave there before signing in here.', 409);
          // Signing in for account management does not take over an active seat.
          // The person can explicitly end other sessions from Account security.
          continue;
        }
        if (!old.roomId) {
          old.roomId = other.roomId;
          const member = this.state.rooms[other.roomId!].players.find(p => p.sessionId === otherId);
          if (member) member.sessionId = sessionId;
          other.roomId = null;
        }
      }
    }
    const token = randomBytes(32).toString('hex');
    const newId = hash(token);
    this.state.sessions[newId] = { ...old, accountId, csrf: random(), expiresAt: this.clock() + policy.session, authenticatedAt: accountId ? this.clock() : null };
    const room = old.roomId ? this.state.rooms[old.roomId] : undefined;
    if (room && accountId) this.assertRoomAccess(room, accountId);
    const member = room?.players.find(p => p.sessionId === sessionId);
    if (member) {
      member.sessionId = newId; member.disconnectedAt = this.clock();
      if (old.accountId !== accountId) member.joinedAt = this.clock();
      const profile = accountId ? this.state.accounts[accountId] : undefined;
      if (profile) { member.nickname = profile.nickname; member.avatar = profile.avatar; member.avatarDesign = profile.avatarDesign; }
      else { member.avatar = 'moss'; member.avatarDesign = null; }
      room!.revision++;
    }
    delete this.state.sessions[sessionId];
    for (const key of Object.keys(this.state.receipts)) if (key.startsWith(`${sessionId}:`)) delete this.state.receipts[key];
    return { token, sessionId: newId };
  }

  async signup(sessionId: string, raw: unknown) {
    const input = signupSchema.parse(raw);
    if (this.view(sessionId).account) throw new AppError('ALREADY_SIGNED_IN', 'You are already signed in.');
    const encoded = await passwordHash(input.password);
    return this.transact(() => {
      this.view(sessionId);
      if (Object.keys(this.state.accounts).length >= 3000) throw new AppError('BUSY', 'Account creation is temporarily unavailable.', 503);
      if (Object.values(this.state.accounts).some(a => a.username === input.username)) throw new AppError('USERNAME_TAKEN', 'That username is unavailable. Try another.', 409);
      const id = random();
      const recoveryCode = randomBytes(24).toString('hex');
      this.state.accounts[id] = { id, username: input.username, passwordHash: encoded, recoveryHash: hash(recoveryCode), googleSubject: null, nickname: input.nickname, avatar: input.avatar, avatarDesign: null, categories: { friends: 'Friends', special: 'My special person' }, provider: 'password', createdAt: this.clock() };
      return { ...this.rotateSession(sessionId, id), recoveryCode };
    });
  }
  async login(sessionId: string, raw: unknown) {
    const input = credentialsSchema.parse(raw);
    await this.tail;
    const account = Object.values(this.state.accounts).find(a => a.username === input.username);
    const verifiedHash = account?.passwordHash;
    const matches = await passwordMatches(input.password, verifiedHash);
    if (!account || !matches) throw new AppError('INVALID_LOGIN', 'The username or password is incorrect.', 401);
    return this.transact(() => {
      // A reset can finish while scrypt is running. Do not revive access with the old password.
      if (!this.state.accounts[account.id] || this.state.accounts[account.id].passwordHash !== verifiedHash) throw new AppError('INVALID_LOGIN', 'The username or password is incorrect.', 401);
      return this.rotateSession(sessionId, account.id);
    });
  }
  async googleLogin(sessionId: string, subject: string, suggestedName: string) {
    return this.transact(() => {
      this.view(sessionId);
      // Provider subject is verified by Supabase. Never link to a password account by email/name.
      let account = Object.values(this.state.accounts).find(a => a.googleSubject === subject);
      if (!account) {
        if (Object.keys(this.state.accounts).length >= 3000) throw new AppError('BUSY', 'Account creation is temporarily unavailable.', 503);
        const safeName = suggestedName.replace(/[\p{Cc}\p{Cf}]/gu, '').trim().slice(0, 24) || 'Your person';
        const current = this.view(sessionId).room?.players.find(p => p.isYou);
        const id = random();
        account = { id, username: null, passwordHash: null, recoveryHash: null, googleSubject: subject, nickname: current?.nickname || safeName, avatar: current?.avatar || 'moss', avatarDesign: null, categories: { friends: 'Friends', special: 'My special person' }, provider: 'google', createdAt: this.clock() };
        this.state.accounts[id] = account;
      }
      return this.rotateSession(sessionId, account.id);
    });
  }
  async logout(sessionId: string) { return this.transact(() => this.rotateSession(sessionId, null)); }
  private requireRecentAccount(sessionId: string) {
    const account = this.requireAccount(sessionId);
    const at = this.state.sessions[sessionId].authenticatedAt;
    if (!at || at + 10 * minute < this.clock()) throw new AppError('REAUTHENTICATE', 'For this action, sign out and sign in again first.', 403);
    return account;
  }
  async signOutOthers(sessionId: string) {
    return this.transact(() => { const account = this.requireRecentAccount(sessionId); this.revokeOtherSessions(account.id, sessionId); return this.rotateSession(sessionId, account.id); });
  }
  exportAccount(sessionId: string) {
    const account = this.requireRecentAccount(sessionId);
    return {
      format: 'just-us-account-export', version: 1, exportedAt: new Date(this.clock()).toISOString(),
      profile: { id: account.id, username: account.username, nickname: account.nickname, avatar: account.avatar, avatarDesign: account.avatarDesign, categories: account.categories, provider: account.provider, createdAt: account.createdAt },
      people: this.people(sessionId).connections, blockedAccounts: this.people(sessionId).blocked,
      rooms: this.directory(sessionId).rooms,
      gameScores: this.state.gameScores[account.id] || emptyTotals(),
      authoredMessages: Object.values(this.state.rooms).flatMap(room => room.messages.filter(m => m.accountId === account.id && m.createdAt + 30 * 86400000 > this.clock()).map(m => ({ roomId: room.id, roomName: room.name, id: m.id, text: m.text, createdAt: m.createdAt }))),
    };
  }
  private requireAccount(sessionId: string) {
    const account = this.view(sessionId).account;
    if (!account) throw new AppError('SIGN_IN_REQUIRED', 'Sign in to use your saved profile and people.', 403);
    return this.state.accounts[account.id];
  }
  private revokeOtherSessions(accountId: string, except: string) {
    for (const [id, session] of Object.entries(this.state.sessions)) if (id !== except && session.accountId === accountId) {
      this.detach(id);
      delete this.state.sessions[id];
      for (const key of Object.keys(this.state.receipts)) if (key.startsWith(`${id}:`)) delete this.state.receipts[key];
    }
  }
  async changePassword(sessionId: string, raw: unknown) {
    const input = z.object({ currentPassword: z.string().max(128), password: credentialsSchema.shape.password }).strict().parse(raw);
    const account = this.requireAccount(sessionId);
    const previousHash = account.passwordHash;
    if (!previousHash || !await passwordMatches(input.currentPassword, previousHash)) throw new AppError('INVALID_LOGIN', 'Your current password is incorrect.', 401);
    const encoded = await passwordHash(input.password);
    return this.transact(() => {
      const current = this.requireAccount(sessionId);
      if (current.passwordHash !== previousHash) throw new AppError('CONFLICT', 'Your password changed. Sign in again.', 409);
      current.passwordHash = encoded;
      this.revokeOtherSessions(current.id, sessionId);
      return this.rotateSession(sessionId, current.id);
    });
  }
  async recoveryKey(sessionId: string, raw: unknown) {
    const input = z.object({ currentPassword: z.string().max(128) }).strict().parse(raw);
    const account = this.requireAccount(sessionId);
    const previousHash = account.passwordHash;
    if (!previousHash || !await passwordMatches(input.currentPassword, previousHash)) throw new AppError('INVALID_LOGIN', 'Your current password is incorrect.', 401);
    return this.transact(() => {
      const current = this.requireAccount(sessionId);
      if (current.passwordHash !== previousHash) throw new AppError('CONFLICT', 'Your password changed. Sign in again.', 409);
      const recoveryCode = randomBytes(24).toString('hex'); current.recoveryHash = hash(recoveryCode);
      return { recoveryCode };
    });
  }
  async recover(sessionId: string, raw: unknown) {
    const input = z.object({ username: credentialsSchema.shape.username, recoveryCode: z.string().regex(/^[a-f0-9]{48}$/), password: credentialsSchema.shape.password }).strict().parse(raw);
    await this.tail; this.view(sessionId);
    const account = Object.values(this.state.accounts).find(a => a.username === input.username);
    const proof = hash(input.recoveryCode);
    const previousHash = account?.recoveryHash;
    if (!account || !previousHash || !timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(previousHash, 'hex'))) throw new AppError('INVALID_RECOVERY', 'The username or recovery key is incorrect.', 401);
    const encoded = await passwordHash(input.password);
    return this.transact(() => {
      this.view(sessionId);
      if (this.state.accounts[account.id]?.recoveryHash !== previousHash) throw new AppError('INVALID_RECOVERY', 'That recovery key is no longer valid.', 401);
      this.revokeOtherSessions(account.id, sessionId);
      const recoveryCode = randomBytes(24).toString('hex');
      this.state.accounts[account.id].passwordHash = encoded;
      this.state.accounts[account.id].recoveryHash = hash(recoveryCode);
      return { ...this.rotateSession(sessionId, account.id), recoveryCode };
    });
  }
  people(sessionId: string): PeopleView {
    const account = this.requireAccount(sessionId);
    return { categories: { ...account.categories },
      connections: Object.values(this.state.connections).filter(c => c.a === account.id || c.b === account.id).flatMap(c => {
        const other = this.state.accounts[c.a === account.id ? c.b : c.a];
        return other ? [{ id: c.id, accountId: other.id, nickname: other.nickname, avatar: other.avatar, avatarDesign: other.avatarDesign, kind: c.kind, petName: c.labels[account.id] || '' }] : [];
      }),
      invitations: Object.values(this.state.invitations).filter(i => i.creator === account.id && !i.acceptedBy && i.expiresAt > this.clock()).map(i => ({ id: i.id, kind: i.kind, expiresAt: i.expiresAt })),
      blocked: this.state.blocks.filter(b => b.owner === account.id).flatMap(b => { const peer = this.state.accounts[b.other]; return peer ? [{ id: peer.id, nickname: peer.nickname }] : []; }),
    };
  }
  private blocked(a: string, b: string) { return this.state.blocks.some(row => (row.owner === a && row.other === b) || (row.owner === b && row.other === a)); }
  private assertRoomAccess(room: Room, accountId: string) {
    if (room.banned.includes(accountId) || room.members.some(id => id !== accountId && this.blocked(accountId, id)) || room.players.some(p => { const peer = this.state.sessions[p.sessionId]?.accountId; return peer && peer !== accountId && this.blocked(accountId, peer); })) throw new AppError('ROOM_UNAVAILABLE', 'That room is unavailable for this account. Leave this visit before signing in, or use another room.', 403);
  }
  previewConnection(sessionId: string, token: string) {
    const account = this.requireAccount(sessionId);
    const invite = Object.values(this.state.invitations).find(i => i.tokenHash === hash(token) && i.expiresAt > this.clock() && !i.acceptedBy);
    const creator = invite ? this.state.accounts[invite.creator] : undefined;
    if (!invite || !creator || this.blocked(creator.id, account.id)) throw new AppError('INVITE_UNAVAILABLE', 'That people invitation is unavailable or expired.', 404);
    return { nickname: creator.nickname, avatar: creator.avatar, avatarDesign: creator.avatarDesign, kind: invite.kind, isYou: creator.id === account.id };
  }
  async peopleAction(sessionId: string, raw: unknown) {
    const label = z.string().trim().min(1).max(24).refine(s => !/[\p{Cc}\p{Cf}]/u.test(s));
    const id = z.string().regex(/^[a-f0-9]{32}$/);
    const input = z.discriminatedUnion('type', [
      z.object({ type: z.literal('invite'), kind: z.enum(['friend', 'special']) }).strict(),
      z.object({ type: z.literal('accept'), token: z.string().regex(/^[a-f0-9]{48}$/) }).strict(),
      z.object({ type: z.literal('revoke'), id }).strict(), z.object({ type: z.literal('remove'), id }).strict(),
      z.object({ type: z.literal('label'), id, petName: label.or(z.literal('')) }).strict(),
      z.object({ type: z.literal('categories'), friends: label, special: label }).strict(),
      z.object({ type: z.literal('block'), id }).strict(), z.object({ type: z.literal('unblock'), id }).strict(),
      z.object({ type: z.literal('demote'), id }).strict(),
    ]).parse(raw);
    return this.transact(() => {
      const account = this.requireAccount(sessionId);
      let token: string | undefined;
      if (input.type === 'categories') account.categories = { friends: input.friends, special: input.special };
      if (input.type === 'invite') {
        if (Object.values(this.state.invitations).filter(i => i.creator === account.id && !i.acceptedBy).length >= 5) throw new AppError('INVITE_LIMIT', 'Revoke an older invitation before making another.');
        if (input.kind === 'special' && Object.values(this.state.connections).some(c => c.kind === 'special' && (c.a === account.id || c.b === account.id))) throw new AppError('SPECIAL_LIMIT', 'You already have a special person. Remove that connection before choosing another.');
        token = randomBytes(24).toString('hex'); const inviteId = random();
        this.state.invitations[inviteId] = { id: inviteId, creator: account.id, tokenHash: hash(token), kind: input.kind, expiresAt: this.clock() + 7 * 86400000, acceptedBy: null };
      }
      if (input.type === 'accept') {
        const invite = Object.values(this.state.invitations).find(i => i.tokenHash === hash(input.token) && i.expiresAt > this.clock());
        if (!invite || (invite.acceptedBy && invite.acceptedBy !== account.id) || this.blocked(invite.creator, account.id) || !this.state.accounts[invite.creator]) throw new AppError('INVITE_UNAVAILABLE', 'That people invitation is unavailable or expired.', 404);
        if (invite.creator === account.id) throw new AppError('SELF_INVITE', 'Send this invitation to your person, rather than accepting it yourself.');
        if (!invite.acceptedBy) {
          const existing = Object.values(this.state.connections).find(c => (c.a === invite.creator && c.b === account.id) || (c.b === invite.creator && c.a === account.id));
          if (invite.kind === 'special' && Object.values(this.state.connections).some(c => c.kind === 'special' && [c.a, c.b].some(id => id === account.id || id === invite.creator))) throw new AppError('SPECIAL_LIMIT', 'One of you already has a special person. Remove that connection before accepting another.');
          if (existing && invite.kind === 'friend') throw new AppError('ALREADY_CONNECTED', 'You are already connected.');
          if (existing) existing.kind = 'special';
          else { const connectionId = random(); this.state.connections[connectionId] = { id: connectionId, a: invite.creator, b: account.id, kind: invite.kind, labels: {}, createdAt: this.clock() }; }
          invite.acceptedBy = account.id;
        }
      }
      if (input.type === 'revoke') {
        const invite = this.state.invitations[input.id];
        if (!invite || invite.creator !== account.id) throw new AppError('NOT_FOUND', 'Invitation not found.', 404);
        delete this.state.invitations[input.id];
      }
      if (input.type === 'remove' || input.type === 'label') {
        const connection = this.state.connections[input.id];
        if (!connection || ![connection.a, connection.b].includes(account.id)) throw new AppError('NOT_FOUND', 'Connection not found.', 404);
        if (input.type === 'remove') delete this.state.connections[input.id];
        else connection.labels[account.id] = input.petName;
      }
      if (input.type === 'demote') {
        const connection = this.state.connections[input.id];
        if (!connection || ![connection.a, connection.b].includes(account.id)) throw new AppError('NOT_FOUND', 'Connection not found.', 404);
        connection.kind = 'friend';
      }
      if (input.type === 'block') {
        if (input.id === account.id || !this.state.accounts[input.id]) throw new AppError('NOT_FOUND', 'Person not found.', 404);
        if (!this.state.blocks.some(b => b.owner === account.id && b.other === input.id)) this.state.blocks.push({ owner: account.id, other: input.id });
        for (const [id, c] of Object.entries(this.state.connections)) if ([c.a, c.b].includes(account.id) && [c.a, c.b].includes(input.id)) delete this.state.connections[id];
        for (const [id, invite] of Object.entries(this.state.roomRequests)) if ((invite.inviter === account.id && invite.target === input.id) || (invite.inviter === input.id && invite.target === account.id)) delete this.state.roomRequests[id];
        // A block revokes membership between these accounts' owned rooms. Other
        // shared rooms retain their owner; the blocker leaves its membership.
        for (const room of Object.values(this.state.rooms)) {
          const revoke = room.ownerAccountId === account.id ? input.id : room.members.includes(input.id) ? account.id : null;
          if (revoke && revoke !== room.ownerAccountId) {
            room.members = room.members.filter(id => id !== revoke);
            for (const [id, s] of Object.entries(this.state.sessions)) if (s.accountId === revoke) { this.retireRoomReceipts(id, room.id); if (s.roomId === room.id) this.detach(id); }
            room.revision++;
          }
        }
        // Leave any shared room; blocking never secretly gives control over the other person's seat.
        for (const [id, s] of Object.entries(this.state.sessions)) if (s.accountId === account.id && s.roomId) {
          const room = this.state.rooms[s.roomId];
          if (room?.players.some(p => this.state.sessions[p.sessionId]?.accountId === input.id)) {
            this.detach(id);
          }
        }
      }
      if (input.type === 'unblock') this.state.blocks = this.state.blocks.filter(b => !(b.owner === account.id && b.other === input.id));
      return { people: this.people(sessionId), ...(token ? { token } : {}) };
    });
  }
  async saveProfile(sessionId: string, raw: unknown) {
    const input = profileSchema.parse(raw);
    return this.transact(() => {
      const session = this.view(sessionId);
      if (!session.account) throw new AppError('SIGN_IN_REQUIRED', 'Sign in to save a profile.', 403);
      Object.assign(this.state.accounts[session.account.id], input);
      const room = this.state.sessions[sessionId].roomId;
      const member = room ? this.state.rooms[room]?.players.find(p => p.sessionId === sessionId) : null;
      if (member) { member.nickname = input.nickname; member.avatar = input.avatar; member.avatarDesign = this.state.accounts[session.account.id].avatarDesign; this.state.rooms[room!].revision++; }
      return this.view(sessionId);
    });
  }
  async deleteAccount(sessionId: string) {
    return this.transact(() => {
      const account = this.view(sessionId).account;
      if (!account) throw new AppError('SIGN_IN_REQUIRED', 'Sign in to manage your account.', 403);
      const authenticated = this.state.sessions[sessionId].authenticatedAt;
      if (!authenticated || authenticated + 10 * 60000 < this.clock()) throw new AppError('REAUTHENTICATE', 'For account deletion, sign out and sign in again first. Your room can continue as a guest.', 403);
      for (const room of Object.values(this.state.rooms)) {
        if (room.ownerAccountId === account.id) { this.removeRoom(room); continue; }
        room.members = room.members.filter(id => id !== account.id);
        if (room.ticTacToe) anonymizeTicTacToe(room.ticTacToe, 'account:' + account.id);
        for (const message of room.messages) if (message.accountId === account.id) { message.accountId = null; message.nickname = 'Former member'; }
      }
      for (const [id, invite] of Object.entries(this.state.roomRequests)) if (invite.target === account.id || invite.inviter === account.id) delete this.state.roomRequests[id];
      for (const [id, session] of Object.entries(this.state.sessions)) if (id !== sessionId && session.accountId === account.id) {
        if (session.roomId && this.state.rooms[session.roomId]) {
          const room = this.state.rooms[session.roomId];
          room.players = room.players.filter(p => p.sessionId !== id);
          if (!room.ownerAccountId) room.ownerId = room.players[0]?.id || '';
          if (!room.players.some(p => this.isOnline(p))) room.emptySince ??= this.clock();
          room.revision++;
        }
        delete this.state.sessions[id];
      }
      delete this.state.gameScores[account.id];
      delete this.state.accounts[account.id];
      for (const [id, c] of Object.entries(this.state.connections)) if (c.a === account.id || c.b === account.id) delete this.state.connections[id];
      for (const [id, i] of Object.entries(this.state.invitations)) if (i.creator === account.id || i.acceptedBy === account.id) delete this.state.invitations[id];
      this.state.blocks = this.state.blocks.filter(b => b.owner !== account.id && b.other !== account.id);
      return this.rotateSession(sessionId, null);
    });
  }
  private project(room: Room, sessionId: string): RoomView {
    const viewer = this.state.sessions[sessionId]?.accountId;
    const owner = this.owns(room, sessionId);
    const member = !!viewer && room.members.includes(viewer);
    const visit = room.players.find(p => p.sessionId === sessionId);
    return {
      id: room.id, revision: room.revision, phase: room.players.length >= 2 ? 'lobby' : 'waiting',
      code: owner ? room.code : '', isOwner: owner,
      players: room.players.map(p => {
        const peer = this.state.sessions[p.sessionId]?.accountId;
        const connection = viewer && peer && viewer !== peer ? Object.values(this.state.connections).find(c => (c.a === viewer && c.b === peer) || (c.b === viewer && c.a === peer)) : null;
        return { id: p.id, nickname: p.nickname, avatar: peer ? p.avatar : 'moss', avatarDesign: peer ? p.avatarDesign : null, petName: connection && viewer ? connection.labels[viewer] || null : null, seat: p.seat, isYou: p.sessionId === sessionId, connected: this.isOnline(p), reconnectUntil: this.isOnline(p) ? null : (p.disconnectedAt ?? this.clock()) + policy.grace, visitor: !peer || !room.members.includes(peer), accountId: viewer ? peer || null : null };
      }),
      expiresAt: room.ownerAccountId ? null : this.expiry(room), serverTime: this.clock(), admissionsOpen: room.admissionsOpen,
      canReopen: room.players.length < 4 && !room.admissionsOpen, games: [], createdAt: room.createdAt, theme: room.theme,
      saved: !!room.ownerAccountId, name: room.name, memberCode: owner ? room.memberCode : '', capacity: 4,
      members: member ? room.members.flatMap(id => { const a = this.state.accounts[id]; return a ? [{ accountId: id, nickname: a.nickname, avatar: a.avatar, owner: id === room.ownerAccountId }] : []; }) : [],
      pendingInvitations: owner ? Object.values(this.state.roomRequests).filter(i => i.roomId === room.id && i.expiresAt > this.clock()).map(i => ({ id: i.id, nickname: this.state.accounts[i.target]?.nickname || 'Former member', expiresAt: i.expiresAt })) : [],
      ...(room.ticTacToe ? { ticTacToe: projectTicTacToe(room.ticTacToe, visit?.id || '', viewer ? 'account:' + viewer : null) } : {}),
      chatEnabled: !!viewer,
      messages: viewer && visit ? room.messages.filter(m => member || m.createdAt >= visit.joinedAt).map(m => ({ id: m.id, nickname: m.nickname, text: m.text, createdAt: m.createdAt, isYou: m.accountId === viewer })) : [],
    };
  }
  private owns(room: Room, sessionId: string) { return room.ownerAccountId ? this.state.sessions[sessionId]?.accountId === room.ownerAccountId : room.players.some(p => p.id === room.ownerId && p.sessionId === sessionId); }
  private detach(sessionId: string) {
    const session = this.state.sessions[sessionId];
    const room = session?.roomId ? this.state.rooms[session.roomId] : undefined;
    if (room) {
      this.retireRoomReceipts(sessionId, room.id);
      room.players = room.players.filter(p => p.sessionId !== sessionId); room.revision++;
      if (!room.ownerAccountId && !room.players.some(p => p.id === room.ownerId)) room.ownerId = room.players[0]?.id || '';
      if (!room.players.some(p => this.isOnline(p))) room.emptySince ??= this.clock();
    }
    if (session) session.roomId = null;
  }
  private retireRoomReceipts(sessionId: string, roomId: string) {
    for (const [key, receipt] of Object.entries(this.state.receipts)) if (key.startsWith(`${sessionId}:`) && (receipt.result as { room?: { id?: string } } | null)?.room?.id === roomId) receipt.result = { room: null };
  }
  private enter(room: Room, sessionId: string, nickname: string, avatar: typeof AVATARS[number], permanent = false) {
    const account = this.view(sessionId).account;
    const owner = !!account && room.ownerAccountId === account.id;
    if (account) this.assertRoomAccess(room, account.id);
    if (room.players.some(p => p.sessionId === sessionId)) {
      if (permanent && account && !room.members.includes(account.id)) {
        if (room.members.length >= 4) throw new AppError('MEMBER_LIMIT', 'All four saved memberships are taken.');
        room.members.push(account.id);
      }
      room.revision++; return;
    }
    if (owner && room.players.length >= 4) {
      const visitor = [...room.players].reverse().find(p => !room.members.includes(this.state.sessions[p.sessionId]?.accountId || ''));
      if (visitor) this.detach(visitor.sessionId);
    }
    if (room.players.length >= 4) throw new AppError('ROOM_FULL', 'All four seats are taken. Please wait for a seat.', 409);
    if (permanent && (!account || (!room.members.includes(account.id) && room.members.length >= 4))) throw new AppError('MEMBER_LIMIT', 'This room already has four saved members.', 409);
    this.detach(sessionId); this.checkAccountRoom(sessionId);
    if (permanent && account && !room.members.includes(account.id)) room.members.push(account.id);
    const seat = [1, 2, 3, 4].find(seat => !room.players.some(p => p.seat === seat))!;
    const player = { id: random(), sessionId, nickname: account?.nickname || nickname, avatar: account?.avatar || 'moss' as const, avatarDesign: account?.avatarDesign || null, seat, disconnectedAt: this.clock(), joinedAt: this.clock() };
    room.players.push(player);
    if (!room.ownerId) room.ownerId = player.id;
    this.state.sessions[sessionId].roomId = room.id;
    if (this.isOnline(player)) room.emptySince = null; else room.emptySince ??= this.clock();
    room.lastActive = this.clock(); room.revision++;
  }
  private current(sessionId: string) { return { room: this.view(sessionId).room }; }
  private checkAccountRoom(sessionId: string) {
    const id = this.state.sessions[sessionId]?.accountId;
    if (id && Object.entries(this.state.sessions).some(([otherId, s]) => otherId !== sessionId && s.accountId === id && s.roomId && this.state.rooms[s.roomId])) throw new AppError('ACCOUNT_IN_USE', 'This account already has a room. Return to that room or leave it first.', 409);
  }
  private once<T>(sessionId: string, commandId: string, payload: unknown, operation: () => T): T {
    const key = `${sessionId}:${commandId}`;
    const fingerprint = hash(JSON.stringify(payload));
    const cached = this.state.receipts[key];
    if (cached) {
      if (cached.fingerprint !== fingerprint) throw new AppError('COMMAND_REUSED', 'Please try that action again with a new request.');
      return structuredClone(cached.result) as T;
    }
    const result = operation();
    this.state.receipts[key] = { fingerprint, result: structuredClone(result), at: this.clock() };
    const keys = Object.keys(this.state.receipts).filter(k => k.startsWith(`${sessionId}:`));
    for (const key of keys.slice(0, Math.max(0, keys.length - 100))) delete this.state.receipts[key];
    return result;
  }
  directory(sessionId: string): RoomDirectoryView {
    const account = this.requireAccount(sessionId);
    return {
      rooms: Object.values(this.state.rooms).filter(room => room.members.includes(account.id)).map(room => ({ id: room.id, name: room.name, owner: room.ownerAccountId === account.id, memberCount: room.members.length, activeCount: room.players.filter(p => this.isOnline(p)).length, current: this.state.sessions[sessionId].roomId === room.id })),
      invitations: Object.values(this.state.roomRequests).filter(i => i.target === account.id && i.expiresAt > this.clock()).flatMap(i => { const room = this.state.rooms[i.roomId], inviter = this.state.accounts[i.inviter]; return room && inviter && !this.blocked(account.id, inviter.id) ? [{ id: i.id, roomName: room.name, inviter: inviter.nickname, expiresAt: i.expiresAt }] : []; }),
    };
  }
  async savedAction(sessionId: string, raw: unknown): Promise<CommandResult> {
    const input = z.object({ commandId: z.string().uuid(), type: z.enum(['enter', 'delete', 'leaveMembership', 'inviteFriend', 'acceptInvite', 'declineInvite', 'cancelInvite']), roomId: z.string().regex(/^[a-f0-9]{32}$/).optional(), targetId: z.string().regex(/^[a-f0-9]{32}$/).optional() }).strict().parse(raw);
    return this.transact(() => this.once(sessionId, input.commandId, input, () => {
      const account = this.requireAccount(sessionId);
      if (input.type === 'cancelInvite') {
        const invite = input.targetId ? this.state.roomRequests[input.targetId] : undefined;
        if (!invite || this.state.rooms[invite.roomId]?.ownerAccountId !== account.id) throw new AppError('NOT_FOUND', 'Invitation not found.', 404);
        delete this.state.roomRequests[invite.id]; return this.current(sessionId);
      }
      if (input.type === 'acceptInvite' || input.type === 'declineInvite') {
        const invite = input.targetId ? this.state.roomRequests[input.targetId] : undefined;
        const room = invite ? this.state.rooms[invite.roomId] : undefined;
        if (!invite || !room || invite.target !== account.id || invite.expiresAt <= this.clock()) throw new AppError('INVITE_UNAVAILABLE', 'That invitation is no longer available.');
        if (input.type === 'acceptInvite') {
          if (this.blocked(account.id, invite.inviter)) throw new AppError('INVITE_UNAVAILABLE', 'That invitation is unavailable.');
          room.banned = room.banned.filter(id => id !== account.id);
          if (this.state.sessions[sessionId].roomId === room.id) {
            if (!room.members.includes(account.id)) { if (room.members.length >= 4) throw new AppError('MEMBER_LIMIT', 'All four memberships are taken.'); room.members.push(account.id); room.revision++; }
          } else this.enter(room, sessionId, account.nickname, account.avatar, true);
        }
        delete this.state.roomRequests[invite.id];
        return this.current(sessionId);
      }
      const room = input.roomId ? this.state.rooms[input.roomId] : undefined;
      if (!room || !room.members.includes(account.id)) throw new AppError('NOT_MEMBER', 'You are not a saved member of that room.', 403);
      if (input.type === 'enter') { if (this.state.sessions[sessionId].roomId !== room.id) this.enter(room, sessionId, account.nickname, account.avatar); }
      if (input.type === 'leaveMembership') {
        if (room.ownerAccountId === account.id) throw new AppError('OWNER_REQUIRED', 'Delete your room instead of leaving its ownership.');
        room.members = room.members.filter(id => id !== account.id);
        for (const p of [...room.players]) if (this.state.sessions[p.sessionId]?.accountId === account.id) this.detach(p.sessionId);
        room.revision++;
      }
      if (input.type === 'delete' || input.type === 'inviteFriend') {
        if (room.ownerAccountId !== account.id) throw new AppError('OWNER_ONLY', 'Only the owner can manage invitations or delete this room.', 403);
        if (input.type === 'delete') this.removeRoom(room);
        else {
          const friend = this.people(sessionId).connections.find(c => c.accountId === input.targetId);
          if (!friend || this.blocked(account.id, friend.accountId)) throw new AppError('NOT_FRIEND', 'Choose an accepted friend.');
          if (room.members.includes(friend.accountId)) throw new AppError('ALREADY_MEMBER', 'Your friend already has a saved membership.');
          if (room.members.length >= 4) throw new AppError('MEMBER_LIMIT', 'All four memberships are taken.');
          if (!Object.values(this.state.roomRequests).some(i => i.roomId === room.id && i.target === friend.accountId)) {
            const id = random(); this.state.roomRequests[id] = { id, roomId: room.id, inviter: account.id, target: friend.accountId, expiresAt: this.clock() + 7 * 86400000 };
          }
        }
      }
      return this.current(sessionId);
    }));
  }

  async create(sessionId: string, raw: unknown): Promise<CommandResult> {
    const input = createSchema.parse(raw);
    return this.transact(() => this.once(sessionId, input.commandId, input, () => {
      const session = this.view(sessionId);
      if (session.room && !session.account) throw new AppError('ALREADY_IN_ROOM', 'Leave your current room before creating another.');
      this.detach(sessionId);
      this.checkAccountRoom(sessionId);
      if (Object.keys(this.state.rooms).length >= 1000) throw new AppError('BUSY', 'No new rooms are available. Try again shortly.', 503);
      let code = roomCode();
      while (Object.values(this.state.rooms).some(r => (r.code === code || r.memberCode === code))) code = roomCode();
      const invitation = random();
      const id = random();
      const player = { id: random(), sessionId, nickname: session.account?.nickname || input.nickname, avatar: session.account?.avatar || 'moss' as const, avatarDesign: session.account?.avatarDesign || null, seat: 1, disconnectedAt: this.clock(), joinedAt: this.clock() };
      this.state.rooms[id] = { id, ownerId: player.id, invitationHash: hash(invitation), code, players: [player], revision: 1, createdAt: this.clock(), lastActive: this.clock(), admissionsOpen: true, theme: 'sage', ownerAccountId: session.account?.id || null, name: input.name ?? 'Our little room', members: session.account ? [session.account.id] : [], banned: [], ticTacToe: null, memberCode: '', memberUntil: 0, visitorUntil: this.clock() + (session.account ? 86400000 : policy.absolute), emptySince: this.online.get(sessionId)?.size ? null : this.clock(), lastPresenceAt: this.clock(), messages: [] };
      this.state.sessions[sessionId].roomId = id;
      return { ...this.current(sessionId), invitation };
    }));
  }

  async join(sessionId: string, raw: unknown): Promise<CommandResult> {
    const input = joinSchema.parse(raw);
    return this.transact(() => this.once(sessionId, input.commandId, input, () => {
      const current = this.view(sessionId);
      if (current.room && !current.account) throw new AppError('ALREADY_IN_ROOM', 'Leave your current room before joining another.');
      const key = input.invitation.replace(/[\s-]/g, '').toUpperCase();
      const room = Object.values(this.state.rooms).find(r => (r.visitorUntil > this.clock() && (r.code === key || r.invitationHash === hash(input.invitation))) || (r.memberUntil > this.clock() && r.memberCode === key));
      if (!room) throw new AppError('ROOM_UNAVAILABLE', 'That invitation is invalid or has expired.', 404);
      if (room.memberCode === key && !current.account && !input.asVisitor) throw new AppError('SIGN_IN_REQUIRED', 'Sign in to save membership, or explicitly join as a visitor.', 403);
      const permanent = !!current.account && room.memberCode === key;
      this.enter(room, sessionId, input.nickname, input.avatar, permanent);
      if (room.memberCode === key) room.memberCode = '';
      else { room.code = ''; room.invitationHash = ''; room.admissionsOpen = false; }
      return this.current(sessionId);
    }));
  }

  async command(sessionId: string, raw: unknown): Promise<CommandResult> {
    const input: RoomCommand = commandSchema.parse(raw);
    return this.transact(() => this.once(sessionId, input.commandId, input, () => {
      const room = this.state.rooms[input.roomId];
      if (!this.validSession(sessionId) || !room || !room.players.some(p => p.sessionId === sessionId)) throw new AppError('NOT_MEMBER', 'This room is no longer available to your session.', 403);
      if (input.type !== 'chat' && !(input.type === 'ticTacToe' && input.game && ['move', 'hand', 'resign'].includes(input.game.action)) && room.revision !== input.expectedRevision) throw new AppError('STALE', 'The room changed. We have refreshed it; please try again.', 409);
      const owner = this.owns(room, sessionId);
      let invitation: string | undefined;
      if (['close', 'regenerateInvite', 'reopen', 'theme', 'memberInvite', 'remove', 'rename', 'saveRoom', 'revokeCodes', 'clearChat'].includes(input.type) && !owner) throw new AppError('OWNER_ONLY', 'Only the room creator can change the room settings.', 403);
      if (input.type === 'close') this.removeRoom(room);
      else if (input.type === 'leave') this.detach(sessionId);
      else {
        if (input.type === 'ticTacToe') {
          if (!input.game) throw new AppError('INVALID_INPUT', 'Choose a game action.');
          const game = room.ticTacToe ||= emptyTicTacToe();
          try { actTicTacToe(game, input.game, this.gameContext(room, sessionId)); }
          catch (error) { if (error instanceof GameRuleError) throw new AppError(error.code, error.message); throw error; }
        }
        if (input.type === 'chat') {
          const account = this.requireAccount(sessionId);
          if (!input.text) throw new AppError('INVALID_INPUT', 'Write a message first.');
          room.messages.push({ id: random(), accountId: account.id, nickname: account.nickname, text: input.text, createdAt: this.clock() });
          room.messages = room.messages.slice(-200);
        }
        if (input.type === 'revokeCodes') { room.code = ''; room.invitationHash = ''; room.memberCode = ''; room.admissionsOpen = false; }
        if (input.type === 'clearChat' || input.type === 'deleteMessage') {
          const account = this.requireAccount(sessionId);
          if (input.type === 'deleteMessage') {
            const message = room.messages.find(m => m.id === input.messageId);
            const visible = this.project(room, sessionId).messages.some(m => m.id === input.messageId);
            if (!message || !visible) throw new AppError('NOT_FOUND', 'Message not found.', 404);
            if (!owner && message.accountId !== account.id) throw new AppError('FORBIDDEN', 'You can only delete your own messages.', 403);
          }
          room.messages = input.type === 'clearChat' ? [] : room.messages.filter(m => m.id !== input.messageId);
          for (const receipt of Object.values(this.state.receipts)) if ((receipt.result as { room?: { id?: string } } | null)?.room?.id === room.id) receipt.result = { room: null };
        }
        if (input.type === 'saveRoom') { const account = this.requireAccount(sessionId); room.ownerAccountId = account.id; if (!room.members.includes(account.id)) room.members.push(account.id); room.visitorUntil = this.clock() + 86400000; }
        if (input.type === 'rename') { if (!input.name || !room.ownerAccountId) throw new AppError('INVALID_INPUT', 'Saved rooms need a name.'); room.name = input.name; }
        if (input.type === 'memberInvite') {
          if (!room.ownerAccountId) throw new AppError('SAVE_REQUIRED', 'Only saved rooms have permanent membership.');
          if (room.members.length >= 4) throw new AppError('MEMBER_LIMIT', 'This room already has four saved members.');
          do { room.memberCode = roomCode(); } while (Object.values(this.state.rooms).some(r => r.code === room.memberCode || (r.id !== room.id && r.memberCode === room.memberCode)));
          room.memberUntil = this.clock() + 86400000;
        }
        if (input.type === 'remove') {
          const player = room.players.find(p => p.id === input.targetId);
          const accountId = player ? this.state.sessions[player.sessionId]?.accountId : input.targetId;
          if (player?.sessionId === sessionId || accountId === room.ownerAccountId) throw new AppError('OWNER_REQUIRED', 'The owner cannot be removed. Delete the room instead.');
          if (!player && (!accountId || !room.members.includes(accountId))) throw new AppError('NOT_FOUND', 'That person is no longer in the room.');
          if (accountId) { room.members = room.members.filter(id => id !== accountId); if (!room.banned.includes(accountId)) room.banned.push(accountId); }
          if (accountId) for (const [id, session] of Object.entries(this.state.sessions)) if (session.accountId === accountId) this.retireRoomReceipts(id, room.id);
          for (const p of [...room.players]) if (p === player || (accountId && this.state.sessions[p.sessionId]?.accountId === accountId)) this.detach(p.sessionId);
          for (const [id, request] of Object.entries(this.state.roomRequests)) if (request.roomId === room.id && request.target === accountId) delete this.state.roomRequests[id];
        }
        if (input.type === 'theme') { this.requireAccount(sessionId); if (!input.theme) throw new AppError('INVALID_INPUT', 'Choose a room theme.'); room.theme = input.theme; }
        if (['reopen', 'regenerateInvite'].includes(input.type) && room.players.length >= 4) throw new AppError('NOT_READY', 'All four seats are taken.');
        if (input.type === 'regenerateInvite' || input.type === 'reopen') {
          invitation = random(); room.invitationHash = hash(invitation);
          do { room.code = roomCode(); } while (Object.values(this.state.rooms).some(r => (r.id !== room.id && r.code === room.code) || r.memberCode === room.code));
          room.admissionsOpen = true; room.visitorUntil = Math.min(this.clock() + 86400000, room.ownerAccountId ? Infinity : room.createdAt + policy.absolute);
        }
        room.lastActive = this.clock(); room.revision++;
      }
      return { ...this.current(sessionId), ...(invitation ? { invitation } : {}) };
    }));
  }

  async connect(sessionId: string, connectionId: string) {
    if (!this.validSession(sessionId)) throw new AppError('SESSION_EXPIRED', 'Refresh to reconnect.', 401);
    // Cleanup happens before marking this participant online, so missed grace periods are respected.
    try {
      await this.transact(() => {});
      const connections = this.online.get(sessionId) ?? new Set<string>();
      connections.add(connectionId);
      this.online.set(sessionId, connections);
      await this.transact(() => {
        const roomId = this.state.sessions[sessionId]?.roomId;
        const room = roomId ? this.state.rooms[roomId] : undefined;
        const player = room?.players.find(p => p.sessionId === sessionId);
        if (player) { player.disconnectedAt = null; room!.emptySince = null; room!.revision++; }
      });
    } catch (e) { const connections = this.online.get(sessionId); connections?.delete(connectionId); if (!connections?.size) this.online.delete(sessionId); throw e; }
  }
  async disconnect(sessionId: string, connectionId: string) {
    const set = this.online.get(sessionId);
    if (!set?.delete(connectionId)) return;
    if (set.size > 0) return;
    this.online.delete(sessionId);
    await this.transact(() => {
      if (this.online.get(sessionId)?.size) return;
      const id = this.state.sessions[sessionId]?.roomId;
      const room = id ? this.state.rooms[id] : undefined;
      const player = room?.players.find(p => p.sessionId === sessionId);
      if (player) { player.disconnectedAt = this.clock(); if (!room!.players.some(p => this.isOnline(p))) room!.emptySince ??= this.clock(); room!.revision++; }
    });
  }
}
