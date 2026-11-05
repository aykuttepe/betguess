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
  { id: 'ligue-1', label: 'Ligue 1', bbcSlug: null, transfermarktCode: 'FR1' },
  { id: 'eredivisie', label: 'Eredivisie', bbcSlug: null, transfermarktCode: 'NL1' },
  { id: 'liga-portugal', label: 'Liga Portugal', bbcSlug: null, transfermarktCode: 'PO1' },
  { id: 'championship', label: 'Championship', bbcSlug: null, transfermarktCode: 'GB2' },
  { id: '1-lig', label: '1. Lig', bbcSlug: null, transfermarktCode: 'TR2' },
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
  shirtNumber?: string;
  foot?: string;
  height?: string;
  joinedDate?: string;
  contractEnd?: string;
  currentInjury?: string | null;
  status?: UnavailablePlayerStatus | null;
  statusReason?: string | null;
}

export type UnavailablePlayerStatus = 'injury' | 'suspension' | 'doubtful' | 'unknown';

export interface TeamBreakdownItem {
  label: string;
  count: number;
}

export interface TeamRankedPlayer {
  name: string;
  position?: string;
  age?: number;
  marketValue: string;
  playerId?: string;
  playerSlug?: string;
  tmPlayerId?: string;
  tmPlayerSlug?: string;
}

export interface TeamRelatedMatch {
  eventId?: string | number;
  date?: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number | null;
  awayScore?: number | null;
  tournament?: string;
  status?: string;
}

export interface TeamTransfer {
  playerName: string;
  fromTeam?: string;
  toTeam?: string;
  date?: string;
  fee?: string;
  type?: string;
}

export interface UnavailablePlayer {
  playerName: string;
  status: UnavailablePlayerStatus;
  reason?: string | null;
  startDate?: string | null;
  expectedReturnDate?: string | null;
  missedMatches?: number | null;
}

export interface TeamDetail {
  teamName: string;
  league: string;
  leagueLabel: string;
  teamId?: string;
  teamSlug?: string;
  teamCountry?: string;
  country?: string;
  logoUrl?: string;
  stadium?: string;
  coach?: string;
  foundedYear?: string;
  squadSize: number;
  avgAge: number;
  foreignPlayers: number;
  totalValue: string;
  pointsPerGame: number;
  totalMatches: number;
  positionBreakdown: TeamBreakdownItem[];
  ageBreakdown: TeamBreakdownItem[];
  topPlayersByValue: TeamRankedPlayer[];
  recentMatches: TeamRelatedMatch[];
  nextMatches: TeamRelatedMatch[];
  transfers: TeamTransfer[];
  unavailablePlayers: UnavailablePlayer[];
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

export interface PlayerSearchResult {
  playerId: string;
  playerSlug: string;
  source: 'tm';
  name: string;
  teamName: string;
  teamId: string;
  teamSlug: string;
  league: string;
  leagueLabel: string;
  position: string;
  age: number;
  nationality: string;
  marketValue: string;
  shirtNumber?: string;
  status?: UnavailablePlayerStatus | null;
}


