import { Standing, TeamValue } from './football-types';
import { apiFetchJson } from './http';

const BASE_URL = '/api/ai';

async function postAI(endpoint: string, body: Record<string, any>): Promise<string> {
    const data = await apiFetchJson<{ analysis: string }>(`${BASE_URL}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body),
    }, {
        defaultError: 'AI servis hatasi',
        redirectOn401: true,
    });
    return data.analysis;
}

export async function fetchMatchAnalysis(
    homeTeam: string,
    awayTeam: string,
    league?: string
): Promise<string> {
    return postAI('match-analysis', { homeTeam, awayTeam, league });
}

export async function fetchTeamAnalysis(
    team: string,
    league?: string
): Promise<string> {
    return postAI('team-analysis', { team, league });
}

export async function fetchLeagueAnalysis(
    leagueLabel: string,
    standings: Standing[]
): Promise<string> {
    const standingsSummary = standings
        .map(s => `${s.position}. ${s.team} — ${s.points}p (${s.won}G ${s.drawn}B ${s.lost}M) AG:${s.gf} YG:${s.ga}`)
        .join('\n');
    return postAI('league-analysis', { leagueLabel, standingsSummary });
}

export async function fetchTransferAnalysis(
    leagueLabel: string,
    teams: TeamValue[]
): Promise<string> {
    const teamsSummary = teams
        .map((t, i) => `${i + 1}. ${t.team} — ${t.totalValue} (Kadro: ${t.squadSize}, Yas: ${t.avgAge}, Lejyoner: ${t.foreignPlayers})`)
        .join('\n');
    return postAI('transfer-analysis', { leagueLabel, teamsSummary });
}

export async function fetchPlayerAnalysis(
    playerName: string,
    playerInfo: string
): Promise<string> {
    return postAI('player-analysis', { playerName, playerInfo });
}

export async function fetchBulkAnalysis(
    matches: { home: string; away: string; matchNo: number }[],
    league?: string
): Promise<string> {
    return postAI('bulk-analysis', { matches, league });
}

export async function fetchFallbackAnalysis(
    context: string,
    error: string
): Promise<string> {
    return postAI('fallback', { context, error });
}

