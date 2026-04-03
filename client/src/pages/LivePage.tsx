import { useEffect, useMemo, useState } from 'react';
import { fetchLiveMatches, fetchFinishedMatches } from '../lib/football-api';

interface ApiMatch {
  id: number;
  home_team?: { name: string; short_name?: string; id?: number };
  away_team?: { name: string; short_name?: string; id?: number };
  homeTeam?: { name: string; id?: number };
  awayTeam?: { name: string; id?: number };
  tournament?: { name?: string; id?: number; category?: string };
  start_time?: string;
  startTimestamp?: number;
  status_code?: number;
  status_description?: string;
  status?: { type?: string; description?: string };
  score?: { home?: number; away?: number };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
  [key: string]: any;
}

type LiveTab = 'devam' | 'biten' | 'kadin';

const PRIORITY_LEAGUES = [
  'champions league',
  'europa league',
  'conference league',
  'premier league',
  'la liga',
  'bundesliga',
  'serie a',
  'ligue 1',
  'super lig',
  'süper lig',
];

const POPULAR_CHIPS: { key: string; label: string; flag: string; match: string }[] = [
  { key: 'premier league', label: 'Premier League', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', match: 'premier league' },
  { key: 'la liga', label: 'La Liga', flag: '\u{1F1EA}\u{1F1F8}', match: 'la liga' },
  { key: 'serie a', label: 'Serie A', flag: '\u{1F1EE}\u{1F1F9}', match: 'serie a' },
  { key: 'bundesliga', label: 'Bundesliga', flag: '\u{1F1E9}\u{1F1EA}', match: 'bundesliga' },
  { key: 'ligue 1', label: 'Ligue 1', flag: '\u{1F1EB}\u{1F1F7}', match: 'ligue 1' },
  { key: 'super lig', label: 'Super Lig', flag: '\u{1F1F9}\u{1F1F7}', match: 'super lig' },
  { key: 'champions league', label: 'UCL', flag: '\u{1F3C6}', match: 'champions league' },
  { key: 'europa league', label: 'UEL', flag: '\u{1F3C6}', match: 'europa league' },
];

const WOMEN_KEYWORDS = ['women', 'feminino', 'frauen', 'feminin', 'femenin', 'kadın', 'female', 'w.'];

function getHomeName(match: ApiMatch): string {
  return match.home_team?.name || match.homeTeam?.name || '-';
}

function getAwayName(match: ApiMatch): string {
  return match.away_team?.name || match.awayTeam?.name || '-';
}

function getHomeScore(match: ApiMatch): string {
  if (match.score?.home != null) return String(match.score.home);
  if (match.homeScore?.current != null) return String(match.homeScore.current);
  return '-';
}

function getAwayScore(match: ApiMatch): string {
  if (match.score?.away != null) return String(match.score.away);
  if (match.awayScore?.current != null) return String(match.awayScore.current);
  return '-';
}

function getTournament(match: ApiMatch): string {
  return match.tournament?.name || '-';
}

function getStatus(match: ApiMatch): string {
  return match.status_description || match.status?.description || match.status?.type || '-';
}

function getCategory(match: ApiMatch): string {
  return match.tournament?.category || 'Football';
}

function isWomenLeague(match: ApiMatch): boolean {
  const t = getTournament(match).toLowerCase();
  const c = getCategory(match).toLowerCase();
  return WOMEN_KEYWORDS.some(k => t.includes(k) || c.includes(k));
}

function isFinishedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('ended') || s.includes('finished') || s.includes('after');
}

function isLiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('started') || s.includes('1st') || s.includes('2nd') ||
    s.includes('half') || s.includes('devre') || s.includes('live') ||
    s.includes('extra') || s.includes('penalty') || s.includes('penalt');
}

function getKickoffLabel(match: ApiMatch): string {
  let date: Date | null = null;
  if (match.startTimestamp) {
    date = new Date(match.startTimestamp * 1000);
  } else if (match.start_time) {
    try { date = new Date(match.start_time); } catch { /* ignore */ }
  }
  if (!date || isNaN(date.getTime())) return '-';

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getMatchDate(match: ApiMatch): string {
  if (match.startTimestamp) {
    return new Date(match.startTimestamp * 1000).toLocaleDateString('tr-TR');
  }
  if (match.start_time) {
    try {
      return new Date(match.start_time).toLocaleDateString('tr-TR');
    } catch {
      return '-';
    }
  }
  return '-';
}

function normalizeMatches(payload: any): ApiMatch[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

/* ─── Country Flag Mapping ─── */

const CATEGORY_FLAGS: Record<string, string> = {
  'england': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
  'italy': '\u{1F1EE}\u{1F1F9}',
  'spain': '\u{1F1EA}\u{1F1F8}',
  'germany': '\u{1F1E9}\u{1F1EA}',
  'france': '\u{1F1EB}\u{1F1F7}',
  'turkey': '\u{1F1F9}\u{1F1F7}',
  'portugal': '\u{1F1F5}\u{1F1F9}',
  'netherlands': '\u{1F1F3}\u{1F1F1}',
  'belgium': '\u{1F1E7}\u{1F1EA}',
  'scotland': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}',
  'brazil': '\u{1F1E7}\u{1F1F7}',
  'argentina': '\u{1F1E6}\u{1F1F7}',
  'usa': '\u{1F1FA}\u{1F1F8}',
  'japan': '\u{1F1EF}\u{1F1F5}',
  'south korea': '\u{1F1F0}\u{1F1F7}',
  'china': '\u{1F1E8}\u{1F1F3}',
  'australia': '\u{1F1E6}\u{1F1FA}',
  'mexico': '\u{1F1F2}\u{1F1FD}',
  'russia': '\u{1F1F7}\u{1F1FA}',
  'ukraine': '\u{1F1FA}\u{1F1E6}',
  'greece': '\u{1F1EC}\u{1F1F7}',
  'austria': '\u{1F1E6}\u{1F1F9}',
  'switzerland': '\u{1F1E8}\u{1F1ED}',
  'croatia': '\u{1F1ED}\u{1F1F7}',
  'denmark': '\u{1F1E9}\u{1F1F0}',
  'sweden': '\u{1F1F8}\u{1F1EA}',
  'norway': '\u{1F1F3}\u{1F1F4}',
  'poland': '\u{1F1F5}\u{1F1F1}',
  'czech republic': '\u{1F1E8}\u{1F1FF}',
  'romania': '\u{1F1F7}\u{1F1F4}',
  'serbia': '\u{1F1F7}\u{1F1F8}',
  'hungary': '\u{1F1ED}\u{1F1FA}',
  'egypt': '\u{1F1EA}\u{1F1EC}',
  'saudi arabia': '\u{1F1F8}\u{1F1E6}',
  'india': '\u{1F1EE}\u{1F1F3}',
  'colombia': '\u{1F1E8}\u{1F1F4}',
  'chile': '\u{1F1E8}\u{1F1F1}',
  'uruguay': '\u{1F1FA}\u{1F1FE}',
  'paraguay': '\u{1F1F5}\u{1F1FE}',
  'wales': '\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}',
  'cyprus': '\u{1F1E8}\u{1F1FE}',
  'finland': '\u{1F1EB}\u{1F1EE}',
  'iceland': '\u{1F1EE}\u{1F1F8}',
  'israel': '\u{1F1EE}\u{1F1F1}',
  'ireland': '\u{1F1EE}\u{1F1EA}',
  'bulgaria': '\u{1F1E7}\u{1F1EC}',
  'slovakia': '\u{1F1F8}\u{1F1F0}',
  'slovenia': '\u{1F1F8}\u{1F1EE}',
  'bosnia': '\u{1F1E7}\u{1F1E6}',
  'albania': '\u{1F1E6}\u{1F1F1}',
  'kazakhstan': '\u{1F1F0}\u{1F1FF}',
  'world': '\u{1F30D}',
  'europe': '\u{1F1EA}\u{1F1FA}',
  'international': '\u{1F30D}',
  'africa': '\u{1F30D}',
  'asia': '\u{1F30F}',
  'south america': '\u{1F30E}',
  'north & central america': '\u{1F30E}',
};

function getCategoryFlag(category: string): string {
  const lower = category.toLowerCase();
  for (const [key, flag] of Object.entries(CATEGORY_FLAGS)) {
    if (lower.includes(key)) return flag;
  }
  return '\u26BD'; // soccer ball fallback
}

function getStatusBadge(match: ApiMatch, minute: string | null): { label: string; className: string } | null {
  const status = getStatus(match);

  if (minute) {
    return {
      label: minute,
      className: minute === 'DV'
        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse',
    };
  }

  if (isFinishedStatus(status)) {
    return { label: 'MS', className: 'bg-slate-600/40 text-slate-300 border-slate-500/30' };
  }

  if (isLiveStatus(status)) {
    return { label: 'C', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 animate-pulse' };
  }

  return null; // not started - show time instead
}

/* ─── League Priority ─── */

function getLeaguePriority(match: ApiMatch): number {
  const name = getTournament(match).toLowerCase();
  for (let i = 0; i < PRIORITY_LEAGUES.length; i++) {
    if (name.includes(PRIORITY_LEAGUES[i])) return i;
  }
  return PRIORITY_LEAGUES.length;
}

function sortByLeagueThenName(a: ApiMatch, b: ApiMatch): number {
  const pa = getLeaguePriority(a);
  const pb = getLeaguePriority(b);
  if (pa !== pb) return pa - pb;
  return getTournament(a).localeCompare(getTournament(b), 'tr');
}

/* ─── Match Minute ─── */

function getMatchMinute(match: ApiMatch): string | null {
  const ts = match.startTimestamp;
  if (!ts) return null;

  const status = getStatus(match).toLowerCase();

  // Only show minute for live matches
  if (!isLiveStatus(status)) {
    return null;
  }

  if (status.includes('half') || status.includes('devre')) {
    return 'DV';
  }

  const elapsedSec = Math.floor(Date.now() / 1000) - ts;
  if (elapsedSec < 0) return null;
  const elapsed = Math.floor(elapsedSec / 60);

  if (status.includes('1st')) {
    if (elapsed <= 45) return `${elapsed}'`;
    return `45+${elapsed - 45}'`;
  }

  if (status.includes('2nd')) {
    const effective = elapsed - 15;
    if (effective <= 90) return `${effective}'`;
    return `90+${effective - 90}'`;
  }

  if (status.includes('extra')) {
    const effective = elapsed - 15;
    return `${effective}'`;
  }

  if (elapsed <= 45) return `${elapsed}'`;
  if (elapsed <= 60) return `45+${elapsed - 45}'`;
  const eff = elapsed - 15;
  if (eff <= 90) return `${eff}'`;
  return `90+${eff - 90}'`;
}

/* ─── Tournament Grouping ─── */

function groupByTournament(matches: ApiMatch[]): [string, ApiMatch[]][] {
  const map = new Map<string, ApiMatch[]>();
  for (const m of matches) {
    const key = getTournament(m);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries());
}

function isPriorityLeague(match: ApiMatch): boolean {
  return getLeaguePriority(match) < PRIORITY_LEAGUES.length;
}

function matchesChipFilter(match: ApiMatch, chipKey: string): boolean {
  const name = getTournament(match).toLowerCase();
  if (chipKey === 'super lig') return name.includes('super lig') || name.includes('süper lig');
  return name.includes(chipKey);
}

/* ─── Popular League Chips ─── */

function PopularLeagueChips({
  matches,
  selected,
  onSelect,
}: {
  matches: ApiMatch[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  // Count matches per chip
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let popularTotal = 0;
    for (const chip of POPULAR_CHIPS) {
      const count = matches.filter((m) => matchesChipFilter(m, chip.match)).length;
      counts[chip.key] = count;
      popularTotal += count;
    }
    counts['popular'] = popularTotal;
    return counts;
  }, [matches]);

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {/* Tümü */}
      <button
        onClick={() => onSelect('all')}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
          selected === 'all'
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
        }`}
      >
        Tumu
        <span className="text-[10px] opacity-70">{matches.length}</span>
      </button>

      {/* Popüler */}
      <button
        onClick={() => onSelect('popular')}
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
          selected === 'popular'
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
        }`}
      >
        Populer
        <span className="text-[10px] opacity-70">{chipCounts['popular'] || 0}</span>
      </button>

      {/* Divider */}
      <div className="w-px h-5 bg-slate-700 shrink-0" />

      {/* Individual leagues */}
      {POPULAR_CHIPS.map((chip) => {
        const count = chipCounts[chip.key] || 0;
        if (count === 0) return null;

        return (
          <button
            key={chip.key}
            onClick={() => onSelect(chip.key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              selected === chip.key
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <span className="text-sm">{chip.flag}</span>
            {chip.label}
            <span className="text-[10px] opacity-70">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── League Dropdown Component ─── */

function LeagueDropdown({
  matches,
  selectedLeague,
  onSelect,
}: {
  matches: ApiMatch[];
  selectedLeague: string;
  onSelect: (league: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const availableLeagues = useMemo(() => {
    const leagueSet = new Set<string>();
    for (const m of matches) {
      const t = getTournament(m);
      if (t !== '-') leagueSet.add(t);
    }
    return Array.from(leagueSet).sort((a, b) => {
      const pa = PRIORITY_LEAGUES.findIndex((l) => a.toLowerCase().includes(l));
      const pb = PRIORITY_LEAGUES.findIndex((l) => b.toLowerCase().includes(l));
      const prioA = pa === -1 ? PRIORITY_LEAGUES.length : pa;
      const prioB = pb === -1 ? PRIORITY_LEAGUES.length : pb;
      if (prioA !== prioB) return prioA - prioB;
      return a.localeCompare(b, 'tr');
    });
  }, [matches]);

  if (availableLeagues.length <= 1) return null;

  const searchLower = search.toLowerCase();
  const priorityLeagues = availableLeagues.filter((l) =>
    PRIORITY_LEAGUES.some((pl) => l.toLowerCase().includes(pl)) &&
    (!searchLower || l.toLowerCase().includes(searchLower))
  );
  const otherLeagues = availableLeagues.filter((l) =>
    !PRIORITY_LEAGUES.some((pl) => l.toLowerCase().includes(pl)) &&
    (!searchLower || l.toLowerCase().includes(searchLower))
  );

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider shrink-0">Lig:</span>
      <div className="relative">
        <button
          onClick={() => { setOpen((v) => !v); setSearch(''); }}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors min-w-[200px] justify-between ${
            selectedLeague !== 'all'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'bg-slate-800/60 text-slate-300 border border-slate-700 hover:text-slate-100'
          }`}
        >
          <span className="truncate">
            {selectedLeague === 'all'
              ? `Tum Ligler (${matches.length})`
              : `${selectedLeague} (${matches.filter((m) => getTournament(m) === selectedLeague).length})`}
          </span>
          <svg className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-full mt-1 z-20 w-72 max-h-80 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
              <div className="border-b border-slate-700/70 p-2">
                <div className="flex items-center gap-2 rounded-lg bg-slate-800/80 px-3 py-2">
                  <svg className="h-3.5 w-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Lig ara..."
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-60 py-1">
                {(!searchLower || 'tumu'.includes(searchLower) || 'tüm'.includes(searchLower)) && (
                  <button
                    onClick={() => { onSelect('all'); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      selectedLeague === 'all'
                        ? 'bg-sky-500/15 text-sky-300'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="font-medium">Tum Ligler</span>
                    <span className="text-[11px] text-slate-500">{matches.length}</span>
                  </button>
                )}

                {priorityLeagues.length > 0 && (
                  <>
                    {priorityLeagues.map((league) => {
                      const count = matches.filter((m) => getTournament(m) === league).length;
                      return (
                        <button
                          key={league}
                          onClick={() => { onSelect(league); setOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                            selectedLeague === league
                              ? 'bg-sky-500/15 text-sky-300'
                              : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                            <span className="truncate font-medium">{league}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 shrink-0">{count}</span>
                        </button>
                      );
                    })}
                    {otherLeagues.length > 0 && (
                      <div className="border-t border-slate-700/50 my-1" />
                    )}
                  </>
                )}

                {otherLeagues.map((league) => {
                  const count = matches.filter((m) => getTournament(m) === league).length;
                  return (
                    <button
                      key={league}
                      onClick={() => { onSelect(league); setOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-2 ${
                        selectedLeague === league
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate">{league}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{count}</span>
                    </button>
                  );
                })}

                {priorityLeagues.length === 0 && otherLeagues.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500 text-center">Sonuc bulunamadi</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ─── */

export default function LivePage() {
  const [liveMatches, setLiveMatches] = useState<ApiMatch[]>([]);
  const [finishedMatches, setFinishedMatches] = useState<ApiMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LiveTab>('devam');
  const [, setTick] = useState(0);

  // Quick filter (popular league chips)
  const [quickFilter, setQuickFilter] = useState<string>('all');

  // League filters (per tab)
  const [liveLeagueFilter, setLiveLeagueFilter] = useState<string>('all');
  const [finishedLeagueFilter, setFinishedLeagueFilter] = useState<string>('all');
  const [womenLeagueFilter, setWomenLeagueFilter] = useState<string>('all');

  // Date filter for finished
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

  // Initial fetch
  useEffect(() => {
    Promise.all([fetchLiveMatches(), fetchFinishedMatches()])
      .then(([live, finished]) => {
        setLiveMatches(normalizeMatches(live));
        setFinishedMatches(normalizeMatches(finished));
      })
      .catch((err: any) => setError(err.message || 'Canli maclar yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  // Auto-refresh every 60s
  useEffect(() => {
    const id = window.setInterval(() => {
      Promise.all([fetchLiveMatches(), fetchFinishedMatches()])
        .then(([live, finished]) => {
          setLiveMatches(normalizeMatches(live));
          setFinishedMatches(normalizeMatches(finished));
        })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Tick every 30s for minute re-calculation
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Refresh finished matches when switching to biten tab
  useEffect(() => {
    if (activeTab === 'biten') {
      fetchFinishedMatches()
        .then((finished) => setFinishedMatches(normalizeMatches(finished)))
        .catch(() => {});
    }
  }, [activeTab]);

  // Combine all matches, deduplicate
  const allCombined = useMemo(() => {
    const map = new Map<number, ApiMatch>();
    for (const m of liveMatches) {
      if (m.id) map.set(m.id, m);
    }
    for (const m of finishedMatches) {
      if (m.id && !map.has(m.id)) map.set(m.id, m);
    }
    return Array.from(map.values());
  }, [liveMatches, finishedMatches]);

  // Live (not finished, not women)
  const sortedLive = useMemo(() => {
    return allCombined
      .filter((m) => !isFinishedStatus(getStatus(m)) && !isWomenLeague(m))
      .sort(sortByLeagueThenName);
  }, [allCombined]);

  // Finished (not women)
  const sortedFinished = useMemo(() => {
    return allCombined
      .filter((m) => isFinishedStatus(getStatus(m)) && !isWomenLeague(m))
      .sort(sortByLeagueThenName);
  }, [allCombined]);

  // Women (all statuses)
  const sortedWomen = useMemo(() => {
    return allCombined
      .filter((m) => isWomenLeague(m))
      .sort(sortByLeagueThenName);
  }, [allCombined]);

  // Available dates from finished matches
  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    for (const m of sortedFinished) {
      dateSet.add(getMatchDate(m));
    }
    return Array.from(dateSet).sort((a, b) => {
      const da = new Date(a.split('.').reverse().join('-'));
      const db = new Date(b.split('.').reverse().join('-'));
      return db.getTime() - da.getTime();
    });
  }, [sortedFinished]);

  // Apply quick filter (popular chips) then league dropdown
  function applyQuickFilter(matches: ApiMatch[]): ApiMatch[] {
    if (quickFilter === 'all') return matches;
    if (quickFilter === 'popular') return matches.filter((m) => isPriorityLeague(m));
    return matches.filter((m) => matchesChipFilter(m, quickFilter));
  }

  // Filtered live matches
  const filteredLive = useMemo(() => {
    let matches = applyQuickFilter(sortedLive);
    if (liveLeagueFilter !== 'all') {
      matches = matches.filter((m) => getTournament(m) === liveLeagueFilter);
    }
    return matches;
  }, [sortedLive, quickFilter, liveLeagueFilter]);

  // Filtered finished matches
  const filteredFinished = useMemo(() => {
    let matches = applyQuickFilter(sortedFinished);

    if (selectedDateFilter !== 'all') {
      matches = matches.filter((m) => getMatchDate(m) === selectedDateFilter);
    }

    if (finishedLeagueFilter !== 'all') {
      matches = matches.filter((m) => getTournament(m) === finishedLeagueFilter);
    }

    return matches;
  }, [sortedFinished, quickFilter, selectedDateFilter, finishedLeagueFilter]);

  // Filtered women matches
  const filteredWomen = useMemo(() => {
    if (womenLeagueFilter === 'all') return sortedWomen;
    return sortedWomen.filter((m) => getTournament(m) === womenLeagueFilter);
  }, [sortedWomen, womenLeagueFilter]);

  const tabs: { id: LiveTab; label: string; count: number; color?: string }[] = [
    { id: 'devam', label: 'Devam Eden', count: sortedLive.length },
    { id: 'biten', label: 'Biten Maclar', count: sortedFinished.length },
    { id: 'kadin', label: 'Kadin Ligleri', count: sortedWomen.length, color: 'pink' },
  ];

  const activeMatches = activeTab === 'devam' ? filteredLive : activeTab === 'biten' ? filteredFinished : filteredWomen;
  const groups = useMemo(() => groupByTournament(activeMatches), [activeMatches]);

  const summaryItems = useMemo(
    () => [
      { label: 'Devam Eden', value: sortedLive.length, accent: 'text-emerald-300' },
      { label: 'Biten', value: sortedFinished.length, accent: 'text-slate-300' },
      { label: 'Toplam', value: sortedLive.length + sortedFinished.length, accent: 'text-white' },
    ],
    [sortedLive.length, sortedFinished.length],
  );

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.98))] p-4 sm:p-5 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.14),_transparent_60%)] lg:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Match Center
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Canli mac akisi</h1>
              <p className="max-w-xl text-sm leading-5 text-slate-300">
                Devam eden ve biten karsilasmalari buyuk ligler onde olacak sekilde takip edin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                <div className={`mt-1 text-lg sm:text-xl font-semibold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Bar */}
      <div className="bg-gray-800/40 rounded-lg p-1.5 flex overflow-x-auto gap-1.5 border border-gray-700">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isPink = tab.color === 'pink';
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setQuickFilter('all'); }}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? isPink
                    ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-transparent'
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                isActive
                  ? isPink ? 'bg-pink-500/20 text-pink-300' : 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-gray-700 text-gray-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Popular league chips - shown for devam and biten */}
        {(activeTab === 'devam' || activeTab === 'biten') && (
          <PopularLeagueChips
            matches={activeTab === 'devam' ? sortedLive : sortedFinished}
            selected={quickFilter}
            onSelect={(key) => {
              setQuickFilter(key);
              // Reset league dropdown when changing quick filter
              if (activeTab === 'devam') setLiveLeagueFilter('all');
              else setFinishedLeagueFilter('all');
            }}
          />
        )}

        {/* League dropdown for devam */}
        {activeTab === 'devam' && quickFilter === 'all' && (
          <LeagueDropdown
            matches={sortedLive}
            selectedLeague={liveLeagueFilter}
            onSelect={setLiveLeagueFilter}
          />
        )}

        {activeTab === 'biten' && (
          <>
            {/* Date Filter */}
            {availableDates.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Tarih:</span>
                <button
                  onClick={() => setSelectedDateFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedDateFilter === 'all'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200'
                  }`}
                >
                  Tumu
                </button>
                {availableDates.map((dateKey) => (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDateFilter(dateKey)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedDateFilter === dateKey
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800/60 text-slate-400 border border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    {dateKey}
                  </button>
                ))}
              </div>
            )}

            {/* League dropdown for finished */}
            {quickFilter === 'all' && (
              <LeagueDropdown
                matches={sortedFinished}
                selectedLeague={finishedLeagueFilter}
                onSelect={setFinishedLeagueFilter}
              />
            )}
          </>
        )}

        {/* League dropdown for kadin tab */}
        {activeTab === 'kadin' && (
          <LeagueDropdown
            matches={sortedWomen}
            selectedLeague={womenLeagueFilter}
            onSelect={setWomenLeagueFilter}
          />
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <div key={index} className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-4">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
              <div className="mt-3 h-16 animate-pulse rounded-xl bg-slate-800/60" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-100 shadow-[0_12px_30px_rgba(127,29,29,0.22)]">
          {error}
        </div>
      )}

      {/* Match List */}
      {!loading && !error && (
        activeMatches.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/70 bg-slate-900/60 px-5 py-12 text-center text-sm text-slate-400">
            {activeTab === 'devam' && (
              quickFilter !== 'all' || liveLeagueFilter !== 'all'
                ? 'Secilen filtrelere uygun mac bulunamadi.'
                : 'Su anda devam eden mac yok.'
            )}
            {activeTab === 'biten' && (
              selectedDateFilter !== 'all' || finishedLeagueFilter !== 'all' || quickFilter !== 'all'
                ? 'Secilen filtrelere uygun biten mac bulunamadi.'
                : 'Henuz biten mac yok.'
            )}
            {activeTab === 'kadin' && (
              womenLeagueFilter !== 'all'
                ? 'Secilen lig icin mac bulunamadi.'
                : 'Su anda kadin liglerinde mac yok.'
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(([tournament, matches]) => {
              const isPriority = getLeaguePriority({ tournament: { name: tournament } } as ApiMatch) < PRIORITY_LEAGUES.length;
              const category = matches[0] ? getCategory(matches[0]) : '';
              const flag = getCategoryFlag(category);

              return (
                <section key={tournament} className="rounded-xl border border-slate-700/60 bg-slate-900/40 overflow-hidden">
                  {/* League Header */}
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 border-l-[3px] ${isPriority ? 'border-l-emerald-400 bg-emerald-500/5' : 'border-l-slate-600 bg-slate-800/30'}`}>
                    <span className="text-base">{flag}</span>
                    <h3 className="text-sm font-bold text-slate-100">{tournament}</h3>
                    <span className="text-[11px] text-slate-500 font-medium ml-auto">{matches.length}</span>
                  </div>

                  {/* Match Rows */}
                  <div className="divide-y divide-slate-800/80">
                    {matches.map((match) => (
                      <MatchRow key={match.id} match={match} showMinute={activeTab !== 'biten'} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

/* ─── MatchRow ─── */

function MatchRow({ match, showMinute }: { match: ApiMatch; showMinute?: boolean }) {
  const homeName = getHomeName(match);
  const awayName = getAwayName(match);
  const homeScore = getHomeScore(match);
  const awayScore = getAwayScore(match);
  const minute = showMinute ? getMatchMinute(match) : null;
  const badge = getStatusBadge(match, minute);

  const homeNum = Number(homeScore);
  const awayNum = Number(awayScore);
  const hasScore = homeScore !== '-' && awayScore !== '-';
  const homeWinning = hasScore && !isNaN(homeNum) && !isNaN(awayNum) && homeNum > awayNum;
  const awayWinning = hasScore && !isNaN(homeNum) && !isNaN(awayNum) && awayNum > homeNum;

  // Half-time score (various API formats)
  const htHome = (match as any).homeScore?.period1 ?? (match as any).score?.htHome;
  const htAway = (match as any).awayScore?.period1 ?? (match as any).score?.htAway;
  const hasHT = htHome != null && htAway != null;

  return (
    <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 hover:bg-slate-800/50 transition-colors cursor-default group">
      {/* Time */}
      <div className="w-12 sm:w-14 shrink-0 text-xs text-slate-400 font-medium tabular-nums">
        {getKickoffLabel(match)}
      </div>

      {/* Status Badge */}
      <div className="w-10 sm:w-12 shrink-0 flex justify-center">
        {badge ? (
          <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold border ${badge.className}`}>
            {badge.label}
          </span>
        ) : (
          <span className="text-[10px] text-slate-500 font-medium">-</span>
        )}
      </div>

      {/* Home Team */}
      <div className="flex-1 min-w-0 text-right pr-2">
        <span className={`text-sm truncate inline-block max-w-full ${homeWinning ? 'font-bold text-white' : 'text-slate-200'}`}>
          {homeName}
        </span>
      </div>

      {/* Score */}
      <div className="w-14 sm:w-16 shrink-0 flex items-center justify-center">
        <div className={`flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold tabular-nums ${
          hasScore
            ? 'bg-slate-700/50 text-white'
            : 'bg-slate-800/40 text-slate-500'
        }`}>
          <span>{homeScore}</span>
          <span className="text-slate-500">-</span>
          <span>{awayScore}</span>
        </div>
      </div>

      {/* Away Team */}
      <div className="flex-1 min-w-0 text-left pl-2">
        <span className={`text-sm truncate inline-block max-w-full ${awayWinning ? 'font-bold text-white' : 'text-slate-200'}`}>
          {awayName}
        </span>
      </div>

      {/* HT Score */}
      <div className="w-14 shrink-0 text-right hidden sm:block">
        {hasHT && (
          <span className="text-[11px] text-slate-500 font-medium tabular-nums">
            IY {htHome}-{htAway}
          </span>
        )}
      </div>
    </div>
  );
}
