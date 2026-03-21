import { useEffect, useState } from 'react';
import { fetchMatchHighlights } from '../../lib/football-api';
import type { MatchHighlight } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function HighlightsTab({ eventId }: Props) {
  const [highlights, setHighlights] = useState<MatchHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchHighlights(eventId)
      .then((d) => setHighlights(Array.isArray(d) ? d : (d as any)?.highlights || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (highlights.length === 0) return <p className="text-gray-400 text-sm">Highlight bulunamadi.</p>;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {highlights.map((hl, i) => (
        <a
          key={i}
          href={hl.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden hover:border-emerald-500/50 transition-colors group"
        >
          {hl.thumbnailUrl && (
            <div className="aspect-video bg-gray-900 overflow-hidden">
              <img
                src={hl.thumbnailUrl}
                alt={hl.title || 'Highlight'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                loading="lazy"
              />
            </div>
          )}
          <div className="p-3">
            <div className="text-white text-sm font-medium line-clamp-2">{hl.title || 'Video'}</div>
            {hl.subtitle && <div className="text-gray-400 text-xs mt-1">{hl.subtitle}</div>}
            {hl.keyHighlight && (
              <span className="inline-block mt-1 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-600/30 rounded px-1.5 py-0.5">
                Onemli
              </span>
            )}
          </div>
        </a>
      ))}
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
