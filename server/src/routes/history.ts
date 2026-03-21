import { Router, Request, Response } from 'express';
import { fetchHistoricalResults } from '../scraper/history-scraper';
import { analyzeHistory } from '../services/history-analysis';
import { readHistory, writeHistory } from '../scraper/history-cache';

const router = Router();

router.get('/history/analysis', async (req: Request, res: Response) => {
  const count = Math.min(
    Math.max(parseInt(String(req.query.count)) || 50, 1),
    200,
  );

  try {
    const programs = await fetchHistoricalResults(count);
    if (programs.length === 0) {
      return res.status(404).json({ error: 'Gecmis sonuc verisi bulunamadi' });
    }
    const analysis = analyzeHistory(programs);
    res.json(analysis);
  } catch (error: any) {
    console.error('[History] Analysis error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/history/refresh', async (req: Request, res: Response) => {
  const count = Math.min(
    Math.max(parseInt(String(req.body?.count)) || 10, 1),
    50,
  );

  try {
    // Clear stored programs to force re-fetch
    const stored = readHistory();
    const toKeep = stored.filter(
      (p) =>
        !stored
          .sort((a, b) => b.programNo - a.programNo)
          .slice(0, count)
          .some((r) => r.programNo === p.programNo),
    );
    writeHistory(toKeep);

    const programs = await fetchHistoricalResults(count);
    const analysis = analyzeHistory(programs);
    res.json(analysis);
  } catch (error: any) {
    console.error('[History] Refresh error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
