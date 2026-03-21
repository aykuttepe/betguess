import axios from 'axios';
import * as cheerio from 'cheerio';
import { TeamValue, TeamValuesData, LEAGUES } from './types';
import { teamValuesCache } from './cache';

const TM_BASE = 'https://www.transfermarkt.com.tr';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function scrapeTeamValues(leagueId: string): Promise<TeamValuesData> {
    const league = LEAGUES.find(l => l.id === leagueId);
    if (!league) {
        throw new Error(`Bilinmeyen lig: ${leagueId}`);
    }

    // Cache kontrolü
    const cached = teamValuesCache.get(`values:${leagueId}`);
    if (cached) {
        console.log(`[TM] Cache'den donuyor: ${leagueId}`);
        return cached;
    }

    // Transfermarkt lig sayfası: /super-lig/startseite/wettbewerb/TR1
    const leagueSlug = getLeagueSlug(league.transfermarktCode);
    const url = `${TM_BASE}/${leagueSlug}/startseite/wettbewerb/${league.transfermarktCode}`;
    console.log(`[TM] Takim degerleri cekiliyor: ${url}`);

    const { data: html } = await axios.get(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        },
        timeout: 15000,
    });

    const $ = cheerio.load(html);
    const teams: TeamValue[] = [];

    // Transfermarkt tablo yapısını parse et
    // Yapı: 7 td hücresi per satır
    // [0] = boş/logo, [1] = takım adı (hauptlink), [2] = kadro, [3] = ort. yaş
    // [4] = lejyonerler, [5] = ort. piyasa değeri, [6] = toplam değer
    $('table.items tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 7) return;

        // Takım adı: hauptlink sınıfındaki a etiketinden
        const teamLink = $(cells[1]).find('a').first();
        const team = teamLink.text().trim();
        if (!team) return;

        // Oyuncu satırlarını atla (genellikle daha az hücre veya farklı yapı)
        const squadText = $(cells[2]).text().trim();
        const squadSize = parseInt(squadText, 10);
        if (isNaN(squadSize)) return;

        const avgAge = parseFloat($(cells[3]).text().trim().replace(',', '.')) || 0;
        const foreignPlayers = parseInt($(cells[4]).text().trim(), 10) || 0;
        const totalValue = $(cells[6]).text().trim() || '-';

        teams.push({
            team,
            squadSize,
            avgAge,
            foreignPlayers,
            totalValue,
        });
    });

    if (teams.length === 0) {
        throw new Error(`${league.label} takim degerleri alinamadi`);
    }

    const result: TeamValuesData = {
        league: leagueId,
        leagueLabel: league.label,
        teams,
        fetchedAt: new Date().toISOString(),
    };

    teamValuesCache.set(`values:${leagueId}`, result);
    console.log(`[TM] ${teams.length} takim degeri cekildi: ${league.label}`);
    return result;
}

function getLeagueSlug(code: string): string {
    const slugs: Record<string, string> = {
        TR1: 'super-lig',
        GB1: 'premier-league',
        ES1: 'laliga',
        IT1: 'serie-a',
        L1: 'bundesliga',
        GB2: 'championship',
    };
    return slugs[code] || 'lig';
}
