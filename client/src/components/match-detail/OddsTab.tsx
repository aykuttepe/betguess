import { useEffect, useState } from 'react';
import { fetchMatchOdds } from '../../lib/football-api';
import type { MatchOdds } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function OddsTab({ eventId }: Props) {
  const [data, setData] = useState<MatchOdds | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchOdds(eventId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <p className="text-gray-400 text-sm">Oran verisi bulunamadi.</p>;

  const markets = data.markets || extractMarkets(data);

  if (markets.length === 0) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <h4 className="text-white font-semibold text-sm mb-2">Ham Oran Verisi</h4>
        <pre className="text-xs text-gray-300 overflow-auto max-h-[50vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {markets.map((market, idx) => (
        <div key={idx} className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 text-white text-sm font-medium">
            {market.marketName || `Pazar ${idx + 1}`}
          </div>
          <div className="p-3 flex flex-wrap gap-2">
            {(market.choices || []).map((choice: { name: string; odds: number }, ci: number) => (
              <div key={ci} className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-center min-w-[70px]">
                <div className="text-gray-400 text-[10px]">{choice.name}</div>
                <div className="text-emerald-400 font-bold text-sm">{Number(choice.odds).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function extractMarkets(data: any): any[] {
  if (Array.isArray(data)) {
    return data.map((m: any) => ({
      marketName: m.marketName || m.name || '',
      choices: m.choices || m.odds || [],
    }));
  }
  return [];
}

function Spinner() {
  return (
    <div className="text-center py-8">
      <div className="inline-block w-7 h-7 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-sm text-red-300">{msg}</div>;
}

