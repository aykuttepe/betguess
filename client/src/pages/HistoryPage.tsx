import { useState, useEffect, useCallback } from 'react';
import {
  HistoryAnalysis,
  DistributionStats,
  KolonFilters,
  HistoricalProgram,
} from '../lib/types';
import { fetchHistoryAnalysis } from '../lib/history-api';

const SUGGESTED_FILTERS_KEY = 'betguess_suggested_filters';

function StatCard({
  label,
  color,
  stats,
}: {
  label: string;
  color: string;
  stats: DistributionStats;
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className={`text-sm font-bold mb-2 ${color}`}>{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-gray-400">Ortalama</span>
        <span className="text-white font-medium">{stats.avg}</span>
        <span className="text-gray-400">Min - Max</span>
        <span className="text-white font-medium">
          {stats.min} - {stats.max}
        </span>
        <span className="text-gray-400">Medyan</span>
        <span className="text-white font-medium">{stats.median}</span>
        <span className="text-gray-400">Std Sapma</span>
        <span className="text-white font-medium">{stats.stdDev}</span>
      </div>
    </div>
  );
}

function SuggestedFiltersCard({
  filters,
  onApply,
}: {
  filters: KolonFilters;
  onApply: () => void;
}) {
  return (
    <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-emerald-400 font-bold text-sm">
          Onerilen Filtreler
        </h3>
        <button
          onClick={onApply}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Kolon Sayfasina Uygula
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <span className="text-green-400 text-xs font-medium">
            Ev Sahibi (1)
          </span>
          <div className="text-white">
            {filters.min1} - {filters.max1}
          </div>
        </div>
        <div>
          <span className="text-yellow-400 text-xs font-medium">
            Beraberlik (X)
          </span>
          <div className="text-white">
            {filters.minX} - {filters.maxX}
          </div>
        </div>
        <div>
          <span className="text-red-400 text-xs font-medium">
            Deplasman (2)
          </span>
          <div className="text-white">
            {filters.min2} - {filters.max2}
          </div>
        </div>
        <div>
          <span className="text-purple-400 text-xs font-medium">
            Ardisik Limit
          </span>
          <div className="text-white">Max {filters.maxConsecutive}</div>
        </div>
      </div>
    </div>
  );
}

function ProgramRow({ program }: { program: HistoricalProgram }) {
  const outcomes = program.matches.map((m) => m.result);
  return (
    <tr className="border-b border-gray-700/50 hover:bg-gray-800/50">
      <td className="px-3 py-2 text-gray-400 text-xs">{program.programNo}</td>
      <td className="px-3 py-2 text-gray-300 text-xs">
        {program.startDate} - {program.endDate}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-0.5 flex-wrap">
          {outcomes.map((o, i) => (
            <span
              key={i}
              className={`inline-block w-5 h-5 text-[10px] font-bold rounded flex items-center justify-center ${
                o === '1'
                  ? 'bg-green-600/30 text-green-400'
                  : o === 'X'
                    ? 'bg-yellow-600/30 text-yellow-400'
                    : 'bg-red-600/30 text-red-400'
              }`}
            >
              {o}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2 text-green-400 text-xs text-center">
        {program.distribution.count1}
      </td>
      <td className="px-3 py-2 text-yellow-400 text-xs text-center">
        {program.distribution.countX}
      </td>
      <td className="px-3 py-2 text-red-400 text-xs text-center">
        {program.distribution.count2}
      </td>
      <td className="px-3 py-2 text-purple-400 text-xs text-center">
        {program.maxConsecutive}
      </td>
    </tr>
  );
}

export default function HistoryPage() {
  const [analysis, setAnalysis] = useState<HistoryAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [count, setCount] = useState(25);
  const [applied, setApplied] = useState(false);

  const load = useCallback(async (c: number) => {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const data = await fetchHistoryAnalysis(c);
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(count);
  }, [count, load]);

  const handleApply = useCallback(() => {
    if (!analysis) return;
    localStorage.setItem(
      SUGGESTED_FILTERS_KEY,
      JSON.stringify(analysis.suggestedFilters),
    );
    setApplied(true);
  }, [analysis]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">
          Gecmis Sonuc Analizi
        </h1>
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Program sayisi:</label>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600"
          >
            {[10, 25, 50, 100].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <button
            onClick={() => load(count)}
            disabled={loading}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'Yukleniyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !analysis && (
        <div className="text-gray-400 text-center py-12">
          Gecmis sonuclar yukleniyor...
        </div>
      )}

      {analysis && (
        <>
          {/* Info */}
          <div className="text-gray-500 text-xs">
            {analysis.programCount} program analiz edildi ({analysis.analyzedFrom}{' '}
            - {analysis.analyzedTo})
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Ev Sahibi (1)"
              color="text-green-400"
              stats={analysis.distribution.home}
            />
            <StatCard
              label="Beraberlik (X)"
              color="text-yellow-400"
              stats={analysis.distribution.draw}
            />
            <StatCard
              label="Deplasman (2)"
              color="text-red-400"
              stats={analysis.distribution.away}
            />
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-sm font-bold mb-2 text-purple-400">
                Ardisik Limit
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-400">Ortalama</span>
                <span className="text-white font-medium">
                  {analysis.consecutiveStats.avgMax}
                </span>
                <span className="text-gray-400">Min - Max</span>
                <span className="text-white font-medium">
                  {analysis.consecutiveStats.minMax} -{' '}
                  {analysis.consecutiveStats.maxMax}
                </span>
                <span className="text-gray-400">Medyan</span>
                <span className="text-white font-medium">
                  {analysis.consecutiveStats.medianMax}
                </span>
              </div>
            </div>
          </div>

          {/* Suggested Filters */}
          <SuggestedFiltersCard
            filters={analysis.suggestedFilters}
            onApply={handleApply}
          />
          {applied && (
            <div className="text-emerald-400 text-sm">
              Filtreler kaydedildi! Kolon sayfasina gidin ve "Gecmis Veriye Gore
              Oner" butonuna tiklayin.
            </div>
          )}

          {/* History Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-700/50">
                    <th className="px-3 py-2 text-gray-400 text-xs font-medium">
                      #
                    </th>
                    <th className="px-3 py-2 text-gray-400 text-xs font-medium">
                      Tarih
                    </th>
                    <th className="px-3 py-2 text-gray-400 text-xs font-medium">
                      Sonuclar
                    </th>
                    <th className="px-3 py-2 text-green-400 text-xs font-medium text-center">
                      1
                    </th>
                    <th className="px-3 py-2 text-yellow-400 text-xs font-medium text-center">
                      X
                    </th>
                    <th className="px-3 py-2 text-red-400 text-xs font-medium text-center">
                      2
                    </th>
                    <th className="px-3 py-2 text-purple-400 text-xs font-medium text-center">
                      Ard.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.programs.map((p) => (
                    <ProgramRow key={p.programNo} program={p} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
