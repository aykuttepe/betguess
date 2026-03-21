import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPlayerProfile } from '../lib/football-api';
import type { PlayerProfile } from '../lib/football-types';

export default function PlayerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerIdInput, setPlayerIdInput] = useState(searchParams.get('playerId') || '');
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerId = searchParams.get('playerId') || '';
  const slug = searchParams.get('slug') || '';

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(null);
    fetchPlayerProfile(playerId, slug)
      .then(setProfile)
      .catch((err: any) => {
        setError(err.message || 'Oyuncu profili yuklenemedi');
        setProfile(null);
      })
      .finally(() => setLoading(false));
  }, [playerId, slug]);

  const transferSummary = useMemo(() => profile?.transferHistory.slice(0, 8) || [], [profile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Player</h2>
        <p className="text-sm text-gray-400 mt-1">Oyuncu profili ve transfer gecmisi.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!playerIdInput.trim()) return;
          setSearchParams({ playerId: playerIdInput.trim() });
        }}
        className="flex gap-3"
      >
        <input
          value={playerIdInput}
          onChange={(e) => setPlayerIdInput(e.target.value)}
          placeholder="Oyuncu ID"
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white outline-none focus:border-emerald-500"
        />
        <button className="px-5 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors">Getir</button>
      </form>

      {loading && <div className="text-gray-400">Yukleniyor...</div>}
      {error && !loading && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>}

      {profile && !loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Oyuncu" value={profile.name} accent />
            <Card label="Kulup" value={profile.currentClub || '-'} />
            <Card label="Deger" value={profile.marketValue} accent />
            <Card label="Pozisyon" value={profile.position || '-'} />
            <Card label="Yas" value={String(profile.age)} />
            <Card label="Mac" value={String(profile.appearances)} />
            <Card label="Gol" value={String(profile.goals)} />
            <Card label="Asist" value={String(profile.assists)} />
          </div>

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
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-sm font-semibold mt-1 ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

