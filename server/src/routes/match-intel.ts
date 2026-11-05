import { Router, Response } from 'express';
import {
  getMatchIntel,
  MatchIntelNotFoundError,
  MatchIntelUpstreamError,
} from '../services/sofascore-service';
import { AuthRequest } from '../auth/types';

const router = Router();

function parseMatchDateToIso(matchDate: string): string {
  const [day, month, year] = matchDate.split('.');
  if (!day || !month || !year) return '';
  return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function createFallbackMatchIntel(homeTeam: string, awayTeam: string, matchDate: string) {
  const dateIso = parseMatchDateToIso(matchDate);
  const startTimestamp = dateIso
    ? Math.floor(new Date(`${dateIso}T00:00:00Z`).getTime() / 1000)
    : 0;

  const event = {
    id: 0,
    homeTeam: { name: homeTeam },
    awayTeam: { name: awayTeam },
    tournament: {
      name: '',
      category: { name: '' },
    },
    status: { description: 'Not started', type: 'notstarted' },
    startTimestamp,
  };

  return {
    eventMeta: {
      eventId: 0,
      tournament: '',
      category: '',
      status: 'Not started',
      startTimestamp,
      startDateIso: startTimestamp ? new Date(startTimestamp * 1000).toISOString() : '',
      homeTeam,
      awayTeam,
      homeScore: null,
      awayScore: null,
    },
    statisticsGroups: [],
    cards: [],
    absentees: [],
    raw: {
      event: { event },
      statistics: { statistics: [] },
      incidents: { incidents: [] },
      lineups: {},
    },
  };
}

router.get('/match-intel', async (req: AuthRequest, res: Response) => {
  const homeTeam = String(req.query.homeTeam || '').trim();
  const awayTeam = String(req.query.awayTeam || '').trim();
  const matchDate = String(req.query.matchDate || '').trim();

  if (!homeTeam || !awayTeam || !matchDate) {
    res.status(400).json({
      error: 'homeTeam, awayTeam ve matchDate (DD.MM.YYYY) zorunlu.',
    });
    return;
  }

  try {
    const intel = await getMatchIntel(homeTeam, awayTeam, matchDate);
    res.json(intel);
  } catch (error: any) {
    if (error instanceof MatchIntelNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof MatchIntelUpstreamError) {
      if (/forbidden/i.test(error.message || '')) {
        res.json(createFallbackMatchIntel(homeTeam, awayTeam, matchDate));
        return;
      }

      res.status(502).json({ error: error.message || 'SofaScore upstream hatasi.' });
      return;
    }

    console.error('[Match Intel] Beklenmeyen hata:', error?.message || error);
    res.status(500).json({ error: 'Match intel verisi alinamadi.' });
  }
});

export default router;
