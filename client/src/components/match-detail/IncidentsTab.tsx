import { useEffect, useState } from 'react';
import { fetchMatchIncidents } from '../../lib/football-api';
import type { MatchIncident } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function IncidentsTab({ eventId }: Props) {
  const [incidents, setIncidents] = useState<MatchIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchIncidents(eventId)
      .then((d) => setIncidents(Array.isArray(d) ? d : (d as any)?.incidents || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (incidents.length === 0) return <p className="text-gray-400 text-sm">Olay verisi bulunamadi.</p>;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white text-sm font-medium">
        Mac Olaylari ({incidents.length})
      </div>
      <div className="max-h-[60vh] overflow-auto divide-y divide-gray-700/50">
        {incidents.map((inc, i) => (
          <div key={i} className="px-3 py-2 flex gap-3 items-start">
            <div className="shrink-0 text-xs font-mono w-10 text-right pt-0.5 text-gray-400">
              {inc.time != null ? `${inc.time}'` : ''}
              {inc.addedTime ? `+${inc.addedTime}` : ''}
            </div>
            <div className="shrink-0 w-6 text-center">{getIcon(inc)}</div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-200 text-xs">
                {formatIncident(inc)}
              </div>
              {inc.homeScore != null && inc.awayScore != null && inc.incidentType === 'goal' && (
                <div className="text-emerald-400 text-[10px] font-bold mt-0.5">
                  {inc.homeScore} - {inc.awayScore}
                </div>
              )}
            </div>
            <div className="shrink-0 text-[10px] text-gray-500">
              {inc.isHome ? 'Ev' : inc.isHome === false ? 'Dep' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getIcon(inc: MatchIncident): string {
  switch (inc.incidentType) {
    case 'goal': return '⚽';
    case 'card': return inc.incidentClass === 'red' || inc.incidentClass === 'secondYellow' ? '🟥' : '🟨';
    case 'substitution': return '🔄';
    case 'var': return '📺';
    case 'period': return '🕐';
    case 'injuryTime': return '⏱';
    default: return '▪';
  }
}

function formatIncident(inc: MatchIncident): string {
  switch (inc.incidentType) {
    case 'goal':
      return `${inc.player?.name || 'Gol'}${inc.assist1 ? ` (asist: ${inc.assist1.name})` : ''}${inc.incidentClass === 'ownGoal' ? ' (KK)' : ''}`;
    case 'card':
      return `${inc.player?.name || 'Kart'} - ${inc.incidentClass === 'yellow' ? 'Sari Kart' : inc.incidentClass === 'red' ? 'Kirmizi Kart' : inc.incidentClass === 'secondYellow' ? '2. Sari' : 'Kart'}${inc.reason ? ` (${inc.reason})` : ''}`;
    case 'substitution':
      return `${inc.playerIn?.name || '?'} giren, ${inc.playerOut?.name || '?'} cikan`;
    case 'var':
      return `VAR: ${inc.text || inc.reason || 'karar'}`;
    case 'period':
      return inc.text || 'Devre';
    case 'injuryTime':
      return `Uzatma: ${inc.text || ''}`;
    default:
      return inc.text || inc.incidentType || '-';
  }
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
