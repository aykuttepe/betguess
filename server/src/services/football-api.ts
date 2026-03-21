import axios from 'axios';
function getFootballApiBaseUrl(): string {
  const raw = (process.env.FOOTBALL_API_URL || 'http://localhost:8000').trim();
  return raw.replace(/\/+$/, '');
}

// --- Error classes ---

export class FootballApiNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballApiNotFoundError';
  }
}

export class FootballApiUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FootballApiUpstreamError';
  }
}

// --- Core fetch ---

export async function fetchFootballApi<T = any>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  try {
    const url = `${getFootballApiBaseUrl()}${path}`;
    const { data } = await axios.get<T>(url, {
      params,
      timeout: 25000,
    });
    return data;
  } catch (error: any) {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(', ')
          : error.message || 'Football API hatasi';

    if (status === 404) {
      throw new FootballApiNotFoundError(message);
    }
    if (status === 422) {
      throw new FootballApiNotFoundError(`Gecersiz parametre: ${message}`);
    }
    throw new FootballApiUpstreamError(
      `Football API istegi basarisiz (${path}): ${message}`
    );
  }
}

// --- Live ---

export async function fetchLiveMatches() {
  return fetchFootballApi('/api/live');
}

export async function fetchScheduledMatches(matchDate?: string) {
  return fetchFootballApi('/api/live/scheduled', matchDate ? { match_date: matchDate } : undefined);
}

export async function fetchLiveMatchDetail(eventId: number) {
  return fetchFootballApi(`/api/live/${eventId}`);
}

// --- Predict ---

export async function fetchPrediction(eventId: number) {
  return fetchFootballApi(`/api/predict/${eventId}`);
}

// --- Stats ---

export async function fetchMatchStats(eventId: number) {
  return fetchFootballApi(`/api/stats/match/${eventId}`);
}

export async function fetchApiStandings(tournamentId: number, seasonId: number) {
  return fetchFootballApi(`/api/stats/standings/${tournamentId}/${seasonId}`);
}

// --- Search ---

export async function searchFootball(query: string) {
  return fetchFootballApi('/api/search', { q: query });
}

// --- Teams ---

export async function fetchPopularTeams() {
  return fetchFootballApi('/api/teams');
}

export async function fetchTeamInfo(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}`);
}

export async function fetchTeamImage(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/image`);
}

export async function fetchTeamPlayers(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/players`);
}

export async function fetchTeamLastEvents(teamId: number, page = 0) {
  return fetchFootballApi(`/api/teams/${teamId}/events/last`, { page });
}

export async function fetchTeamNextEvents(teamId: number, page = 0) {
  return fetchFootballApi(`/api/teams/${teamId}/events/next`, { page });
}

export async function fetchTeamTransfers(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/transfers`);
}

export async function fetchTeamStatistics(teamId: number, tournamentId: number, seasonId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/statistics`, {
    tournament_id: tournamentId,
    season_id: seasonId,
  });
}

export async function fetchTeamSeasons(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/seasons`);
}

export async function fetchTeamNearEvents(teamId: number) {
  return fetchFootballApi(`/api/teams/${teamId}/near-events`);
}

// --- Tournaments ---

export async function fetchTournaments() {
  return fetchFootballApi('/api/tournaments/');
}

export async function fetchTournamentCategories() {
  return fetchFootballApi('/api/tournaments/categories');
}

export async function fetchCategoryLeagues(categoryId: number) {
  return fetchFootballApi(`/api/tournaments/categories/${categoryId}/leagues`);
}

export async function fetchTournamentInfo(tournamentId: number) {
  return fetchFootballApi(`/api/tournaments/${tournamentId}`);
}

export async function fetchTournamentSeasons(tournamentId: number) {
  return fetchFootballApi(`/api/tournaments/${tournamentId}/seasons`);
}

export async function fetchTournamentStandings(
  tournamentId: number,
  seasonId: number,
  type: 'total' | 'home' | 'away' = 'total'
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/standings`,
    { type }
  );
}

export async function fetchTournamentRounds(tournamentId: number, seasonId: number) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/rounds`
  );
}

export async function fetchRoundEvents(
  tournamentId: number,
  seasonId: number,
  roundNum: number
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/events/round/${roundNum}`
  );
}

export async function fetchTournamentLastEvents(
  tournamentId: number,
  seasonId: number,
  page = 0
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/events/last`,
    { page }
  );
}

export async function fetchTournamentNextEvents(
  tournamentId: number,
  seasonId: number,
  page = 0
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/events/next`,
    { page }
  );
}

export async function fetchFeaturedEvents(tournamentId: number, seasonId: number) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/featured`
  );
}

export async function fetchTopPlayers(
  tournamentId: number,
  seasonId: number,
  statType = 'goals'
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/top-players`,
    { stat_type: statType }
  );
}

export async function fetchTopTeams(
  tournamentId: number,
  seasonId: number,
  statType = 'goals'
) {
  return fetchFootballApi(
    `/api/tournaments/${tournamentId}/season/${seasonId}/top-teams`,
    { stat_type: statType }
  );
}

// --- Matches ---

export async function fetchMatchDetail(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}`);
}

export async function fetchMatchStatistics(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/statistics`);
}

export async function fetchMatchLineups(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/lineups`);
}

export async function fetchMatchIncidents(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/incidents`);
}

export async function fetchMatchH2H(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/h2h`);
}

export async function fetchMatchPregameForm(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/pregame-form`);
}

export async function fetchMatchGraph(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/graph`);
}

export async function fetchMatchOdds(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/odds`);
}

export async function fetchMatchShotmap(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/shotmap`);
}

export async function fetchMatchHighlights(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/highlights`);
}

export async function fetchMatchBestPlayers(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/best-players`);
}

export async function fetchMatchComments(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/comments`);
}

export async function fetchMatchManagers(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/managers`);
}

export async function fetchMatchVotes(eventId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/votes`);
}

export async function fetchPlayerMatchStats(eventId: number, playerId: number) {
  return fetchFootballApi(`/api/matches/${eventId}/player/${playerId}/statistics`);
}

// --- Players ---

export async function fetchPlayerInfo(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}`);
}

export async function fetchPlayerImage(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/image`);
}

export async function fetchPlayerSeasons(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/seasons`);
}

export async function fetchPlayerStatistics(
  playerId: number,
  tournamentId: number,
  seasonId: number
) {
  return fetchFootballApi(`/api/players/${playerId}/statistics`, {
    tournament_id: tournamentId,
    season_id: seasonId,
  });
}

export async function fetchPlayerLastEvents(playerId: number, page = 0) {
  return fetchFootballApi(`/api/players/${playerId}/events/last`, { page });
}

export async function fetchPlayerNextEvents(playerId: number, page = 0) {
  return fetchFootballApi(`/api/players/${playerId}/events/next`, { page });
}

export async function fetchPlayerTransferHistory(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/transfer-history`);
}

export async function fetchPlayerHeatmap(playerId: number, eventId: number) {
  return fetchFootballApi(`/api/players/${playerId}/heatmap/${eventId}`);
}

export async function fetchPlayerNationalTeam(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/national-team`);
}

export async function fetchPlayerCharacteristics(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/characteristics`);
}

export async function fetchPlayerAttributes(playerId: number) {
  return fetchFootballApi(`/api/players/${playerId}/attributes`);
}

// --- Managers ---

export async function fetchManagerInfo(managerId: number) {
  return fetchFootballApi(`/api/managers/${managerId}`);
}

export async function fetchManagerCareer(managerId: number) {
  return fetchFootballApi(`/api/managers/${managerId}/career`);
}

export async function fetchManagerImage(managerId: number) {
  return fetchFootballApi(`/api/managers/${managerId}/image`);
}

// --- Trending ---

export async function fetchTrending() {
  return fetchFootballApi('/api/trending');
}

export async function fetchPopularTournaments() {
  return fetchFootballApi('/api/popular-tournaments');
}


export const __testables = {
  getFootballApiBaseUrl,
};


