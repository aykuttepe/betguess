import { useState, useEffect, useCallback } from 'react';
import { fetchStandings, fetchLeagues } from '../lib/football-api';
import { StandingsData, LeagueInfo, FormResult } from '../lib/football-types';
import { fetchFallbackAnalysis, fetchLeagueAnalysis } from '../lib/ai-api';
import AiPanel from '../components/AiPanel';

const FORM_COLORS: Record<FormResult, string> = {
  W: 'bg-green-500',
  D: 'bg-yellow-500',
  L: 'bg-red-500',
};

const FORM_LABELS: Record<FormResult, string> = {
  W: 'G',
  D: 'B',
  L: 'M',
};

function getZoneBorder(position: number, totalTeams: number): string {
  if (position <= 4) return 'border-l-4 border-l-emerald-500';
  if (position > totalTeams - 3) return 'border-l-4 border-l-red-500';
  return 'border-l-4 border-l-transparent';
}

export default function StandingsPage() {
  const [leagues, setLeagues] = useState<LeagueInfo[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('super-lig');
  const [data, setData] = useState<StandingsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeagues().then(setLeagues).catch(() => {});
  }, []);

  const load = useCallback(async (league: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchStandings(league));
    } catch (err: any) {
      setError(err.message || 'Puan durumu yuklenemedi');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedLeague);
  }, [selectedLeague, load]);

  const standingsLeagues = leagues.filter((league) => league.hasStandings);

  return (
    <>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h2 className="text-lg sm:text-xl font-bold text-white">Puan Durumu</h2>
        <div className="flex gap-2 flex-wrap">
          {standingsLeagues.map((league) => (
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
          <p className="mt-4 text-gray-400">Puan durumu yukleniyor...</p>
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
            title="AI Yardimi - Puan Durumu"
            autoLoad
            fetchFn={() => fetchFallbackAnalysis(`${selectedLeague} ligi puan durumu bilgileri`, error)}
          />
        </div>
      )}

      {data && !loading && (
        <>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="text-center py-2 text-sm text-gray-400 border-b border-gray-700">
              {data.leagueLabel}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-gray-800 text-gray-300">
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">#</th>
                    <th className="px-2 sm:px-3 py-3 text-left">Takim</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">O</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">G</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">B</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-8 sm:w-10">M</th>
                    <th className="px-3 py-3 text-center w-12 hidden sm:table-cell">AG</th>
                    <th className="px-3 py-3 text-center w-12 hidden sm:table-cell">YG</th>
                    <th className="px-3 py-3 text-center w-12 hidden sm:table-cell">AV</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-10 sm:w-12 font-bold">P</th>
                    <th className="px-2 sm:px-3 py-3 text-center w-20 sm:w-32">Form</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((row) => (
                    <tr
                      key={row.position}
                      className={`border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors ${getZoneBorder(row.position, data.standings.length)}`}
                    >
                      <td className="px-2 sm:px-3 py-2 text-center text-emerald-400 font-bold">{row.position}</td>
                      <td className="px-2 sm:px-3 py-2 text-white font-medium truncate max-w-[120px] sm:max-w-none">{row.team}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-gray-300">{row.played}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-green-400">{row.won}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-yellow-400">{row.drawn}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-red-400">{row.lost}</td>
                      <td className="px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{row.gf}</td>
                      <td className="px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{row.ga}</td>
                      <td className="px-3 py-2 text-center text-gray-300 hidden sm:table-cell">{row.gd}</td>
                      <td className="px-2 sm:px-3 py-2 text-center text-white font-bold text-sm sm:text-base">{row.points}</td>
                      <td className="px-2 sm:px-3 py-2">
                        <div className="flex gap-0.5 sm:gap-1 justify-center">
                          {row.form.map((f, i) => (
                            <span
                              key={i}
                              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full ${FORM_COLORS[f]} text-white text-[10px] sm:text-xs font-bold flex items-center justify-center`}
                              title={f === 'W' ? 'Galibiyet' : f === 'D' ? 'Beraberlik' : 'Maglubiyet'}
                            >
                              {FORM_LABELS[f]}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 px-4 py-2 text-xs text-gray-500 border-t border-gray-700">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Ust Sira</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Alt Sira</span>
              <span className="ml-auto">Kaynak: Football API | {new Date(data.fetchedAt).toLocaleString('tr-TR')}</span>
            </div>
          </div>

          <div className="mt-6">
            <AiPanel
              title={`AI Lig Analizi - ${data.leagueLabel}`}
              buttonLabel={`${data.leagueLabel} AI Analizi`}
              fetchFn={() => fetchLeagueAnalysis(data.leagueLabel, data.standings)}
            />
          </div>
        </>
      )}
    </>
  );
}
