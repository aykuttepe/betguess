import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchFootball } from '../lib/football-api';
import type { SearchResult } from '../lib/football-types';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const runSearch = useCallback(async (value: string) => {
    const q = value.trim();
    if (!q) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await searchFootball(q);
      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || 'Arama yapilamadi');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialQuery = searchParams.get('q') || '';
    setQuery(initialQuery);
    if (initialQuery.trim()) {
      void runSearch(initialQuery);
    } else {
      setResults([]);
      setError(null);
    }
  }, [searchParams, runSearch]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) {
      setSearchParams({});
      setResults([]);
      setError(null);
      return;
    }

    const currentQuery = searchParams.get('q') || '';
    if (currentQuery === q) {
      await runSearch(q);
      return;
    }

    setSearchParams({ q });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Ara</h2>
        <p className="text-sm text-gray-400 mt-1">Takim, oyuncu ve turnuva aramasi.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Takim, oyuncu, mac ara..."
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        <button className="px-5 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">Ara</button>
      </form>

      {loading && <div className="text-gray-400">Araniyor...</div>}
      {error && !loading && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>}

      <div className="space-y-3">
        {results.map((result, index) => (
          <button
            key={`${result.type}-${result.entity.id}-${index}`}
            onClick={() => {
              if (result.type === 'player') {
                navigate(`/player?playerId=${result.entity.id}&slug=${encodeURIComponent(result.entity.slug || '')}`);
                return;
              }
              if (result.type === 'tournament') {
                navigate(`/tournaments?tournamentId=${result.entity.id}`);
                return;
              }
            }}
            className="w-full text-left bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-emerald-500 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-white font-medium">{result.entity.name}</div>
                <div className="text-xs text-gray-400 mt-1">Tip: {result.type}</div>
              </div>
              <div className="text-xs text-emerald-400">ID {result.entity.id}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
