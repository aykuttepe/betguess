import { useState, useEffect, useCallback } from 'react';
import { fetchTeamValues, fetchLeagues } from '../lib/football-api';
import { TeamValuesData, LeagueInfo } from '../lib/football-types';
import { fetchFallbackAnalysis, fetchTransferAnalysis } from '../lib/ai-api';
import AiPanel from '../components/AiPanel';

export default function TeamValuesPage() {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('super-lig');
  const [data, setData] = useState<TeamValuesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
  }, []);

  const load = useCallback(async (league: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTeamValues(league));
    } catch (err: any) {
      setError(err.message || 'Takim degerleri yuklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedLeague);
  }, [selectedLeague, load]);

  return (
    <>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h2 className="text-lg sm:text-xl font-bold text-white">Takim Degerleri</h2>
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

      {loading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-400">Takim degerleri yukleniyor...</p>
        </div>
      )}

      {error && !loading && (
        <div className="space-y-4">
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
            <p className="text-red-400 font-medium">{error}</p>
            <button
              onClick={() => load(selectedLeague)}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              Tekrar Dene
            </button>
          </div>
          <AiPanel
            title="AI Yardimi - Takim Degerleri"
            autoLoad
            fetchFn={() => fetchFallbackAnalysis(`${selectedLeague} ligi takim degerleri ve piyasa bilgileri`, error)}
          />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="text-center py-2 text-sm text-gray-400 border-b border-gray-700">{data.leagueLabel}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">#</th>
                    <th className="px-2 sm:px-3 py-3 text-left">Takim</th>
                    <th className="px-2 sm:px-3 py-3 text-center">Kadro</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">Ort. Yas</th>
                    <th className="px-3 py-3 text-center hidden sm:table-cell">Yabanci</th>
                    <th className="px-2 sm:px-3 py-3 text-right">Toplam Deger</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teams.map((team, idx) => (
                    <tr key={team.team} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="px-2 sm:px-3 py-2 text-center text-emerald-400 font-bold">{idx + 1}</td>
                      <td className="px-2 sm:px-3 py-2 text-white font-medium truncate max-w-[120px] sm:max-w-none">{team.team}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-gray-300">{team.squadSize}</td>
                      <td className="px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{team.avgAge > 0 ? team.avgAge.toFixed(1) : '-'}</td>
                      <td className="px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{team.foreignPlayers}</td>
                      <td className="px-2 sm:px-3 py-2 text-right font-bold text-emerald-400">{team.totalValue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-right px-4 py-2 text-xs text-gray-500 border-t border-gray-700">
              Kaynak: Football API | {new Date(data.fetchedAt).toLocaleString('tr-TR')}
            </div>
          </div>

          <div className="mt-6">
            <AiPanel
              title={`AI Transfer Analizi - ${data.leagueLabel}`}
              buttonLabel={`${data.leagueLabel} Transfer Analizi`}
              fetchFn={() => fetchTransferAnalysis(data.leagueLabel, data.teams)}
            />
          </div>
        </>
      )}
    </>
  );
}
