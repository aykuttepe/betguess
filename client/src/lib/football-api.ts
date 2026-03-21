import type {
  MatchPrediction,
  MatchOdds,
  ShotmapItem,
  MomentumGraphData,
  MatchComment,
  MatchIncident,
  BestPlayer,
  MatchVotes,
  MatchHighlight,
  PregameForm,
  SearchResponse,
  LeagueInfo,
  StandingsData,
  TeamValuesData,
  TeamListItem,
  TeamDetail,
  PlayerProfile,
  MatchIntelResponse,
  TeamStatsResponse,
  TournamentMapResponse,
} from './football-types';
import { apiFetchJson } from './http';

const BASE = '/api/football';
const LEGACY_BASE = '/api';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return apiFetchJson<T>(url, init, {
    defaultError: 'Baglanti hatasi',
    redirectOn401: true,
  });
}

export function fetchMatchPredictions(eventId: number): Promise<MatchPrediction> {
  return fetchJson(`${BASE}/matches/${eventId}/predictions`);
}

export function fetchMatchOdds(eventId: number): Promise<MatchOdds> {
  return fetchJson(`${BASE}/matches/${eventId}/odds`);
}

export function fetchMatchShotmap(eventId: number): Promise<ShotmapItem[]> {
  return fetchJson(`${BASE}/matches/${eventId}/shotmap`);
}

export function fetchMatchGraph(eventId: number): Promise<MomentumGraphData> {
  return fetchJson(`${BASE}/matches/${eventId}/graph`);
}

export function fetchMatchComments(eventId: number): Promise<MatchComment[]> {
  return fetchJson(`${BASE}/matches/${eventId}/comments`);
}

export function fetchMatchIncidents(eventId: number): Promise<MatchIncident[]> {
  return fetchJson(`${BASE}/matches/${eventId}/incidents`);
}

export function fetchMatchBestPlayers(eventId: number): Promise<BestPlayer[]> {
  return fetchJson(`${BASE}/matches/${eventId}/best-players`);
}

export function fetchMatchVotes(eventId: number): Promise<MatchVotes> {
  return fetchJson(`${BASE}/matches/${eventId}/votes`);
}

export function fetchMatchHighlights(eventId: number): Promise<MatchHighlight[]> {
  return fetchJson(`${BASE}/matches/${eventId}/highlights`);
}

export function fetchMatchPregameForm(eventId: number): Promise<PregameForm> {
  return fetchJson(`${BASE}/matches/${eventId}/pregame-form`);
}

export function fetchLiveMatches(): Promise<any> {
  return fetchJson(`${BASE}/live`);
}

export function fetchScheduledMatches(matchDate?: string): Promise<any> {
  const q = matchDate ? `?matchDate=${encodeURIComponent(matchDate)}` : '';
  return fetchJson(`${BASE}/live/scheduled${q}`);
}

export function searchFootball(query: string): Promise<SearchResponse> {
  return fetchJson(`${BASE}/search?q=${encodeURIComponent(query)}`);
}

export function fetchTrending(): Promise<any> {
  return fetchJson(`${BASE}/trending`);
}

export function fetchPopularTournaments(): Promise<any> {
  return fetchJson(`${BASE}/popular-tournaments`);
}

export function fetchTournamentCatalog(): Promise<TournamentMapResponse> {
  return fetchJson(`${BASE}/tournaments`);
}

export function fetchTournamentInfo(tournamentId: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}`);
}

export function fetchTournamentSeasons(tournamentId: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/seasons`);
}

export function fetchTournamentStandingsView(
  tournamentId: number,
  seasonId: number,
  type: 'total' | 'home' | 'away' = 'total'
): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/standings?type=${type}`);
}

export function fetchTournamentFeatured(tournamentId: number, seasonId: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/featured`);
}

export function fetchTournamentCategories(): Promise<any> {
  return fetchJson(`${BASE}/tournaments/categories`);
}

export function fetchCategoryLeagues(categoryId: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/categories/${categoryId}/leagues`);
}

export function fetchTournamentRounds(tournamentId: number, seasonId: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/rounds`);
}

export function fetchRoundEvents(tournamentId: number, seasonId: number, roundNum: number): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/events/round/${roundNum}`);
}

export function fetchTournamentLastEvents(tournamentId: number, seasonId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/events/last?page=${page}`);
}

export function fetchTournamentNextEvents(tournamentId: number, seasonId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/events/next?page=${page}`);
}

export function fetchTopPlayers(tournamentId: number, seasonId: number, statType = 'goals'): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/top-players?stat_type=${encodeURIComponent(statType)}`);
}

export function fetchTopTeams(tournamentId: number, seasonId: number, statType = 'goals'): Promise<any> {
  return fetchJson(`${BASE}/tournaments/${tournamentId}/season/${seasonId}/top-teams?stat_type=${encodeURIComponent(statType)}`);
}

export function fetchLeagues(): Promise<LeagueInfo[]> {
  return fetchJson(`${BASE}/leagues`);
}

export function fetchStandings(league: string): Promise<StandingsData> {
  return fetchJson(`${BASE}/standings/${league}`);
}

export function refreshStandings(league: string): Promise<StandingsData> {
  return fetchJson(`${BASE}/standings/${league}/refresh`, { method: 'POST' });
}

export function fetchTeamValues(league: string): Promise<TeamValuesData> {
  return fetchJson(`${BASE}/team-values/${league}`);
}

export function refreshTeamValues(league: string): Promise<TeamValuesData> {
  return fetchJson(`${BASE}/team-values/${league}/refresh`, { method: 'POST' });
}

export function fetchTeamList(league: string): Promise<TeamListItem[]> {
  return fetchJson(`${BASE}/teams/${league}`);
}

export function fetchTeamDetail(teamId: string, slug: string, league: string): Promise<TeamDetail> {
  return fetchJson(`${BASE}/teams/${teamId}/detail?slug=${encodeURIComponent(slug)}&league=${encodeURIComponent(league)}`);
}

export function refreshTeamDetail(teamId: string, slug: string, league: string): Promise<TeamDetail> {
  return fetchJson(`${BASE}/teams/${teamId}/detail/refresh?slug=${encodeURIComponent(slug)}&league=${encodeURIComponent(league)}`, {
    method: 'POST',
  });
}

export function fetchPlayerProfile(playerId: string, slug = ''): Promise<PlayerProfile> {
  return fetchJson(`${BASE}/players/${playerId}/profile?slug=${encodeURIComponent(slug)}`);
}

export function refreshPlayerProfile(playerId: string, slug = ''): Promise<PlayerProfile> {
  return fetchJson(`${BASE}/players/${playerId}/profile/refresh?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
  });
}

export function fetchMatchIntel(
  homeTeam: string,
  awayTeam: string,
  matchDate: string
): Promise<MatchIntelResponse> {
  const url = `${LEGACY_BASE}/match-intel?homeTeam=${encodeURIComponent(homeTeam)}&awayTeam=${encodeURIComponent(awayTeam)}&matchDate=${encodeURIComponent(matchDate)}`;
  return fetchJson(url);
}

export function fetchTeamStats(eventId: number): Promise<TeamStatsResponse> {
  return fetchJson(`${LEGACY_BASE}/match-team-stats/${eventId}`);
}

// --- Football API: Team endpoints ---

export function fetchPopularTeams(): Promise<any> {
  return fetchJson(`${BASE}/teams/popular`);
}

export function fetchTeamInfo(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/info`);
}

export function fetchTeamPlayers(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/players`);
}

export function fetchTeamLastEvents(teamId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/events/last?page=${page}`);
}

export function fetchTeamNextEvents(teamId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/events/next?page=${page}`);
}

export function fetchTeamTransfers(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/transfers`);
}

export function fetchTeamStatistics(teamId: number, tournamentId: number, seasonId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/statistics?tournament_id=${tournamentId}&season_id=${seasonId}`);
}

export function fetchTeamSeasons(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/seasons`);
}

export function fetchTeamNearEvents(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/near-events`);
}

export function fetchTeamImage(teamId: number): Promise<any> {
  return fetchJson(`${BASE}/teams/${teamId}/image`);
}

// --- Football API: Player endpoints ---

export function fetchPlayerImage(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/image`);
}

export function fetchPlayerSeasons(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/seasons`);
}

export function fetchPlayerStatistics(playerId: number, tournamentId: number, seasonId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/statistics?tournament_id=${tournamentId}&season_id=${seasonId}`);
}

export function fetchPlayerLastEvents(playerId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/events/last?page=${page}`);
}

export function fetchPlayerNextEvents(playerId: number, page = 0): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/events/next?page=${page}`);
}

export function fetchPlayerTransferHistory(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/transfer-history`);
}

export function fetchPlayerHeatmap(playerId: number, eventId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/heatmap/${eventId}`);
}

export function fetchPlayerNationalTeam(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/national-team`);
}

export function fetchPlayerCharacteristics(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/characteristics`);
}

export function fetchPlayerAttributes(playerId: number): Promise<any> {
  return fetchJson(`${BASE}/players/${playerId}/attributes`);
}
