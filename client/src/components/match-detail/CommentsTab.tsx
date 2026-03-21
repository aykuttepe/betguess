import { useEffect, useState } from 'react';
import { fetchMatchComments } from '../../lib/football-api';
import type { MatchComment } from '../../lib/football-types';

interface Props {
  eventId: number;
}

export default function CommentsTab({ eventId }: Props) {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMatchComments(eventId)
      .then((d) => setComments(Array.isArray(d) ? d : (d as any)?.comments || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <Spinner />;
  if (error) return <ErrorMsg msg={error} />;
  if (comments.length === 0) return <p className="text-gray-400 text-sm">Yorum verisi bulunamadi.</p>;

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-700 text-white text-sm font-medium">
        Mac Yorumlari ({comments.length})
      </div>
      <div className="max-h-[60vh] overflow-auto divide-y divide-gray-700/50">
        {comments.map((c, i) => (
          <div key={i} className="px-3 py-2 flex gap-3">
            <div className="shrink-0 text-emerald-400 text-xs font-mono w-10 text-right pt-0.5">
              {c.time != null ? `${c.time}'` : ''}
              {c.addedTime ? `+${c.addedTime}` : ''}
            </div>
            <div className="text-gray-200 text-xs leading-relaxed">{c.text || '-'}</div>
          </div>
        ))}
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
