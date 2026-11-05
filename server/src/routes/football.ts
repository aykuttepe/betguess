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
  fetchLiveMatchDetail,
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
import { getLiveEvents, getScheduledEventsForDate, searchSofaScore } from '../services/sofascore-service';
import { LEAGUES } from '../scraper/types';
import { getStandings, clearStandingsCache } from '../services/standings-service';
import {
  getTeamList,
  getTeamDetail,
  getTeamValues,
  clearTeamDetailCache,
  clearTeamValuesCache,
} from '../services/team-service';
import { getPlayerDetail, searchPlayers, clearPlayerCache } from '../services/player-service';


const router = Router();
const LOCAL_SEASON_ID = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
const LOCAL_TOURNAMENT_IDS: Record<string, number> = {
  'super-lig': 52,
  'premier-league': 17,
  'la-liga': 8,
  'serie-a': 23,
  'bundesliga': 35,
  'ligue-1': 34,
  'eredivisie': 37,
  'liga-portugal': 238,
  'championship': 18,
  '1-lig': 98,
};

interface LocalTournament {
  slug: string;
  id: number;
  name: string;
  type: 'league' | 'cup';
}

const LOCAL_CUP_TOURNAMENTS: LocalTournament[] = [
  { slug: 'champions-league', id: 7, name: 'UEFA Champions League', type: 'cup' },
  { slug: 'europa-league', id: 679, name: 'UEFA Europa League', type: 'cup' },
  { slug: 'conference-league', id: 17015, name: 'UEFA Conference League', type: 'cup' },
  { slug: 'uefa-super-cup', id: 1_000_001, name: 'UEFA Super Cup', type: 'cup' },
  { slug: 'world-cup', id: 16, name: 'FIFA World Cup', type: 'cup' },
  { slug: 'euro', id: 1, name: 'UEFA European Championship', type: 'cup' },
  { slug: 'nations-league', id: 10783, name: 'UEFA Nations League', type: 'cup' },
  { slug: 'copa-libertadores', id: 384, name: 'Copa Libertadores', type: 'cup' },
];

const LOCAL_TOURNAMENTS: LocalTournament[] = [
  ...LEAGUES.map((league) => ({
    slug: league.id,
    id: LOCAL_TOURNAMENT_IDS[league.id] ?? Math.abs(hashString(league.id)),
    name: league.label,
    type: 'league' as const,
  })),
  ...LOCAL_CUP_TOURNAMENTS,
];

const LOCAL_LEAGUE_TOURNAMENTS = LOCAL_TOURNAMENTS.filter((tournament) => tournament.type === 'league');
const LOCAL_ALL_TOURNAMENTS = LOCAL_TOURNAMENTS.map((tournament) => ({
  slug: tournament.slug,
  id: tournament.id,
  name: tournament.name,
  type: tournament.type,
}));

function parseEventId(req: Request): number {
  return parseInt(String(req.params.eventId), 10);
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  return hash;
}

function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function getLocalTournamentById(tournamentId: number) {
  return LOCAL_TOURNAMENTS.find((tournament) => tournament.id === tournamentId) ?? null;
}

function getLocalTournamentCatalog() {
  const leagues = LOCAL_ALL_TOURNAMENTS.filter((tournament) => tournament.type === 'league');
  const cups = LOCAL_ALL_TOURNAMENTS.filter((tournament) => tournament.type === 'cup');

  return {
    tournaments: Object.fromEntries(
      LOCAL_ALL_TOURNAMENTS.map((tournament) => [
        tournament.slug,
        tournament,
      ])
    ),
    leagues,
    cups,
  };
}

function getLocalSeasons() {
  return {
    seasons: [{
      id: LOCAL_SEASON_ID,
      name: `${LOCAL_SEASON_ID}/${String(LOCAL_SEASON_ID + 1).slice(-2)}`,
      year: LOCAL_SEASON_ID,
      current: true,
    }],
  };
}

async function getLocalTournamentStandings(tournamentId: number) {
  const tournament = getLocalTournamentById(tournamentId);
  if (!tournament) {
    throw new FootballApiNotFoundError(`Turnuva bulunamadi: ${tournamentId}`);
  }

  if (tournament.type !== 'league') {
    return { standings: [] };
  }

  const data = await getStandings(tournament.slug);
  return {
    standings: [{
      name: data.leagueLabel,
      type: 'total',
      rows: data.standings.map((row, index) => ({
        position: row.position,
        team: {
          id: index + 1,
          name: row.team,
          slug: normalizeSearch(row.team),
        },
        matches: row.played,
        wins: row.won,
        draws: row.drawn,
        losses: row.lost,
        scoresFor: row.gf,
        scoresAgainst: row.ga,
        points: row.points,
      })),
    }],
  };
}

async function searchLocalFootball(query: string) {
  const needle = normalizeSearch(query);
  const results: Array<{ type: 'team' | 'tournament'; entity: { id: number; name: string; slug: string } }> = [];

  for (const tournament of LOCAL_TOURNAMENTS) {
    if (normalizeSearch(tournament.name).includes(needle) || normalizeSearch(tournament.slug).includes(needle)) {
      results.push({
        type: 'tournament',
        entity: { id: tournament.id, name: tournament.name, slug: tournament.slug },
      });
    }
  }

  if (needle.length >= 3) {
    const teamResults = await Promise.all(
      LOCAL_LEAGUE_TOURNAMENTS.map(async (tournament) => {
        const teams = await getTeamList(tournament.slug).catch(() => []);
        return teams
          .filter((team) => normalizeSearch(team.name).includes(needle) || normalizeSearch(team.teamSlug).includes(needle))
          .slice(0, 8)
          .map((team) => ({
            type: 'team' as const,
            entity: {
              id: Number(team.teamId) || 0,
              name: team.name,
              slug: team.teamSlug,
            },
          }));
      })
    );
    results.push(...teamResults.flat());
  }

  return { results: results.slice(0, 30) };
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
  // Zincir: SofaScore → ESPN
  try {
    const result = await getLiveEvents();
    if (result.events.length > 0) return res.json(result);
    throw new Error('SofaScore boş döndü');
  } catch (_sofaErr) {
    try {
      const { getEspnLiveAndScheduled } = await import('../services/espn-service');
      const result = await getEspnLiveAndScheduled();
      res.json(result);
    } catch (e) { handleError(res, e); }
  }
});

// IMPORTANT: /live/scheduled and /live/finished must come BEFORE /live/:eventId
router.get('/live/finished', async (_req: Request, res: Response) => {
  // Zincir: SofaScore → ESPN
  const merge = (a: any[], b: any[]) => {
    const seen = new Set<any>();
    const out: any[] = [];
    for (const m of [...a, ...b]) {
      if (m.id && !seen.has(m.id)) { seen.add(m.id); out.push(m); }
    }
    return out;
  };

  try {
    const today = new Date().toISOString().split('T')[0];
    const [liveResult, scheduledResult] = await Promise.all([
      getLiveEvents().catch(() => ({ events: [] })),
      getScheduledEventsForDate(today).catch(() => ({ events: [] })),
    ]);
    const combined = merge(liveResult.events, scheduledResult.events);
    if (combined.length > 0) return res.json({ events: combined });
    throw new Error('SofaScore boş döndü');
  } catch (_sofaErr) {
    try {
      const { getEspnLiveAndScheduled } = await import('../services/espn-service');
      const result = await getEspnLiveAndScheduled();
      res.json(result);
    } catch (e) { handleError(res, e); }
  }
});

router.get('/live/scheduled', async (req: Request, res: Response) => {
  // Zincir: SofaScore → ESPN
  try {
    const matchDate = req.query.matchDate as string | undefined;
    const result = await getScheduledEventsForDate(matchDate);
    res.json(result);
  } catch (_sofaErr) {
    try {
      const { getEspnLiveAndScheduled } = await import('../services/espn-service');
      const result = await getEspnLiveAndScheduled();
      res.json(result);
    } catch (e) { handleError(res, e); }
  }
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

  // Zincir: SofaScore → local catalog
  try {
    const data = await searchSofaScore(q);
    if (data.results.length > 0) return res.json(data);
    throw new Error('SofaScore sonuç bulunamadı');
  } catch (_sofaErr) {
    res.json(await searchLocalFootball(q));
  }
});

router.get('/trending', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTrending());
  } catch (e) { handleError(res, e); }
});

router.get('/popular-tournaments', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchPopularTournaments());
  } catch {
    res.json({ tournaments: LOCAL_ALL_TOURNAMENTS });
  }
});

router.get('/tournaments', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTournaments());
  } catch {
    res.json(getLocalTournamentCatalog());
  }
});

// IMPORTANT: /tournaments/categories must come BEFORE /tournaments/:tournamentId
router.get('/tournaments/categories', async (_req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentCategories());
  } catch {
    res.json({ categories: [{ id: 1, name: 'Ligler' }, { id: 2, name: 'Kupalar' }] });
  }
});

router.get('/tournaments/categories/:categoryId/leagues', async (req: Request, res: Response) => {
  try {
    res.json(await fetchCategoryLeagues(parseInt(String(req.params.categoryId), 10)));
  } catch {
    const categoryId = parseInt(String(req.params.categoryId), 10);
    res.json({
      leagues: LOCAL_ALL_TOURNAMENTS.filter((tournament) =>
        categoryId === 2 ? tournament.type === 'cup' : tournament.type === 'league'
      ),
    });
  }
});

router.get('/tournaments/:tournamentId', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentInfo(parseInt(String(req.params.tournamentId), 10)));
  } catch (e) {
    const tournament = getLocalTournamentById(parseInt(String(req.params.tournamentId), 10));
    if (tournament) {
      res.json({ tournament: { id: tournament.id, name: tournament.name, slug: tournament.slug } });
      return;
    }
    handleError(res, e);
  }
});

router.get('/tournaments/:tournamentId/seasons', async (req: Request, res: Response) => {
  try {
    res.json(await fetchTournamentSeasons(parseInt(String(req.params.tournamentId), 10)));
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json(getLocalSeasons());
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    try {
      res.json(await getLocalTournamentStandings(parseInt(String(req.params.tournamentId), 10)));
    } catch {
      handleError(res, e);
    }
  }
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
    if (e instanceof FootballApiNotFoundError || getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ rounds: [] });
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ events: [] });
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ events: [] });
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ events: [] });
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ topPlayers: [] });
      return;
    }
    handleError(res, e);
  }
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
  } catch (e) {
    if (getLocalTournamentById(parseInt(String(req.params.tournamentId), 10))) {
      res.json({ topTeams: [] });
      return;
    }
    handleError(res, e);
  }
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

router.get('/players/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    const league = String(req.query.league || '');
    const limit = Math.min(parseInt(String(req.query.limit || '30'), 10) || 30, 50);
    res.json({ results: await searchPlayers(q, league, limit) });
  } catch (e) { handleError(res, e); }
});

router.get('/players/:playerId/profile', async (req: Request, res: Response) => {
  try {
    const source = String(req.query.source || 'sofa') === 'tm' ? 'tm' : 'sofa';
    res.json(await getPlayerDetail(String(req.params.playerId), String(req.query.slug || ''), source));
  } catch (e) { handleError(res, e); }
});

router.post('/players/:playerId/profile/refresh', async (req: Request, res: Response) => {
  clearPlayerCache(String(req.params.playerId));
  try {
    const source = String(req.query.source || 'sofa') === 'tm' ? 'tm' : 'sofa';
    res.json(await getPlayerDetail(String(req.params.playerId), String(req.query.slug || ''), source));
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


