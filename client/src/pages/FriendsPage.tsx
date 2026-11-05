import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FriendRequest, FriendSearchResult, FriendUser, friendsApi } from '../lib/friends-api';
import { useConfirm } from '../components/ConfirmDialog';
import { showButtonFeedback } from '../lib/button-feedback';

type SocialTab = 'discover' | 'requests' | 'friends';

function relationshipText(relationship: FriendSearchResult['relationship']) {
  if (relationship === 'friend') return 'Arkadaşınız';
  if (relationship === 'incoming') return 'Size istek göndermiş';
  if (relationship === 'outgoing') return 'İstek gönderildi';
  if (relationship === 'self') return 'Bu sizsiniz';
  return 'Arkadaş eklenebilir';
}

export default function FriendsPage() {
  const [searchParams] = useSearchParams();
  const confirmAction = useConfirm();
  const [activeTab, setActiveTab] = useState<SocialTab>('discover');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchResult[]>([]);
  const [friendMessage, setFriendMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFriends = useCallback(async () => {
    setLoading(true);
    try {
      const [friendRows, requestRows] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getRequests(),
      ]);
      setFriends(Array.isArray(friendRows) ? friendRows : []);
      setIncomingRequests(Array.isArray(requestRows?.incoming) ? requestRows.incoming : []);
      setOutgoingRequests(Array.isArray(requestRows?.outgoing) ? requestRows.outgoing : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'discover' || tab === 'requests' || tab === 'friends') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const statCards = useMemo(() => [
    { label: 'Toplam arkadaş', value: friends.length },
    { label: 'Gelen istek', value: incomingRequests.length },
    { label: 'Gönderilen istek', value: outgoingRequests.length },
  ], [friends.length, incomingRequests.length, outgoingRequests.length]);

  const handleFriendSearch = async () => {
    const query = friendSearch.trim();
    if (query.length < 2) {
      setFriendMessage('Aramak için en az 2 karakter girin.');
      setFriendSearchResults([]);
      return;
    }

    try {
      const rows = await friendsApi.searchUsers(query);
      setFriendSearchResults(Array.isArray(rows) ? rows : []);
      setFriendMessage(Array.isArray(rows) && rows.length ? null : 'Kullanıcı bulunamadı.');
    } catch (err) {
      setFriendMessage(err instanceof Error ? err.message : 'Arama yapılamadı.');
    }
  };

  const handleSendFriendRequest = async (recipient: string) => {
    try {
      await friendsApi.sendRequest(recipient);
      setFriendMessage('Arkadaşlık isteği gönderildi.');
      setFriendSearch('');
      setFriendSearchResults([]);
      fetchFriends();
    } catch (err) {
      setFriendMessage(err instanceof Error ? err.message : 'İstek gönderilemedi.');
    }
  };

  const handleRespondFriendRequest = async (requestId: number, action: 'accept' | 'decline') => {
    try {
      await friendsApi.respondRequest(requestId, action);
      setFriendMessage(action === 'accept' ? 'Arkadaşlık isteği kabul edildi.' : 'Arkadaşlık isteği reddedildi.');
      fetchFriends();
    } catch (err) {
      setFriendMessage(err instanceof Error ? err.message : 'İstek güncellenemedi.');
    }
  };

  const handleRemoveFriend = async (friendId: number) => {
    const confirmed = await confirmAction({
      title: 'Arkadas kaldirilsin mi?',
      message: 'Bu kullanici arkadas listenizden kaldirilacak. Daha sonra tekrar istek gonderebilirsiniz.',
      confirmLabel: 'Arkadasi Kaldir',
      tone: 'danger',
    });

    if (!confirmed) return;

    try {
      await friendsApi.removeFriend(friendId);
      setFriendMessage('Arkadaş listeden kaldırıldı.');
      showButtonFeedback('Arkadas listenizden kaldirildi.', 'success');
      fetchFriends();
    } catch (err) {
      setFriendMessage(err instanceof Error ? err.message : 'Arkadaş kaldırılamadı.');
      showButtonFeedback(err instanceof Error ? err.message : 'Arkadas kaldirilamadi.', 'error');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-400/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),rgba(2,6,23,0.94)_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] px-5 py-8 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:px-8 lg:px-10">
        <div className="max-w-4xl">
          <p className="text-sm font-black uppercase tracking-[0.45em] text-emerald-300">Sosyal Alan</p>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Arkadaşlar ve İstekler</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-200 sm:text-lg">
            Arkadaş ekleme, bekleyen istekleri yönetme, aktif arkadaşları takip etme ve paylaşılan kuponlara hızlı geçiş burada toplanıyor.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className="rounded-3xl border border-white/10 bg-slate-950/45 p-6">
              <div className="text-base font-medium text-slate-300">{card.label}</div>
              <div className="mt-3 text-4xl font-black text-white">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.25)]">
        <div className="flex flex-wrap gap-3">
          {[
            { id: 'discover' as const, label: 'Keşfet' },
            { id: 'requests' as const, label: 'İstekler' },
            { id: 'friends' as const, label: `Arkadaş Listesi (${friends.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-2xl px-6 py-4 text-sm font-black transition ${
                activeTab === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_12px_28px_rgba(16,185,129,0.25)]'
                  : 'border border-white/10 bg-white/5 text-white hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {friendMessage && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-200">
          {friendMessage}
        </div>
      )}

      {activeTab === 'discover' && (
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_60px_rgba(2,6,23,0.22)] sm:p-8">
          <h2 className="text-3xl font-black text-white">Yeni arkadaş bul</h2>
          <p className="mt-4 text-base leading-7 text-slate-300">
            Kullanıcı adı veya tam e-posta ile arama yapabilir, gelen istekleri doğrudan sonuçlardan yönetebilirsiniz.
          </p>

          <div className="mt-8 flex flex-col gap-3 lg:flex-row">
            <input
              value={friendSearch}
              onChange={(event) => setFriendSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleFriendSearch()}
              placeholder="Kullanıcı adı veya e-posta"
              className="min-h-14 flex-1 rounded-2xl border border-white/10 bg-slate-950 px-5 text-base text-white outline-none placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
            <button
              type="button"
              onClick={handleFriendSearch}
              className="min-h-14 rounded-2xl bg-emerald-500 px-8 text-base font-black text-slate-950 transition hover:bg-emerald-400"
            >
              Ara
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {friendSearchResults.map((user) => (
              <div key={user.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-black text-white">{user.username}</div>
                  <div className="mt-1 text-sm text-slate-400">{relationshipText(user.relationship)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendFriendRequest(user.username)}
                  disabled={user.relationship !== 'none'}
                  className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  İstek Gönder
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'requests' && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
            <h2 className="text-2xl font-black text-white">Gelen İstekler</h2>
            <div className="mt-5 space-y-3">
              {loading && <div className="text-slate-400">Yükleniyor...</div>}
              {!loading && incomingRequests.length === 0 && <div className="text-slate-500">Gelen arkadaşlık isteği yok.</div>}
              {incomingRequests.map((request) => (
                <div key={request.id} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-black text-white">{request.requester_username}</div>
                    <div className="text-xs text-slate-500">{new Date(request.created_at).toLocaleDateString('tr-TR')}</div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => handleRespondFriendRequest(request.id, 'accept')} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-slate-950">
                      Kabul
                    </button>
                    <button type="button" onClick={() => handleRespondFriendRequest(request.id, 'decline')} className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold text-white">
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
            <h2 className="text-2xl font-black text-white">Gönderilen İstekler</h2>
            <div className="mt-5 space-y-3">
              {loading && <div className="text-slate-400">Yükleniyor...</div>}
              {!loading && outgoingRequests.length === 0 && <div className="text-slate-500">Bekleyen gönderilmiş istek yok.</div>}
              {outgoingRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                  <div className="font-black text-white">{request.recipient_username}</div>
                  <div className="mt-1 text-sm text-slate-500">Bekliyor</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'friends' && (
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black text-white">Arkadaş Listesi</h2>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-300">
              {friends.length} kişi
            </span>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading && <div className="text-slate-400">Yükleniyor...</div>}
            {!loading && friends.length === 0 && <div className="text-slate-500">Henüz arkadaş eklenmemiş.</div>}
            {friends.map((friend) => (
              <div key={friend.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="text-lg font-black text-white">{friend.username}</div>
                <div className="mt-1 truncate text-sm text-slate-500">{friend.email}</div>
                <button
                  type="button"
                  onClick={() => handleRemoveFriend(friend.id)}
                  className="mt-4 rounded-xl bg-red-500/15 px-4 py-2 text-sm font-bold text-red-300 transition hover:bg-red-500/25"
                >
                  Arkadaşı Sil
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
