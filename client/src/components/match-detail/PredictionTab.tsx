import { useEffect, useState } from 'react';
import { fetchMatchPredictions } from '../../lib/football-api';
import type { MatchPrediction } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function PredictionTab({ eventId }: Props) {
  const [data, setData] = useState<MatchPrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchPredictions(eventId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <Empty />;

  const home = data.homeWinProbability ?? (data as any).homeWin ?? null;
  const draw = data.drawProbability ?? (data as any).draw ?? null;
  const away = data.awayWinProbability ?? (data as any).awayWin ?? null;

  const hasProbs = home !== null || draw !== null || away !== null;

  return (
    <div className="space-y-4">
      {hasProbs && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
          <h4 className="text-white font-semibold text-sm mb-3">Tahmin Olasiliklari</h4>
          <div className="flex gap-3">
            <ProbBar label="Ev" pct={toPercent(home)} color="emerald" />
            <ProbBar label="Bes" pct={toPercent(draw)} color="yellow" />
            <ProbBar label="Dep" pct={toPercent(away)} color="red" />
          </div>
        </div>
      )}

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <h4 className="text-white font-semibold text-sm mb-2">Ham Tahmin Verisi</h4>
        <pre className="text-xs text-gray-300 overflow-auto max-h-[40vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function ProbBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const bg = color === 'emerald' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex-1">
      <div className="text-center text-gray-300 text-xs mb-1">{label}</div>
      <div className="w-full h-8 bg-gray-900 rounded overflow-hidden relative">
        <div className={`h-full ${bg} transition-all`} style={{ width: `${pct}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
          {pct > 0 ? `${pct.toFixed(1)}%` : '-'}
        </span>
      </div>
    </div>
  );
}

function toPercent(val: any): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  if (isNaN(n)) return 0;
  return n > 1 ? n : n * 100;
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

function Empty() {
  return <p className="text-gray-400 text-sm">Tahmin verisi bulunamadi.</p>;
}
