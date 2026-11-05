import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchTeamList, fetchTeamDetail, fetchLeagues, refreshTeamDetail } from '../lib/football-api';
import { TeamListItem, TeamDetail, LeagueInfo, PlayerStats } from '../lib/football-types';
import { fetchTeamAnalysis, fetchFallbackAnalysis } from '../lib/ai-api';
import AiPanel from '../components/AiPanel';
import PlayerDetailModal from '../components/PlayerDetailModal';

type SortKey = 'name' | 'appearances' | 'goals' | 'assists' | 'yellowCards' | 'redCards' | 'minutesPlayed';

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function valueOrDash(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function statusLabel(status?: PlayerStats['status'] | null): string {
  if (status === 'injury') return 'Sakat';
  if (status === 'suspension') return 'Cezali';
  if (status === 'doubtful') return 'Supheli';
  if (status === 'unknown') return 'Belirsiz';
  return '';
}

function statusClass(status?: PlayerStats['status'] | null): string {
  if (status === 'injury') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (status === 'suspension') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30';
  if (status === 'doubtful') return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
  return 'bg-gray-500/15 text-gray-300 border-gray-500/30';
}

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
    if (!teamId) {
      return;
    }

    let cancelled = false;

    async function loadFromQuery() {
      setLoadingDetail(true);
      setError(null);

      const fallbackTeam = { teamId: teamId!, name: slug || teamId!, teamSlug: slug } as TeamListItem;
      setSelectedTeam(fallbackTeam);

      try {
        const availableLeagues = await fetchLeagues().catch(() => []);
        const leagueIds = [
          'super-lig',
          ...availableLeagues.map((league) => league.id).filter((leagueId) => leagueId !== 'super-lig'),
        ];
        const targetSlug = normalizeKey(slug);

        for (const leagueId of leagueIds) {
          const leagueTeams = await fetchTeamList(leagueId).catch(() => []);
          const matchedTeam = leagueTeams.find((team) => {
            const teamSlug = normalizeKey(team.teamSlug || '');
            const teamName = normalizeKey(team.name || '');
            const targetId = String(teamId);
            return (
              team.teamId === targetId ||
              (!!targetSlug && (
                (!!teamSlug && (teamSlug.includes(targetSlug) || targetSlug.includes(teamSlug))) ||
                teamName.includes(targetSlug)
              ))
            );
          });

          if (matchedTeam) {
            if (cancelled) return;
            setSelectedLeague(leagueId);
            setSelectedTeam(matchedTeam);
            setDetail(await fetchTeamDetail(matchedTeam.teamId, matchedTeam.teamSlug, leagueId));
            return;
          }
        }

        if (cancelled) return;
        setDetail(await fetchTeamDetail(fallbackTeam.teamId, fallbackTeam.teamSlug, 'super-lig'));
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message);
          setDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadFromQuery();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTeams = useCallback(async (league: string) => {
    setLoadingTeams(true);
    setError(null);
    if (!searchParams.get('teamId')) {
      setSelectedTeam(null);
      setDetail(null);
    }
    try {
      setTeams(await fetchTeamList(league));
    } catch (err: any) {
      setError(err.message);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, [searchParams]);

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
    unavailableCount: detail.unavailablePlayers?.length || detail.players.filter((player) => player.status || player.currentInjury).length,
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
          <TeamProfileSummary detail={detail} />

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
            <StatCard label="Takim" value={detail.teamName} accent />
            <StatCard label="Kadro" value={detail.squadSize.toString()} />
            <StatCard label="Ort. Yas" value={detail.avgAge > 0 ? detail.avgAge.toFixed(1) : '-'} />
            <StatCard label="Yabanci" value={(detail.foreignPlayers || 0).toString()} />
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
            <StatCard label="Sakat/Cezali" value={teamStats.unavailableCount.toString()} danger={teamStats.unavailableCount > 0} />
            {teamStats.topScorer && teamStats.topScorer.goals > 0 && (
              <StatCard label="Gol Krali" value={`${teamStats.topScorer.name} (${teamStats.topScorer.goals})`} accent />
            )}
            {teamStats.topAssist && teamStats.topAssist.assists > 0 && (
              <StatCard label="Asist Krali" value={`${teamStats.topAssist.name} (${teamStats.topAssist.assists})`} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <BreakdownSection title="Pozisyon Dagilimi" items={detail.positionBreakdown || []} />
            <BreakdownSection title="Yas Dagilimi" items={detail.ageBreakdown || []} />
            <TopPlayersSection detail={detail} />
            <UnavailableSection detail={detail} />
            <MatchesSection title="Son Maclar" matches={detail.recentMatches || []} />
            <MatchesSection title="Gelecek Maclar" matches={detail.nextMatches || []} />
            <TransfersSection detail={detail} />
          </div>

          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">#</th>
                    <SortHeader label="Oyuncu" field="name" className="text-left" />
                    <th className="px-2 sm:px-3 py-3 text-center hidden sm:table-cell">Pozisyon</th>
                    <th className="px-2 sm:px-3 py-3 text-center hidden md:table-cell">Deger</th>
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
                  data-feedback="Kadro verisi yenileniyor..."
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

function TeamProfileSummary({ detail }: { detail: TeamDetail }) {
  const infoItems = ([
    ['Lig', detail.leagueLabel],
    ['Ulke', detail.country || detail.teamCountry],
    ['Teknik direktor', detail.coach],
    ['Stadyum', detail.stadium],
    ['Kurulus', detail.foundedYear],
  ] as Array<[string, string | undefined]>).filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 mb-4">
      <div className="flex items-center gap-4">
        {detail.logoUrl && (
          <img
            src={detail.logoUrl}
            alt={detail.teamName}
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain bg-white rounded p-1"
            loading="lazy"
          />
        )}
        <div className="min-w-0">
          <h3 className="text-lg sm:text-2xl font-bold text-white truncate">{detail.teamName}</h3>
          <div className="flex flex-wrap gap-2 mt-2">
            {infoItems.map(([label, value]) => (
              <span key={label} className="text-xs px-2 py-1 rounded border border-gray-600 bg-gray-900/40 text-gray-300">
                <span className="text-gray-500">{label}: </span>{value}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionPanel({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`bg-gray-800/50 rounded-lg border border-gray-700 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {children}
    </section>
  );
}

function EmptyState() {
  return <p className="text-sm text-gray-500">Veri yok</p>;
}

function BreakdownSection({ title, items }: { title: string; items: TeamDetail['positionBreakdown'] }) {
  if (!items.length) {
    return (
      <SectionPanel title={title}>
        <EmptyState />
      </SectionPanel>
    );
  }

  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  return (
    <SectionPanel title={title}>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs text-gray-300 mb-1">
              <span>{item.label}</span>
              <span>{item.count}</span>
            </div>
            <div className="h-1.5 rounded bg-gray-700 overflow-hidden">
              <div className="h-full bg-emerald-500" style={{ width: `${Math.max(8, (item.count / total) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}

function TopPlayersSection({ detail }: { detail: TeamDetail }) {
  const players = detail.topPlayersByValue || [];
  return (
    <SectionPanel title="En Degerli Oyuncular">
      {players.length === 0 ? <EmptyState /> : (
        <div className="space-y-2">
          {players.map((player) => (
            <div key={`${player.name}-${player.marketValue}`} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-white truncate">{player.name}</div>
                <div className="text-xs text-gray-500 truncate">{valueOrDash(player.position)}{player.age ? ` | ${player.age}` : ''}</div>
              </div>
              <span className="text-emerald-400 font-semibold whitespace-nowrap">{player.marketValue}</span>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function UnavailableSection({ detail }: { detail: TeamDetail }) {
  const unavailable = detail.unavailablePlayers || [];
  return (
    <SectionPanel title="Sakat/Cezali Oyuncular">
      {unavailable.length === 0 ? <EmptyState /> : (
        <div className="space-y-2">
          {unavailable.map((player) => (
            <div key={`${player.playerName}-${player.status}`} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="text-white truncate">{player.playerName}</div>
                <div className="text-xs text-gray-500 truncate">{player.reason || 'Detay yok'}</div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${statusClass(player.status)}`}>
                {statusLabel(player.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function MatchesSection({ title, matches }: { title: string; matches: TeamDetail['recentMatches'] }) {
  return (
    <SectionPanel title={title}>
      {matches.length === 0 ? <EmptyState /> : (
        <div className="space-y-2">
          {matches.slice(0, 5).map((match, idx) => (
            <div key={`${match.eventId || idx}-${match.homeTeam}-${match.awayTeam}`} className="text-sm text-gray-300">
              <div className="flex items-center gap-2 text-white min-w-0">
                <span className="truncate">{match.homeTeam}</span>
                {match.homeScore !== null && match.homeScore !== undefined && match.awayScore !== null && match.awayScore !== undefined ? (
                  <span className="shrink-0 rounded bg-gray-900/70 border border-gray-600 px-2 py-0.5 font-bold text-emerald-300">
                    {match.homeScore}:{match.awayScore}
                  </span>
                ) : (
                  <span className="shrink-0 text-gray-500">-</span>
                )}
                <span className="truncate">{match.awayTeam}</span>
              </div>
              <div className="text-xs text-gray-500">{[match.tournament, match.date, match.status].filter(Boolean).join(' | ')}</div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
  );
}

function TransfersSection({ detail }: { detail: TeamDetail }) {
  const transfers = detail.transfers || [];
  return (
    <SectionPanel title="Transferler" className="lg:col-span-2">
      {transfers.length === 0 ? <EmptyState /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {transfers.slice(0, 8).map((transfer, idx) => (
            <div key={`${transfer.playerName}-${idx}`} className="text-sm text-gray-300">
              <div className="text-white truncate">{transfer.playerName}</div>
              <div className="text-xs text-gray-500 truncate">
                {[transfer.fromTeam, transfer.toTeam, transfer.fee, transfer.date].filter(Boolean).join(' | ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionPanel>
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
  const playerStatus = player.status || (player.currentInjury ? 'injury' : null);

  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={onClick}>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-500 text-xs">{idx + 1}</td>
      <td className="px-2 sm:px-3 py-2 text-white font-medium">
        <div className="flex items-center gap-2 min-w-0">
          {player.shirtNumber && <span className="text-[10px] text-gray-500 w-5 shrink-0">#{player.shirtNumber}</span>}
          <span className="truncate">{player.name}</span>
          {playerStatus && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${statusClass(playerStatus)}`} title={player.statusReason || player.currentInjury || ''}>
              {statusLabel(playerStatus)}
            </span>
          )}
        </div>
      </td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">{player.position || '-'}</span>
      </td>
      <td className="px-2 sm:px-3 py-2 text-center text-emerald-400 hidden md:table-cell">{player.marketValue || '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-300">{player.appearances || '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center font-bold text-emerald-400">{player.goals > 0 ? player.goals : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center text-blue-400">{player.assists > 0 ? player.assists : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">{player.yellowCards > 0 ? player.yellowCards : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center hidden sm:table-cell">{(player.redCards + player.secondYellows) > 0 ? player.redCards + player.secondYellows : '-'}</td>
      <td className="px-2 sm:px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{player.minutesPlayed > 0 ? player.minutesPlayed.toLocaleString('tr-TR') : '-'}</td>
    </tr>
  );
}
