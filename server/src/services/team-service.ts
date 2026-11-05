import { teamDetailCache, teamListCache, teamValuesCache } from '../scraper/cache';
import { scrapeTeamList, scrapeTeamDetail } from '../scraper/team-detail-scraper';
import { scrapeTeamValues } from '../scraper/transfermarkt-scraper';
import { TeamDetail, TeamListItem, TeamValuesData } from '../scraper/types';

export async function getTeamList(leagueId: string): Promise<TeamListItem[]> {
  return scrapeTeamList(leagueId);
}

export async function getTeamDetail(
  teamId: string,
  teamSlug: string,
  league: string
): Promise<TeamDetail> {
  return scrapeTeamDetail(teamId, teamSlug, league);
}

export async function getTeamValues(leagueId: string): Promise<TeamValuesData> {
  return scrapeTeamValues(leagueId);
}

export function clearTeamDetailCache(teamId?: string): void {
  if (teamId) {
    // Detail cache keys include league context: detail:${teamId}:${league}.
    // CacheStore has no prefix delete, so refresh clears detail cache to avoid stale league-specific entries.
    teamDetailCache.clear();
  } else {
    teamDetailCache.clear();
  }
}

export function clearTeamValuesCache(leagueId?: string): void {
  if (leagueId) {
    teamValuesCache.clear(`values:${leagueId}`);
  } else {
    teamValuesCache.clear();
  }
}

export function clearTeamListCache(leagueId?: string): void {
  if (leagueId) {
    teamListCache.clear(`teams:${leagueId}`);
  } else {
    teamListCache.clear();
  }
}
