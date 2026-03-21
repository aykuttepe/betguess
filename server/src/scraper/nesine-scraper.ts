import { SportTotoMatch, SportTotoProgram } from './types';
import { getCached, setCache } from './cache';

const SPORTOTO_API_URL = 'https://st.nesine.com/v2/Program';

let inflightProgramPromise: Promise<SportTotoProgram> | null = null;

interface ProgramApiErrorItem {
  c: number;
  m: string;
}

interface ProgramApiResponse {
  sc: number;
  d: {
    id: number;
    pNo: number;
    programStartDate: string;
    programEndDate: string;
    programLastPlayDate: string;
    week: number;
    status: boolean;
    matches: ApiMatch[];
  } | null;
  el?: ProgramApiErrorItem[] | null;
  ml?: unknown;
}

interface ApiMatch {
  mid: number;
  pno: number;
  name: string;
  homeTeam: string;
  awayTeam: string;
  matchNo: number;
  result: string;
  eventDate: string;
  eventTime: string;
  percentage1: number;
  percentage0: number;
  percentage2: number;
}

function parseApiData(data: ProgramApiResponse): SportTotoMatch[] {
  return (data.d?.matches ?? []).map((m) => ({
    matchNumber: m.matchNo,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    matchDate: m.eventDate,
    matchTime: m.eventTime,
    preferences: {
      home: m.percentage1,
      draw: m.percentage0,
      away: m.percentage2,
    },
  }));
}

async function fetchProgramFromSource(): Promise<SportTotoProgram> {
  console.log('[Scraper] st.nesine.com uzerinden veri cekiliyor...');

  const response = await fetch(SPORTOTO_API_URL, {
    headers: {
      'Accept-Language': 'tr-TR,tr;q=0.9',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Spor Toto program servisi HTTP ${response.status} dondu`);
  }

  const payload = await response.json() as ProgramApiResponse;

  if (payload.sc === 200 && payload.d?.matches) {
    const matches = parseApiData(payload);
    const d = payload.d;

    const program: SportTotoProgram = {
      weekLabel: `Spor Toto ${d.pNo}. Program (${d.programStartDate?.substring(0, 10) || ''} - ${d.programEndDate?.substring(0, 10) || ''})`,
      matches,
      fetchedAt: new Date().toISOString(),
    };

    if (matches.length > 0) {
      setCache(program);
    }

    return program;
  }

  const providerMessage = payload.el?.[0]?.m;
  if (providerMessage) {
    return {
      weekLabel: providerMessage,
      matches: [],
      fetchedAt: new Date().toISOString(),
    };
  }

  throw new Error('Spor Toto program verisi alinamadi');
}

export async function scrapeMatches(forceRefresh = false): Promise<SportTotoProgram> {
  if (!forceRefresh) {
    const cached = getCached();
    if (cached) {
      console.log('[Scraper] Cache\'den donuyor');
      return cached;
    }
  }

  if (!inflightProgramPromise) {
    inflightProgramPromise = fetchProgramFromSource().finally(() => {
      inflightProgramPromise = null;
    });
  }

  return inflightProgramPromise;
}
