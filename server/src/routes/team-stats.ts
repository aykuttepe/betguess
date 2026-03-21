import { Router, Request, Response } from 'express';
import { getTeamStats } from '../services/team-stats-service';
import {
  MatchIntelNotFoundError,
  MatchIntelUpstreamError,
} from '../services/match-intel-service';

const router = Router();

router.get('/match-team-stats/:eventId', async (req: Request, res: Response) => {
  const eventId = parseInt(String(req.params.eventId), 10);

  if (!eventId || isNaN(eventId)) {
    res.status(400).json({ error: 'Gecerli bir eventId gerekli.' });
    return;
  }

  try {
    const stats = await getTeamStats(eventId);
    res.json(stats);
  } catch (error: any) {
    if (error instanceof MatchIntelNotFoundError) {
      res.status(404).json({ error: error.message });
      return;
    }

    if (error instanceof MatchIntelUpstreamError) {
      res.status(502).json({ error: error.message || 'SofaScore upstream hatasi.' });
      return;
    }

    console.error('[Team Stats] Beklenmeyen hata:', error?.message || error);
    res.status(500).json({ error: 'Takim istatistikleri alinamadi.' });
  }
});

export default router;
