/**
 * ESPN Unofficial Football API
 * Ücretsiz, rate limit yok, geniş kapsam.
 * Endpoint: https://site.api.espn.com/apis/site/v2/sports/soccer
 */

import axios from 'axios';
import { CacheStore } from '../scraper/cache';

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_CACHE_TTL_MS = 90 * 1000; // 1.5 dakika

const espnCache = new CacheStore<any[]>(ESPN_CACHE_TTL_MS);

const ESPN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
};

// ESPN'in desteklediği popüler ligler (slug → lig adı)
const ESPN_LEAGUES: { slug: string; name: string }[] = [
  { slug: 'eng.1',   name: 'Premier League' },
  { slug: 'esp.1',   name: 'La Liga' },
  { slug: 'ger.1',   name: 'Bundesliga' },
  { slug: 'ita.1',   name: 'Serie A' },
  { slug: 'fra.1',   name: 'Ligue 1' },
  { slug: 'tur.1',   name: 'Süper Lig' },
  { slug: 'tur.2',   name: 'TFF 1. Lig' },
  { slug: 'por.1',   name: 'Primeira Liga' },
  { slug: 'ned.1',   name: 'Eredivisie' },
  { slug: 'bel.1',   name: 'Pro League' },
  { slug: 'sco.1',   name: 'Scottish Premiership' },
  { slug: 'uefa.champions', name: 'Champions League' },
  { slug: 'uefa.europa',    name: 'Europa League' },
  { slug: 'uefa.europa.conf', name: 'Conference League' },
  { slug: 'usa.1',   name: 'MLS' },
  { slug: 'bra.1',   name: 'Brasileirão' },
  { slug: 'arg.1',   name: 'Primera División' },
];

/**
 * ESPN scoreboard event'ini SofaScore formatına dönüştürür.
 * LivePage'in normalizeMatches() beklentisiyle uyumludur.
 */
function mapEspnEvent(evt: any, leagueName: string): any {
  const competition = Array.isArray(evt.competitions) ? evt.competitions[0] : null;
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];

  const home = competitors.find((c: any) => c.homeAway === 'home') || competitors[0];
  const away = competitors.find((c: any) => c.homeAway === 'away') || competitors[1];

  const statusType = String(evt.status?.type?.name || '').toLowerCase();
  let statusDescription = String(evt.status?.type?.description || evt.status?.type?.shortDetail || '');

  // SofaScore benzeri status_description değerleri
  if (statusType === 'in') {
    const period = evt.status?.period;
    if (period === 1) statusDescription = '1st half';
    else if (period === 2) statusDescription = '2nd half';
    else statusDescription = 'started';
  } else if (statusType === 'post') {
    statusDescription = 'ended';
  } else if (statusType === 'pre') {
    statusDescription = 'not started';
  }

  const startTimestamp = evt.date
    ? Math.floor(new Date(evt.date).getTime() / 1000)
    : null;

  return {
    id: typeof evt.id === 'string' ? parseInt(evt.id, 10) || `espn_${evt.id}` : evt.id,
    homeTeam: { name: home?.team?.displayName || home?.team?.name || '-', id: home?.team?.id },
    awayTeam: { name: away?.team?.displayName || away?.team?.name || '-', id: away?.team?.id },
    homeScore: { current: home?.score != null ? parseInt(String(home.score), 10) : null },
    awayScore: { current: away?.score != null ? parseInt(String(away.score), 10) : null },
    tournament: { name: leagueName, category: leagueName },
    status: { type: statusType, description: statusDescription },
    status_description: statusDescription,
    startTimestamp,
    start_time: evt.date || null,
    _source: 'espn',
  };
}

async function fetchEspnScoreboard(leagueSlug: string): Promise<any[]> {
  const url = `${ESPN_BASE}/${leagueSlug}/scoreboard`;
  const { data } = await axios.get(url, { headers: ESPN_HEADERS, timeout: 10000 });
  const events: any[] = Array.isArray(data?.events) ? data.events : [];
  return events;
}

/**
 * Tüm desteklenen liglerden live + scheduled maçları çeker.
 * Paralel istekler gönderir, hatalar sessizce atlanır.
 */
export async function getEspnLiveAndScheduled(): Promise<{ events: any[] }> {
  const cacheKey = 'espn:all:scoreboard';
  const cached = espnCache.get(cacheKey);
  if (cached) return { events: cached };

  const results = await Promise.allSettled(
    ESPN_LEAGUES.map(async ({ slug, name }) => {
      const rawEvents = await fetchEspnScoreboard(slug);
      return rawEvents.map((e) => mapEspnEvent(e, name));
    })
  );

  const all: any[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const evt of r.value) {
        const key = String(evt.id);
        if (!seen.has(key)) {
          seen.add(key);
          all.push(evt);
        }
      }
    }
  }

  espnCache.set(cacheKey, all);
  return { events: all };
}
