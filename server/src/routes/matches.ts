import { Router, Request, Response } from 'express';
import { scrapeMatches } from '../scraper/nesine-scraper';
import { clearCache, getCached, getStaleCached } from '../scraper/cache';

const router = Router();
let backgroundRefreshPromise: Promise<void> | null = null;

function revalidateMatchesInBackground(): void {
  if (backgroundRefreshPromise) {
    return;
  }

  backgroundRefreshPromise = scrapeMatches(true)
    .then(() => undefined)
    .catch((error: Error) => {
      console.error('[API] Arka plan mac yenileme basarisiz:', error.message);
    })
    .finally(() => {
      backgroundRefreshPromise = null;
    });
}

router.get('/matches', async (_req: Request, res: Response) => {
  const freshProgram = getCached();
  if (freshProgram) {
    res.setHeader('X-Data-Source', 'fresh-cache');
    res.json(freshProgram);
    return;
  }

  const staleProgram = getStaleCached();
  if (staleProgram) {
    res.setHeader('X-Data-Source', 'stale-cache');
    res.json(staleProgram);
    revalidateMatchesInBackground();
    return;
  }

  try {
    const program = await scrapeMatches(true);
    res.setHeader('X-Data-Source', program.matches.length > 0 ? 'live-scrape' : 'live-empty');
    res.json(program);
  } catch (error: any) {
    console.error('[API] Mac verisi cekilemedi:', error.message);
    res.status(500).json({
      error: 'Mac verileri cekilemedi. Lutfen tekrar deneyin.',
      details: error.message,
    });
  }
});

router.post('/matches/refresh', async (_req: Request, res: Response) => {
  clearCache();
  try {
    const program = await scrapeMatches(true);
    res.setHeader('X-Data-Source', program.matches.length > 0 ? 'live-refresh' : 'live-empty');
    res.json(program);
  } catch (error: any) {
    res.status(500).json({
      error: 'Mac verileri yenilenemedi.',
      details: error.message,
    });
  }
});

export default router;
