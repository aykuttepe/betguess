import { scrapeStandings } from '../scraper/bbc-scraper';
import { standingsCache } from '../scraper/cache';
import { StandingsData } from '../scraper/types';

export async function getStandings(leagueId: string): Promise<StandingsData> {
  return scrapeStandings(leagueId);
}

export function clearStandingsCache(leagueId?: string): void {
  if (leagueId) {
    standingsCache.clear(`standings:${leagueId}`);
  } else {
    standingsCache.clear();
  }
}
