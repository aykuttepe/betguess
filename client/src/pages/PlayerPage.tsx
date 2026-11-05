import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPlayerProfile, searchPlayers } from '../lib/football-api';
import type { PlayerProfile, PlayerSearchResult } from '../lib/football-types';

export default function PlayerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerId = searchParams.get('playerId') || '';
  const slug = searchParams.get('slug') || '';
  const source = searchParams.get('source') === 'tm' ? 'tm' : 'sofa';

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      searchPlayers(q)
        .then((data) => {
          if (!cancelled) setResults(data.results || []);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    fetchPlayerProfile(playerId, slug, source)
      .then(setProfile)
      .catch((err: any) => {
        setError(err.message || 'Oyuncu profili yuklenemedi');
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [playerId, slug, source]);

  const transferSummary = useMemo(() => profile?.transferHistory.slice(0, 8) || [], [profile]);

  function selectPlayer(player: PlayerSearchResult) {
    setSearchParams({
      playerId: player.playerId,
      slug: player.playerSlug,
      source: player.source,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Oyuncular</h2>
        <p className="text-sm text-gray-400 mt-1">Desteklenen lig kadrolarinda oyuncu ara.</p>
      </div>

      <div className="space-y-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Oyuncu adi yaz..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        {searching && <div className="text-sm text-gray-400">Oyuncular araniyor...</div>}
        {results.length > 0 && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
            {results.map((result) => (
              <button
                key={`${result.source}-${result.playerId}`}
                type="button"
                onClick={() => selectPlayer(result)}
                className="w-full px-4 py-3 text-left border-b border-gray-700/60 last:border-b-0 hover:bg-gray-700/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-white font-medium truncate">
                      {result.shirtNumber ? `#${result.shirtNumber} ` : ''}{result.name}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {[result.teamName, result.leagueLabel, result.position, result.nationality].filter(Boolean).join(' | ')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-emerald-400 font-semibold">{result.marketValue || '-'}</div>
                    <div className="text-xs text-gray-500">{result.age ? `${result.age} yas` : '-'}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <div className="text-gray-400">Yukleniyor...</div>}
      {error && !loading && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>}

      {profile && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Oyuncu" value={profile.name} accent />
            <Card label="Kulup" value={profile.currentClub || '-'} />
            <Card label="Deger" value={profile.marketValue || '-'} accent />
            <Card label="Pozisyon" value={profile.position || '-'} />
            <Card label="Yas" value={profile.age ? String(profile.age) : '-'} />
            <Card label="Uyruk" value={profile.nationality || '-'} />
            <Card label="Boy" value={profile.height || '-'} />
            <Card label="Ayak" value={profile.foot || '-'} />
          </div>

          {profile.currentInjury && (
            <section className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <div className="text-red-300 font-semibold">Mevcut Sakatlik</div>
              <div className="text-sm text-red-200 mt-1">{profile.currentInjury}</div>
            </section>
          )}

          <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold">Transfer Gecmisi</div>
            {transferSummary.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">Transfer kaydi bulunamadi.</p>
            ) : (
              <div className="divide-y divide-gray-700/60">
                {transferSummary.map((transfer, index) => (
                  <div key={`${transfer.fromTeam}-${transfer.toTeam}-${index}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-white">{transfer.fromTeam} {'->'} {transfer.toTeam}</div>
                    <div className="text-sm text-gray-400">{transfer.transferDate} | {transfer.fee}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 text-white font-semibold">Sakatlik Gecmisi</div>
            {profile.injuries.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">Sakatlik kaydi bulunamadi.</p>
            ) : (
              <div className="divide-y divide-gray-700/60">
                {profile.injuries.slice(0, 10).map((injury, index) => (
                  <div key={`${injury.injury}-${index}`} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-white">{injury.injury}</div>
                    <div className="text-sm text-gray-400">{injury.from} - {injury.to} | {injury.gamesMissed || '-'} mac</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-sm font-semibold mt-1 truncate ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}
