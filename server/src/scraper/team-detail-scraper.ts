import axios from 'axios';
import * as cheerio from 'cheerio';
import {
    TeamListItem,
    PlayerStats,
    TeamDetail,
    TeamBreakdownItem,
    TeamRankedPlayer,
    TeamRelatedMatch,
    TeamTransfer,
    UnavailablePlayer,
    UnavailablePlayerStatus,
    LEAGUES,
} from './types';
import { teamListCache, teamDetailCache } from './cache';
import { fetchTeamNextEvents, searchFootball } from '../services/football-api';

const TM_BASE = 'https://www.transfermarkt.com.tr';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

function cleanText(value: string | undefined | null): string {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function cleanTeamName(value: string): string {
    return cleanText(value).replace(/\s+\(\d+\.?\)$/g, '');
}

function absoluteTransfermarktUrl(src?: string): string | undefined {
    if (!src) return undefined;
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${TM_BASE}${src}`;
    return src;
}

function firstNonEmpty(...values: Array<string | undefined | null>): string | undefined {
    return values.map(cleanText).find(Boolean);
}

function extractHeaderValue($: any, labels: string[]): string | undefined {
    const normalizedLabels = labels.map((label) => label.toLowerCase());

    const details = $('[class*="data-header__details"] li, [class*="data-header__details"] span, [class*="data-header__details"] div')
        .toArray();

    for (const el of details) {
        const text = cleanText($(el).text());
        const lower = text.toLowerCase();
        const label = normalizedLabels.find((candidate) => lower.includes(candidate));
        if (!label) continue;

        const directMatch = text.match(/:\s*(.+)$/);
        if (directMatch?.[1]) return cleanText(directMatch[1]);

        const clone = $(el).clone();
        clone.find('[class*="data-header__label"]').remove();
        const withoutLabel = cleanText(clone.text());
        if (withoutLabel && !normalizedLabels.some((candidate) => withoutLabel.toLowerCase() === candidate)) {
            return withoutLabel;
        }
    }

    const headerText = cleanText($('[class*="data-header__details"]').text());
    for (const label of labels) {
        const regex = new RegExp(`${label}\\s*:?\\s*([^:]+?)(?=\\s+(?:Teknik direkt[oö]r|Antren[oö]r|Stadyum|Stat|Kurulu[sş]|[ÜU]lke|Lig|Kadro|Ya[sş]|Yabanc[ıi])\\b|$)`, 'i');
        const match = headerText.match(regex);
        if (match?.[1]) return cleanText(match[1]);
    }

    return undefined;
}

function extractFoundedYear(value?: string): string | undefined {
    const match = value?.match(/\b(18|19|20)\d{2}\b/);
    return match?.[0];
}

function parseMarketValue(value: string): number {
    const normalized = value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/€/g, '')
        .replace(/mio\.?|mil\.?|milyon/g, 'm')
        .replace(/th\.?|bin/g, 'k')
        .replace(/bn\.?|milyar/g, 'b');

    const match = normalized.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return 0;

    const amount = parseFloat(match[1].replace(',', '.'));
    if (Number.isNaN(amount)) return 0;
    if (normalized.includes('b')) return amount * 1_000_000_000;
    if (normalized.includes('m')) return amount * 1_000_000;
    if (normalized.includes('k')) return amount * 1_000;
    return amount;
}

function parseTurkishDate(value?: string): number {
    if (!value) return 0;

    const months: Record<string, number> = {
        oca: 0,
        sub: 1,
        şub: 1,
        mar: 2,
        nis: 3,
        may: 4,
        haz: 5,
        tem: 6,
        agu: 7,
        ağu: 7,
        eyl: 8,
        eki: 9,
        kas: 10,
        ara: 11,
    };
    const normalized = value.toLowerCase().replace(/\./g, '');
    const match = normalized.match(/\b(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})\b/i);
    if (!match) return 0;

    const monthKey = match[2].slice(0, 3);
    const month = months[monthKey];
    if (month === undefined) return 0;

    return new Date(parseInt(match[3], 10), month, parseInt(match[1], 10)).getTime();
}

function buildBreakdown(players: PlayerStats[], getLabel: (player: PlayerStats) => string): TeamBreakdownItem[] {
    const counts = new Map<string, number>();
    players.forEach((player) => {
        const label = getLabel(player) || 'Belirsiz';
        counts.set(label, (counts.get(label) || 0) + 1);
    });

    return Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'tr'));
}

function ageBucket(age: number): string {
    if (!age) return 'Bilinmiyor';
    if (age <= 21) return '21 ve alti';
    if (age <= 25) return '22-25';
    if (age <= 29) return '26-29';
    return '30+';
}

function topPlayersByValue(players: PlayerStats[]): TeamRankedPlayer[] {
    return [...players]
        .filter((player) => parseMarketValue(player.marketValue) > 0)
        .sort((a, b) => parseMarketValue(b.marketValue) - parseMarketValue(a.marketValue))
        .slice(0, 5)
        .map((player) => ({
            name: player.name,
            position: player.position,
            age: player.age,
            marketValue: player.marketValue,
            playerId: player.playerId,
            playerSlug: player.playerSlug,
            tmPlayerId: player.tmPlayerId,
            tmPlayerSlug: player.tmPlayerSlug,
        }));
}

function pickStatusReason(source: string, fallback: string): string {
    const text = cleanText(source);
    const patterns = [
        /[A-Za-zÇĞİÖŞÜçğıöşü\s]+sakatl[ıi]ğ[ıi](?:\s*[–-]\s*[^.]{0,80})?/i,
        /(?:Sarı kart cezalısı|Kırmızı kart cezalısı|Spor mahkeme cezalısı|cezalısı|suspend[^–-]*)(?:\s*[–-]\s*[^.]{0,80})?/i,
        /(?:doubtful|questionable|şüpheli|supheli)(?:\s*[–-]\s*[^.]{0,80})?/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match?.[0]) return cleanText(match[0]).slice(0, 140);
    }

    return cleanText(text || fallback).slice(0, 140);
}

function parseUnavailableStatus($: any, $row: any): { status: UnavailablePlayerStatus; reason: string } | null {
    const attrValues = $row
        .find('[title], [alt]')
        .toArray()
        .flatMap((el: any) => [$(el).attr('title'), $(el).attr('alt')])
        .filter(Boolean)
        .map(cleanText);
    const titleText = cleanText(attrValues.join(' '));
    const rowText = cleanText($row.text());
    const combined = `${titleText} ${rowText}`.toLowerCase();

    if (/(sakat|verletz|injur|muscle|hamstring|knee|ankle|return unknown|illness)/i.test(combined)) {
        const reasonSource = attrValues.find((value: string) => /(sakat|verletz|injur|muscle|hamstring|knee|ankle|illness)/i.test(value)) || rowText;
        return { status: 'injury', reason: pickStatusReason(reasonSource, 'Sakatlik') };
    }
    if (/(ceza|sperr|suspend|red card|yellow card suspension|kart cezas)/i.test(combined)) {
        const reasonSource = attrValues.find((value: string) => /(ceza|sperr|suspend|red card|yellow card suspension|kart cezas)/i.test(value)) || rowText;
        return { status: 'suspension', reason: pickStatusReason(reasonSource, 'Ceza') };
    }
    if (/(doubt|supheli|şüpheli|questionable)/i.test(combined)) {
        const reasonSource = attrValues.find((value: string) => /(doubt|supheli|şüpheli|questionable)/i.test(value)) || rowText;
        return { status: 'doubtful', reason: pickStatusReason(reasonSource, 'Durumu belirsiz') };
    }

    return null;
}

async function scrapeTeamMatches(
    teamId: string,
    teamSlug: string,
    teamName: string,
    seasonYear: number
): Promise<{ recentMatches: TeamRelatedMatch[]; nextMatches: TeamRelatedMatch[] }> {
    const url = `${TM_BASE}/${teamSlug}/spielplan/verein/${teamId}/saison_id/${seasonYear}`;
    const recentMatches: TeamRelatedMatch[] = [];
    const nextMatches: TeamRelatedMatch[] = [];
    const now = Date.now();

    try {
        const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(html);

        $('table').each((_, table) => {
            $(table).find('tbody > tr').each((_, row) => {
                const cells = $(row)
                    .children('td')
                    .toArray()
                    .map((cell) => cleanText($(cell).text()))
                    .filter(Boolean);
                const date = cells.find((cell) => /\b\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4}\b/.test(cell));
                const homeAwayIndex = cells.findIndex((cell) => cell === 'E' || cell === 'D');
                if (!date || homeAwayIndex < 0) return;

                const opponent = cells.slice(homeAwayIndex + 1).find((cell) => !/^\(.+\)$/.test(cell) && !/^\d{1,2}:\d{2}$/.test(cell));
                if (!opponent) return;

                const scoreCell = cells
                    .map((cell, index) => ({ cell, index }))
                    .filter((item) => item.index > homeAwayIndex && /^\d+\s*:\s*\d+(?:\s+\S+)?$/.test(item.cell))
                    .at(-1)?.cell;
                const scoreMatch = scoreCell?.match(/^(\d+)\s*:\s*(\d+)/);
                const score = scoreMatch ? [parseInt(scoreMatch[1], 10), parseInt(scoreMatch[2], 10)] : null;
                const isHome = cells[homeAwayIndex] === 'E';
                const dateMs = parseTurkishDate(date);
                const match: TeamRelatedMatch = {
                    date,
                    homeTeam: cleanTeamName(isHome ? teamName : opponent),
                    awayTeam: cleanTeamName(isHome ? opponent : teamName),
                    homeScore: score ? score[0] : null,
                    awayScore: score ? score[1] : null,
                    status: score ? 'Oynandi' : 'Planlandi',
                };

                if (score && (!dateMs || dateMs <= now)) {
                    recentMatches.push(match);
                } else if (!score && (!dateMs || dateMs >= now)) {
                    nextMatches.push(match);
                }
            });
        });
    } catch (err: any) {
        console.warn(`[TM-Detail] Mac listesi alinamadi: ${err.message}`);
    }

    recentMatches.sort((a, b) => parseTurkishDate(b.date) - parseTurkishDate(a.date));
    nextMatches.sort((a, b) => parseTurkishDate(a.date) - parseTurkishDate(b.date));

    if (nextMatches.length === 0) {
        nextMatches.push(...await scrapeNextMatchesFromFootballApi(teamName));
    }

    return {
        recentMatches: recentMatches.slice(0, 5),
        nextMatches: nextMatches.slice(0, 5),
    };
}

async function scrapeNextMatchesFromFootballApi(teamName: string): Promise<TeamRelatedMatch[]> {
    try {
        const normalizedTeamName = teamName.replace(/\s+SK$/i, '').trim();
        const searchData: any = await searchFootball(normalizedTeamName);
        const results = Array.isArray(searchData?.results) ? searchData.results : [];
        const teamResult = results.find((result: any) => {
            const type = String(result?.type || '').toLowerCase();
            const name = cleanText(result?.entity?.name).toLowerCase();
            return type === 'team' && name && (
                name === normalizedTeamName.toLowerCase()
                || name.includes(normalizedTeamName.toLowerCase())
                || normalizedTeamName.toLowerCase().includes(name)
            );
        });
        const sofaTeamId = parseInt(String(teamResult?.entity?.id || ''), 10);
        if (!sofaTeamId) return [];

        const nextData: any = await fetchTeamNextEvents(sofaTeamId, 0);
        const events = Array.isArray(nextData?.events) ? nextData.events : Array.isArray(nextData) ? nextData : [];
        return events.slice(0, 5).map((event: any) => {
            const startTimestamp = event?.startTimestamp;
            return {
                eventId: event?.id,
                date: typeof startTimestamp === 'number' ? new Date(startTimestamp * 1000).toISOString() : undefined,
                homeTeam: String(event?.homeTeam?.name || ''),
                awayTeam: String(event?.awayTeam?.name || ''),
                homeScore: null,
                awayScore: null,
                tournament: event?.tournament?.name,
                status: event?.status?.description || event?.status?.type || 'Planlandi',
            };
        }).filter((match: TeamRelatedMatch) => match.homeTeam && match.awayTeam);
    } catch (err: any) {
        console.warn(`[TM-Detail] Football API gelecek mac fallback alinamadi: ${err.message}`);
        return [];
    }
}

async function scrapeTeamTransfers(
    teamId: string,
    teamSlug: string,
    seasonYear: number,
    teamName: string
): Promise<TeamTransfer[]> {
    const url = `${TM_BASE}/${teamSlug}/transfers/verein/${teamId}/saison_id/${seasonYear}`;
    const transfers: TeamTransfer[] = [];

    try {
        const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(html);

        $('table.items').slice(0, 2).each((tableIndex, table) => {
            const incoming = tableIndex === 0;
            $(table).find('tbody > tr').filter((_, row) => ['odd', 'even'].includes(String($(row).attr('class') || ''))).each((_, row) => {
                const $row = $(row);
                const playerName = cleanText($row.find('a[href*="spieler"]').first().text() || $row.find('a').first().text());
                if (!playerName) return;

                const links = $row.find('a').toArray().map((link) => cleanText($(link).text())).filter(Boolean);
                const otherTeam = links.find((label) => label !== playerName && !label.includes('€'));
                const fee = cleanText($row.children('td').last().text()) || undefined;

                transfers.push({
                    playerName,
                    fromTeam: incoming ? otherTeam : teamName,
                    toTeam: incoming ? teamName : otherTeam,
                    fee,
                    type: incoming ? 'incoming' : 'outgoing',
                });
            });
        });
    } catch (err: any) {
        console.warn(`[TM-Detail] Transfer listesi alinamadi: ${err.message}`);
    }

    return transfers.slice(0, 12);
}

function getLeagueSlug(code: string): string {
    const slugs: Record<string, string> = {
        TR1: 'super-lig',
        GB1: 'premier-league',
        ES1: 'laliga',
        IT1: 'serie-a',
        L1: 'bundesliga',
        FR1: 'ligue-1',
        NL1: 'eredivisie',
        PO1: 'liga-portugal',
        GB2: 'championship',
        TR2: '1-lig',
    };
    return slugs[code] || 'lig';
}

function getLeagueCountry(leagueId: string): string {
    const countries: Record<string, string> = {
        'super-lig': 'Türkiye',
        '1-lig': 'Türkiye',
        'premier-league': 'İngiltere',
        championship: 'İngiltere',
        'la-liga': 'İspanya',
        'serie-a': 'İtalya',
        bundesliga: 'Almanya',
        'ligue-1': 'Fransa',
        eredivisie: 'Hollanda',
        'liga-portugal': 'Portekiz',
    };
    return countries[leagueId] || '';
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

    const cacheKey = `detail:${teamId}:${leagueId}`;
    const cached = teamDetailCache.get(cacheKey);
    if (cached) {
        console.log(`[TM-Detail] Cache'den: ${teamId} (${leagueId})`);
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

    const logoUrl = absoluteTransfermarktUrl(
        $k('img.data-header__profile-image').attr('src')
        || $k('[class*="data-header__profile-image"]').attr('src')
        || $k('header img').first().attr('src')
    );
    const country = firstNonEmpty(
        extractHeaderValue($k, ['Ülke', 'Ulke', 'Country']),
        extractHeaderValue($k, ['Lig', 'League'])?.replace(league.label, '').trim(),
        getLeagueCountry(leagueId)
    );
    const stadium = extractHeaderValue($k, ['Stadyum', 'Stat', 'Stadium']);
    const coach = extractHeaderValue($k, ['Teknik direktör', 'Teknik direktor', 'Antrenör', 'Antrenor', 'Manager', 'Coach']);
    const foundedYear = extractFoundedYear(extractHeaderValue($k, ['Kuruluş', 'Kurulus', 'Founded']));

    // Kadro oyuncularini parse et
    const kaderPlayers: Map<string, PlayerStats> = new Map();
    let currentPosition = '';

    $k('table.items tbody tr').each((_, row) => {
        const $row = $k(row);
        const cells = $row.children('td');

        // Pozisyon baslik satirlari
        if (cells.length === 1) {
            const posText = $k(cells[0]).text().trim();
            if (posText) currentPosition = posText;
            return;
        }
        if (cells.length < 8 || !$row.find('td.rueckennummer').length) return;

        // Oyuncu adi
        const primaryNameCell = $row.find('td.hauptlink a[href*="/profil/spieler/"]').first();
        const nameCell = primaryNameCell.length
            ? primaryNameCell
            : $row.find('a[href*="/profil/spieler/"]').first();
        const name = nameCell.text().trim();
        if (!name || name.length < 2) return;

        // Oyuncu TM ID ve slug
        const playerHref = nameCell.attr('href') || '';
        const playerIdMatch = playerHref.match(/\/spieler\/(\d+)/);
        const playerSlugMatch = playerHref.match(/^\/([^/]+)\//);
        const tmPlayerId = playerIdMatch ? playerIdMatch[1] : undefined;
        const tmPlayerSlug = playerSlugMatch ? playerSlugMatch[1] : undefined;

        const shirtNumber = cleanText($row.find('td.rueckennummer').first().text()).replace(/^#/, '')
            || cleanText($row.find('td').first().text()).match(/^#?\d+$/)?.[0]?.replace(/^#/, '');

        const position = firstNonEmpty(
            cleanText($k(cells[1]).find('table tr').last().text()),
            cleanText($k(cells[1]).find('td').last().text()),
            currentPosition
        ) || '';
        const ageText = cleanText($k(cells[2]).text());
        const ageMatch = ageText.match(/\((\d{1,2})\)/);
        const age = ageMatch ? parseInt(ageMatch[1], 10) : 0;

        // Uyruk
        const nationality = $k(cells[3]).find('img[title]').first().attr('title') || $row.find('img[title]').filter((_, el) => {
            const src = $k(el).attr('src') || '';
            return src.includes('flag') || src.includes('header');
        }).first().attr('title') || '';

        // Piyasa degeri
        const mvCell = $k(cells[cells.length - 1]).text().trim() || $row.find('td.rechts a, td.rechts').last().text().trim();
        const marketValue = mvCell && mvCell.includes('€') ? mvCell : '-';
        const combinedRowText = cleanText($row.text());
        const height = cleanText($k(cells[4]).text()).match(/\b\d[,.]\d{2}\s*m\b/i)?.[0]?.replace(',', '.')
            || combinedRowText.match(/\b\d[,.]\d{2}\s*m\b/i)?.[0]?.replace(',', '.');
        const foot = cleanText($k(cells[5]).text()) || undefined;
        const joinedDate = cleanText($k(cells[6]).text()) || undefined;
        const contractEnd = cleanText($k(cells[8]).text()).match(/\b\d{1,2}\s+[A-Za-zÇĞİÖŞÜçğıöşü]+\s+\d{4}\b/)?.[0]
            || combinedRowText.match(/\b\d{2}\.\d{2}\.\d{4}\b/)?.[0];
        const unavailableStatus = parseUnavailableStatus($k, $row);

        if (!kaderPlayers.has(name)) {
            kaderPlayers.set(name, {
                name,
                position,
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
                shirtNumber,
                foot,
                height,
                joinedDate,
                contractEnd,
                currentInjury: unavailableStatus?.status === 'injury' ? unavailableStatus.reason : null,
                status: unavailableStatus?.status ?? null,
                statusReason: unavailableStatus?.reason ?? null,
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

    const [matchLists, transfers] = await Promise.all([
        scrapeTeamMatches(teamId, teamSlug, teamName, seasonYear),
        scrapeTeamTransfers(teamId, teamSlug, seasonYear, teamName),
    ]);

    const unavailablePlayers: UnavailablePlayer[] = players
        .filter((player) => player.status || player.currentInjury)
        .map((player) => ({
            playerName: player.name,
            status: player.status || 'unknown',
            reason: player.statusReason || player.currentInjury || null,
            startDate: null,
            expectedReturnDate: null,
            missedMatches: null,
        }));
    const normalizedCountry = cleanText(country);
    const foreignPlayers = normalizedCountry
        ? players.filter((player) => {
            const nationality = cleanText(player.nationality).toLowerCase();
            return Boolean(nationality) && !nationality.includes(normalizedCountry.toLowerCase());
        }).length
        : 0;

    const result: TeamDetail = {
        teamName,
        league: leagueId,
        leagueLabel: league.label,
        teamId,
        teamSlug,
        teamCountry: normalizedCountry,
        country: normalizedCountry,
        logoUrl,
        stadium,
        coach,
        foundedYear,
        squadSize: squadSize || players.length,
        avgAge,
        foreignPlayers,
        totalValue,
        pointsPerGame,
        totalMatches,
        positionBreakdown: buildBreakdown(players, (player) => player.position),
        ageBreakdown: buildBreakdown(players, (player) => ageBucket(player.age)),
        topPlayersByValue: topPlayersByValue(players),
        recentMatches: matchLists.recentMatches,
        nextMatches: matchLists.nextMatches,
        transfers,
        unavailablePlayers,
        players,
        fetchedAt: new Date().toISOString(),
    };

    teamDetailCache.set(cacheKey, result);
    console.log(`[TM-Detail] ${players.length} oyuncu (kadro+istatistik): ${teamName}`);
    return result;
}

