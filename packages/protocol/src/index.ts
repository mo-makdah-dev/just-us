export const ROOM_PROTOCOL_VERSION = 5;
export const AVATARS = ['moss', 'peach', 'lilac', 'sky', 'sun', 'rose'] as const;
export type AvatarId = typeof AVATARS[number];
export const PIXEL_COLORS = ['transparent', '#332e40', '#fff4dd', '#f2c7a6', '#dca77e', '#b97f60', '#895c47', '#704532', '#b5784e', '#c77f70', '#ad7588', '#8e78aa', '#668ca2', '#648573', '#b59043', '#dce6cb', '#e3d8ec', '#d6e5ed', '#f3e8ba', '#edd8df'] as const;
export type AvatarDesign = { version: 1; pixels: number[] };
export type GameTotals = { played: number; wins: number; draws: number; losses: number; points: number; forfeits: number };
export type TicTacToeMode = 'single' | 'knockout' | 'league';
export type TicTacToeEntry = { id: string; name: string };
export type TicTacToeMatch = { id: string; x: TicTacToeEntry; o: TicTacToeEntry; board: ('X' | 'O' | null)[]; turn: 'X' | 'O'; status: 'playing' | 'won' | 'draw' | 'forfeit' | 'void'; winner: string | null; line: number[]; fixtureId: string | null; endedAt: number | null };
export type TicTacToeFixture = { id: string; x: string; o: string | null; status: 'pending' | 'done' | 'void'; winner: string | null; draw: boolean; round: number; attempt: number };
export type TicTacToeCompetition = { id: string; mode: 'knockout' | 'league'; status: 'running' | 'completed' | 'cancelled'; entrants: TicTacToeEntry[]; fixtures: TicTacToeFixture[]; round: number; champions: string[] };
export type TicTacToeView = { open: boolean; hands: string[]; match: TicTacToeMatch | null; competition: TicTacToeCompetition | null; scores: (GameTotals & { id: string; name: string; isYou: boolean })[]; recent: { id: string; x: string; o: string; outcome: string; winner: string | null }[] };
export type PlayerView = {
  id: string; nickname: string; avatar: AvatarId; seat: number;
  connected: boolean; reconnectUntil: number | null; isYou: boolean;
  avatarDesign?: AvatarDesign | null; petName?: string | null;
  visitor: boolean; accountId: string | null;
};
export type RoomView = {
  id: string; revision: number; phase: 'waiting' | 'lobby';
  code: string; isOwner: boolean; players: PlayerView[];
  expiresAt: number | null; serverTime: number; admissionsOpen: boolean;
  canReopen: boolean; games: []; createdAt: number;
  theme?: 'sage' | 'sunset' | 'midnight';
  saved: boolean; name: string; memberCode: string; capacity: number;
  members: { accountId: string; nickname: string; avatar: AvatarId; owner: boolean }[];
  pendingInvitations: { id: string; nickname: string; expiresAt: number }[];
  chatEnabled: boolean; messages: { id: string; nickname: string; text: string; createdAt: number; isYou: boolean }[];
  ticTacToe?: TicTacToeView;
};
export type RoomDirectoryView = {
  rooms: { id: string; name: string; owner: boolean; memberCount: number; activeCount: number; current: boolean }[];
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
};
export type RoomCommand = {
  commandId: string; roomId: string; expectedRevision: number;
  type: 'keepAlive' | 'leave' | 'close' | 'regenerateInvite' | 'reopen' | 'theme' | 'memberInvite' | 'remove' | 'rename' | 'chat' | 'saveRoom' | 'revokeCodes' | 'deleteMessage' | 'clearChat' | 'ticTacToe';
  theme?: 'sage' | 'sunset' | 'midnight';
  targetId?: string; name?: string; text?: string; messageId?: string;
  game?: { action: 'open' | 'hand' | 'start' | 'move' | 'next' | 'rematch' | 'resign' | 'cancel' | 'lobby'; mode?: TicTacToeMode; players?: string[]; random?: boolean; matchId?: string; cell?: number; ply?: number; raised?: boolean; fixtureId?: string };
};
export type CommandResult = { room: RoomView | null; invitation?: string };
export type WireResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
