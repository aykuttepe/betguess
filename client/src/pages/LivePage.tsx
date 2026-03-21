import { useEffect, useMemo, useState } from 'react';
import { fetchLiveMatches, fetchScheduledMatches } from '../lib/football-api';

interface ApiMatch {
  id: number;
  home_team?: { name: string; short_name?: string; id?: number };
  away_team?: { name: string; short_name?: string; id?: number };
  homeTeam?: { name: string; id?: number };
  awayTeam?: { name: string; id?: number };
  tournament?: { name?: string; id?: number; category?: string };
  start_time?: string;
  startTimestamp?: number;
  status_code?: number;
  status_description?: string;
  status?: { type?: string; description?: string };
  score?: { home?: number; away?: number };
  homeScore?: { current?: number };
  awayScore?: { current?: number };
  [key: string]: any;
}

function getHomeName(match: ApiMatch): string {
  return match.home_team?.name || match.homeTeam?.name || '-';
}

function getAwayName(match: ApiMatch): string {
  return match.away_team?.name || match.awayTeam?.name || '-';
}

function getHomeScore(match: ApiMatch): string {
  if (match.score?.home != null) return String(match.score.home);
  if (match.homeScore?.current != null) return String(match.homeScore.current);
  return '-';
}

function getAwayScore(match: ApiMatch): string {
  if (match.score?.away != null) return String(match.score.away);
  if (match.awayScore?.current != null) return String(match.awayScore.current);
  return '-';
}

function getTournament(match: ApiMatch): string {
  return match.tournament?.name || '-';
}

function getStatus(match: ApiMatch): string {
  return match.status_description || match.status?.description || match.status?.type || '-';
}

function getKickoffLabel(match: ApiMatch): string {
  if (match.start_time) {
    try {
      return new Date(match.start_time).toLocaleString('tr-TR');
    } catch {
      return '-';
    }
  }

  if (match.startTimestamp) {
    return new Date(match.startTimestamp * 1000).toLocaleString('tr-TR');
  }

  return '-';
}

function getCategory(match: ApiMatch): string {
  return match.tournament?.category || 'Football';
}

function normalizeMatches(payload: any): ApiMatch[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.events)) return payload.events;
  if (Array.isArray(payload?.matches)) return payload.matches;
  return [];
}

function getStatusTone(status: string): string {
  const normalized = status.toLowerCase();

  if (normalized.includes('half') || normalized.includes('devre')) {
    return 'bg-amber-500/15 text-amber-200 border-amber-400/30';
  }

  if (normalized.includes('started') || normalized.includes('2nd') || normalized.includes('1st') || normalized.includes('live')) {
    return 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30';
  }

  if (normalized.includes('ended') || normalized.includes('finished')) {
    return 'bg-slate-500/15 text-slate-200 border-slate-400/30';
  }

  return 'bg-sky-500/15 text-sky-200 border-sky-400/30';
}

function getScoreTone(home: string, away: string): string {
  if (home === '-' || away === '-') {
    return 'from-slate-800 to-slate-900 text-slate-200 border-slate-700/50';
  }

  const homeNum = Number(home);
  const awayNum = Number(away);

  if (Number.isNaN(homeNum) || Number.isNaN(awayNum)) {
    return 'from-slate-800 to-slate-900 text-slate-200 border-slate-700/50';
  }

  if (homeNum === awayNum) {
    return 'from-amber-600/20 to-orange-600/10 text-amber-100 border-amber-500/30';
  }

  return 'from-emerald-600/20 to-teal-600/10 text-emerald-100 border-emerald-500/30';
}

export default function LivePage() {
  const [liveMatches, setLiveMatches] = useState<ApiMatch[]>([]);
  const [scheduledMatches, setScheduledMatches] = useState<ApiMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchLiveMatches(), fetchScheduledMatches()])
      .then(([live, scheduled]) => {
        setLiveMatches(normalizeMatches(live));
        setScheduledMatches(normalizeMatches(scheduled));
      })
      .catch((err: any) => setError(err.message || 'Canli maclar yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  const totalMatches = liveMatches.length + scheduledMatches.length;
  const summaryItems = useMemo(
    () => [
      { label: 'Canli', value: liveMatches.length, accent: 'text-emerald-300' },
      { label: 'Siradaki', value: scheduledMatches.length, accent: 'text-sky-300' },
      { label: 'Toplam', value: totalMatches, accent: 'text-white' },
    ],
    [liveMatches.length, scheduledMatches.length, totalMatches]
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-700/80 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(17,24,39,0.98))] p-4 sm:p-5 shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,_rgba(56,189,248,0.14),_transparent_60%)] lg:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              Match Center
            </div>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Canlı maç akışı</h1>
              <p className="max-w-xl text-sm leading-5 text-slate-300">
                Devam eden ve sıradaki karşılaşmaları daha güçlü bir skor hiyerarşisi, durum etiketi ve temiz kart düzeniyle takip edin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-auto">
            {summaryItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm">
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.label}</div>
                <div className={`mt-1 text-lg sm:text-xl font-semibold ${item.accent}`}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-5">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-800" />
              <div className="mt-6 space-y-3">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-800" />
                    <div className="mt-3 h-6 w-56 animate-pulse rounded bg-slate-800" />
                    <div className="mt-4 h-12 animate-pulse rounded-xl bg-slate-800/80" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-rose-100 shadow-[0_12px_30px_rgba(127,29,29,0.22)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <MatchSection
            title="Canli Maclar"
            eyebrow="Aktif"
            description="Skor degisimi olan veya su an devam eden karsilasmalar."
            matches={liveMatches}
            emptyText="Su anda canli mac yok."
          />
          <MatchSection
            title="Siradaki Maclar"
            eyebrow="Takvim"
            description="Baslama saatine gore siradaki maclar."
            matches={scheduledMatches}
            emptyText="Yakin mac bulunamadi."
          />
        </div>
      )}
    </div>
  );
}

function MatchSection({
  title,
  eyebrow,
  description,
  matches,
  emptyText,
}: {
  title: string;
  eyebrow: string;
  description: string;
  matches: ApiMatch[];
  emptyText: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-700/80 bg-[linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(17,24,39,0.92))] shadow-[0_15px_40px_rgba(15,23,42,0.30)]">
      <div className="border-b border-slate-700/70 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{eyebrow}</div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                {matches.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">{emptyText}</div>
      ) : (
        <div className="space-y-2.5 p-3 sm:p-4">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchCard({ match }: { match: ApiMatch }) {
  const status = getStatus(match);
  const homeName = getHomeName(match);
  const awayName = getAwayName(match);
  const homeScore = getHomeScore(match);
  const awayScore = getAwayScore(match);
  const scoreTone = getScoreTone(homeScore, awayScore);

  return (
    <article className="group relative overflow-hidden rounded-xl border border-slate-700/60 bg-[linear-gradient(145deg,_rgba(30,41,59,0.4),_rgba(15,23,42,0.6))] p-3 sm:p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500/80 hover:bg-slate-800/80 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      {/* Top Bar: Labels & Time */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/50 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-300 shadow-sm">
            {getCategory(match)}
          </span>
          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wider text-slate-300 shadow-sm">
            {getTournament(match)}
          </span>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wider shadow-sm ${getStatusTone(status)}`}>
            {status}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <svg className="h-3 w-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-6a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {getKickoffLabel(match)}
        </div>
      </div>

      {/* Main Content: Teams & Score */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Teams Context */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-[9px] font-bold text-slate-400">1</div>
            <div className="truncate text-sm sm:text-base font-semibold text-slate-100 group-hover:text-white transition-colors">{homeName}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/50 text-[9px] font-bold text-slate-400">2</div>
            <div className="truncate text-sm sm:text-base font-semibold text-slate-100 group-hover:text-white transition-colors">{awayName}</div>
          </div>
        </div>

        {/* Score Context */}
        <div className={`shrink-0 flex flex-col items-center justify-center rounded-lg border bg-gradient-to-br px-3 py-2 min-w-[64px] sm:min-w-[70px] shadow-sm ${scoreTone}`}>
          <div className="mb-0.5 text-[8px] sm:text-[9px] uppercase tracking-[0.2em] opacity-70 font-bold">Skor</div>
          <div className="flex items-center gap-1 text-xl sm:text-2xl font-extrabold tracking-tighter">
            <span>{homeScore}</span>
            <span className="opacity-40 -translate-y-0.5">:</span>
            <span>{awayScore}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
