export interface Game {
  gamePk: number;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  inningHalf: 'Top' | 'Bot';
  inning: number;
  gameState: 'Preview' | 'Live' | 'Final' | 'Delayed';
  startTime: string;
}

export interface Pitch {
  pitchCode: string;
  pitchDescription: string;
  endSpeed: number;
  startSpeed: number;
  spinRate: number;
  breakVertical: number;
  breakHorizontal: number;
  pX: number;
  pZ: number;
  szTop: number;
  szBot: number;
  result: string;
  isContact: boolean;
  exitVelocity?: number;
  launchAngle?: number;
  hitDistance?: number;
  contactResult?: string;
}

export interface AtBat {
  batterId: number;
  batterLastName: string;
  batterHand: 'L' | 'R';
  pitcherId: number;
  pitcherLastName: string;
  pitcherHand: 'L' | 'R';
  pitchCount: number;
  balls: number;
  strikes: number;
  outs: number;
  pitches: Pitch[];
}

export interface MatchupStats {
  avg: string;
  hr: number;
  ab: number;
}

export interface AppSettings {
  selectedGamePk: number | null;
  favoriteTeams: string[];
  perspective: 'catcher' | 'pitcher';
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedGamePk: null,
  favoriteTeams: [],
  perspective: 'catcher',
};
