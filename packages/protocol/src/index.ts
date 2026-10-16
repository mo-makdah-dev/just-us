export const AVATARS = ['moss', 'peach', 'lilac', 'sky', 'sun', 'rose'] as const;
export type AvatarId = typeof AVATARS[number];
export const PIXEL_COLORS = ['transparent', '#332e40', '#fff4dd', '#f2c7a6', '#dca77e', '#b97f60', '#895c47', '#704532', '#b5784e', '#c77f70', '#ad7588', '#8e78aa', '#668ca2', '#648573', '#b59043', '#dce6cb', '#e3d8ec', '#d6e5ed', '#f3e8ba', '#edd8df'] as const;
export type AvatarDesign = { version: 1; pixels: number[] };
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
};
export type RoomCommand = {
  commandId: string; roomId: string; expectedRevision: number;
  type: 'keepAlive' | 'leave' | 'close' | 'regenerateInvite' | 'reopen' | 'theme' | 'memberInvite' | 'remove' | 'rename' | 'chat' | 'saveRoom' | 'revokeCodes' | 'deleteMessage' | 'clearChat';
  theme?: 'sage' | 'sunset' | 'midnight';
  targetId?: string; name?: string; text?: string; messageId?: string;
};
export type CommandResult = { room: RoomView | null; invitation?: string };
export type WireResult<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
