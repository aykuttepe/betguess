import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchTournamentCatalog,
  fetchTournamentSeasons,
  fetchTournamentStandingsView,
  fetchTournamentRounds,
  fetchRoundEvents,
  fetchTopPlayers,
  fetchTopTeams,
  fetchTournamentNextEvents,
  fetchTournamentLastEvents,
} from '../lib/football-api';
import type { TournamentSummary } from '../lib/football-types';

type DetailTab = 'standings' | 'fixtures' | 'top-players' | 'top-teams' | 'results' | 'upcoming';

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: 'standings', label: 'Puan Durumu' },
  { key: 'fixtures', label: 'Fikstur' },
  { key: 'results', label: 'Son Maclar' },
  { key: 'upcoming', label: 'Gelecek Maclar' },
  { key: 'top-players', label: 'Gol Kralligi' },
  { key: 'top-teams', label: 'Takim Siralamalari' },
];

export default function TournamentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<number | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('standings');

  useEffect(() => {
    fetchTournamentCatalog()
      .then((data) => {
        const list = Object.entries(data.tournaments || {}).map(([slug, tournament]) => ({ ...tournament, slug }));
        setTournaments(list.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((err: any) => setError(err.message || 'Turnuvalar yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fromQuery = searchParams.get('tournamentId');
    if (fromQuery) setSelectedTournamentId(Number(fromQuery));
  }, [searchParams]);

  useEffect(() => {
    if (!selectedTournamentId) {
      setSelectedSeasonId(null);
      setSeasons([]);
      return;
    }
    let cancelled = false;
    setError(null);
    setSelectedSeasonId(null);
    setSeasons([]);

    fetchTournamentSeasons(selectedTournamentId)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.seasons) ? data.seasons : [];
        setSeasons(list);
        const current = list.find((s: any) => s?.current) || list[0] || null;
        setSelectedSeasonId(current?.id ?? null);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Sezonlar yuklenemedi');
      });
    return () => { cancelled = true; };
  }, [selectedTournamentId]);

  const selectedTournamentName = useMemo(
    () => tournaments.find((item) => item.id === selectedTournamentId)?.name || 'Turnuva',
    [tournaments, selectedTournamentId]
  );

  function selectTournament(id: number) {
    setSelectedTournamentId(id);
    setSelectedSeasonId(null);
    setSeasons([]);
    setError(null);
    setDetailTab('standings');
    setSearchParams({ tournamentId: String(id) });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Turnuvalar</h2>
        <p className="text-sm text-gray-400 mt-1">Turnuva listesi, fikstur, gol kralligi ve daha fazlasi.</p>
      </div>

      {loading && <div className="text-gray-400">Yukleniyor...</div>}
      {error && !loading && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-6">
          {/* Tournament list */}
          <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold">Turnuva Listesi</div>
            <div className="max-h-[75vh] overflow-auto divide-y divide-gray-700/60">
              {tournaments.map((t) => (
                <button
                  key={(t as any).slug || t.id}
                  onClick={() => selectTournament(t.id)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${selectedTournamentId === t.id ? 'bg-emerald-500/10 text-emerald-300' : 'text-gray-200 hover:bg-gray-700/40'}`}
                >
                  <div className="font-medium text-sm">{t.name}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Detail panel */}
          <div className="space-y-4">
            {/* Season selector */}
            {selectedTournamentId && (
              <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold">{selectedTournamentName}</div>
                <div className="px-4 py-3 flex gap-2 flex-wrap">
                  {seasons.map((season) => (
                    <button
                      key={season.id}
                      onClick={() => setSelectedSeasonId(season.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs ${selectedSeasonId === season.id ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                    >
                      {season.name || season.year || season.id}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Tab navigation */}
            {selectedTournamentId && selectedSeasonId && (
              <>
                <div className="flex flex-wrap gap-2">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setDetailTab(tab.key)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors ${detailTab === tab.key ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {detailTab === 'standings' && (
                  <StandingsSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} />
                )}
                {detailTab === 'fixtures' && (
                  <FixturesSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} />
                )}
                {detailTab === 'results' && (
                  <EventsSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} mode="last" />
                )}
                {detailTab === 'upcoming' && (
                  <EventsSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} mode="next" />
                )}
                {detailTab === 'top-players' && (
                  <TopPlayersSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} />
                )}
                {detailTab === 'top-teams' && (
                  <TopTeamsSection tournamentId={selectedTournamentId} seasonId={selectedSeasonId} />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Standings ──────────────────────────────────────────
function StandingsSection({ tournamentId, seasonId }: { tournamentId: number; seasonId: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [standingType, setStandingType] = useState<'total' | 'home' | 'away'>('total');

  useEffect(() => {
    setLoading(true);
    fetchTournamentStandingsView(tournamentId, seasonId, standingType)
      .then((data) => {
        const r = Array.isArray(data?.standings?.[0]?.rows) ? data.standings[0].rows : [];
        setRows(r);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tournamentId, seasonId, standingType]);

  if (loading) return <Spinner />;

  return (
    <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Puan Durumu</span>
        <div className="flex gap-1">
          {(['total', 'home', 'away'] as const).map((t) => (
            <button key={t} onClick={() => setStandingType(t)}
              className={`px-2 py-1 text-[10px] rounded ${standingType === t ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {t === 'total' ? 'Genel' : t === 'home' ? 'Ic Saha' : 'Dis Saha'}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Veri bulunamadi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400 bg-gray-900/40">
                <th className="px-3 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 text-left">Takim</th>
                <th className="px-2 py-2 text-center">O</th>
                <th className="px-2 py-2 text-center">G</th>
                <th className="px-2 py-2 text-center">B</th>
                <th className="px-2 py-2 text-center">M</th>
                <th className="px-2 py-2 text-center hidden sm:table-cell">AG</th>
                <th className="px-2 py-2 text-center hidden sm:table-cell">YG</th>
                <th className="px-2 py-2 text-center">AV</th>
                <th className="px-3 py-2 text-center font-bold">P</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.team?.id || row.position} className="border-t border-gray-700/60 hover:bg-gray-700/30">
                  <td className="px-3 py-2 text-center text-emerald-400 font-bold">{row.position}</td>
                  <td className="px-3 py-2 text-white font-medium truncate max-w-[160px]">{row.team?.name || '-'}</td>
                  <td className="px-2 py-2 text-center text-gray-300">{row.matches ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-green-400">{row.wins ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-yellow-400">{row.draws ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-red-400">{row.losses ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-gray-300 hidden sm:table-cell">{row.scoresFor ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-gray-300 hidden sm:table-cell">{row.scoresAgainst ?? '-'}</td>
                  <td className="px-2 py-2 text-center text-gray-300">{(row.scoresFor ?? 0) - (row.scoresAgainst ?? 0)}</td>
                  <td className="px-3 py-2 text-center text-white font-bold">{row.points ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Fixtures (Round-based) ──────────────────────────────
function FixturesSection({ tournamentId, seasonId }: { tournamentId: number; seasonId: number }) {
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    setLoadingRounds(true);
    fetchTournamentRounds(tournamentId, seasonId)
      .then((data) => {
        const r = Array.isArray(data?.rounds) ? data.rounds : Array.isArray(data) ? data : [];
        setRounds(r);
        const current = r.find((rd: any) => rd?.current) || r[r.length - 1] || null;
        setSelectedRound(current?.round ?? r.length);
      })
      .catch(() => setRounds([]))
      .finally(() => setLoadingRounds(false));
  }, [tournamentId, seasonId]);

  useEffect(() => {
    if (!selectedRound) return;
    setLoadingEvents(true);
    fetchRoundEvents(tournamentId, seasonId, selectedRound)
      .then((data) => {
        const e = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
        setEvents(e);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoadingEvents(false));
  }, [tournamentId, seasonId, selectedRound]);

  if (loadingRounds) return <Spinner />;

  const totalRounds = rounds.length || (selectedRound ?? 0);

  return (
    <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <span className="text-white font-semibold text-sm">Fikstur - {selectedRound}. Hafta</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelectedRound((r) => Math.max(1, (r ?? 1) - 1))}
            className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600" disabled={selectedRound === 1}>←</button>
          <select
            value={selectedRound ?? ''}
            onChange={(e) => setSelectedRound(Number(e.target.value))}
            className="bg-gray-700 text-white text-xs rounded px-2 py-1 border border-gray-600"
          >
            {Array.from({ length: totalRounds }, (_, i) => i + 1).map((r) => (
              <option key={r} value={r}>{r}. Hafta</option>
            ))}
          </select>
          <button onClick={() => setSelectedRound((r) => Math.min(totalRounds, (r ?? 1) + 1))}
            className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs hover:bg-gray-600" disabled={selectedRound === totalRounds}>→</button>
        </div>
      </div>

      {loadingEvents ? <Spinner /> : events.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Bu hafta icin mac bulunamadi.</p>
      ) : (
        <div className="divide-y divide-gray-700/60">
          {events.map((ev: any) => <MatchRow key={ev.id} event={ev} />)}
        </div>
      )}
    </section>
  );
}

// ── Last/Next Events ────────────────────────────────────
function EventsSection({ tournamentId, seasonId, mode }: { tournamentId: number; seasonId: number; mode: 'last' | 'next' }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fn = mode === 'last' ? fetchTournamentLastEvents : fetchTournamentNextEvents;
    fn(tournamentId, seasonId, 0)
      .then((data) => {
        const e = Array.isArray(data?.events) ? data.events : Array.isArray(data) ? data : [];
        setEvents(e);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [tournamentId, seasonId, mode]);

  if (loading) return <Spinner />;

  return (
    <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold text-sm">
        {mode === 'last' ? 'Son Oynanan Maclar' : 'Gelecek Maclar'}
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Mac bulunamadi.</p>
      ) : (
        <div className="divide-y divide-gray-700/60">
          {events.map((ev: any) => <MatchRow key={ev.id} event={ev} />)}
        </div>
      )}
    </section>
  );
}

// ── Top Players ─────────────────────────────────────────
function TopPlayersSection({ tournamentId, seasonId }: { tournamentId: number; seasonId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statType, setStatType] = useState('goals');

  const statOptions = [
    { value: 'goals', label: 'Goller' },
    { value: 'assists', label: 'Asistler' },
    { value: 'rating', label: 'Rating' },
    { value: 'yellowCards', label: 'Sari Kartlar' },
    { value: 'redCards', label: 'Kirmizi Kartlar' },
  ];

  useEffect(() => {
    setLoading(true);
    fetchTopPlayers(tournamentId, seasonId, statType)
      .then((d) => {
        const list = Array.isArray(d?.topPlayers) ? d.topPlayers
          : Array.isArray(d?.top_players) ? d.top_players
          : Array.isArray(d) ? d : [];
        setData(list);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tournamentId, seasonId, statType]);

  return (
    <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <span className="text-white font-semibold text-sm">Oyuncu Siralamalari</span>
        <div className="flex gap-1 flex-wrap">
          {statOptions.map((opt) => (
            <button key={opt.value} onClick={() => setStatType(opt.value)}
              className={`px-2 py-1 text-[10px] rounded ${statType === opt.value ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Spinner /> : data.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Veri bulunamadi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400 bg-gray-900/40">
                <th className="px-3 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 text-left">Oyuncu</th>
                <th className="px-3 py-2 text-left hidden sm:table-cell">Takim</th>
                <th className="px-3 py-2 text-center">Deger</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 30).map((item: any, idx: number) => {
                const player = item.player || item;
                const team = item.team || player.team || {};
                const value = item.statistics?.[statType] ?? item.value ?? item.goals ?? item.assists ?? item.rating ?? '-';
                return (
                  <tr key={player.id || idx} className="border-t border-gray-700/60 hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-center text-emerald-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 text-white font-medium">{player.name || player.shortName || '-'}</td>
                    <td className="px-3 py-2 text-gray-400 hidden sm:table-cell">{team.name || team.shortName || '-'}</td>
                    <td className="px-3 py-2 text-center text-emerald-400 font-bold">{typeof value === 'number' ? value.toFixed?.(1) ?? value : value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Top Teams ───────────────────────────────────────────
function TopTeamsSection({ tournamentId, seasonId }: { tournamentId: number; seasonId: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statType, setStatType] = useState('goals');

  const statOptions = [
    { value: 'goals', label: 'Goller' },
    { value: 'possession', label: 'Top Hakimiyeti' },
    { value: 'shotsOnTarget', label: 'Isabetli Sutlar' },
    { value: 'yellowCards', label: 'Sari Kartlar' },
  ];

  useEffect(() => {
    setLoading(true);
    fetchTopTeams(tournamentId, seasonId, statType)
      .then((d) => {
        const list = Array.isArray(d?.topTeams) ? d.topTeams
          : Array.isArray(d?.top_teams) ? d.top_teams
          : Array.isArray(d) ? d : [];
        setData(list);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tournamentId, seasonId, statType]);

  return (
    <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between flex-wrap gap-2">
        <span className="text-white font-semibold text-sm">Takim Siralamalari</span>
        <div className="flex gap-1 flex-wrap">
          {statOptions.map((opt) => (
            <button key={opt.value} onClick={() => setStatType(opt.value)}
              className={`px-2 py-1 text-[10px] rounded ${statType === opt.value ? 'bg-emerald-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? <Spinner /> : data.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-400">Veri bulunamadi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400 bg-gray-900/40">
                <th className="px-3 py-2 text-center w-8">#</th>
                <th className="px-3 py-2 text-left">Takim</th>
                <th className="px-3 py-2 text-center">Deger</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((item: any, idx: number) => {
                const team = item.team || item;
                const value = item.statistics?.[statType] ?? item.value ?? item.goals ?? '-';
                return (
                  <tr key={team.id || idx} className="border-t border-gray-700/60 hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-center text-emerald-400 font-bold">{idx + 1}</td>
                    <td className="px-3 py-2 text-white font-medium">{team.name || team.shortName || '-'}</td>
                    <td className="px-3 py-2 text-center text-emerald-400 font-bold">{typeof value === 'number' ? value.toFixed?.(1) ?? value : value}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Shared match row ────────────────────────────────────
function MatchRow({ event }: { event: any }) {
  const home = event.home_team?.name || event.homeTeam?.name || event.homeTeam?.shortName || '-';
  const away = event.away_team?.name || event.awayTeam?.name || event.awayTeam?.shortName || '-';
  const homeScore = event.score?.home ?? event.homeScore?.current ?? event.homeScore?.display ?? null;
  const awayScore = event.score?.away ?? event.awayScore?.current ?? event.awayScore?.display ?? null;
  const hasScore = homeScore !== null && awayScore !== null;
  const status = event.status_description || event.status?.description || event.status?.type || '';
  const time = event.start_time || (event.startTimestamp ? new Date(event.startTimestamp * 1000).toLocaleString('tr-TR') : '');

  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <div className="text-white text-sm font-medium">{home} vs {away}</div>
        <div className="text-xs text-gray-500 mt-0.5">{status}{time ? ` | ${typeof time === 'string' && time.includes('T') ? new Date(time).toLocaleString('tr-TR') : time}` : ''}</div>
      </div>
      {hasScore && (
        <div className="text-emerald-400 font-bold text-sm">{homeScore} - {awayScore}</div>
      )}
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────
function Spinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
