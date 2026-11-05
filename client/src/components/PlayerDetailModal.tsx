import { useState, useEffect, useCallback } from 'react';
import { PlayerStats, PlayerProfile, PlayerInjury, PlayerTransfer } from '../lib/football-types';
import { fetchPlayerProfile } from '../lib/football-api';
import { fetchPlayerAnalysis } from '../lib/ai-api';
import AiPanel from './AiPanel';

interface PlayerDetailModalProps {
  player: PlayerStats;
  onClose: () => void;
}

export default function PlayerDetailModal({ player, onClose }: PlayerDetailModalProps) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detailPlayerId = player.tmPlayerId || player.playerId || '';
  const detailPlayerSlug = player.tmPlayerSlug || player.playerSlug || '';
  const profileSource: 'tm' | 'sofa' = player.tmPlayerId ? 'tm' : 'sofa';

  const loadProfile = useCallback(async () => {
    const numericId = parseInt(detailPlayerId, 10);
    if (!detailPlayerId || isNaN(numericId)) {
      setError('Bu oyuncu için detaylı profil bilgisi mevcut değil.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlayerProfile(String(numericId), detailPlayerSlug, profileSource);
      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [detailPlayerId, detailPlayerSlug, profileSource]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const playerInfo = profile
    ? `Pozisyon: ${profile.position}, Yas: ${profile.age}, Uyruk: ${profile.nationality}, Deger: ${profile.marketValue}, Mac: ${profile.appearances}, Gol: ${profile.goals}, Asist: ${profile.assists}, Transfer: ${profile.transferHistory.length}, Sakatlik: ${profile.injuries.length} kayit, Mevcut sakatlik: ${profile.currentInjury || 'Yok'}`
    : `Pozisyon: ${player.position}, Yas: ${player.age}, Mac: ${player.appearances}, Gol: ${player.goals}, Asist: ${player.assists}`;
  const appearances = profile?.appearances || player.appearances;
  const goals = profile?.goals || player.goals;
  const assists = profile?.assists || player.assists;
  const yellowCards = profile?.yellowCards || player.yellowCards;
  const redCards = profile?.redCards || player.redCards + player.secondYellows;
  const minutesPlayed = profile?.minutesPlayed || player.minutesPlayed;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/80 sticky top-0 z-10">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {player.name}
              {(profile?.currentInjury || player.currentInjury) && (
                <span className="text-sm" title={profile?.currentInjury || player.currentInjury || ''}>Y</span>
              )}
            </h3>
            <p className="text-xs text-gray-400">{player.position} | {player.nationality}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-gray-400 text-sm">Oyuncu profili yukleniyor...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <InfoCard label="Yas" value={String(profile?.age || player.age)} />
            <InfoCard label="Uyruk" value={profile?.nationality || player.nationality} />
            <InfoCard label="Pozisyon" value={profile?.position || player.position} />
            {player.shirtNumber && <InfoCard label="Forma" value={player.shirtNumber} />}
            {(profile?.height || player.height) && <InfoCard label="Boy" value={profile?.height || player.height || '-'} />}
            {(profile?.foot || player.foot) && <InfoCard label="Ayak" value={profile?.foot || player.foot || '-'} />}
            {player.contractEnd && <InfoCard label="Sozlesme" value={player.contractEnd} />}
            {(profile?.marketValue || player.marketValue) && (
              <InfoCard label="Piyasa Degeri" value={profile?.marketValue || player.marketValue} accent />
            )}
          </div>

          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-2">Sezon Istatistikleri</h4>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              <StatBox label="Mac" value={appearances} />
              <StatBox label="Gol" value={goals} color="text-emerald-400" />
              <StatBox label="Asist" value={assists} color="text-blue-400" />
              <StatBox label="Sari" value={yellowCards} color="text-yellow-400" />
              <StatBox label="Kirmizi" value={redCards} color="text-red-400" />
              <StatBox label="Dakika" value={minutesPlayed} />
            </div>
          </div>

          {profile?.currentInjury && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
              <p className="text-red-400 font-medium text-sm">Mevcut Sakatlik</p>
              <p className="text-red-300 text-xs mt-1">{profile.currentInjury}</p>
            </div>
          )}

          {profile && profile.transferHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-300 mb-2">Transfer Gecmisi</h4>
              <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400">
                        <th className="px-2 py-2 text-left">Nereden</th>
                        <th className="px-2 py-2 text-left">Nereye</th>
                        <th className="px-2 py-2 text-center">Tarih</th>
                        <th className="px-2 py-2 text-right">Bedel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.transferHistory.slice(0, 10).map((transfer, i) => (
                        <TransferRow key={i} transfer={transfer} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {profile && profile.injuries.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-gray-300 mb-2">Sakatlik Gecmisi</h4>
              <div className="bg-gray-900/50 rounded-lg border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-800 text-gray-400">
                        <th className="px-2 py-2 text-left">Sakatlik</th>
                        <th className="px-2 py-2 text-center">Tarih</th>
                        <th className="px-2 py-2 text-center">Gun</th>
                        <th className="px-2 py-2 text-center">Mac</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profile.injuries.slice(0, 10).map((inj, i) => (
                        <InjuryRow key={i} injury={inj} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <AiPanel
            title={`AI Oyuncu Analizi - ${player.name}`}
            buttonLabel={`${player.name} AI Analizi`}
            fetchFn={() => fetchPlayerAnalysis(player.name, playerInfo)}
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-2">
      <div className="text-[10px] text-gray-400">{label}</div>
      <div className={`text-xs font-bold truncate ${accent ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
    </div>
  );
}

function StatBox({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-700/30 rounded p-2 text-center">
      <div className={`text-sm font-bold ${color}`}>{value || '-'}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
    </div>
  );
}

function InjuryRow({ injury }: { injury: PlayerInjury }) {
  const isCurrent = injury.to === '-';
  return (
    <tr className={`border-b border-gray-700/50 ${isCurrent ? 'bg-red-900/10' : ''}`}>
      <td className="px-2 py-1.5 text-gray-300">{injury.injury}</td>
      <td className="px-2 py-1.5 text-center text-gray-400 whitespace-nowrap">{injury.from}</td>
      <td className="px-2 py-1.5 text-center text-gray-400">{injury.daysMissed > 0 ? injury.daysMissed : '-'}</td>
      <td className="px-2 py-1.5 text-center text-gray-400">{injury.gamesMissed > 0 ? injury.gamesMissed : '-'}</td>
    </tr>
  );
}

function TransferRow({ transfer }: { transfer: PlayerTransfer }) {
  return (
    <tr className="border-b border-gray-700/50">
      <td className="px-2 py-1.5 text-gray-300">{transfer.fromTeam}</td>
      <td className="px-2 py-1.5 text-gray-300">{transfer.toTeam}</td>
      <td className="px-2 py-1.5 text-center text-gray-400 whitespace-nowrap">{transfer.transferDate}</td>
      <td className="px-2 py-1.5 text-right text-emerald-400">{transfer.fee}</td>
    </tr>
  );
}
