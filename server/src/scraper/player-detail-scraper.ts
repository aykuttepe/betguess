import axios from 'axios';
import * as cheerio from 'cheerio';
import { PlayerProfile, PlayerInjury } from './types';
import { playerDetailCache } from './cache';

const TM_BASE = 'https://www.transfermarkt.com.tr';

const USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
};

/**
 * Oyuncu profil sayfasindan detaylari ceker
 */
export async function scrapePlayerDetail(
    playerId: string,
    playerSlug: string
): Promise<PlayerProfile> {
    const cached = playerDetailCache.get(`player:${playerId}`);
    if (cached) {
        console.log(`[TM-Player] Cache'den: ${playerId}`);
        return cached;
    }

    // Profil sayfasi
    const profileUrl = `${TM_BASE}/${playerSlug}/profil/spieler/${playerId}`;
    console.log(`[TM-Player] Profil cekiliyor: ${profileUrl}`);

    const { data: profileHtml } = await axios.get(profileUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(profileHtml);

    // Temel bilgiler
    const name = $('h1[class*="data-header"]').text().trim()
        || $('header .data-header__headline-wrapper').text().trim()
        || playerSlug.replace(/-/g, ' ');

    const imageUrl = $('img[class*="data-header__profile-image"]').attr('src') || '';

    // Header info box bilgileri
    const infoItems = $('[class*="info-table"] span, [class*="data-header__items"] li');
    let position = '';
    let age = 0;
    let nationality = '';
    let foot = '';
    let height = '';
    let currentClub = '';

    // data-header__details icinden bilgileri cek
    const headerText = $('[class*="data-header__details"]').text();
    const infoTable = $('table.auflistung, [class*="info-table"]');

    infoTable.find('tr, li').each((_, el) => {
        const text = $(el).text().trim();
        if (text.includes('Pozisyon') || text.includes('Position')) {
            position = text.replace(/Pozisyon:?|Position:?/i, '').trim();
        }
        if (text.includes('Yaş') || text.includes('Age')) {
            const ageMatch = text.match(/(\d+)/);
            if (ageMatch) age = parseInt(ageMatch[1], 10);
        }
        if (text.includes('Uyruk') || text.includes('Nationality')) {
            nationality = $(el).find('img').attr('title') || text.replace(/Uyruk:?|Nationality:?/i, '').trim();
        }
        if (text.includes('Ayak') || text.includes('Foot')) {
            foot = text.replace(/Ayak:?|Foot:?/i, '').trim();
        }
        if (text.includes('Boy') || text.includes('Height')) {
            const hMatch = text.match(/(\d+[.,]?\d*\s*m)/);
            if (hMatch) height = hMatch[1];
        }
        if (text.includes('Mevcut kulüp') || text.includes('Current club')) {
            currentClub = text.replace(/Mevcut kulüp:?|Current club:?/i, '').trim();
        }
    });

    // Yas data-header'dan
    if (!age) {
        const ageMatch = headerText.match(/(\d+)\s*Yaş/i);
        if (ageMatch) age = parseInt(ageMatch[1], 10);
    }

    // Piyasa degeri
    const marketValue = $('[class*="data-header__market-value"]').text().trim()
        || $('[class*="waehrung"]').first().text().trim()
        || '-';

    // Kariyer istatistikleri — performans tablosu
    let appearances = 0, goals = 0, assists = 0;
    let yellowCards = 0, redCards = 0, minutesPlayed = 0;

    // Footer toplam satiri
    const footerRow = $('table.items tfoot tr').last();
    if (footerRow.length) {
        const footerCells = footerRow.find('td');
        if (footerCells.length >= 5) {
            const parseNum = (idx: number) => {
                const t = $(footerCells[idx]).text().trim().replace(/\./g, '').replace(/-/g, '0');
                return parseInt(t, 10) || 0;
            };
            // Toplam satirindaki sutunlar
            appearances = parseNum(2) || parseNum(3);
            goals = parseNum(3) || parseNum(4);
            assists = parseNum(4) || parseNum(5);
        }
    }

    // Stats from the data-header boxes
    $('[class*="data-header__box"]').each((_, box) => {
        const label = $(box).find('[class*="label"]').text().trim();
        const val = $(box).find('[class*="data"]').text().trim();
        const num = parseInt(val.replace(/\./g, ''), 10) || 0;
        if (label.includes('Gol') || label.includes('Goal')) goals = goals || num;
        if (label.includes('Mac') || label.includes('App')) appearances = appearances || num;
        if (label.includes('Asist') || label.includes('Assist')) assists = assists || num;
    });

    // Sakatlık gecmisi — ayri sayfa
    const injuries = await scrapePlayerInjuries(playerId, playerSlug);
    const currentInjury = injuries.length > 0 && injuries[0].to === '-'
        ? injuries[0].injury
        : null;

    const result: PlayerProfile = {
        name,
        position,
        age,
        nationality,
        marketValue,
        currentClub,
        foot,
        height,
        appearances,
        goals,
        assists,
        yellowCards,
        redCards,
        minutesPlayed,
        injuries,
        currentInjury,
        transferHistory: [],
        imageUrl: imageUrl || undefined,
    };

    playerDetailCache.set(`player:${playerId}`, result);
    console.log(`[TM-Player] Oyuncu profili cekildi: ${name}`);
    return result;
}

/**
 * Oyuncu sakatlik gecmisi sayfasindan verileri ceker
 */
async function scrapePlayerInjuries(
    playerId: string,
    playerSlug: string
): Promise<PlayerInjury[]> {
    try {
        const url = `${TM_BASE}/${playerSlug}/verletzungen/spieler/${playerId}`;
        console.log(`[TM-Player] Sakatlik gecmisi cekiliyor: ${url}`);

        const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
        const $ = cheerio.load(html);
        const injuries: PlayerInjury[] = [];

        $('table.items tbody tr').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 4) return;

            const injury = $(cells[1]).text().trim();
            if (!injury) return;

            const from = $(cells[2]).text().trim();
            const to = $(cells[3]).text().trim();

            // Gun ve mac kaybi
            const dayText = $(cells[4])?.text().trim() || '0';
            const daysMissed = parseInt(dayText.replace(/\D/g, ''), 10) || 0;

            const gamesText = $(cells[5])?.text().trim() || '0';
            const gamesMissed = parseInt(gamesText.replace(/\D/g, ''), 10) || 0;

            injuries.push({
                injury,
                from,
                to: to || '-',
                daysMissed,
                gamesMissed,
            });
        });

        console.log(`[TM-Player] ${injuries.length} sakatlik kaydi bulundu`);
        return injuries;
    } catch (err: any) {
        console.warn(`[TM-Player] Sakatlik verileri alinamadi: ${err.message}`);
        return [];
    }
}


