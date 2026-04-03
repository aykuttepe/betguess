import { Router, Request, Response } from 'express';
import { fetchLiveProgram, fetchCurrentProgramNo } from '../scraper/history-scraper';
import { LiveProgram } from '../scraper/live-types';

const router = Router();

/* ─── In-memory cache (2 minute TTL) ─── */
let cache: { data: LiveProgram; cachedAt: number; pno: number } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

function isCacheValid(pno: number): boolean {
  return !!cache && cache.pno === pno && Date.now() - cache.cachedAt < CACHE_TTL_MS;
}

/* GET /api/live-tracking/program/current */
router.get('/live-tracking/program/current', async (_req: Request, res: Response) => {
  try {
    const pno = await fetchCurrentProgramNo();
    if (!pno) {
      return res.status(404).json({ error: 'Aktif program bulunamadi' });
    }

    if (isCacheValid(pno)) {
      return res.json(cache!.data);
    }

    const program = await fetchLiveProgram(pno);
    if (!program) {
      return res.status(404).json({ error: 'Program verileri alinamadi' });
    }

    cache = { data: program, cachedAt: Date.now(), pno };
    res.json(program);
  } catch (err: any) {
    console.error('[LiveTracking] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/live-tracking/program/:pno */
router.get('/live-tracking/program/:pno', async (req: Request, res: Response) => {
  try {
    const pno = parseInt(String(req.params.pno), 10);
    if (isNaN(pno)) {
      return res.status(400).json({ error: 'Gecersiz program numarasi' });
    }

    if (isCacheValid(pno)) {
      return res.json(cache!.data);
    }

    const program = await fetchLiveProgram(pno);
    if (!program) {
      return res.status(404).json({ error: 'Program bulunamadi' });
    }

    cache = { data: program, cachedAt: Date.now(), pno };
    res.json(program);
  } catch (err: any) {
    console.error('[LiveTracking] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
