import { useEffect, useState } from 'react';
import { fetchMatchShotmap } from '../../lib/football-api';
import type { ShotmapItem } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function ShotmapTab({ eventId }: Props) {
  const [shots, setShots] = useState<ShotmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchShotmap(eventId)
      .then((d) => setShots(Array.isArray(d) ? d : (d as any)?.shotmap || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (shots.length === 0) return <p className="text-gray-400 text-sm">Sut haritasi verisi yok.</p>;

  return (
    <div className="space-y-4">
      {/* SVG pitch with shots */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 overflow-hidden">
        <svg viewBox="0 0 100 65" className="w-full" style={{ maxHeight: '400px' }}>
          {/* Pitch background */}
          <rect x="0" y="0" width="100" height="65" fill="#1a472a" rx="1" />
          {/* Center line */}
          <line x1="50" y1="0" x2="50" y2="65" stroke="#2d6b3f" strokeWidth="0.3" />
          {/* Center circle */}
          <circle cx="50" cy="32.5" r="9.15" fill="none" stroke="#2d6b3f" strokeWidth="0.3" />
          {/* Penalty areas */}
          <rect x="0" y="14" width="16.5" height="37" fill="none" stroke="#2d6b3f" strokeWidth="0.3" />
          <rect x="83.5" y="14" width="16.5" height="37" fill="none" stroke="#2d6b3f" strokeWidth="0.3" />
          {/* Goal areas */}
          <rect x="0" y="22.5" width="5.5" height="20" fill="none" stroke="#2d6b3f" strokeWidth="0.3" />
          <rect x="94.5" y="22.5" width="5.5" height="20" fill="none" stroke="#2d6b3f" strokeWidth="0.3" />

          {/* Shot dots */}
          {shots.map((shot, i) => {
            const coords = shot.playerCoordinates || shot.draw?.start;
            if (!coords) return null;
            const x = (coords.x ?? 50);
            const y = (coords.y ?? 32.5);
            const isGoal = shot.shotType === 'goal';
            const isOnTarget = shot.shotType === 'save' || shot.shotType === 'on-target';
            const fill = isGoal ? '#10b981' : isOnTarget ? '#f59e0b' : '#ef4444';
            const r = isGoal ? 1.8 : 1.2;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={r}
                fill={fill}
                opacity={0.85}
                stroke={shot.isHome ? '#fff' : '#666'}
                strokeWidth={0.3}
              >
                <title>
                  {shot.player?.name || '?'} {shot.minute ? `${shot.minute}'` : ''}
                  {shot.xg ? ` xG: ${shot.xg.toFixed(2)}` : ''}
                  {isGoal ? ' GOL' : ''}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-gray-400 px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Gol</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> Kaleye Isabetli</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Isabetsiz</span>
      </div>

      {/* Shot list */}
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 text-white text-sm font-medium">
          Sut Detaylari ({shots.length})
        </div>
        <div className="max-h-[40vh] overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 bg-gray-900/40">
                <th className="px-3 py-2 text-left">Dk</th>
                <th className="px-3 py-2 text-left">Oyuncu</th>
                <th className="px-3 py-2 text-center">Tip</th>
                <th className="px-3 py-2 text-center">xG</th>
                <th className="px-3 py-2 text-center">Takim</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((shot, i) => (
                <tr key={i} className="border-t border-gray-700/70">
                  <td className="px-3 py-1.5 text-gray-200">{shot.minute ?? '-'}{shot.addedTime ? `+${shot.addedTime}` : ''}</td>
                  <td className="px-3 py-1.5 text-gray-200">{shot.player?.name || '-'}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      shot.shotType === 'goal' ? 'bg-emerald-500/30 text-emerald-300' :
                      shot.shotType === 'save' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {shot.shotType || '?'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-center text-gray-300">{shot.xg != null ? shot.xg.toFixed(2) : '-'}</td>
                  <td className="px-3 py-1.5 text-center text-gray-300">{shot.isHome ? 'Ev' : 'Dep'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
