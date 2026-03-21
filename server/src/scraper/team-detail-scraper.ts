import axios from 'axios';
import * as cheerio from 'cheerio';
import { TeamListItem, PlayerStats, TeamDetail, LEAGUES } from './types';
import { teamListCache, teamDetailCache } from './cache';

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

/**
 * Lig sayfasından takım listesini çeker (isim + Transfermarkt ID)
 */
export async function scrapeTeamList(leagueId: string): Promise<TeamListItem[]> {
    const league = LEAGUES.find(l => l.id === leagueId);
    if (!league) throw new Error(`Bilinmeyen lig: ${leagueId}`);

    const cached = teamListCache.get(`teams:${leagueId}`);
    if (cached) {
        console.log(`[TM-Detail] Takım listesi cache'den: ${leagueId}`);
        return cached;
    }

    const slug = getLeagueSlug(league.transfermarktCode);
    const url = `${TM_BASE}/${slug}/startseite/wettbewerb/${league.transfermarktCode}`;
    console.log(`[TM-Detail] Takım listesi cekiliyor: ${url}`);

    const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(html);
    const teams: TeamListItem[] = [];

    $('table.items tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length < 7) return;

        const teamLink = $(cells[1]).find('a').first();
        const name = teamLink.text().trim();
        if (!name) return;

        const href = teamLink.attr('href') || '';
        const vereinMatch = href.match(/\/verein\/(\d+)/);
        const slugMatch = href.match(/^\/([^/]+)\//);

        if (vereinMatch) {
            const tmId = vereinMatch[1];
            const tmSlug = slugMatch ? slugMatch[1] : name.toLowerCase().replace(/\s+/g, '-');

            if (!teams.find(t => (t.tmId || t.teamId) === tmId)) {
                teams.push({ name, teamId: tmId, teamSlug: tmSlug, tmId, tmSlug });
            }
        }
    });

    if (teams.length === 0) {
        throw new Error(`${league.label} takim listesi alinamadi`);
    }

    teamListCache.set(`teams:${leagueId}`, teams);
    console.log(`[TM-Detail] ${teams.length} takim bulundu: ${league.label}`);
    return teams;
}

/**
 * Belirli bir takımın güncel kadro + performans istatistiklerini çeker.
 * Kadro sayfası (kader) + Performans sayfası (leistungsdaten) birleştirilir.
 */
export async function scrapeTeamDetail(
    teamId: string,
    teamSlug: string,
    leagueId: string
): Promise<TeamDetail> {
    const league = LEAGUES.find(l => l.id === leagueId);
    if (!league) throw new Error(`Bilinmeyen lig: ${leagueId}`);

    const cached = teamDetailCache.get(`detail:${teamId}`);
    if (cached) {
        console.log(`[TM-Detail] Cache'den: ${teamId}`);
        return cached;
    }

    // Guncel sezonu otomatik hesapla (Temmuz'dan itibaren yeni sezon baslar)
    const now = new Date();
    const seasonYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

    // ============= 1) KADRO SAYFASI — guncel tam kadro + piyasa degerleri =============
    const kaderUrl = `${TM_BASE}/${teamSlug}/kader/verein/${teamId}/saison_id/${seasonYear}/plus/1`;
    console.log(`[TM-Detail] Kadro cekiliyor: ${kaderUrl}`);

    const { data: kaderHtml } = await axios.get(kaderUrl, { headers: HEADERS, timeout: 15000 });
    const $k = cheerio.load(kaderHtml);

    let teamName = $k('h1[class*="data-header"]').text().trim()
        || $k('header .data-header__headline-wrapper').text().trim()
        || teamSlug.replace(/-/g, ' ');

    let squadSize = 0;
    let avgAge = 0;
    let totalValue = '-';
    let pointsPerGame = 0;
    let totalMatches = 0;

    const headerDetails = $k('[class*="data-header__details"]').text();
    const squadMatch2 = headerDetails.match(/Kadro[^:]*:\s*(\d+)/i);
    if (squadMatch2) squadSize = parseInt(squadMatch2[1], 10);

    const ageMatch2 = headerDetails.match(/Ya[sş][^:]*:\s*(\d+[.,]\d+)/i);
    if (ageMatch2) avgAge = parseFloat(ageMatch2[1].replace(',', '.'));

    const valueBox = $k('[class*="data-header__market-value"]').text().trim()
        || $k('[class*="waehrung"]').first().text().trim();
    if (valueBox) totalValue = valueBox;

    // Kadro oyuncularini parse et
    const kaderPlayers: Map<string, PlayerStats> = new Map();
    let currentPosition = '';

    $k('table.items tbody tr').each((_, row) => {
        const $row = $k(row);
        const cells = $row.find('td');

        // Pozisyon baslik satirlari
        if (cells.length === 1) {
            const posText = $k(cells[0]).text().trim();
            if (posText) currentPosition = posText;
            return;
        }
        if (cells.length < 4) return;

        // Oyuncu adi
        const nameCell = $row.find('a[href*="spieler"]').first();
        const name = nameCell.text().trim();
        if (!name || name.length < 2) return;

        // Oyuncu TM ID ve slug
        const playerHref = nameCell.attr('href') || '';
        const playerIdMatch = playerHref.match(/\/spieler\/(\d+)/);
        const playerSlugMatch = playerHref.match(/^\/([^/]+)\//);
        const tmPlayerId = playerIdMatch ? playerIdMatch[1] : undefined;
        const tmPlayerSlug = playerSlugMatch ? playerSlugMatch[1] : undefined;

        // Yas — 2 haneli sayi iceren td
        let age = 0;
        cells.each((_, c) => {
            const t = $k(c).text().trim();
            if (/^\d{2}$/.test(t)) {
                const n = parseInt(t, 10);
                if (n >= 14 && n <= 50 && age === 0) age = n;
            }
        });

        // Uyruk
        const nationality = $row.find('img[title]').filter((_, el) => {
            const src = $k(el).attr('src') || '';
            return src.includes('flag') || src.includes('header');
        }).first().attr('title') || '';

        // Piyasa degeri
        const mvCell = $row.find('td.rechts a, td.rechts').last().text().trim();
        const marketValue = mvCell && mvCell.includes('€') ? mvCell : '-';

        if (!kaderPlayers.has(name)) {
            kaderPlayers.set(name, {
                name,
                position: currentPosition,
                age,
                nationality,
                appearances: 0,
                goals: 0,
                assists: 0,
                yellowCards: 0,
                secondYellows: 0,
                redCards: 0,
                minutesPlayed: 0,
                marketValue,
                tmPlayerId,
                tmPlayerSlug,
            });
        }
    });

    console.log(`[TM-Detail] Kadro'dan ${kaderPlayers.size} oyuncu bulundu`);

    // ============= 2) PERFORMANS SAYFASI — mac istatistikleri =============
    const perfUrl = `${TM_BASE}/${teamSlug}/leistungsdaten/verein/${teamId}/reldata/%26${seasonYear}/plus/1`;
    console.log(`[TM-Detail] Performans verileri cekiliyor: ${perfUrl}`);

    try {
        const { data: perfHtml } = await axios.get(perfUrl, { headers: HEADERS, timeout: 15000 });
        const $p = cheerio.load(perfHtml);

        // Mac ve puan bilgisi
        const infoText = $p('div.data-header__box--big').text()
            || $p('[class*="data-header"]').text();
        const matchPPG = infoText.match(/(\d+)\s*ma[çc].*?(\d+[.,]\d+)\s*puan/i);
        if (matchPPG) {
            totalMatches = parseInt(matchPPG[1], 10);
            pointsPerGame = parseFloat(matchPPG[2].replace(',', '.'));
        }

        // Performans istatistiklerini parse et — eslestir
        let perfPosition = '';
        $p('table.items tbody tr').each((_, row) => {
            const $row = $p(row);
            const cells = $row.find('td');

            if (cells.length === 1) {
                const posText = $p(cells[0]).text().trim();
                if (posText) perfPosition = posText;
                return;
            }
            if (cells.length < 10) return;

            const nameCell = $row.find('td.hauptlink a').first();
            const name = nameCell.text().trim();
            if (!name || name.length < 2) return;

            const parseNum = (cell: cheerio.Element) => {
                const t = $p(cell).text().trim().replace(/\./g, '').replace(/'/g, '').replace(/-/g, '0');
                return parseInt(t, 10) || 0;
            };

            const appearances = parseNum(cells[8]);
            const goals = parseNum(cells[9]);
            const assists = parseNum(cells[10]);
            const yellowCards = parseNum(cells[11]);
            const secondYellows = parseNum(cells[12]);
            const redCards = parseNum(cells[13]);
            const minutesPlayed = parseNum(cells[17]);

            // Kadro'daki oyuncuyla eslestir
            const player = kaderPlayers.get(name);
            if (player) {
                player.appearances = appearances;
                player.goals = goals;
                player.assists = assists;
                player.yellowCards = yellowCards;
                player.secondYellows = secondYellows;
                player.redCards = redCards;
                player.minutesPlayed = minutesPlayed;
                if (!player.position || player.position.length < 2) {
                    player.position = perfPosition;
                }
            }
        });

        console.log(`[TM-Detail] Performans verileri eslesti`);
    } catch (err: any) {
        console.warn(`[TM-Detail] Performans verileri alinamadi: ${err.message}`);
    }

    // ============= SONUC =============
    const players = Array.from(kaderPlayers.values());

    if (players.length === 0) {
        throw new Error(`Oyuncu verileri alinamadi: ${teamSlug}`);
    }

    // Takim adini sayfadan al (daha guvenilir)
    const pageTitle = $k('title').text();
    const titleMatch = pageTitle.match(/^(.+?)\s*-/);
    if (titleMatch) teamName = titleMatch[1].trim();

    const result: TeamDetail = {
        teamName,
        league: leagueId,
        leagueLabel: league.label,
        squadSize: squadSize || players.length,
        avgAge,
        totalValue,
        pointsPerGame,
        totalMatches,
        players,
        fetchedAt: new Date().toISOString(),
    };

    teamDetailCache.set(`detail:${teamId}`, result);
    console.log(`[TM-Detail] ${players.length} oyuncu (kadro+istatistik): ${teamName}`);
    return result;
}

