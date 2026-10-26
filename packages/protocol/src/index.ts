export const ROOM_PROTOCOL_VERSION = 5;
export const AVATARS = ['moss', 'peach', 'lilac', 'sky', 'sun', 'rose'] as const;
export type AvatarId = typeof AVATARS[number];
export const PIXEL_COLORS = ['transparent', '#332e40', '#fff4dd', '#f2c7a6', '#dca77e', '#b97f60', '#895c47', '#704532', '#b5784e', '#c77f70', '#ad7588', '#8e78aa', '#668ca2', '#648573', '#b59043', '#dce6cb', '#e3d8ec', '#d6e5ed', '#f3e8ba', '#edd8df'] as const;
export type AvatarDesign = { version: 1; pixels: number[] };
export type GameTotals = { played: number; wins: number; draws: number; losses: number; points: number; forfeits: number };
export type { TicTacToeMode, TicTacToeEntry, TicTacToeMatch, TicTacToeFixture, TicTacToeCompetition, TicTacToeView, TicTacToeAction, TicTacToeGameAction } from './games/tic-tac-toe.js';
import type { TicTacToeView, TicTacToeAction, TicTacToeGameAction } from './games/tic-tac-toe.js';
export type GameContracts = { 'tic-tac-toe': { action: TicTacToeGameAction; view: TicTacToeView } };
export type GameId = keyof GameContracts;
export type GameAction = { [K in GameId]: { gameId: K; action: GameContracts[K]['action']; sessionId?:string } }[GameId];
export type GameSessionInfo = { id: string; gameId: GameId; mode: string; participants: { playerId: string; ready: boolean }[]; phase: 'waiting' | 'playing' | 'results'; canConfigure: boolean };
export type GameSessionView = { [K in GameId]: GameSessionInfo & { gameId: K; game: GameContracts[K]['view'] } }[GameId];
export type GameSessionCommand = ({ action: 'open'; gameId: GameId } | { action: 'join' | 'leave' | 'start' } | { action: 'ready'; ready: boolean } | { action: 'mode'; mode: string }) & {sessionId?:string};
export type PlayerView = {
  id: string; nickname: string; avatar: AvatarId; seat: number;
  connected: boolean; reconnectUntil: number | null; isYou: boolean;
  avatarDesign?: AvatarDesign | null; petName?: string | null;
  visitor: boolean; accountId: string | null;
};
export type RoomView = {
  id: string; revision: number; phase: 'waiting' | 'lobby';
  code: string; isOwner: boolean; allowPlayerGames?: boolean; players: PlayerView[];
  expiresAt: number | null; serverTime: number; admissionsOpen: boolean;
  canReopen: boolean; games: []; createdAt: number;
  theme?: 'sage' | 'sunset' | 'midnight';
  saved: boolean; name: string; memberCode: string; capacity: number;
  members: { accountId: string; nickname: string; avatar: AvatarId; owner: boolean }[];
  pendingInvitations: { id: string; nickname: string; expiresAt: number }[];
  chatEnabled: boolean; messages: { id: string; nickname: string; text: string; createdAt: number; isYou: boolean }[];
  gameSession?: GameSessionView | null;
  /** Compatibility projection for clients predating generic game sessions. */
  ticTacToe?: TicTacToeView;
};
export type RoomDirectoryView = {
  rooms: { id: string; name: string; owner: boolean; memberCount: number; activeCount: number; current: boolean; theme?: 'sage' | 'sunset' | 'midnight'; people?: { id: string; nickname: string; avatar: AvatarId; avatarDesign: AvatarDesign | null; here: boolean; member: boolean; admin: boolean }[] }[];
  invitations: { id: string; roomName: string; inviter: string; expiresAt: number }[];
};
export type AccountView = { id: string; username: string | null; nickname: string; avatar: AvatarId; provider: 'password' | 'google'; avatarDesign?: AvatarDesign | null };
export type PeopleView = {
  categories: { friends: string; special: string };
  connections: { id: string; accountId: string; nickname: string; avatar: AvatarId; avatarDesign: AvatarDesign | null; kind: 'friend' | 'special'; petName: string }[];
  invitations: { id: string; kind: 'friend' | 'special'; expiresAt: number }[];
  blocked: { id: string; nickname: string }[];
};
export type SessionView = {
  csrf: string; room: RoomView | null; serverTime: number;
  account: AccountView | null;
  access: { tier: 'guest' | 'account'; accountCatalogue: boolean };
  auth: { google: boolean };
  recoveryCode?: string;
  gameScores?: GameTotals;
  scoresByGame?: Partial<Record<GameId, GameTotals>>;
};
export type RoomCommand = {
  commandId: string; roomId: string; expectedRevision: number;
  type: 'keepAlive' | 'leave' | 'close' | 'regenerateInvite' | 'reopen' | 'theme' | 'memberInvite' | 'remove' | 'rename' | 'chat' | 'saveRoom' | 'revokeCodes' | 'deleteMessage' | 'clearChat' | 'ticTacToe' | 'gameSettings' | 'gameSession' | 'gameAction';
  theme?: 'sage' | 'sunset' | 'midnight';
  allowPlayerGames?: boolean; targetId?: string; name?: string; text?: string; messageId?: string;
  sessionCommand?: GameSessionCommand; gameAction?: GameAction;
  /** Legacy tic-tac-toe transport; new clients use gameAction. */
  game?: TicTacToeAction;
};
export type CommandResult = { room: RoomView | null; invitation?: string };
export type WireResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
