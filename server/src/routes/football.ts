import { Router, Request, Response } from 'express';
import {
  fetchPrediction,
  fetchMatchOdds,
  fetchMatchShotmap,
  fetchMatchGraph,
  fetchMatchComments,
  fetchMatchIncidents,
  fetchMatchBestPlayers,
  fetchMatchVotes,
  fetchMatchHighlights,
  fetchMatchPregameForm,
  fetchMatchManagers,
  fetchMatchDetail,
  fetchMatchLineups,
  fetchMatchH2H,
  fetchPlayerMatchStats,
  fetchLiveMatches,
  fetchLiveMatchDetail,
  fetchScheduledMatches,
  searchFootball,
  fetchTrending,
  fetchTournaments,
  fetchTournamentInfo,
  fetchTournamentSeasons,
  fetchTournamentStandings,
  fetchFeaturedEvents,
  fetchPopularTournaments,
  fetchTournamentCategories,
  fetchCategoryLeagues,
  fetchTournamentRounds,
  fetchRoundEvents,
  fetchTournamentLastEvents,
  fetchTournamentNextEvents,
  fetchTopPlayers,
  fetchTopTeams,
  fetchTeamImage,
  fetchPopularTeams,
  fetchTeamInfo,
  fetchTeamPlayers,
  fetchTeamLastEvents,
  fetchTeamNextEvents,
  fetchTeamTransfers,
  fetchTeamStatistics,
  fetchTeamSeasons,
  fetchTeamNearEvents,
  fetchPlayerImage,
  fetchPlayerSeasons,
  fetchPlayerStatistics,
  fetchPlayerLastEvents,
  fetchPlayerNextEvents,
  fetchPlayerTransferHistory,
  fetchPlayerHeatmap,
  fetchPlayerNationalTeam,
  fetchPlayerCharacteristics,
  fetchPlayerAttributes,
  FootballApiNotFoundError,
  FootballApiUpstreamError,
} from '../services/football-api';
import { LEAGUES } from '../scraper/types';
import { getStandings, clearStandingsCache } from '../services/standings-service';
import {
  getTeamList,
  getTeamDetail,
  getTeamValues,
  clearTeamDetailCache,
  clearTeamValuesCache,
} from '../services/team-service';
import { getPlayerDetail, clearPlayerCache } from '../services/player-service';

const router = Router();

function parseEventId(req: Request): number {
  return parseInt(String(req.params.eventId), 10);
}

function handleError(res: Response, error: any): void {
  if (error instanceof FootballApiNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (error instanceof FootballApiUpstreamError) {
    res.status(502).json({ error: error.message });
    return;
  }
  console.error('[Football Route]', error?.message || error);
  res.status(500).json({ error: error?.message || 'Beklenmeyen hata' });
}

router.get('/matches/:eventId', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchDetail(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/lineups', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchLineups(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/h2h', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchH2H(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/player/:playerId/statistics', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    res.json(await fetchPlayerMatchStats(parseEventId(req), parseInt(String(playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/predictions', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPrediction(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/odds', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchOdds(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/shotmap', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchShotmap(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/graph', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchGraph(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/comments', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchComments(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/incidents', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchIncidents(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/best-players', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchBestPlayers(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/votes', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchVotes(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/highlights', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchHighlights(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/pregame-form', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchPregameForm(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/matches/:eventId/managers', async (req: Request, res: Response) => {
  try {
    res.json(await fetchMatchManagers(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/live', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchLiveMatches());
  } catch (e) { handleError(res, e); }
});

// IMPORTANT: /live/scheduled must come BEFORE /live/:eventId to avoid "scheduled" being parsed as eventId
router.get('/live/scheduled', async (req: Request, res: Response) => {
  try {
    const matchDate = req.query.matchDate as string | undefined;
    res.json(await fetchScheduledMatches(matchDate));
  } catch (e) { handleError(res, e); }
});

router.get('/live/:eventId', async (req: Request, res: Response) => {
  try {
    res.json(await fetchLiveMatchDetail(parseEventId(req)));
  } catch (e) { handleError(res, e); }
});

router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'q parametresi zorunlu.' });
    return;
  }

  try {
    res.json(await searchFootball(q));
  } catch (e) { handleError(res, e); }
});

router.get('/trending', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTrending());
  } catch (e) { handleError(res, e); }
});

router.get('/popular-tournaments', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchPopularTournaments());
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTournaments());
  } catch (e) { handleError(res, e); }
});

// IMPORTANT: /tournaments/categories must come BEFORE /tournaments/:tournamentId
router.get('/tournaments/categories', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentCategories());
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/categories/:categoryId/leagues', async (req: Request, res: Response) => {
  try {
    res.json(await fetchCategoryLeagues(parseInt(String(req.params.categoryId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentInfo(parseInt(String(req.params.tournamentId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/seasons', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentSeasons(parseInt(String(req.params.tournamentId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/standings', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchTournamentStandings(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        (req.query.type as 'total' | 'home' | 'away') || 'total'
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/featured', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchFeaturedEvents(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10)
      )
    );
  } catch (e) {
    if (e instanceof FootballApiNotFoundError) {
      res.json({ events: [] });
      return;
    }
    handleError(res, e);
  }
});

router.get('/tournaments/:tournamentId/season/:seasonId/rounds', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchTournamentRounds(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10)
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/events/round/:roundNum', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchRoundEvents(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        parseInt(String(req.params.roundNum), 10)
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/events/last', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(
      await fetchTournamentLastEvents(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        page
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/events/next', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(
      await fetchTournamentNextEvents(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        page
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/top-players', async (req: Request, res: Response) => {
  try {
    const statType = String(req.query.stat_type || 'goals');
    res.json(
      await fetchTopPlayers(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        statType
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/tournaments/:tournamentId/season/:seasonId/top-teams', async (req: Request, res: Response) => {
  try {
    const statType = String(req.query.stat_type || 'goals');
    res.json(
      await fetchTopTeams(
        parseInt(String(req.params.tournamentId), 10),
        parseInt(String(req.params.seasonId), 10),
        statType
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/leagues', (_req: Request, res: Response) => {
  res.json(
    LEAGUES.map((league) => ({
      id: league.id,
      label: league.label,
      hasStandings: true,
      hasTeamValues: true,
    }))
  );
});

router.get('/standings/:league', async (req: Request, res: Response) => {
  try {
    res.json(await getStandings(String(req.params.league)));
  } catch (e) { handleError(res, e); }
});

router.post('/standings/:league/refresh', async (req: Request, res: Response) => {
  clearStandingsCache(String(req.params.league));
  try {
    res.json(await getStandings(String(req.params.league)));
  } catch (e) { handleError(res, e); }
});

router.get('/team-values/:league', async (req: Request, res: Response) => {
  try {
    res.json(await getTeamValues(String(req.params.league)));
  } catch (e) { handleError(res, e); }
});

router.post('/team-values/:league/refresh', async (req: Request, res: Response) => {
  clearTeamValuesCache(String(req.params.league));
  try {
    res.json(await getTeamValues(String(req.params.league)));
  } catch (e) { handleError(res, e); }
});

// IMPORTANT: /teams/popular must come BEFORE /teams/:league to avoid "popular" being parsed as league param
router.get('/teams/popular', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchPopularTeams());
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:league', async (req: Request, res: Response) => {
  try {
    res.json(await getTeamList(String(req.params.league)));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/detail', async (req: Request, res: Response) => {
  try {
    res.json(
      await getTeamDetail(
        String(req.params.teamId),
        String(req.query.slug || ''),
        String(req.query.league || 'super-lig')
      )
    );
  } catch (e) { handleError(res, e); }
});

router.post('/teams/:teamId/detail/refresh', async (req: Request, res: Response) => {
  clearTeamDetailCache(String(req.params.teamId));
  try {
    res.json(
      await getTeamDetail(
        String(req.params.teamId),
        String(req.query.slug || ''),
        String(req.query.league || 'super-lig')
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/image', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamImage(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

// --- New Football API team endpoints ---

router.get('/teams/:teamId/info', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamInfo(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/players', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamPlayers(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/events/last', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(await fetchTeamLastEvents(parseInt(String(req.params.teamId), 10), page));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/events/next', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(await fetchTeamNextEvents(parseInt(String(req.params.teamId), 10), page));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/transfers', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamTransfers(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/statistics', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchTeamStatistics(
        parseInt(String(req.params.teamId), 10),
        parseInt(String(req.query.tournament_id || '0'), 10),
        parseInt(String(req.query.season_id || '0'), 10)
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/seasons', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamSeasons(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/teams/:teamId/near-events', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTeamNearEvents(parseInt(String(req.params.teamId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/profile', async (req: Request, res: Response) => {
  try {
    res.json(await getPlayerDetail(String(req.params.playerId), String(req.query.slug || '')));
  } catch (e) { handleError(res, e); }
});

router.post('/players/:playerId/profile/refresh', async (req: Request, res: Response) => {
  clearPlayerCache(String(req.params.playerId));
  try {
    res.json(await getPlayerDetail(String(req.params.playerId), String(req.query.slug || '')));
  } catch (e) { handleError(res, e); }
});

// --- New Football API player endpoints ---

router.get('/players/:playerId/image', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerImage(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/seasons', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerSeasons(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/statistics', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchPlayerStatistics(
        parseInt(String(req.params.playerId), 10),
        parseInt(String(req.query.tournament_id || '0'), 10),
        parseInt(String(req.query.season_id || '0'), 10)
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/events/last', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(await fetchPlayerLastEvents(parseInt(String(req.params.playerId), 10), page));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/events/next', async (req: Request, res: Response) => {
  try {
    const page = parseInt(String(req.query.page || '0'), 10);
    res.json(await fetchPlayerNextEvents(parseInt(String(req.params.playerId), 10), page));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/transfer-history', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerTransferHistory(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/heatmap/:eventId', async (req: Request, res: Response) => {
  try {
    res.json(
      await fetchPlayerHeatmap(
        parseInt(String(req.params.playerId), 10),
        parseInt(String(req.params.eventId), 10)
      )
    );
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/national-team', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerNationalTeam(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/characteristics', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerCharacteristics(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/attributes', async (req: Request, res: Response) => {
  try {
    res.json(await fetchPlayerAttributes(parseInt(String(req.params.playerId), 10)));
  } catch (e) { handleError(res, e); }
});

export default router;


