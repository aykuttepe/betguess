import { Router, Request, Response } from 'express';
import {
  getMatchIntel,
  MatchIntelNotFoundError,
  MatchIntelUpstreamError,
} from '../services/match-intel-service';

const router = Router();

router.get('/match-intel', async (req: Request, res: Response) => {
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
      res.status(502).json({ error: error.message || 'SofaScore upstream hatasi.' });
      return;
    }

    console.error('[Match Intel] Beklenmeyen hata:', error?.message || error);
    res.status(500).json({ error: 'Match intel verisi alinamadi.' });
  }
});

export default router;
