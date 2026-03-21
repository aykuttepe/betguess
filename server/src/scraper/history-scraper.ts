import { HistoricalMatch, HistoricalProgram, TotoOutcome } from './history-types';
import { readHistory, writeHistory, getStoredProgramNos } from './history-cache';

const RESULT_API_URL = 'https://st.nesine.com/v1/Result';

interface ResultApiResponse {
  sc: number;
  d: {
    programWeekList: Array<{
      pno: number;
      startDate: string;
      endDate: string;
      selected: boolean;
    }>;
    programResultList: Array<{
      number: number;
      homeTeam: string;
      awayTeam: string;
      result: string;
      score: string;
    }>;
  } | null;
}

function parseResult(raw: string): TotoOutcome | null {
  if (raw === '1') return '1';
  if (raw === 'X' || raw === '0') return 'X';
  if (raw === '2') return '2';
  return null;
}

function computeMaxConsecutive(matches: HistoricalMatch[]): number {
  let max = 1;
  let streak = 1;
  for (let i = 1; i < matches.length; i++) {
    if (matches[i].result === matches[i - 1].result) {
      streak++;
      if (streak > max) max = streak;
    } else {
      streak = 1;
    }
  }
  return matches.length > 0 ? max : 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchResultApi(pno?: number): Promise<ResultApiResponse> {
  const url = pno ? `${RESULT_API_URL}?pno=${pno}` : RESULT_API_URL;
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'tr-TR,tr;q=0.9',
      'User-Agent': 'Mozilla/5.0',
    },
  });
  if (!response.ok) {
    throw new Error(`Result API HTTP ${response.status}`);
  }
  return response.json() as Promise<ResultApiResponse>;
}

function parseProgram(
  pno: number,
  startDate: string,
  endDate: string,
  resultList: ResultApiResponse['d'] extends infer D ? D extends { programResultList: infer R } ? R : never : never,
): HistoricalProgram | null {
  const matches: HistoricalMatch[] = [];

  for (const m of resultList) {
    const outcome = parseResult(m.result);
    if (!outcome) return null; // incomplete results
    matches.push({
      matchNo: m.number,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      result: outcome,
      score: m.score,
    });
  }

  if (matches.length === 0) return null;

  const count1 = matches.filter((m) => m.result === '1').length;
  const countX = matches.filter((m) => m.result === 'X').length;
  const count2 = matches.filter((m) => m.result === '2').length;

  return {
    programNo: pno,
    startDate,
    endDate,
    matchCount: matches.length,
    matches,
    distribution: { count1, countX, count2 },
    maxConsecutive: computeMaxConsecutive(matches),
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchAvailableProgramList(): Promise<
  Array<{ pno: number; startDate: string; endDate: string }>
> {
  const data = await fetchResultApi();
  if (data.sc !== 200 || !data.d) return [];
  return data.d.programWeekList;
}

export async function fetchHistoricalProgram(
  pno: number,
): Promise<HistoricalProgram | null> {
  const data = await fetchResultApi(pno);
  if (data.sc !== 200 || !data.d?.programResultList?.length) return null;

  const weekInfo = data.d.programWeekList.find((w) => w.pno === pno);
  return parseProgram(
    pno,
    weekInfo?.startDate ?? '',
    weekInfo?.endDate ?? '',
    data.d.programResultList,
  );
}

export async function fetchHistoricalResults(
  count: number,
): Promise<HistoricalProgram[]> {
  const stored = readHistory();
  const storedNos = getStoredProgramNos();

  // Get available programs list
  const available = await fetchAvailableProgramList();
  const toFetch = available
    .slice(0, count)
    .filter((p) => !storedNos.has(p.pno));

  console.log(
    `[History] ${stored.length} cached, ${toFetch.length} to fetch (requested ${count})`,
  );

  const newPrograms: HistoricalProgram[] = [];

  for (const prog of toFetch) {
    try {
      const result = await fetchHistoricalProgram(prog.pno);
      if (result) {
        newPrograms.push(result);
        console.log(`[History] Fetched program ${prog.pno}`);
      }
      if (toFetch.indexOf(prog) < toFetch.length - 1) {
        await sleep(500);
      }
    } catch (err: any) {
      console.error(`[History] Failed to fetch program ${prog.pno}:`, err.message);
    }
  }

  if (newPrograms.length > 0) {
    const merged = [...stored, ...newPrograms];
    writeHistory(merged);
    return merged.sort((a, b) => b.programNo - a.programNo).slice(0, count);
  }

  return stored.sort((a, b) => b.programNo - a.programNo).slice(0, count);
}
