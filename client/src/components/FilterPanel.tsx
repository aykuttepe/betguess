import { useState, useCallback } from 'react';
import { KolonFilters } from '../lib/types';
import { fetchHistoryAnalysis } from '../lib/history-api';

const SUGGESTED_FILTERS_KEY = 'betguess_suggested_filters';

interface FilterPanelProps {
  filters: KolonFilters;
  onChange: (filters: KolonFilters) => void;
  onReset: () => void;
  filteredCount: number | null; // null = henuz uretilmedi
  totalCount: number | null;
}

export default function FilterPanel({
  filters,
  onChange,
  onReset,
  filteredCount,
  totalCount,
}: FilterPanelProps) {
  const [suggestedFilters, setSuggestedFilters] = useState<KolonFilters | null>(null);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  const handleFetchSuggested = useCallback(async () => {
    // First check localStorage (set by HistoryPage)
    const stored = localStorage.getItem(SUGGESTED_FILTERS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as KolonFilters;
        setSuggestedFilters(parsed);
        return;
      } catch { /* ignore */ }
    }

    // Fallback: fetch from API
    setSuggestedLoading(true);
    try {
      const data = await fetchHistoryAnalysis(25);
      setSuggestedFilters(data.suggestedFilters);
      localStorage.setItem(SUGGESTED_FILTERS_KEY, JSON.stringify(data.suggestedFilters));
    } catch {
      // silently fail
    } finally {
      setSuggestedLoading(false);
    }
  }, []);

  const handleApplySuggested = useCallback(() => {
    if (suggestedFilters) {
      onChange(suggestedFilters);
    }
  }, [suggestedFilters, onChange]);
  const update = (key: keyof KolonFilters, value: number) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-3 sm:p-4 mt-4 no-print">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-bold text-sm">Filtreler</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFetchSuggested}
            disabled={suggestedLoading}
            className="text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            {suggestedLoading ? 'Yukleniyor...' : 'Gecmis Veriye Gore Oner'}
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={onReset}
            className="text-xs text-gray-400 hover:text-gray-300"
          >
            Sifirla
          </button>
        </div>
      </div>

      {/* Suggested Filters Banner */}
      {suggestedFilters && (
        <div className="mb-3 p-2 bg-emerald-900/20 border border-emerald-700/40 rounded-lg flex flex-wrap items-center gap-2 text-xs">
          <span className="text-emerald-400 font-medium">Onerilen:</span>
          <span className="text-green-400">1({suggestedFilters.min1}-{suggestedFilters.max1})</span>
          <span className="text-yellow-400">X({suggestedFilters.minX}-{suggestedFilters.maxX})</span>
          <span className="text-red-400">2({suggestedFilters.min2}-{suggestedFilters.max2})</span>
          <span className="text-purple-400">Ard({suggestedFilters.maxConsecutive})</span>
          <button
            onClick={handleApplySuggested}
            className="ml-auto px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs transition-colors"
          >
            Uygula
          </button>
          <button
            onClick={() => setSuggestedFilters(null)}
            className="text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ardisik Ayni Sonuc */}
      <div className="mb-4">
        <label className="text-gray-400 text-xs block mb-1">
          Ardisik Ayni Sonuc Limiti
          <span className="text-gray-500 ml-1">(0 = devre disi)</span>
        </label>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {[0, 2, 3, 4, 5, 6].map((val) => (
            <button
              key={val}
              onClick={() => update('maxConsecutive', val)}
              className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded text-xs sm:text-sm font-medium transition-colors ${filters.maxConsecutive === val
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
            >
              {val === 0 ? 'Yok' : `Max ${val}`}
            </button>
          ))}
        </div>
      </div>

      {/* Sonuc Dagilimi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <DistributionFilter
          label="Ev Sahibi (1)"
          color="text-green-400"
          min={filters.min1}
          max={filters.max1}
          onMinChange={(v) => update('min1', v)}
          onMaxChange={(v) => update('max1', v)}
        />
        <DistributionFilter
          label="Beraberlik (X)"
          color="text-yellow-400"
          min={filters.minX}
          max={filters.maxX}
          onMinChange={(v) => update('minX', v)}
          onMaxChange={(v) => update('maxX', v)}
        />
        <DistributionFilter
          label="Deplasman (2)"
          color="text-red-400"
          min={filters.min2}
          max={filters.max2}
          onMinChange={(v) => update('min2', v)}
          onMaxChange={(v) => update('max2', v)}
        />
      </div>

      {/* Filtre Sonucu */}
      {totalCount !== null && filteredCount !== null && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs sm:text-sm">
          <span className="text-gray-400">Filtre sonucu: </span>
          <span className="text-white font-bold">
            {filteredCount.toLocaleString('tr-TR')}
          </span>
          <span className="text-gray-500">
            {' '}/ {totalCount.toLocaleString('tr-TR')} kolon
          </span>
          {filteredCount < totalCount && (
            <span className="text-emerald-400 ml-1 sm:ml-2">
              ({(totalCount - filteredCount).toLocaleString('tr-TR')} elendi)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function DistributionFilter({
  label,
  color,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  color: string;
  min: number;
  max: number;
  onMinChange: (v: number) => void;
  onMaxChange: (v: number) => void;
}) {
  return (
    <div className="bg-gray-700/50 rounded p-2">
      <div className={`text-xs font-medium mb-2 ${color}`}>{label}</div>
      <div className="flex items-center gap-1.5 sm:gap-1">
        <label className="text-gray-500 text-[10px]">Min</label>
        <select
          value={min}
          onChange={(e) => onMinChange(Number(e.target.value))}
          className="bg-gray-700 text-white text-xs rounded px-1.5 py-1.5 sm:px-1 sm:py-1 w-14 sm:w-12 border border-gray-600"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <label className="text-gray-500 text-[10px]">Max</label>
        <select
          value={max}
          onChange={(e) => onMaxChange(Number(e.target.value))}
          className="bg-gray-700 text-white text-xs rounded px-1.5 py-1.5 sm:px-1 sm:py-1 w-14 sm:w-12 border border-gray-600"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
