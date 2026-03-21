import { useCallback, useEffect, useMemo, useState, lazy, Suspense } from 'react';
import { fetchMatchIntel, fetchTeamStats } from '../lib/football-api';
import {
  H2HMatch,
  MatchIntelAbsentee,
  MatchIntelCardIncident,
  MatchIntelResponse,
  MatchIntelStatisticsGroup,
  RecentMatch,
  TeamStatsResponse,
} from '../lib/football-types';
import { SportTotoMatch } from '../lib/types';

const PredictionTab = lazy(() => import('./match-detail/PredictionTab'));
const OddsTab = lazy(() => import('./match-detail/OddsTab'));
const ShotmapTab = lazy(() => import('./match-detail/ShotmapTab'));
const MomentumTab = lazy(() => import('./match-detail/MomentumTab'));
const CommentsTab = lazy(() => import('./match-detail/CommentsTab'));
const IncidentsTab = lazy(() => import('./match-detail/IncidentsTab'));
const HighlightsTab = lazy(() => import('./match-detail/HighlightsTab'));

type TabKey = 'teams' | 'stats' | 'lineups' | 'absentees' | 'cards' | 'prediction' | 'odds' | 'shotmap' | 'momentum' | 'comments' | 'incidents' | 'highlights' | 'raw';

interface MatchDetailModalProps {
  match: SportTotoMatch;
  onClose: () => void;
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'teams', label: 'Takimlar' },
  { key: 'stats', label: 'Istatistikler' },
  { key: 'prediction', label: 'Tahmin' },
  { key: 'odds', label: 'Oranlar' },
  { key: 'incidents', label: 'Olaylar' },
  { key: 'lineups', label: 'Kadrolar' },
  { key: 'shotmap', label: 'Sut Haritasi' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'comments', label: 'Yorumlar' },
  { key: 'highlights', label: 'Ozetler' },
  { key: 'absentees', label: 'Sakat/Ceza' },
  { key: 'cards', label: 'Kartlar' },
  { key: 'raw', label: 'Ham Veri' },
];

export default function MatchDetailModal({ match, onClose }: MatchDetailModalProps) {
  const [tab, setTab] = useState<TabKey>('teams');
  const [data, setData] = useState<MatchIntelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Team stats (lazy-loaded)
  const [teamStats, setTeamStats] = useState<TeamStatsResponse | null>(null);
  const [teamStatsLoading, setTeamStatsLoading] = useState(false);
  const [teamStatsError, setTeamStatsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchMatchIntel(match.homeTeam, match.awayTeam, match.matchDate);
      setData(response);
    } catch (err: any) {
      setError(err?.message || 'Match detay verisi alinamadi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [match.homeTeam, match.awayTeam, match.matchDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Lazy load team stats when teams tab is selected
  useEffect(() => {
    if (tab !== 'teams') return;
    if (!data?.eventMeta?.eventId) return;
    if (teamStats || teamStatsLoading) return;

    setTeamStatsLoading(true);
    setTeamStatsError(null);

    fetchTeamStats(data.eventMeta.eventId)
      .then(setTeamStats)
      .catch((err: any) => setTeamStatsError(err?.message || 'Takim verileri alinamadi'))
      .finally(() => setTeamStatsLoading(false));
  }, [tab, data, teamStats, teamStatsLoading]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const groupedStats = useMemo(() => groupStatsByPeriod(data?.statisticsGroups || []), [data]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="max-w-5xl mx-auto bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-white font-bold text-base sm:text-lg">
              {match.homeTeam} - {match.awayTeam}
            </h3>
            <p className="text-gray-400 text-xs sm:text-sm">
              {match.matchDate} {match.matchTime}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Kapat"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-700 flex flex-wrap gap-2">
          {TABS.map((tabInfo) => (
            <button
              key={tabInfo.key}
              onClick={() => setTab(tabInfo.key)}
              className={`px-3 py-1.5 text-xs sm:text-sm rounded transition-colors ${
                tab === tabInfo.key
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tabInfo.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading && (
            <div className="text-center py-10">
              <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-gray-400">Mac verileri yukleniyor...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">
              <p>{error}</p>
              <button
                onClick={load}
                className="mt-2 px-3 py-1.5 bg-red-700 text-white rounded hover:bg-red-600 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs sm:text-sm">
                <InfoCard label="Turnuva" value={data.eventMeta.tournament || '-'} />
                <InfoCard label="Kategori" value={data.eventMeta.category || '-'} />
                <InfoCard label="Durum" value={data.eventMeta.status || '-'} />
                <InfoCard
                  label="Skor"
                  value={
                    data.eventMeta.homeScore !== null && data.eventMeta.awayScore !== null
                      ? `${data.eventMeta.homeScore} - ${data.eventMeta.awayScore}`
                      : '-'
                  }
                />
              </div>

              {tab === 'teams' && (
                <TeamsTab
                  teamStats={teamStats}
                  loading={teamStatsLoading}
                  error={teamStatsError}
                  onRetry={() => {
                    setTeamStats(null);
                    setTeamStatsError(null);
                  }}
                />
              )}

              {tab === 'stats' && (
                <StatsTab groupedStats={groupedStats} />
              )}

              {tab === 'lineups' && (
                <LineupsTab rawLineups={data.raw.lineups} />
              )}

              {tab === 'absentees' && (
                <AbsenteesTab absentees={data.absentees} />
              )}

              {tab === 'cards' && <CardsTab cards={data.cards} />}

              {tab === 'prediction' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <PredictionTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'odds' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <OddsTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'shotmap' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <ShotmapTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'momentum' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <MomentumTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'comments' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <CommentsTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'incidents' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <IncidentsTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'highlights' && data.eventMeta.eventId && (
                <Suspense fallback={<TabSpinner />}>
                  <HighlightsTab eventId={data.eventMeta.eventId} />
                </Suspense>
              )}

              {tab === 'raw' && (
                <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 overflow-auto max-h-[60vh]">
                  {JSON.stringify(data.raw, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Teams Tab ──────────────────────────────────────────────

function TeamsTab({
  teamStats,
  loading,
  error,
  onRetry,
}: {
  teamStats: TeamStatsResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-7 h-7 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="mt-2 text-gray-400 text-sm">Takim istatistikleri yukleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm text-red-300">
        <p>{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 px-3 py-1.5 bg-red-700 text-white rounded hover:bg-red-600 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  if (!teamStats) {
    return <p className="text-gray-400 text-sm">Takim verisi bekleniyor...</p>;
  }

  return (
    <div className="space-y-6">
      <StandingsCompare home={teamStats.homeTeam} away={teamStats.awayTeam} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RecentFormCard title={teamStats.homeTeam.name} matches={teamStats.homeTeam.recentMatches} />
        <RecentFormCard title={teamStats.awayTeam.name} matches={teamStats.awayTeam.recentMatches} />
      </div>

      <H2HSection matches={teamStats.h2hMatches} />
    </div>
  );
}

function StandingsCompare({
  home,
  away,
}: {
  home: TeamStatsResponse['homeTeam'];
  away: TeamStatsResponse['awayTeam'];
}) {
  if (!home.standing && !away.standing) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
        <h4 className="text-white font-semibold text-sm mb-2">Puan Durumu</h4>
        <p className="text-gray-400 text-sm">Puan durumu verisi bulunamadi.</p>
      </div>
    );
  }

  const cols = ['Sira', 'O', 'G', 'B', 'M', 'AG', 'YG', 'Av', 'P'];

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white font-semibold text-sm">
        Puan Durumu Karsilastirmasi
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-gray-400 bg-gray-900/40">
              <th className="px-3 py-2 text-left">Takim</th>
              {cols.map((c) => (
                <th key={c} className="px-2 py-2 text-center">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[home, away].map((team) => {
              const s = team.standing;
              if (!s) {
                return (
                  <tr key={team.id} className="border-t border-gray-700/70">
                    <td className="px-3 py-2 text-gray-200 font-medium">{team.name}</td>
                    <td colSpan={cols.length} className="px-3 py-2 text-gray-500 text-center">-</td>
                  </tr>
                );
              }
              return (
                <tr key={team.id} className="border-t border-gray-700/70">
                  <td className="px-3 py-2 text-gray-200 font-medium">{team.name}</td>
                  <td className="px-2 py-2 text-center text-emerald-400 font-bold">{s.position}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.played}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.won}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.drawn}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.lost}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.goalsFor}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.goalsAgainst}</td>
                  <td className="px-2 py-2 text-center text-gray-200">{s.goalDifference}</td>
                  <td className="px-2 py-2 text-center text-white font-bold">{s.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecentFormCard({ title, matches }: { title: string; matches: RecentMatch[] }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white font-semibold text-sm">
        {title} - Son Maclar
      </div>
      {matches.length === 0 ? (
        <p className="px-3 py-3 text-gray-400 text-sm">Son mac verisi yok.</p>
      ) : (
        <>
          <div className="px-3 py-2 flex gap-1.5">
            {matches.map((m) => (
              <span
                key={m.eventId}
                className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold ${formBadgeClass(m.result)}`}
                title={`${m.homeTeam} ${m.homeScore ?? '?'}-${m.awayScore ?? '?'} ${m.awayTeam}`}
              >
                {m.result === 'W' ? 'G' : m.result === 'D' ? 'B' : 'M'}
              </span>
            ))}
          </div>
          <div className="max-h-[30vh] overflow-auto">
            <table className="w-full text-xs">
              <tbody>
                {matches.map((m) => (
                  <tr key={m.eventId} className="border-t border-gray-700/70">
                    <td className="px-3 py-1.5 text-gray-500">{formatShortDate(m.date)}</td>
                    <td className="px-2 py-1.5 text-gray-200 text-right truncate max-w-[100px]">{m.homeTeam}</td>
                    <td className="px-2 py-1.5 text-center text-white font-medium whitespace-nowrap">
                      {m.homeScore ?? '?'}-{m.awayScore ?? '?'}
                    </td>
                    <td className="px-2 py-1.5 text-gray-200 truncate max-w-[100px]">{m.awayTeam}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${formBadgeClass(m.result)}`}>
                        {m.result === 'W' ? 'G' : m.result === 'D' ? 'B' : 'M'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function H2HSection({ matches }: { matches: H2HMatch[] }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white font-semibold text-sm">
        Karsilikli Maclar
      </div>
      {matches.length === 0 ? (
        <p className="px-3 py-3 text-gray-400 text-sm">Karsilikli mac verisi bulunamadi.</p>
      ) : (
        <div className="overflow-x-auto max-h-[40vh] overflow-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400 bg-gray-900/40">
                <th className="px-3 py-2 text-left">Tarih</th>
                <th className="px-3 py-2 text-right">Ev Sahibi</th>
                <th className="px-3 py-2 text-center">Skor</th>
                <th className="px-3 py-2 text-left">Deplasman</th>
                <th className="px-3 py-2 text-left">Turnuva</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.eventId} className="border-t border-gray-700/70">
                  <td className="px-3 py-2 text-gray-500">{formatShortDate(m.date)}</td>
                  <td className="px-3 py-2 text-right text-gray-200">{m.homeTeam}</td>
                  <td className="px-3 py-2 text-center text-white font-medium whitespace-nowrap">
                    {m.homeScore ?? '?'} - {m.awayScore ?? '?'}
                  </td>
                  <td className="px-3 py-2 text-gray-200">{m.awayTeam}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs truncate max-w-[120px]">{m.tournament}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Existing tabs ──────────────────────────────────────────

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded p-2">
      <div className="text-gray-400 text-[10px] sm:text-xs">{label}</div>
      <div className="text-white text-xs sm:text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

function groupStatsByPeriod(groups: MatchIntelStatisticsGroup[]): Record<string, MatchIntelStatisticsGroup[]> {
  const output: Record<string, MatchIntelStatisticsGroup[]> = {};
  for (const group of groups) {
    if (!output[group.period]) {
      output[group.period] = [];
    }
    output[group.period].push(group);
  }
  return output;
}

function StatsTab({ groupedStats }: { groupedStats: Record<string, MatchIntelStatisticsGroup[]> }) {
  const periods = Object.keys(groupedStats);
  if (periods.length === 0) {
    return <p className="text-gray-400 text-sm">Istatistik verisi bulunamadi.</p>;
  }

  return (
    <div className="space-y-4">
      {periods.map((period) => (
        <div key={period}>
          <h4 className="text-emerald-400 font-semibold mb-2 text-sm">Periyot: {period}</h4>
          <div className="space-y-3">
            {groupedStats[period].map((group, index) => (
              <div key={`${group.groupName}-${index}`} className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-700 text-white text-sm font-medium">
                  {group.groupName}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-gray-400 bg-gray-900/40">
                        <th className="px-3 py-2 text-left">Istatistik</th>
                        <th className="px-3 py-2 text-right">Ev</th>
                        <th className="px-3 py-2 text-right">Dep</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item, itemIndex) => (
                        <tr key={`${item.name}-${itemIndex}`} className="border-t border-gray-700/70">
                          <td className="px-3 py-2 text-gray-200">{item.name}</td>
                          <td className="px-3 py-2 text-right text-gray-200">{stringifyValue(item.home)}</td>
                          <td className="px-3 py-2 text-right text-gray-200">{stringifyValue(item.away)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupsTab({ rawLineups }: { rawLineups: any }) {
  const homePlayers = Array.isArray(rawLineups?.home?.players) ? rawLineups.home.players : [];
  const awayPlayers = Array.isArray(rawLineups?.away?.players) ? rawLineups.away.players : [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PlayerListCard title="Ev Sahibi Kadro" players={homePlayers} />
      <PlayerListCard title="Deplasman Kadro" players={awayPlayers} />
    </div>
  );
}

function PlayerListCard({ title, players }: { title: string; players: any[] }) {
  if (players.length === 0) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
        <h4 className="text-white font-semibold mb-2">{title}</h4>
        <p className="text-gray-400 text-sm">Kadro verisi yok.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white font-semibold text-sm">{title}</div>
      <div className="max-h-[42vh] overflow-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-gray-400">
              <th className="px-3 py-2 text-left">Oyuncu</th>
              <th className="px-3 py-2 text-center">Poz.</th>
              <th className="px-3 py-2 text-center">Rol</th>
            </tr>
          </thead>
          <tbody>
            {players.map((row, idx) => {
              const player = row?.player || {};
              return (
                <tr key={`${player?.id || player?.name || idx}`} className="border-t border-gray-700/70">
                  <td className="px-3 py-2 text-gray-200">{player?.name || '-'}</td>
                  <td className="px-3 py-2 text-center text-gray-300">{player?.position || '-'}</td>
                  <td className="px-3 py-2 text-center text-gray-300">{row?.substitute ? 'Yedek' : 'Ilk 11'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AbsenteesTab({ absentees }: { absentees: MatchIntelAbsentee[] }) {
  if (absentees.length === 0) {
    return <p className="text-gray-400 text-sm">Sakat/ceza verisi bulunamadi.</p>;
  }

  const home = absentees.filter((item) => item.side === 'home');
  const away = absentees.filter((item) => item.side === 'away');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AbsenteeListCard title="Ev Sahibi" items={home} />
      <AbsenteeListCard title="Deplasman" items={away} />
    </div>
  );
}

function AbsenteeListCard({ title, items }: { title: string; items: MatchIntelAbsentee[] }) {
  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white font-semibold text-sm">{title}</div>
      {items.length === 0 ? (
        <p className="px-3 py-3 text-gray-400 text-sm">Kayit yok.</p>
      ) : (
        <div className="max-h-[42vh] overflow-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="text-gray-400">
                <th className="px-3 py-2 text-left">Oyuncu</th>
                <th className="px-3 py-2 text-left">Durum</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={`${item.playerId || item.playerName}-${idx}`} className="border-t border-gray-700/70">
                  <td className="px-3 py-2 text-gray-200">
                    <div>{item.playerName || '-'}</div>
                    {item.description && <div className="text-[11px] text-gray-400">{item.description}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-1 rounded ${statusClass(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CardsTab({ cards }: { cards: MatchIntelCardIncident[] }) {
  if (cards.length === 0) {
    return <p className="text-gray-400 text-sm">Kart olayi bulunamadi.</p>;
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-gray-400 bg-gray-900/40">
              <th className="px-3 py-2 text-left">Dakika</th>
              <th className="px-3 py-2 text-left">Takim</th>
              <th className="px-3 py-2 text-left">Oyuncu</th>
              <th className="px-3 py-2 text-left">Kart</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, idx) => (
              <tr key={`${card.id || idx}-${idx}`} className="border-t border-gray-700/70">
                <td className="px-3 py-2 text-gray-200">
                  {formatMinute(card.minute, card.addedTime)}
                </td>
                <td className="px-3 py-2 text-gray-200">{teamLabel(card.team)}</td>
                <td className="px-3 py-2 text-gray-200">{card.playerName || '-'}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-1 rounded ${cardClass(card.cardType)}`}>
                    {cardLabel(card.cardType)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabSpinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────

function stringifyValue(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatMinute(minute: number | null, addedTime: number | null): string {
  if (minute === null) return '-';
  if (addedTime !== null && addedTime > 0 && addedTime < 90) {
    return `${minute}+${addedTime}`;
  }
  return `${minute}`;
}

function teamLabel(team: 'home' | 'away' | 'unknown'): string {
  if (team === 'home') return 'Ev';
  if (team === 'away') return 'Dep';
  return '-';
}

function statusClass(status: string): string {
  if (status === 'injury') return 'bg-red-900/40 text-red-300 border border-red-700/50';
  if (status === 'suspension') return 'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50';
  if (status === 'missing') return 'bg-gray-700 text-gray-200 border border-gray-600';
  return 'bg-gray-700 text-gray-200 border border-gray-600';
}

function statusLabel(status: string): string {
  if (status === 'injury') return 'Sakat';
  if (status === 'suspension') return 'Karti/Ceza';
  if (status === 'missing') return 'Eksik';
  return 'Bilinmiyor';
}

function cardClass(cardType: string): string {
  if (cardType === 'yellow') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-600/40';
  if (cardType === 'red') return 'bg-red-500/20 text-red-300 border border-red-600/40';
  if (cardType === 'second_yellow') return 'bg-orange-500/20 text-orange-300 border border-orange-600/40';
  return 'bg-gray-700 text-gray-200 border border-gray-600';
}

function cardLabel(cardType: string): string {
  if (cardType === 'yellow') return 'Sari';
  if (cardType === 'red') return 'Kirmizi';
  if (cardType === 'second_yellow') return '2. Sari';
  return 'Kart';
}

function formBadgeClass(result: 'W' | 'D' | 'L'): string {
  if (result === 'W') return 'bg-emerald-500/30 text-emerald-300 border border-emerald-600/40';
  if (result === 'D') return 'bg-yellow-500/20 text-yellow-300 border border-yellow-600/40';
  return 'bg-red-500/20 text-red-300 border border-red-600/40';
}

function formatShortDate(isoDate: string): string {
  if (!isoDate) return '-';
  try {
    const d = new Date(isoDate);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '-';
  }
}


