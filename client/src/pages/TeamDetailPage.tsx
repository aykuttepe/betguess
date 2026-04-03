import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTeamList, fetchTeamDetail, fetchLeagues, refreshTeamDetail } from '../lib/football-api';
import { TeamListItem, TeamDetail, LeagueInfo, PlayerStats } from '../lib/football-types';
import { fetchTeamAnalysis, fetchFallbackAnalysis } from '../lib/ai-api';
import AiPanel from '../components/AiPanel';
import PlayerDetailModal from '../components/PlayerDetailModal';

type SortKey = 'name' | 'appearances' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'minutesPlayed';

export default function TeamDetailPage() {
  const [searchParams] = useSearchParams();
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('super-lig');
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamListItem | null>(null);
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('appearances');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
  }, []);

  // URL'den doğrudan takım yükleme (arama sayfasından gelince)
  useEffect(() => {
    const teamId = searchParams.get('teamId');
    const slug = searchParams.get('slug') || '';
    if (teamId) {
      setLoadingDetail(true);
      setError(null);
      setSelectedTeam({ teamId, name: slug || teamId, teamSlug: slug } as TeamListItem);
      fetchTeamDetail(teamId, slug, 'super-lig')
        .then(setDetail)
        .catch((err: any) => { setError(err.message); setDetail(null); })
        .finally(() => setLoadingDetail(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = useCallback(async (league: string) => {
    setLoadingTeams(true);
    setError(null);
    setSelectedTeam(null);
    setDetail(null);
    try {
      setTeams(await fetchTeamList(league));
    } catch (err: any) {
      setError(err.message);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  useEffect(() => {
    loadTeams(selectedLeague);
  }, [selectedLeague, loadTeams]);

  const loadDetail = useCallback(async (team: TeamListItem) => {
    setLoadingDetail(true);
    setError(null);
    try {
      setDetail(await fetchTeamDetail(team.teamId, team.teamSlug, selectedLeague));
    } catch (err: any) {
      setError(err.message);
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedLeague]);

  const handleTeamSelect = (team: TeamListItem) => {
    setSelectedTeam(team);
    loadDetail(team);
  };

  const handleRefresh = useCallback(async () => {
    if (!selectedTeam) return;
    setLoadingDetail(true);
    setError(null);
    try {
      setDetail(await refreshTeamDetail(selectedTeam.teamId, selectedTeam.teamSlug, selectedLeague));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedTeam, selectedLeague]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortedPlayers = detail?.players ? [...detail.players].sort((a, b) => {
    const valA = a[sortKey];
    const valB = b[sortKey];
    if (typeof valA === 'string') {
      return sortAsc ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
    }
    return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  }) : [];

  const SortHeader = ({ label, field, className = '', hideOnMobile }: { label: string; field: SortKey; className?: string; hideOnMobile?: boolean }) => (
    <th
      className={`px-2 sm:px-3 py-3 text-center cursor-pointer hover:text-emerald-400 transition-colors select-none ${hideOnMobile ? 'hidden sm:table-cell' : ''} ${className}`}
      onClick={() => handleSort(field)}
    >
      {label} {sortKey === field ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  const teamStats = detail ? {
    totalGoals: detail.players.reduce((s, p) => s + p.goals, 0),
    totalAssists: detail.players.reduce((s, p) => s + p.assists, 0),
    totalYellows: detail.players.reduce((s, p) => s + p.yellowCards, 0),
    totalReds: detail.players.reduce((s, p) => s + p.redCards + p.secondYellows, 0),
    topScorer: detail.players.length > 0 ? detail.players.reduce((best, p) => p.goals > best.goals ? p : best, detail.players[0]) : null,
    topAssist: detail.players.length > 0 ? detail.players.reduce((best, p) => p.assists > best.assists ? p : best, detail.players[0]) : null,
  } : null;

  return (
    <>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg sm:text-xl font-bold text-white">Takim Detay</h2>
        <div className="flex gap-2 flex-wrap">
          {leagues.map((league) => (
            <button
              key={league.id}
              onClick={() => setSelectedLeague(league.id)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${selectedLeague === league.id
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {league.label}
            </button>
          ))}
        </div>
      </div>

      {loadingTeams ? (
        <div className="text-center py-8">
          <div className="inline-block w-6 h-6 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-gray-400 text-sm">Takimlar yukleniyor...</p>
        </div>
      ) : teams.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-1.5 sm:gap-2 flex-wrap">
            {teams.map((team) => (
              <button
                key={team.teamId}
                onClick={() => handleTeamSelect(team)}
                className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded text-xs sm:text-sm transition-all ${selectedTeam?.teamId === team.teamId
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-gray-700/60 text-gray-300 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {team.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && !loadingDetail && (
        <div className="space-y-4 mb-4">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
          {selectedTeam && (
            <AiPanel
              title={`AI Yardimi - ${selectedTeam.name}`}
              autoLoad
              fetchFn={() => fetchFallbackAnalysis(`${selectedTeam.name} takiminin ${selectedLeague} ligindeki oyuncu istatistikleri`, error)}
            />
          )}
        </div>
      )}

      {loadingDetail && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Oyuncu istatistikleri yukleniyor...</p>
        </div>
      )}

      {detail && !loadingDetail && teamStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
            <StatCard label="Takim" value={detail.teamName} accent />
            <StatCard label="Kadro" value={detail.squadSize.toString()} />
            <StatCard label="Ort. Yas" value={detail.avgAge > 0 ? detail.avgAge.toFixed(1) : '-'} />
            <StatCard label="Toplam Deger" value={detail.totalValue} accent />
            <StatCard label="Toplam Gol" value={teamStats.totalGoals.toString()} />
            <StatCard label="Toplam Asist" value={teamStats.totalAssists.toString()} />
            {detail.totalMatches > 0 && (
              <>
                <StatCard label="Toplam Mac" value={detail.totalMatches.toString()} />
                <StatCard label="Puan/Mac" value={detail.pointsPerGame.toFixed(2)} />
              </>
            )}
            <StatCard label="Sari Kart" value={teamStats.totalYellows.toString()} warn />
            <StatCard label="Kirmizi Kart" value={teamStats.totalReds.toString()} danger />
            {teamStats.topScorer && teamStats.topScorer.goals > 0 && (
              <StatCard label="Gol Krali" value={`${teamStats.topScorer.name} (${teamStats.topScorer.goals})`} accent />
            )}
            {teamStats.topAssist && teamStats.topAssist.assists > 0 && (
              <StatCard label="Asist Krali" value={`${teamStats.topAssist.name} (${teamStats.topAssist.assists})`} />
            )}
          </div>

          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">#</th>
                    <SortHeader label="Oyuncu" field="name" className="text-left" />
                    <th className="px-2 sm:px-3 py-3 text-center hidden sm:table-cell">Pozisyon</th>
                    <SortHeader label="Mac" field="appearances" />
                    <SortHeader label="Gol" field="goals" />
                    <SortHeader label="Asist" field="assists" />
                    <SortHeader label="Sari" field="yellowCards" hideOnMobile />
                    <SortHeader label="Kirmizi" field="redCards" hideOnMobile />
                    <SortHeader label="Dakika" field="minutesPlayed" hideOnMobile />
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player, idx) => (
                    <PlayerRow key={player.name + idx} player={player} idx={idx} onClick={() => setSelectedPlayer(player)} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 border-t border-gray-700 flex-wrap gap-2">
              <span>Oyuncuya tikla | detay</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={loadingDetail}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors underline"
                >
                  Kadroyu Yenile
                </button>
                <span>Kaynak: Football API | {new Date(detail.fetchedAt).toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <AiPanel
              title={`AI Takim Analizi - ${detail.teamName}`}
              buttonLabel={`${detail.teamName} AI Analizi`}
              fetchFn={() => fetchTeamAnalysis(detail.teamName, detail.leagueLabel)}
            />
          </div>
        </>
      )}

      {!selectedTeam && !loadingTeams && teams.length > 0 && (
        <div className="text-center py-16 text-gray-500">
          <p>Detaylarini gormek icin yukaridan bir takim secin</p>
        </div>
      )}

      {selectedPlayer && (
        <PlayerDetailModal player={selectedPlayer} onClose={() => setSelectedPlayer(null)} />
      )}
    </>
  );
}

function StatCard({ label, value, accent, warn, danger }: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
  danger?: boolean;
}) {
  let valueColor = 'text-white';
  if (accent) valueColor = 'text-emerald-400';
  if (warn) valueColor = 'text-yellow-400';
  if (danger) valueColor = 'text-red-400';

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-2 sm:p-3">
      <div className="text-[10px] sm:text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xs sm:text-sm font-bold ${valueColor} truncate`}>{value}</div>
    </div>
  );
}

function PlayerRow({ player, idx, onClick }: { player: PlayerStats; idx: number; onClick: () => void }) {
  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={onClick}>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-500 text-xs">{idx + 1}</td>
      <td className="px-2 sm:px-3 py-2 text-white font-medium">{player.name}</td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{player.position || '-'}</span>
      </td>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-300">{player.appearances || '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center font-bold text-emerald-400">{player.goals > 0 ? player.goals : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center text-blue-400">{player.assists > 0 ? player.assists : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">{player.yellowCards > 0 ? player.yellowCards : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">{(player.redCards + player.secondYellows) > 0 ? player.redCards + player.secondYellows : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{player.minutesPlayed > 0 ? player.minutesPlayed.toLocaleString('tr-TR') : '-'}</td>
    </tr>
  );
}

