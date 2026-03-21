import axios from 'axios';
import * as DDG from 'duck-duck-scrape';
import { aiCache } from '../scraper/cache';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

function getApiKey(): string {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY ortam degiskeni ayarlanmamis');
    return key;
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * DuckDuckGo ile web'de ara — ucretsiz, API key gerektirmez
 */
async function webSearch(query: string, maxResults = 5): Promise<string> {
    try {
        console.log(`[AI] DuckDuckGo arama: "${query}"`);
        const results = await DDG.search(query, {
            safeSearch: DDG.SafeSearchType.OFF,
        });

        if (!results.results || results.results.length === 0) {
            console.log('[AI] DuckDuckGo sonuc bulunamadi');
            return '';
        }

        const topResults = results.results.slice(0, maxResults);
        let searchContext = 'Web Arama Sonuclari:\n';

        for (const r of topResults) {
            const snippet = (r.description || '').slice(0, 250);
            searchContext += `- ${r.title}: ${snippet}\n`;
        }

        console.log(`[AI] ${topResults.length} web sonucu bulundu`);
        return searchContext;
    } catch (err: any) {
        console.warn('[AI] DuckDuckGo arama hatasi:', err.message);
        return '';
    }
}

async function chat(messages: ChatMessage[], maxTokens = 1024): Promise<string> {
    try {
        const { data } = await axios.post(
            GROQ_API_URL,
            {
                model: MODEL,
                messages,
                temperature: 0.7,
                max_tokens: maxTokens,
            },
            {
                headers: {
                    Authorization: `Bearer ${getApiKey()}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            }
        );
        return data.choices?.[0]?.message?.content || 'Yanit alinamadi.';
    } catch (error: any) {
        console.error('[AI] Groq API hatasi:', error.response?.data || error.message);
        throw new Error(error.response?.data?.error?.message || 'AI servisi su anda kullanilamiyor.');
    }
}

/** Cache'li chat — ayni prompt tekrar API'ye gitmez */
async function cachedChat(cacheKey: string, messages: ChatMessage[], maxTokens = 1024): Promise<string> {
    const cached = aiCache.get(cacheKey);
    if (cached) {
        console.log(`[AI] Cache'den: ${cacheKey}`);
        return cached;
    }
    const result = await chat(messages, maxTokens);
    aiCache.set(cacheKey, result);
    return result;
}

/** Web arama + Groq chat birlesik — once web'de ara, sonuclari prompt'a ekle */
async function searchAndChat(
    cacheKey: string,
    searchQuery: string,
    messages: ChatMessage[],
    maxTokens = 1024
): Promise<string> {
    const cached = aiCache.get(cacheKey);
    if (cached) {
        console.log(`[AI] Cache'den: ${cacheKey}`);
        return cached;
    }

    // Web'de ara
    const webContext = await webSearch(searchQuery);

    // Web sonuclarini system prompt'a ekle
    if (webContext) {
        const systemIdx = messages.findIndex(m => m.role === 'system');
        if (systemIdx >= 0) {
            messages[systemIdx].content += `\n\nGUNCEL WEB VERILERI (Bu bilgileri kullanarak analiz yap):\n${webContext}`;
        }
    }

    const result = await chat(messages, maxTokens);
    aiCache.set(cacheKey, result);
    return result;
}

const SYSTEM_PROMPT = `Sen BetGuess spor analiz asistanisin. Futbol maclari, takimlar ve ligler hakkinda detayli analiz yapiyorsun.

Kurallar:
- Turkce yanit ver
- Kisa ve oz ol, gereksiz uzatma
- Istatistik ve veri tabanli analiz yap
- Tahminlerde ihtimalleri yuzde olarak belirt
- Emoji kullan
- Her yaniti markdown formatinda yaz
- Eger guncel web verileri saglanmissa, bunlari oncelikli kullan`;

/**
 * Mac analizi — web aramali
 */
export async function analyzeMatch(
    homeTeam: string,
    awayTeam: string,
    league: string
): Promise<string> {
    const key = `match:${homeTeam}:${awayTeam}:${league}`;
    console.log(`[AI] Mac analizi: ${homeTeam} vs ${awayTeam}`);
    return searchAndChat(
        key,
        `${homeTeam} vs ${awayTeam} ${league} mac analizi 2025 form sakatlik kadro`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${league} liginde oynanan mac: ${homeTeam} (Ev Sahibi) vs ${awayTeam} (Deplasman)

Sunlari analiz et:
1. Her iki takimin guncel formu ve son performansi
2. Tarihsel karsilasma istatistikleri (head-to-head)
3. Guclu ve zayif yonler
4. Tahmin: 1 (Ev Sahibi), X (Beraberlik), 2 (Deplasman) ihtimalleri yuzde olarak
5. Onemli notlar (sakatliklar, cezalilar, form farklari)`,
            },
        ]
    );
}

/**
 * Takim analizi — web aramali
 */
export async function analyzeTeam(
    teamName: string,
    league: string
): Promise<string> {
    const key = `team:${teamName}:${league}`;
    console.log(`[AI] Takim analizi: ${teamName} (${league})`);
    return searchAndChat(
        key,
        `${teamName} ${league} 2025 sezon performans kadro sakatlik transfer`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${league} ligindeki ${teamName} takimini analiz et:

1. Genel performans ve lig siralamasi
2. Gol atma ve gol yeme istatistikleri
3. Guclu yonleri ve zayif noktalari
4. Anahtar oyuncular ve yildiz performanslar
5. Sezon trendi (yukselen mi, dusen mi?)
6. Dikkat edilmesi gereken noktalar`,
            },
        ]
    );
}

/**
 * Lig analizi — web aramali
 */
export async function analyzeLeague(
    leagueLabel: string,
    standingsSummary: string
): Promise<string> {
    const key = `league:${leagueLabel}`;
    console.log(`[AI] Lig analizi: ${leagueLabel}`);
    return searchAndChat(
        key,
        `${leagueLabel} 2025 puan durumu sampiyonluk yarisi kume dusme`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${leagueLabel} ligi analizi:

Puan durumu ozeti:
${standingsSummary}

Sunlari analiz et:
1. Sampiyon adaylari ve sampiyonluk yarisi
2. Kume dusme tehlikesindeki takimlar
3. En dikkat cekici performanslar
4. Lig genel trendi ve tahminler
5. Sezon sonu beklentileri`,
            },
        ]
    );
}

/**
 * Transfer analizi — web aramali
 */
export async function analyzeTransfers(
    leagueLabel: string,
    teamsSummary: string
): Promise<string> {
    const key = `transfer:${leagueLabel}`;
    console.log(`[AI] Transfer analizi: ${leagueLabel}`);
    return searchAndChat(
        key,
        `${leagueLabel} 2025 transfer haberleri piyasa degeri kadro`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${leagueLabel} ligi takim degerleri ve transfer analizi:

Takim degerleri ozeti:
${teamsSummary}

Sunlari analiz et:
1. En degerli takimlar ve kadro gucleri
2. Transfer piyasasi trendleri
3. Deger/performans karsilastirmasi
4. Yatirim yapilabilecek takimlar
5. Lejyoner oranlarinin etkisi`,
            },
        ]
    );
}

/**
 * Oyuncu analizi — web aramali
 */
export async function analyzePlayer(
    playerName: string,
    playerInfo: string
): Promise<string> {
    const key = `player:${playerName}`;
    console.log(`[AI] Oyuncu analizi: ${playerName}`);
    return searchAndChat(
        key,
        `${playerName} futbolcu 2025 istatistik performans sakatlik transfer`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${playerName} oyuncusu hakkinda analiz:

${playerInfo}

Sunlari analiz et:
1. Oyuncunun gucleri ve zayifliklari
2. Performans degerlendirmesi
3. Sakatlik gecmisi ve etkisi
4. Piyasa degeri analizi
5. Gelecek beklentileri`,
            },
        ],
        800
    );
}

/**
 * Toplu mac analizi — web aramali
 */
export async function analyzeBulkMatches(
    matches: { home: string; away: string; matchNo: number }[],
    league: string
): Promise<string> {
    const matchList = matches.map(m => `Mac ${m.matchNo}: ${m.home} vs ${m.away}`).join('\n');
    const key = `bulk:${league}:${matches.map(m => m.matchNo).join(',')}`;
    console.log(`[AI] Toplu mac analizi: ${matches.length} mac`);

    // Toplu icin ilk 3 macin takimlarini ara
    const searchTeams = matches.slice(0, 3).map(m => `${m.home} ${m.away}`).join(', ');

    return searchAndChat(
        key,
        `${league} ${searchTeams} mac tahmin form 2025`,
        [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: `${league} ligi mac programi analizi:

${matchList}

Her mac icin kisa analiz ve 1/X/2 tahmin yuzdeleri ver. Sonra genel bir kupon onerisi yap.`,
            },
        ],
        2048
    );
}

/**
 * Hata durumunda fallback analiz — web aramasiz
 */
export async function fallbackAnalysis(
    context: string,
    errorMessage: string
): Promise<string> {
    console.log(`[AI] Fallback analiz: ${context}`);
    return cachedChat(`fallback:${context}`, [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Veri kaynagindan bilgi cekilemedi (Hata: ${errorMessage}).

Baglam: ${context}

Lutfen bu konuda genel bilgini kullanarak kisa bir ozet ve analiz yap.`,
        },
    ], 800);
}
