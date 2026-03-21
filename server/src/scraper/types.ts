export interface SportTotoMatch {
  matchNumber: number;
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  matchTime: string;
  preferences: {
    home: number;
    draw: number;
    away: number;
  };
}

export interface SportTotoProgram {
  weekLabel: string;
  matches: SportTotoMatch[];
  fetchedAt: string;
}

export type FormResult = 'W' | 'D' | 'L';

export interface Standing {
  position: number;
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  form: FormResult[];
}

export interface StandingsData {
  league: string;
  leagueLabel: string;
  standings: Standing[];
  fetchedAt: string;
}

export interface TeamValue {
  team: string;
  squadSize: number;
  avgAge: number;
  foreignPlayers: number;
  totalValue: string;
}

export interface TeamValuesData {
  league: string;
  leagueLabel: string;
  teams: TeamValue[];
  fetchedAt: string;
}

export interface LeagueConfig {
  id: string;
  label: string;
  bbcSlug: string | null;
  transfermarktCode: string;
}

export const LEAGUES: LeagueConfig[] = [
  { id: 'super-lig', label: 'Süper Lig', bbcSlug: null, transfermarktCode: 'TR1' },
  { id: 'premier-league', label: 'Premier League', bbcSlug: 'premier-league', transfermarktCode: 'GB1' },
  { id: 'la-liga', label: 'La Liga', bbcSlug: 'spanish-la-liga', transfermarktCode: 'ES1' },
  { id: 'serie-a', label: 'Serie A', bbcSlug: 'italian-serie-a', transfermarktCode: 'IT1' },
  { id: 'bundesliga', label: 'Bundesliga', bbcSlug: 'german-bundesliga', transfermarktCode: 'L1' },
];

export interface TeamListItem {
  name: string;
  teamId: string;
  teamSlug: string;
  tmId?: string;
  tmSlug?: string;
}

export interface PlayerStats {
  name: string;
  position: string;
  age: number;
  nationality: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  secondYellows: number;
  redCards: number;
  minutesPlayed: number;
  marketValue: string;
  playerId?: string;
  playerSlug?: string;
  tmPlayerId?: string;
  tmPlayerSlug?: string;
  currentInjury?: string | null;
}

export interface TeamDetail {
  teamName: string;
  league: string;
  leagueLabel: string;
  teamId?: string;
  teamSlug?: string;
  teamCountry?: string;
  logoUrl?: string;
  squadSize: number;
  avgAge: number;
  totalValue: string;
  pointsPerGame: number;
  totalMatches: number;
  players: PlayerStats[];
  fetchedAt: string;
}

export interface PlayerInjury {
  injury: string;
  from: string;
  to: string;
  daysMissed: number;
  gamesMissed: number;
}

export interface PlayerTransfer {
  fromTeam: string;
  toTeam: string;
  transferDate: string;
  fee: string;
}

export interface PlayerProfile {
  name: string;
  position: string;
  age: number;
  nationality: string;
  marketValue: string;
  currentClub: string;
  foot: string;
  height: string;
  appearances: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  minutesPlayed: number;
  injuries: PlayerInjury[];
  currentInjury: string | null;
  transferHistory: PlayerTransfer[];
  imageUrl?: string;
}


