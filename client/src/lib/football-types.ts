export type FormResult = 'W' | 'D' | 'L';

export interface MatchPrediction {
  homeWinProbability?: number;
  drawProbability?: number;
  awayWinProbability?: number;
  [key: string]: any;
}

export interface MatchOddsMarket {
  marketName?: string;
  choices?: Array<{
    name: string;
    odds: number;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface MatchOdds {
  markets?: MatchOddsMarket[];
  [key: string]: any;
}

export interface ShotmapItem {
  player?: { name: string; id?: number };
  isHome?: boolean;
  shotType?: string;
  situation?: string;
  bodyPart?: string;
  goalMouthLocation?: string;
  playerCoordinates?: { x: number; y: number; z?: number };
  blockCoordinates?: { x: number; y: number; z?: number };
  goalMouthCoordinates?: { x: number; y: number; z?: number };
  xg?: number;
  xgot?: number;
  minute?: number;
  addedTime?: number;
  draw?: { start?: { x: number; y: number }; end?: { x: number; y: number }; goal?: { x: number; y: number } };
  [key: string]: any;
}

export interface MomentumGraphPoint {
  minute: number;
  value: number;
}

export interface MomentumGraphData {
  graphPoints?: MomentumGraphPoint[];
  [key: string]: any;
}

export interface MatchComment {
  text?: string;
  time?: number;
  addedTime?: number;
  [key: string]: any;
}

export interface MatchIncident {
  incidentType?: string;
  time?: number;
  addedTime?: number;
  isHome?: boolean;
  player?: { name: string; id?: number };
  assist1?: { name: string; id?: number };
  homeScore?: number;
  awayScore?: number;
  incidentClass?: string;
  reason?: string;
  playerIn?: { name: string; id?: number };
  playerOut?: { name: string; id?: number };
  rescinded?: boolean;
  text?: string;
  [key: string]: any;
}

export interface BestPlayer {
  player?: { name: string; id?: number; position?: string };
  value?: string;
  label?: string;
  rating?: number;
  [key: string]: any;
}

export interface MatchVotes {
  vote1?: number;
  voteX?: number;
  vote2?: number;
  [key: string]: any;
}

export interface MatchHighlight {
  title?: string;
  subtitle?: string;
  url?: string;
  thumbnailUrl?: string;
  mediaType?: string;
  doFollow?: boolean;
  keyHighlight?: boolean;
  [key: string]: any;
}

export interface PregameFormTeam {
  avgRating?: string;
  position?: number;
  value?: string;
  form?: string[];
  [key: string]: any;
}

export interface PregameForm {
  homeTeam?: PregameFormTeam;
  awayTeam?: PregameFormTeam;
  label?: string;
  [key: string]: any;
}

export interface LiveMatch {
  id: number;
  homeTeam?: { name: string; id?: number };
  awayTeam?: { name: string; id?: number };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
  status?: { type?: string; description?: string };
  tournament?: { name?: string; id?: number };
  startTimestamp?: number;
  [key: string]: any;
}

export interface SearchResult {
  type: string;
  entity: {
    id: number;
    name: string;
    slug?: string;
    [key: string]: any;
  };
}

export interface SearchResponse {
  results?: SearchResult[];
  [key: string]: any;
}

export type MatchIntelCardType = 'yellow' | 'red' | 'second_yellow' | 'unknown';
export type MatchIntelAbsenteeStatus = 'injury' | 'suspension' | 'missing' | 'unknown';

export interface MatchIntelEventMeta {
  eventId: number;
  tournament: string;
  category: string;
  status: string;
  startTimestamp: number;
  startDateIso: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
}

export interface MatchIntelStatisticItem {
  name: string;
  home: string | number | null;
  away: string | number | null;
  homeValue: number | null;
  awayValue: number | null;
  compareCode: number | null;
  valueType: string | null;
  statisticsType: string | null;
}

export interface MatchIntelStatisticsGroup {
  period: string;
  groupName: string;
  items: MatchIntelStatisticItem[];
}

export interface MatchIntelCardIncident {
  id: number | null;
  minute: number | null;
  addedTime: number | null;
  team: 'home' | 'away' | 'unknown';
  cardType: MatchIntelCardType;
  playerName: string;
  reason: string | null;
}

export interface MatchIntelAbsentee {
  side: 'home' | 'away';
  playerId: number | null;
  playerName: string;
  position: string;
  status: MatchIntelAbsenteeStatus;
  reasonCode: number | null;
  description: string | null;
  expectedEndDate: string | null;
}

export interface MatchIntelResponse {
  eventMeta: MatchIntelEventMeta;
  statisticsGroups: MatchIntelStatisticsGroup[];
  cards: MatchIntelCardIncident[];
  absentees: MatchIntelAbsentee[];
  raw: {
    event: any;
    statistics: any;
    incidents: any;
    lineups: any;
  };
}

export interface TeamStandingRow {
  position: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface H2HMatch {
  eventId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  tournament: string;
}

export interface RecentMatch {
  eventId: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  result: 'W' | 'D' | 'L';
  tournament: string;
}

export interface TeamStatsResponse {
  eventId: number;
  homeTeam: {
    id: number;
    name: string;
    standing: TeamStandingRow | null;
    recentMatches: RecentMatch[];
  };
  awayTeam: {
    id: number;
    name: string;
    standing: TeamStandingRow | null;
    recentMatches: RecentMatch[];
  };
  h2hMatches: H2HMatch[];
}

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

export interface LeagueInfo {
  id: string;
  label: string;
  hasStandings: boolean;
  hasTeamValues: boolean;
}

export interface TeamListItem {
  name: string;
  teamId: string;
  teamSlug: string;
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

export interface TournamentSummary {
  id: number;
  name: string;
  slug?: string;
}

export interface TournamentMapResponse {
  tournaments?: Record<string, TournamentSummary>;
}

export interface TournamentSeason {
  id: number;
  name?: string;
  year?: number;
  current?: boolean;
}

