import type {
  CameraPreset,
  PlayDifficulty,
  SimMatchState,
  TeamSide,
} from '../shared/volleyballRules';

export enum GameState {
  TITLE_MENU = 'TITLE_MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ROUND_SUMMARY = 'ROUND_SUMMARY',
  GAME_OVER = 'GAME_OVER',
}

export type MatchMode = 'online' | 'world_tour' | 'local_2p' | 'daily_challenge';

export type TargetPointsOption = 7 | 11 | 15;

export type BallSkinId = 'classic' | 'solar_flare' | 'emerald_aegis' | 'midnight_cobalt';

export type DailyChallengeId = 'comeback_win' | 'perfect_block' | 'surge_blitz';

export interface DailyChallengeScenario {
  id: DailyChallengeId;
  title: string;
  scenarioKicker: string;
  description: string;
  objectiveSummary: string;
  opponentNation: string;
  difficulty: PlayDifficulty;
  targetPoints: TargetPointsOption;
  initialLeftScore: number;
  initialRightScore: number;
  servingSide: TeamSide;
  initialSurge: number;
  requiredBlocks?: number;
  requiredSurgeStrikes?: number;
  rewardCoins: number;
  rewardTitle: string;
  rewardSkinId: BallSkinId;
  rewardSkinName: string;
  rewardSwatchHex: string;
}

export interface DailyChallengeProgress {
  completedDatesById: Record<string, string>; // challengeId -> YYYY-MM-DD
  unlockedSkins: BallSkinId[];
  unlockedTitles: string[];
  equippedSkin: BallSkinId;
  equippedTitle: string;
  tourCoins: number;
}

export interface OpenRoomSummary {
  code: string;
  hostCallsign: string;
  hostNation: string;
  targetPoints: number;
  isPublic: boolean;
}

export interface OnlinePlayerInfo {
  playerCode: string;
  callsign: string;
  nationCode: string;
  status: 'available' | 'searching' | 'in_match';
}

export interface IncomingInvite {
  inviteId: string;
  fromCallsign: string;
  fromCode: string;
  fromNation: string;
  targetPoints: number;
}

export interface LobbySnapshot {
  onlineCount: number;
  queueCount: number;
  activeMatches: number;
  openRooms: OpenRoomSummary[];
  onlinePlayers: OnlinePlayerInfo[];
}

export interface MatchSummaryRecord {
  id: string;
  mode: MatchMode;
  leftNation: string;
  leftCallsign: string;
  rightNation: string;
  rightCallsign: string;
  leftScore: number;
  rightScore: number;
  winnerSide: TeamSide;
  longestRally: number;
  leftSpikes: number;
  rightSpikes: number;
  leftBlocks: number;
  rightBlocks: number;
  dateLabel: string;
}

export type { CameraPreset, PlayDifficulty, SimMatchState, TeamSide };
