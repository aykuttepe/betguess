import { Router, Request, Response } from 'express';
import {
    analyzeMatch,
    analyzeTeam,
    analyzeLeague,
    analyzeTransfers,
    analyzePlayer,
    analyzeBulkMatches,
    fallbackAnalysis,
} from '../services/ai-service';

const router = Router();

// Mac analizi
router.post('/match-analysis', async (req: Request, res: Response) => {
    const { homeTeam, awayTeam, league } = req.body;
    if (!homeTeam || !awayTeam) {
        return res.status(400).json({ error: 'homeTeam ve awayTeam zorunlu.' });
    }
    try {
        const analysis = await analyzeMatch(homeTeam, awayTeam, league || 'Super Lig');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Mac analizi hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Takim analizi
router.post('/team-analysis', async (req: Request, res: Response) => {
    const { team, league } = req.body;
    if (!team) {
        return res.status(400).json({ error: 'team zorunlu.' });
    }
    try {
        const analysis = await analyzeTeam(team, league || 'Super Lig');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Takim analizi hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Lig analizi
router.post('/league-analysis', async (req: Request, res: Response) => {
    const { leagueLabel, standingsSummary } = req.body;
    if (!leagueLabel) {
        return res.status(400).json({ error: 'leagueLabel zorunlu.' });
    }
    try {
        const analysis = await analyzeLeague(leagueLabel, standingsSummary || '');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Lig analizi hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Transfer analizi
router.post('/transfer-analysis', async (req: Request, res: Response) => {
    const { leagueLabel, teamsSummary } = req.body;
    if (!leagueLabel) {
        return res.status(400).json({ error: 'leagueLabel zorunlu.' });
    }
    try {
        const analysis = await analyzeTransfers(leagueLabel, teamsSummary || '');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Transfer analizi hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Oyuncu analizi
router.post('/player-analysis', async (req: Request, res: Response) => {
    const { playerName, playerInfo } = req.body;
    if (!playerName) {
        return res.status(400).json({ error: 'playerName zorunlu.' });
    }
    try {
        const analysis = await analyzePlayer(playerName, playerInfo || '');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Oyuncu analizi hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Toplu mac analizi
router.post('/bulk-analysis', async (req: Request, res: Response) => {
    const { matches, league } = req.body;
    if (!matches || !Array.isArray(matches)) {
        return res.status(400).json({ error: 'matches array zorunlu.' });
    }
    try {
        const analysis = await analyzeBulkMatches(matches, league || 'Super Lig');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Toplu analiz hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Fallback analiz (hata durumu)
router.post('/fallback', async (req: Request, res: Response) => {
    const { context, error: errorMsg } = req.body;
    if (!context) {
        return res.status(400).json({ error: 'context zorunlu.' });
    }
    try {
        const analysis = await fallbackAnalysis(context, errorMsg || 'Bilinmeyen hata');
        res.json({ analysis });
    } catch (error: any) {
        console.error('[AI Route] Fallback hatasi:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
