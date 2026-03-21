import axios from 'axios';
import * as cheerio from 'cheerio';
import { Standing, StandingsData, FormResult, LEAGUES } from './types';
import { standingsCache } from './cache';

const BBC_BASE = 'https://www.bbc.com/sport/football';
const TM_BASE = 'https://www.transfermarkt.com.tr';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

function getLeagueSlug(code: string): string {
    const slugs: Record<string, string> = {
        TR1: 'super-lig',
        GB1: 'premier-league',
        ES1: 'laliga',
        IT1: 'serie-a',
        L1: 'bundesliga',
    };
    return slugs[code] || 'lig';
}

export async function scrapeStandings(leagueId: string): Promise<StandingsData> {
    const league = LEAGUES.find(l => l.id === leagueId);
    if (!league) {
        throw new Error(`Bilinmeyen lig: ${leagueId}`);
    }

    // Cache kontrolu
    const cached = standingsCache.get(`standings:${leagueId}`);
    if (cached) {
        console.log(`[Standings] Cache'den donuyor: ${leagueId}`);
        return cached;
    }

    // BBC slug'i varsa BBC'den cek, yoksa Transfermarkt'tan
    if (league.bbcSlug) {
        return scrapeBBC(league.bbcSlug, leagueId, league.label);
    } else {
        return scrapeTransfermarkt(league.transfermarktCode, leagueId, league.label);
    }
}

/**
 * BBC Sport'tan puan durumu cek (Premier League, La Liga, Serie A, Bundesliga)
 */
async function scrapeBBC(bbcSlug: string, leagueId: string, leagueLabel: string): Promise<StandingsData> {
    const url = `${BBC_BASE}/${bbcSlug}/table`;
    console.log(`[BBC] Puan durumu cekiliyor: ${url}`);

    const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 15000,
    });

    const $ = cheerio.load(html);
    const standings: Standing[] = [];

    $('table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 9) return;

        const firstCell = $(cells[0]);
        const teamLink = firstCell.find('a');
        const team = teamLink.length > 0
            ? teamLink.text().trim()
            : firstCell.text().trim().replace(/^\d+/, '');

        const rankSpan = firstCell.find('span').first();
        const position = rankSpan.length > 0
            ? parseInt(rankSpan.text().trim(), 10)
            : parseInt(firstCell.text().trim(), 10);

        const played = parseInt($(cells[1]).text().trim(), 10);
        const won = parseInt($(cells[2]).text().trim(), 10);
        const drawn = parseInt($(cells[3]).text().trim(), 10);
        const lost = parseInt($(cells[4]).text().trim(), 10);
        const gf = parseInt($(cells[5]).text().trim(), 10);
        const ga = parseInt($(cells[6]).text().trim(), 10);
        const gd = parseInt($(cells[7]).text().trim(), 10);
        const points = parseInt($(cells[8]).text().trim(), 10);

        const form: FormResult[] = [];
        const lastCell = $(cells[cells.length - 1]);
        lastCell.find('li').each((_, li) => {
            const text = $(li).text().trim();
            if (text.startsWith('W') || text.includes('Win')) form.push('W');
            else if (text.startsWith('D') || text.includes('Draw')) form.push('D');
            else if (text.startsWith('L') || text.includes('Loss')) form.push('L');
        });

        if (!isNaN(position) && team) {
            standings.push({
                position, team,
                played: played || 0, won: won || 0, drawn: drawn || 0, lost: lost || 0,
                gf: gf || 0, ga: ga || 0, gd: gd || 0, points: points || 0,
                form,
            });
        }
    });

    if (standings.length === 0) {
        throw new Error(`${leagueLabel} puan durumu verisi alinamadi (BBC)`);
    }

    const result: StandingsData = {
        league: leagueId,
        leagueLabel: leagueLabel,
        standings,
        fetchedAt: new Date().toISOString(),
    };

    standingsCache.set(`standings:${leagueId}`, result);
    console.log(`[BBC] ${standings.length} takim puan durumu cekildi: ${leagueLabel}`);
    return result;
}

/**
 * Transfermarkt'tan puan durumu cek (Super Lig ve BBC'de olmayan ligler)
 * Tablo yapisi: [0]=sira, [1]=logo, [2]=takim, [3]=oynanan, [4]=galibiyet,
 * [5]=beraberlik, [6]=maglubiyet, [7]=gol(58:18), [8]=averaj, [9]=puan
 */
async function scrapeTransfermarkt(tmCode: string, leagueId: string, leagueLabel: string): Promise<StandingsData> {
    const slug = getLeagueSlug(tmCode);
    const url = `${TM_BASE}/${slug}/tabelle/wettbewerb/${tmCode}`;
    console.log(`[TM] Puan durumu cekiliyor: ${url}`);

    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 30000 });
    const $ = cheerio.load(html);
    const standings: Standing[] = [];

    $('table.items tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 9) return;

        const position = parseInt($(cells[0]).text().trim(), 10);
        const team = $(cells[2]).find('a').first().text().trim();
        if (!team || isNaN(position)) return;

        const played = parseInt($(cells[3]).text().trim(), 10) || 0;
        const won = parseInt($(cells[4]).text().trim(), 10) || 0;
        const drawn = parseInt($(cells[5]).text().trim(), 10) || 0;
        const lost = parseInt($(cells[6]).text().trim(), 10) || 0;

        // Gol durumu "58:18" formatinda
        const goalsStr = $(cells[7]).text().trim();
        const goalParts = goalsStr.split(':');
        const gf = parseInt(goalParts[0], 10) || 0;
        const ga = parseInt(goalParts[1], 10) || 0;
        const gd = parseInt($(cells[8]).text().trim(), 10) || 0;
        const points = parseInt($(cells[9]).text().trim(), 10) || 0;

        // Transfermarkt'ta form bilgisi yok — bos birak
        const form: FormResult[] = [];

        standings.push({
            position, team,
            played, won, drawn, lost,
            gf, ga, gd, points,
            form,
        });
    });

    if (standings.length === 0) {
        throw new Error(`${leagueLabel} puan durumu verisi alinamadi (Transfermarkt)`);
    }

    const result: StandingsData = {
        league: leagueId,
        leagueLabel: leagueLabel,
        standings,
        fetchedAt: new Date().toISOString(),
    };

    standingsCache.set(`standings:${leagueId}`, result);
    console.log(`[TM] ${standings.length} takim puan durumu cekildi: ${leagueLabel}`);
    return result;
}
