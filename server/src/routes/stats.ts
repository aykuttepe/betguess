import { Router, Response } from 'express';
import { LEAGUES } from '../scraper/types';
import { getStandings, clearStandingsCache } from '../services/standings-service';
import { getTeamList, getTeamDetail, getTeamValues, clearTeamDetailCache, clearTeamValuesCache } from '../services/team-service';
import { getPlayerDetail, clearPlayerCache } from '../services/player-service';

const router = Router();

// Desteklenen ligleri listele
router.get('/leagues', (_req, res: Response) => {
    res.json(LEAGUES.map(l => ({
        id: l.id,
        label: l.label,
        hasStandings: true,
        hasTeamValues: true,
    })));
});

// Puan durumu
router.get('/standings/:league', async (req, res: Response) => {
    const league = req.params.league;
    try {
        const data = await getStandings(league);
        res.json(data);
    } catch (error: any) {
        console.error(`[API] Puan durumu cekilemedi (${league}):`, error.message);
        res.status(500).json({
            error: error.message || 'Puan durumu verileri cekilemedi.',
        });
    }
});

// Puan durumu cache temizle
router.post('/standings/:league/refresh', async (req, res: Response) => {
    const league = req.params.league;
    clearStandingsCache(league);
    try {
        const data = await getStandings(league);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Takim degerleri
router.get('/team-values/:league', async (req, res: Response) => {
    const league = req.params.league;
    try {
        const data = await getTeamValues(league);
        res.json(data);
    } catch (error: any) {
        console.error(`[API] Takim degerleri cekilemedi (${league}):`, error.message);
        res.status(500).json({
            error: error.message || 'Takim degerleri cekilemedi.',
        });
    }
});

// Takim degerleri cache temizle
router.post('/team-values/:league/refresh', async (req, res: Response) => {
    const league = req.params.league;
    clearTeamValuesCache(league);
    try {
        const data = await getTeamValues(league);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Lig ici takim listesi
router.get('/teams/:league', async (req, res: Response) => {
    const league = req.params.league;
    try {
        const teams = await getTeamList(league);
        res.json(teams);
    } catch (error: any) {
        console.error(`[API] Takim listesi cekilemedi (${league}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Takim detay (oyuncu istatistikleri)
router.get('/team-detail/:teamId', async (req, res: Response) => {
    const { teamId } = req.params;
    const teamSlug = (req.query.slug as string) || '';
    const league = (req.query.league as string) || 'super-lig';
    try {
        const data = await getTeamDetail(teamId, teamSlug, league);
        res.json(data);
    } catch (error: any) {
        console.error(`[API] Takim detayi cekilemedi (${teamId}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Takim detay cache temizle
router.post('/team-detail/:teamId/refresh', async (req, res: Response) => {
    const { teamId } = req.params;
    const teamSlug = (req.query.slug as string) || '';
    const league = (req.query.league as string) || 'super-lig';
    clearTeamDetailCache(teamId);
    try {
        const data = await getTeamDetail(teamId, teamSlug, league);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Oyuncu detay profili (sakatlik dahil)
router.get('/player/:playerId', async (req, res: Response) => {
    const { playerId } = req.params;
    const playerSlug = (req.query.slug as string) || '';
    try {
        const data = await getPlayerDetail(playerId, playerSlug);
        res.json(data);
    } catch (error: any) {
        console.error(`[API] Oyuncu detayi cekilemedi (${playerId}):`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// Oyuncu detay cache temizle
router.post('/player/:playerId/refresh', async (req, res: Response) => {
    const { playerId } = req.params;
    clearPlayerCache(playerId);
    try {
        const data = await getPlayerDetail(playerId);
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
