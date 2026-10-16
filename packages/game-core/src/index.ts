// No game is registered in Phase 1. Future rules live behind this boundary.
export interface GameModule<State, Action, View> {
  id: string;
  rulesVersion: number;
  initialState(playerIds: readonly [string, string]): State;
  apply(state: State, actorId: string, action: Action): State;
  project(state: State, playerId: string): View;
}
export const gameCatalogue: readonly [] = [];
