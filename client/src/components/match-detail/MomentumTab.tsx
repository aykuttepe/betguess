import { useEffect, useState } from 'react';
import { fetchMatchGraph } from '../../lib/football-api';
import type { MomentumGraphData, MomentumGraphPoint } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function MomentumTab({ eventId }: Props) {
  const [data, setData] = useState<MomentumGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchGraph(eventId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (!data) return <p className="text-gray-400 text-sm">Momentum verisi bulunamadi.</p>;

  const points: MomentumGraphPoint[] = data.graphPoints || extractPoints(data);

  if (points.length === 0) {
    return (
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
        <h4 className="text-white font-semibold text-sm mb-2">Ham Veri</h4>
        <pre className="text-xs text-gray-300 overflow-auto max-h-[40vh]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    );
  }

  const maxMinute = Math.max(...points.map((p) => p.minute), 90);
  const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), 1);

  const W = 600;
  const H = 200;
  const pad = { top: 20, bottom: 30, left: 10, right: 10 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;
  const midY = pad.top + plotH / 2;

  const toX = (minute: number) => pad.left + (minute / maxMinute) * plotW;
  const toY = (value: number) => midY - (value / maxAbs) * (plotH / 2);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.minute).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(' ');

  const areaAbove = `M ${toX(points[0].minute).toFixed(1)} ${midY} ` +
    points.map((p) => `L ${toX(p.minute).toFixed(1)} ${Math.min(toY(p.value), midY).toFixed(1)}`).join(' ') +
    ` L ${toX(points[points.length - 1].minute).toFixed(1)} ${midY} Z`;

  const areaBelow = `M ${toX(points[0].minute).toFixed(1)} ${midY} ` +
    points.map((p) => `L ${toX(p.minute).toFixed(1)} ${Math.max(toY(p.value), midY).toFixed(1)}`).join(' ') +
    ` L ${toX(points[points.length - 1].minute).toFixed(1)} ${midY} Z`;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
      <h4 className="text-white font-semibold text-sm mb-3">Momentum Grafigi</h4>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {/* Center line */}
        <line x1={pad.left} y1={midY} x2={W - pad.right} y2={midY} stroke="#4b5563" strokeWidth="0.5" />

        {/* Areas */}
        <path d={areaAbove} fill="rgba(16,185,129,0.15)" />
        <path d={areaBelow} fill="rgba(239,68,68,0.15)" />

        {/* Line */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth="1.5" />

        {/* Labels */}
        <text x={pad.left + 2} y={pad.top - 5} className="text-[9px]" fill="#9ca3af">Ev Sahibi</text>
        <text x={pad.left + 2} y={H - pad.bottom + 15} className="text-[9px]" fill="#9ca3af">Deplasman</text>

        {/* Minute markers */}
        {[0, 15, 30, 45, 60, 75, 90].filter((m) => m <= maxMinute).map((m) => (
          <g key={m}>
            <line x1={toX(m)} y1={pad.top} x2={toX(m)} y2={H - pad.bottom} stroke="#374151" strokeWidth="0.3" />
            <text x={toX(m)} y={H - pad.bottom + 12} textAnchor="middle" className="text-[8px]" fill="#6b7280">{m}'</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function extractPoints(data: any): MomentumGraphPoint[] {
  if (Array.isArray(data)) return data.map((p: any) => ({ minute: p.minute ?? p.m ?? 0, value: p.value ?? p.v ?? 0 }));
  if (data?.points && Array.isArray(data.points)) return data.points;
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
