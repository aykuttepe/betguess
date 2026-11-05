import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMatches } from '../hooks/useMatches';
import { couponsApi, CouponRow } from '../lib/coupons-api';
import { buildCouponPayload } from '../lib/coupon-payload';
import { FriendRequest, FriendSearchResult, FriendUser, friendsApi } from '../lib/friends-api';
import { fetchHistoryAnalysis } from '../lib/history-api';
import { SYSTEM_FORMULAS } from '../lib/system-formulas';
import {
  buildCouponInsight,
  CouponGrade,
  CouponInsight,
  KolonGrade,
  parseProgramNoFromWeekLabel,
} from '../lib/coupon-grading';
import { generateSystemCoupons, SystemMatchDistribution, SystemKupon } from '../lib/system-generator';
import { DEFAULT_SEQUENCE_FILTERS, HistoricalProgram, Kolon, Outcome, SequenceFilters, SportTotoMatch } from '../lib/types';
import KolonOutput, { KolonRowStatus } from '../components/KolonOutput';
import { applySequenceFilters } from '../lib/kolon-generator';
import { useLiveTracking } from '../hooks/useLiveTracking';
import { gradeCouponsLive, summarizeLiveGrades } from '../lib/live-grading';
import LiveTrackingDashboard from '../components/LiveTrackingDashboard';
import LiveCouponCard from '../components/LiveCouponCard';
import CelebrationOverlay from '../components/CelebrationOverlay';
import { useUsageStatus } from '../hooks/useUsageStatus';
import UpgradePrompt from '../components/UpgradePrompt';
import { useConfirm } from '../components/ConfirmDialog';
import { showButtonFeedback } from '../lib/button-feedback';

type Tab = 'otomatik' | 'kayitli' | 'gelen' | 'arkadaslar' | 'gelecek' | 'gecmis' | 'canli' | 'kazanan' | 'devam';
type GradeBucket = 12 | 13 | 14 | 15;
type GradeFilter = GradeBucket | 'kazanilan' | 'devam';

const GRADE_BUCKETS: GradeBucket[] = [15, 14, 13, 12];
const TAB_IDS: Tab[] = ['otomatik', 'kayitli', 'gelen', 'gelecek', 'gecmis', 'canli', 'kazanan', 'devam'];

function isTab(value: string | null): value is Tab {
  return TAB_IDS.includes(value as Tab);
}

function getGradeAccent(grade: CouponGrade): string {
  if (grade === 15) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  if (grade === 14) return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
  if (grade === 13) return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
  return 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30';
}

function normalizeSystemSelections(selections: string[] | undefined): Outcome[] {
  if (!selections) return [];

  return selections.filter((selection): selection is Outcome => (
    selection === '1' || selection === 'X' || selection === '2'
  ));
}

function systemKuponsToKolonlar(kupons: SystemKupon[], matches: SportTotoMatch[]): Kolon[] {
  const kolonlar: Kolon[] = [];

  for (const kupon of kupons) {
    const current = new Array<Outcome>(matches.length);

    const buildKolon = (matchIndex: number) => {
      if (matchIndex === matches.length) {
        kolonlar.push({
          id: kolonlar.length + 1,
          predictions: [...current],
        });
        return;
      }

      const match = matches[matchIndex];
      const outcomes = normalizeSystemSelections(kupon.selections[match.matchNumber]);
      if (outcomes.length === 0) {
        return;
      }

      for (const outcome of outcomes) {
        current[matchIndex] = outcome;
        buildKolon(matchIndex + 1);
      }
    };

    buildKolon(0);
  }

  return kolonlar;
}

export default function MyCouponsPage() {
  const [searchParams] = useSearchParams();
  const { program, loading: programLoading } = useMatches();
  const confirmAction = useConfirm();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab');
    return isTab(tab) ? tab : 'kayitli';
  });
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [sharedCoupons, setSharedCoupons] = useState<CouponRow[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<FriendSearchResult[]>([]);
  const [friendMessage, setFriendMessage] = useState<string | null>(null);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [historyPrograms, setHistoryPrograms] = useState<HistoricalProgram[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // For viewing a specific selected coupon
  const [selectedCoupon, setSelectedCoupon] = useState<{
    id: number;
    week: string;
    data: SystemKupon[];
    matches: SportTotoMatch[];
    snapshotUrl: string | null;
    canShare: boolean;
  } | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter | null>(null);
  const [detailActiveSequenceMatch, setDetailActiveSequenceMatch] = useState<number | null>(null);
  const [detailSequenceFilters, setDetailSequenceFilters] = useState<SequenceFilters>({
    ...DEFAULT_SEQUENCE_FILTERS,
  });
  const [shareRecipient, setShareRecipient] = useState('');
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareFriendSearch, setShareFriendSearch] = useState('');
  const [shareFriendResults, setShareFriendResults] = useState<FriendSearchResult[]>([]);
  const [shareFriendSearching, setShareFriendSearching] = useState(false);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [selectedCouponIds, setSelectedCouponIds] = useState<Set<number>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data: usage, canUse } = useUsageStatus();
  const [selectedLiveBucket, setSelectedLiveBucket] = useState<string | null>(null);
  const { liveProgram, loading: liveLoading, error: liveError, refetch: liveRefetch } = useLiveTracking(
    activeTab === 'canli' || activeTab === 'kayitli' || Boolean(selectedCoupon)
  );

  // Celebration overlay
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationHits, setCelebrationHits] = useState(0);

  useEffect(() => {
    fetchCoupons();
    fetchFriends();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (isTab(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchCouponHistory();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await couponsApi.getCoupons();
      setCoupons(Array.isArray(data) ? data : []);
      const incoming = await couponsApi.getSharedWithMe();
      setSharedCoupons(Array.isArray(incoming) ? incoming : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    setFriendsLoading(true);
    try {
      const [friendRows, requestRows] = await Promise.all([
        friendsApi.getFriends(),
        friendsApi.getRequests(),
      ]);

      setFriends(friendRows);
      setIncomingRequests(requestRows.incoming);
      setOutgoingRequests(requestRows.outgoing);
    } catch (err) {
      console.error(err);
    } finally {
      setFriendsLoading(false);
    }
  };

  const fetchCouponHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const analysis = await fetchHistoryAnalysis(200);
      setHistoryPrograms(analysis.programs);
    } catch (err: any) {
      setHistoryError(err.message || 'Gecmis kupon sonuclari yuklenemedi.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateAuto = async () => {
    if (!program || !program.matches || program.matches.length < 15) return;
    
    setGenerating(true);
    try {
      // Logic for automatic coupon generation:
      // Pick top 5 most confident matches as Kapali (1 choice), 4 slightly less confident as Cifte (2 choices)
      // This is a basic algorithm relying on preferences/odds.

      // Calculate confidence for each match. Lower sum of top choices => more confident? 
      // Actually, highest single preference % means most confident.
      const matchesWithConf = program.matches.map(m => {
        const probs = [
          { outcome: '1' as const, p: Number(m.preferences?.home) || 33 },
          { outcome: 'X' as const, p: Number(m.preferences?.draw) || 33 },
          { outcome: '2' as const, p: Number(m.preferences?.away) || 33 },
        ].sort((a,b) => b.p - a.p);
        
        return {
          matchNumber: m.matchNumber,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          top1: probs[0],
          top2: probs[1],
          top3: probs[2],
        };
      });

      // Sort by confidence of top 1 prediction
      matchesWithConf.sort((a,b) => b.top1.p - a.top1.p);

      const formula = SYSTEM_FORMULAS.find(f => f.kapaliCount === 2 && f.cifteCount === 4) || SYSTEM_FORMULAS[0];
      const { kapaliCount, cifteCount } = formula;
      const tekCount = 15 - kapaliCount - cifteCount;

      const targetCouponCount = 10; // Generate 10 coupons automatically

      const dists: SystemMatchDistribution[] = matchesWithConf.map((m, i) => {
        const counts: Record<string, number> = { '1': 0, 'X': 0, '2': 0, '1X': 0, '12': 0, 'X2': 0, '1X2': 0 };
        
        if (i < tekCount) {
          // Most confident -> Tek (Single Choice)
          counts[m.top1.outcome] = targetCouponCount;
        } else if (i < tekCount + cifteCount) {
          // Medium confident -> Cifte (Double Choice combining top 2)
          const c1 = m.top1.outcome;
          const c2 = m.top2.outcome;
          
          let formattedCombo = '1X';
          if ((c1==='1'&&c2==='X')||(c1==='X'&&c2==='1')) formattedCombo='1X';
          if ((c1==='1'&&c2==='2')||(c1==='2'&&c2==='1')) formattedCombo='12';
          if ((c1==='X'&&c2==='2')||(c1==='2'&&c2==='X')) formattedCombo='X2';

          counts[formattedCombo] = targetCouponCount;
        } else {
          // Least confident -> Kapali (Triple Choice)
          counts['1X2'] = targetCouponCount;
        }

        return {
           matchNumber: m.matchNumber,
           homeTeam: m.homeTeam,
           awayTeam: m.awayTeam,
           counts
        };
      });

      const generated = generateSystemCoupons(dists, targetCouponCount);

      await couponsApi.saveCoupon('otomatik', program.weekLabel, buildCouponPayload(generated, program.matches));
      await fetchCoupons();
    } catch (err) {
      console.error('Auto generate error:', err);
      showButtonFeedback('Otomatik kupon uretilirken bir hata olustu.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const currentWeek = program?.weekLabel || '';
  const currentProgramNo = parseProgramNoFromWeekLabel(currentWeek);

  const programsByNo = useMemo(() => {
    return new Map(historyPrograms.map((item) => [item.programNo, item]));
  }, [historyPrograms]);

  const couponInsights = useMemo(() => {
    return coupons.map((coupon) => buildCouponInsight(coupon, programsByNo));
  }, [coupons, programsByNo]);

  const sharedCouponInsights = useMemo(() => {
    return sharedCoupons.map((coupon) => buildCouponInsight(coupon, programsByNo));
  }, [sharedCoupons, programsByNo]);

  const savedCouponGradeSummary = useMemo(() => {
    const summary: Record<GradeBucket, number> = {
      15: 0,
      14: 0,
      13: 0,
      12: 0,
    };

    for (const insight of couponInsights) {
      if (insight.coupon.type !== 'kayitli' || insight.grade === null) {
        continue;
      }

      summary[insight.grade] += 1;
    }

    return summary;
  }, [couponInsights]);

  const wonCoupons = useMemo(() => {
    return couponInsights.filter(
      (i) => i.coupon.type === 'kayitli' && i.grade !== null && i.hasCompletedProgram
    );
  }, [couponInsights]);

  const ongoingCoupons = useMemo(() => {
    return couponInsights.filter(
      (i) => i.coupon.type === 'kayitli' && !i.hasCompletedProgram && i.programNo !== null
    );
  }, [couponInsights]);

  // Flatten winning kolonlar from all won coupons, deduplicate by selection signature
  const winningKolonlar = useMemo(() => {
    const all: { coupon: CouponRow; kolon: KolonGrade }[] = [];
    for (const insight of wonCoupons) {
      for (const kg of insight.kolonGrades) {
        if (kg.grade !== null) {
          all.push({ coupon: insight.coupon, kolon: kg });
        }
      }
    }

    // Deduplicate: group by selection signature (across coupons)
    const seen = new Map<string, { coupon: CouponRow; kolon: KolonGrade; count: number }>();
    for (const item of all) {
      const sig = item.kolon.matchDetails
        .map(md => `${md.matchNo}:${[...md.selections].sort().join('')}`)
        .join(',');
      const existing = seen.get(sig);
      if (existing) {
        existing.count++;
      } else {
        seen.set(sig, { ...item, count: 1 });
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.kolon.hitCount - a.kolon.hitCount);
  }, [wonCoupons]);

  const gradeCoupons = useMemo(() => {
    if (selectedGrade === null) return [];
    if (selectedGrade === 'kazanilan') return wonCoupons;
    if (selectedGrade === 'devam') return ongoingCoupons;
    return couponInsights.filter(
      (i) => i.coupon.type === 'kayitli' && i.grade === selectedGrade
    );
  }, [couponInsights, selectedGrade, wonCoupons, ongoingCoupons]);

  useEffect(() => {
    setSelectedGrade(null);
    setSelectedCouponIds(new Set());
  }, [activeTab]);

  useEffect(() => {
    setDetailActiveSequenceMatch(null);
    setDetailSequenceFilters({ ...DEFAULT_SEQUENCE_FILTERS });
    setShareRecipient('');
    setShareMessage(null);
    setShareFriendSearch('');
    setShareFriendResults([]);
    setShowSnapshot(false);
  }, [selectedCoupon?.id]);

  const selectedCouponMatches = useMemo(() => {
    if (!selectedCoupon) {
      return [];
    }

    return selectedCoupon.matches.length > 0 ? selectedCoupon.matches : program?.matches || [];
  }, [program?.matches, selectedCoupon]);

  const selectedCouponBaseKolonlar = useMemo(() => {
    if (!selectedCoupon) {
      return [];
    }

    return systemKuponsToKolonlar(selectedCoupon.data, selectedCouponMatches);
  }, [selectedCoupon, selectedCouponMatches]);

  const selectedCouponKolonlar = useMemo(() => {
    return applySequenceFilters(selectedCouponBaseKolonlar, detailSequenceFilters);
  }, [detailSequenceFilters, selectedCouponBaseKolonlar]);

  const selectedCouponProgramNo = useMemo(() => {
    return selectedCoupon ? parseProgramNoFromWeekLabel(selectedCoupon.week) : null;
  }, [selectedCoupon]);

  const selectedCouponRowStatuses = useMemo(() => {
    if (!selectedCoupon || selectedCouponProgramNo === null || selectedCouponKolonlar.length === 0) {
      return undefined;
    }

    const liveMatchesByNo = liveProgram?.programNo === selectedCouponProgramNo
      ? new Map(liveProgram.matches.map((match) => [match.matchNo, match.result]))
      : null;

    const historicalProgram = liveMatchesByNo ? null : programsByNo.get(selectedCouponProgramNo) ?? null;
    const historicalResultsByNo = historicalProgram
      ? new Map(historicalProgram.matches.map((match) => [match.matchNo, match.result]))
      : null;

    const statuses: Record<number, KolonRowStatus> = {};
    const hasResultSource = Boolean(liveMatchesByNo || historicalResultsByNo);

    for (const kolon of selectedCouponKolonlar) {
      let hitCount = 0;
      let missCount = 0;
      let pendingCount = 0;

      selectedCouponMatches.forEach((match, index) => {
        const prediction = kolon.predictions[index];
        const result = liveMatchesByNo
          ? liveMatchesByNo.get(match.matchNumber) ?? null
          : historicalResultsByNo?.get(match.matchNumber) ?? null;

        if (!hasResultSource || result === null) {
          pendingCount += 1;
          return;
        }

        if (prediction === result) {
          hitCount += 1;
        } else {
          missCount += 1;
        }
      });

      const eliminated = missCount > 3;
      statuses[kolon.id] = {
        tone: eliminated ? 'red' : 'blue',
        symbol: eliminated ? '!' : '✓',
        title: eliminated
          ? `${missCount} kayıp var. 3'ten fazla maç kaybı olduğu için elendi.`
          : hasResultSource
            ? `${hitCount} doğru, ${missCount} kayıp, ${pendingCount} bekliyor. Kupon devam ediyor.`
            : `${pendingCount} maç bekliyor. Bu program için sonuç verisi henüz yok.`,
      };
    }

    return statuses;
  }, [
    liveProgram,
    programsByNo,
    selectedCoupon,
    selectedCouponKolonlar,
    selectedCouponMatches,
    selectedCouponProgramNo,
  ]);

  const detailActiveSequenceOutcomes = detailActiveSequenceMatch === null
    ? []
    : detailSequenceFilters[detailActiveSequenceMatch] || [];

  const handleDetailSequenceOutcomesChange = useCallback((outcomes: Outcome[]) => {
    if (detailActiveSequenceMatch === null) {
      return;
    }

    setDetailSequenceFilters((prev) => {
      const next = { ...prev };

      if (outcomes.length === 0) {
        delete next[detailActiveSequenceMatch];
      } else {
        next[detailActiveSequenceMatch] = outcomes;
      }

      return next;
    });
  }, [detailActiveSequenceMatch]);

  const handleDetailActiveSequenceFilterReset = useCallback(() => {
    if (detailActiveSequenceMatch === null) {
      return;
    }

    setDetailSequenceFilters((prev) => {
      const next = { ...prev };
      delete next[detailActiveSequenceMatch];
      return next;
    });
  }, [detailActiveSequenceMatch]);

  const handleDetailSequenceFilterRemove = useCallback((matchNumber: number) => {
    setDetailSequenceFilters((prev) => {
      if (!(matchNumber in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[matchNumber];
      return next;
    });

    setDetailActiveSequenceMatch((current) => (current === matchNumber ? null : current));
  }, []);

  const handleFriendSearch = useCallback(async () => {
    const query = friendSearch.trim();
    setFriendMessage(null);

    if (query.length < 2) {
      setFriendSearchResults([]);
      setFriendMessage('Arama icin en az 2 karakter girin.');
      return;
    }

    try {
      const results = await friendsApi.searchUsers(query);
      setFriendSearchResults(results);
      if (results.length === 0) {
        setFriendMessage('Kullanici bulunamadi.');
      }
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Kullanici aramasi yapilamadi.');
    }
  }, [friendSearch]);

  const handleSendFriendRequest = useCallback(async (recipient: string) => {
    setFriendMessage(null);

    try {
      await friendsApi.sendRequest(recipient);
      setFriendMessage(`${recipient} kullanicisina arkadaslik istegi gonderildi.`);
      setFriendSearchResults([]);
      setFriendSearch('');
      await fetchFriends();
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Arkadaslik istegi gonderilemedi.');
    }
  }, []);

  const handleRespondFriendRequest = useCallback(async (requestId: number, action: 'accept' | 'decline') => {
    setFriendMessage(null);

    try {
      await friendsApi.respondRequest(requestId, action);
      setFriendMessage(action === 'accept' ? 'Arkadaslik istegi kabul edildi.' : 'Arkadaslik istegi reddedildi.');
      await fetchFriends();
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Arkadaslik istegi yanitlanamadi.');
    }
  }, []);

  const handleRemoveFriend = useCallback(async (friendId: number) => {
    const confirmed = await confirmAction({
      title: 'Arkadas kaldirilsin mi?',
      message: 'Bu kullanici arkadas listenizden kaldirilacak. Daha sonra tekrar istek gonderebilirsiniz.',
      confirmLabel: 'Arkadasi Kaldir',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setFriendMessage(null);

    try {
      await friendsApi.removeFriend(friendId);
      setFriendMessage('Arkadas listenizden kaldirildi.');
      showButtonFeedback('Arkadas listenizden kaldirildi.', 'success');
      await fetchFriends();
    } catch (error) {
      setFriendMessage(error instanceof Error ? error.message : 'Arkadas silinemedi.');
      showButtonFeedback(error instanceof Error ? error.message : 'Arkadas silinemedi.', 'error');
    }
  }, [confirmAction]);

  const handleShareSelectedCoupon = useCallback(async () => {
    if (!selectedCoupon || !selectedCoupon.canShare) {
      return;
    }

    const recipient = shareRecipient.trim();
    if (!recipient) {
      setShareMessage('Paylasmak icin bir arkadas secin.');
      return;
    }

    setShareLoading(true);
    setShareMessage(null);

    try {
      const result = await couponsApi.shareCoupon(selectedCoupon.id, recipient);
      setShareRecipient('');
      setShareMessage(`${result.recipient.username} kullanicisina paylasildi.`);
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Kupon paylasilamadi.');
    } finally {
      setShareLoading(false);
    }
  }, [selectedCoupon, shareRecipient]);

  const handleShareFriendSearch = useCallback(async () => {
    const query = shareFriendSearch.trim();
    setShareMessage(null);

    if (query.length < 2) {
      setShareFriendResults([]);
      setShareMessage('Arama icin en az 2 karakter girin.');
      return;
    }

    setShareFriendSearching(true);
    try {
      const results = await friendsApi.searchUsers(query);
      setShareFriendResults(results);
      if (results.length === 0) {
        setShareMessage('Kullanici bulunamadi.');
      }
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Kullanici aramasi yapilamadi.');
    } finally {
      setShareFriendSearching(false);
    }
  }, [shareFriendSearch]);

  const handleShareFriendRequest = useCallback(async (recipient: string) => {
    setShareMessage(null);

    try {
      await friendsApi.sendRequest(recipient);
      setShareMessage(`${recipient} kullanicisina arkadaslik istegi gonderildi.`);
      setShareFriendSearch('');
      setShareFriendResults([]);
      await fetchFriends();
    } catch (error) {
      setShareMessage(error instanceof Error ? error.message : 'Arkadaslik istegi gonderilemedi.');
    }
  }, []);

  const filteredCoupons = useMemo(() => {
    // Kazanan and devam tabs use their own dedicated lists
    if (activeTab === 'kazanan') return wonCoupons;
    if (activeTab === 'devam') return ongoingCoupons;

    const matchesTab = (insight: CouponInsight) => {
      const { coupon, programNo } = insight;

      if (activeTab === 'otomatik') return coupon.type === 'otomatik';
      if (activeTab === 'kayitli') return coupon.type === 'kayitli';
      if (activeTab === 'gelecek') {
        if (currentProgramNo !== null && programNo !== null) {
          return programNo >= currentProgramNo;
        }
        return coupon.week === currentWeek;
      }
      if (activeTab === 'gecmis') {
        if (currentProgramNo !== null && programNo !== null) {
          return programNo < currentProgramNo;
        }
        return coupon.week !== currentWeek && coupon.week !== '';
      }
      return false;
    };

    if (activeTab === 'gelen') {
      return sharedCouponInsights;
    }

    return couponInsights
      .filter(matchesTab)
      .sort((left, right) => {
        if (activeTab === 'kayitli' || activeTab === 'gecmis') {
          const hitDelta = (right.bestHitCount ?? -1) - (left.bestHitCount ?? -1);
          if (hitDelta !== 0) {
            return hitDelta;
          }
        }

        return new Date(right.coupon.created_at).getTime() - new Date(left.coupon.created_at).getTime();
      });
  }, [activeTab, couponInsights, currentProgramNo, currentWeek, wonCoupons, ongoingCoupons, sharedCouponInsights]);

  const bulkSelectableCouponIds = useMemo(() => {
    if (activeTab !== 'kayitli') {
      return [];
    }

    return filteredCoupons
      .filter((insight) => insight.coupon.type === 'kayitli' && !insight.coupon.share_id)
      .map((insight) => insight.coupon.id);
  }, [activeTab, filteredCoupons]);

  const selectedBulkCouponIds = useMemo(() => {
    return bulkSelectableCouponIds.filter((id) => selectedCouponIds.has(id));
  }, [bulkSelectableCouponIds, selectedCouponIds]);

  const allBulkCouponsSelected = bulkSelectableCouponIds.length > 0
    && selectedBulkCouponIds.length === bulkSelectableCouponIds.length;

  const toggleCouponSelection = useCallback((couponId: number) => {
    setSelectedCouponIds((current) => {
      const next = new Set(current);
      if (next.has(couponId)) {
        next.delete(couponId);
      } else {
        next.add(couponId);
      }
      return next;
    });
  }, []);

  const toggleAllBulkSelection = useCallback(() => {
    setSelectedCouponIds((current) => {
      const next = new Set(current);

      if (allBulkCouponsSelected) {
        bulkSelectableCouponIds.forEach((id) => next.delete(id));
      } else {
        bulkSelectableCouponIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }, [allBulkCouponsSelected, bulkSelectableCouponIds]);

  const handleBulkDelete = useCallback(async () => {
    const idsToDelete = bulkSelectableCouponIds.filter((id) => selectedCouponIds.has(id));
    if (idsToDelete.length === 0) {
      return;
    }

    const confirmed = await confirmAction({
      title: 'Secili kuponlar silinsin mi?',
      message: `${idsToDelete.length} kayitli kupon kalici olarak silinecek. Bu islem geri alinamaz.`,
      confirmLabel: 'Kuponlari Sil',
      tone: 'danger',
    });

    if (!confirmed) {
      return;
    }

    setBulkDeleting(true);
    try {
      await Promise.all(idsToDelete.map((id) => couponsApi.deleteCoupon(id)));
      setSelectedCouponIds(new Set());
      if (selectedCoupon && idsToDelete.includes(selectedCoupon.id)) {
        setSelectedCoupon(null);
      }
      await fetchCoupons();
      showButtonFeedback(`${idsToDelete.length} kupon silindi.`, 'success');
    } catch (error) {
      showButtonFeedback(error instanceof Error ? error.message : 'Kuponlar silinirken bir hata olustu.', 'error');
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkSelectableCouponIds, selectedCouponIds, selectedCoupon, confirmAction]);

  const gradedCouponCount = useMemo(() => {
    return GRADE_BUCKETS.reduce((total, grade) => total + savedCouponGradeSummary[grade], 0);
  }, [savedCouponGradeSummary]);

  const liveGrades = useMemo(() => {
    if (!liveProgram) return [];
    // Get all kayitli coupons for the current program
    const currentKupons: { id: string; selections: Record<number, string[]> }[] = [];
    for (const insight of couponInsights) {
      if (insight.coupon.type !== 'kayitli') continue;
      // Match coupon to current program by programNo
      if (insight.programNo !== null && insight.programNo === liveProgram.programNo) {
        for (const k of insight.parsedData) {
          currentKupons.push(k);
        }
      }
    }
    return gradeCouponsLive(currentKupons, liveProgram);
  }, [liveProgram, couponInsights]);

  // Deduplicate liveGrades by selection signature
  const dedupedLiveGrades = useMemo(() => {
    const dedupMap = new Map<string, { grade: typeof liveGrades[0]; count: number }>();
    for (const g of liveGrades) {
      const sig = g.matchDetails
        .map(md => `${md.matchNo}:${[...md.selection].sort().join('')}`)
        .join('|');
      const existing = dedupMap.get(sig);
      if (existing) {
        existing.count++;
      } else {
        dedupMap.set(sig, { grade: g, count: 1 });
      }
    }
    return Array.from(dedupMap.values())
      .sort((a, b) => {
        if (b.grade.hitCount !== a.grade.hitCount) return b.grade.hitCount - a.grade.hitCount;
        return a.grade.missCount - b.grade.missCount;
      });
  }, [liveGrades]);

  const liveSummary = useMemo(() => {
    if (!liveProgram || liveGrades.length === 0) return null;
    return summarizeLiveGrades(liveGrades, liveProgram.finishedCount, liveProgram.notStartedCount + liveProgram.inProgressCount);
  }, [liveGrades, liveProgram]);

  // Auto-trigger celebration when all matches finished and best hit >= 12
  useEffect(() => {
    if (!liveSummary || !liveProgram) return;
    const allFinished = liveSummary.pendingMatchCount === 0 && liveSummary.finishedMatchCount > 0;
    const bestHit = liveSummary.bestHitCount;
    if (allFinished && bestHit >= 12) {
      const storageKey = `celebration-shown-${liveProgram.programNo}`;
      // Check localStorage so it only shows once per program, ever
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, '1');
        setCelebrationHits(bestHit);
        setShowCelebration(true);
      }
    }
  }, [liveSummary, liveProgram]);

  const renderCouponCard = (insight: CouponInsight) => {
    const { coupon, parsedData, savedMatches, snapshot, grade, bestHitCount, hasCompletedProgram } = insight;
    const isSharedCoupon = Boolean(coupon.share_id);
    const canBulkSelect = activeTab === 'kayitli' && coupon.type === 'kayitli' && !isSharedCoupon;
    const selectedForBulk = selectedCouponIds.has(coupon.id);

    return (
      <div
        key={coupon.id}
        className={`bg-gray-800 border rounded-xl p-5 shadow-lg flex flex-col transition-colors ${
          selectedForBulk ? 'border-emerald-500/70 ring-1 ring-emerald-500/30' : 'border-gray-700'
        }`}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            {canBulkSelect && (
              <label className="mb-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-2 py-1 text-xs font-semibold text-gray-300 hover:border-emerald-500/50 hover:text-emerald-300">
                <input
                  type="checkbox"
                  checked={selectedForBulk}
                  onChange={() => toggleCouponSelection(coupon.id)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                />
                Seç
              </label>
            )}
            <span className="text-xs font-bold px-2 py-1 bg-gray-700 rounded text-gray-300">
              #{coupon.id}
            </span>
            <h3 className="text-emerald-400 font-bold mt-2">{coupon.week}</h3>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-xs px-2 py-1 rounded font-bold ${coupon.type === 'otomatik' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-500'}`}>
              {coupon.type.toUpperCase()}
            </span>
            {grade !== null && (
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${getGradeAccent(grade)}`}>
                {grade}'e Giden
              </span>
            )}
            {isSharedCoupon && (
              <span className="text-xs px-2 py-1 rounded font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                BANA GELEN
              </span>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          İçerisinde <strong className="text-gray-200">{parsedData.length}</strong> adet farklı kolon barındırıyor.
        </p>
        {isSharedCoupon && (
          <p className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
            Gönderen: <strong>{coupon.sender_username}</strong>
          </p>
        )}

        {hasCompletedProgram && bestHitCount !== null && (
          <div className="mb-4 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-gray-500">En iyi derece</div>
            <div className="mt-1 text-sm font-semibold text-white">
              {bestHitCount}/15 isabet
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 border-t border-gray-700 flex justify-between items-center gap-2">
          <span className="text-xs text-gray-500">
            Oluşturulma: {new Date(coupon.created_at).toLocaleDateString('tr-TR')}
          </span>

          <div className="flex gap-2">
            {!isSharedCoupon && (
              <button
                onClick={async () => {
                  const confirmed = await confirmAction({
                    title: 'Kupon silinsin mi?',
                    message: 'Bu kayitli kupon kalici olarak silinecek. Bu islem geri alinamaz.',
                    confirmLabel: 'Kuponu Sil',
                    tone: 'danger',
                  });

                  if (!confirmed) {
                    return;
                  }

                  try {
                    await couponsApi.deleteCoupon(coupon.id);
                    await fetchCoupons();
                    if (selectedCoupon?.id === coupon.id) setSelectedCoupon(null);
                    setSelectedCouponIds((current) => {
                      const next = new Set(current);
                      next.delete(coupon.id);
                      return next;
                    });
                    showButtonFeedback('Kupon silindi.', 'success');
                  } catch (error) {
                    showButtonFeedback(error instanceof Error ? error.message : 'Kupon silinemedi.', 'error');
                  }
                }}
                className="text-gray-500 hover:text-red-400 transition-colors p-2"
                title="Sil"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            )}
            <button
              onClick={() => setSelectedCoupon({
                id: coupon.id,
                week: coupon.week,
                data: parsedData,
                matches: savedMatches,
                snapshotUrl: snapshot?.url ?? null,
                canShare: !isSharedCoupon,
              })}
              className="bg-gray-700 hover:bg-gray-600 text-sm font-medium px-4 py-1.5 rounded transition-colors"
            >
              Detay Görüntüle
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">Kuponlarım</h1>
          <p className="text-gray-400 text-sm mt-1">Kayıtlı sistem kuponlarınız ve YZ ile otomatik üretilen tahminler.</p>
          {usage && usage.limits['saved_coupons'] && usage.limits['saved_coupons'].limit !== -1 && (
            <p className="text-xs mt-2 font-medium bg-gray-700/50 inline-block px-2 py-1 rounded text-gray-300 border border-gray-600">
              Günlük Kaydetme Kotası: <span className={!canUse('saved_coupons') ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{usage.limits['saved_coupons'].used} / {usage.limits['saved_coupons'].limit}</span>
            </p>
          )}
        </div>
        <button
          onClick={handleGenerateAuto}
          disabled={generating || programLoading}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {generating ? 'Üretiliyor...' : '✨ Otomatik Kupon Üret'}
        </button>
      </div>

      {!canUse('saved_coupons') && (
        <UpgradePrompt 
          feature="saved_coupons" 
          usageInfo={usage?.limits['saved_coupons']}
          requiredTier={usage?.tier === 'free' ? 'pro' : 'premium'}
        />
      )}

      <div className="bg-gray-800/40 rounded-lg p-2 flex overflow-x-auto gap-2 border border-gray-700">
        {[
          { id: 'canli', label: 'Canli Takip', badge: null, accent: null },
          { id: 'kazanan', label: '🏆 Kazananlar', badge: wonCoupons.length, accent: 'emerald' },
          { id: 'devam', label: '▶ Devam Eden', badge: ongoingCoupons.length, accent: 'sky' },
          { id: 'kayitli', label: 'Kayıtlı Kuponlarım', badge: null, accent: null },
          { id: 'gelen', label: 'Bana Gelenler', badge: sharedCoupons.length, accent: 'emerald' },
          { id: 'otomatik', label: 'Otomatik Oynadıklarım', badge: null, accent: null },
          { id: 'gelecek', label: 'Gelecek Hafta', badge: null, accent: null },
          { id: 'gecmis', label: 'Geçmiş Hafta', badge: null, accent: null },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const accentColor = tab.accent === 'sky' ? 'sky' : 'emerald';
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as Tab);
                setSelectedCoupon(null);
              }}
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap flex items-center gap-2 ${
                isActive
                  ? tab.accent === 'sky'
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                  : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-transparent'
              }`}
            >
              {tab.label}
              {tab.badge !== null && tab.badge > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                  isActive
                    ? accentColor === 'sky' ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'canli' && (
        <div className="space-y-4">
          {liveLoading && !liveProgram && (
            <div className="text-center py-12 text-gray-400">
              <div className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p>Canli program verileri yukleniyor...</p>
            </div>
          )}

          {liveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {liveError}
            </div>
          )}

          {liveProgram && liveSummary && (
            <>
              <LiveTrackingDashboard
                summary={liveSummary}
                programNo={liveProgram.programNo}
                fetchedAt={liveProgram.fetchedAt}
                onRefresh={liveRefetch}
                loading={liveLoading}
              />
              <div className="space-y-2">
                {dedupedLiveGrades.map(({ grade, count }, i) => (
                  <LiveCouponCard key={`${grade.kuponId}-${i}`} grade={grade} index={i} count={count} />
                ))}
              </div>
            </>
          )}

          {liveProgram && liveGrades.length === 0 && !liveLoading && (
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-8 text-center text-gray-400">
              <p className="text-lg mb-2">Canli takip icin kayitli kupon bulunamadi.</p>
              <p className="text-sm">
                Mevcut program ({liveProgram.programNo}) ile eslesen kayitli kuponunuz yok.
                Kupon kaydedin ve buradan canli takip edin.
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'kayitli' && liveSummary && liveProgram && (
        <div className="bg-gray-800/55 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Canli Derecelendirme — Program {liveProgram.programNo}
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                {liveSummary.finishedMatchCount}/{liveSummary.finishedMatchCount + liveSummary.pendingMatchCount} mac tamamlandi
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Son: {new Date(liveProgram.fetchedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <button onClick={liveRefetch} disabled={liveLoading} className="text-xs px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">
                {liveLoading ? '...' : 'Yenile'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { id: 'perfect', label: "15'te 15", subtitle: 'Hatasiz', count: liveSummary.buckets.perfect, accent: 'emerald' },
              { id: 'oneMiss', label: "15'te 14", subtitle: '1 Yanlis', count: liveSummary.buckets.oneMiss, accent: 'sky' },
              { id: 'twoMiss', label: "15'te 13", subtitle: '2 Yanlis', count: liveSummary.buckets.twoMiss, accent: 'amber' },
              { id: 'threeMiss', label: "15'te 12", subtitle: '3 Yanlis', count: liveSummary.buckets.threeMiss, accent: 'fuchsia' },
              { id: 'eliminated', label: 'Elenmis', subtitle: '4+ Yanlis', count: liveSummary.buckets.eliminated, accent: 'gray' },
            ].map(b => {
              const isSelected = selectedLiveBucket === b.id;
              return (
                <div
                  key={b.id}
                  onClick={() => b.count > 0 && setSelectedLiveBucket(isSelected ? null : b.id)}
                  className={`rounded-2xl border px-5 py-4 transition-all ${
                    b.count === 0 ? 'border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 opacity-50' :
                    isSelected
                      ? b.accent === 'emerald' ? 'border-emerald-400/50 bg-emerald-500/15 ring-1 ring-emerald-400/30 cursor-pointer' :
                        b.accent === 'sky' ? 'border-sky-400/50 bg-sky-500/15 ring-1 ring-sky-400/30 cursor-pointer' :
                        b.accent === 'amber' ? 'border-amber-400/50 bg-amber-500/15 ring-1 ring-amber-400/30 cursor-pointer' :
                        b.accent === 'fuchsia' ? 'border-fuchsia-400/50 bg-fuchsia-500/15 ring-1 ring-fuchsia-400/30 cursor-pointer' :
                        'border-gray-500/50 bg-gray-500/15 ring-1 ring-gray-400/30 cursor-pointer'
                      : 'border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-gray-500 cursor-pointer'
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-300">{b.label}</div>
                  <div className="text-xs text-gray-500">{b.subtitle}</div>
                  <div className="mt-2 text-3xl font-black text-white">{b.count}</div>
                </div>
              );
            })}
          </div>

          {/* Expanded live bucket kolonlar */}
          {selectedLiveBucket && (() => {
            const bucketKolonlar = liveGrades.filter(g => {
              if (g.maxPossible < 12) return false;
              if (selectedLiveBucket === 'perfect') return g.isAlive && g.missCount === 0;
              if (selectedLiveBucket === 'oneMiss') return g.isAlive && g.missCount === 1;
              if (selectedLiveBucket === 'twoMiss') return g.isAlive && g.missCount === 2;
              if (selectedLiveBucket === 'threeMiss') return g.isAlive && g.missCount === 3;
              if (selectedLiveBucket === 'eliminated') return !g.isAlive;
              return false;
            });

            if (bucketKolonlar.length === 0) return null;

            // Deduplicate by selection signature
            const dedupMap = new Map<string, { grade: typeof bucketKolonlar[0]; count: number }>();
            for (const g of bucketKolonlar) {
              const sig = g.matchDetails
                .map(md => `${md.matchNo}:${[...md.selection].sort().join('')}`)
                .join('|');
              const existing = dedupMap.get(sig);
              if (existing) {
                existing.count++;
              } else {
                dedupMap.set(sig, { grade: g, count: 1 });
              }
            }
            const uniqueKolonlar = Array.from(dedupMap.values())
              .sort((a, b) => b.grade.hitCount - a.grade.hitCount);

            return (
              <div className="space-y-3 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {uniqueKolonlar.length} farklı kolon listeleniyor
                    {bucketKolonlar.length !== uniqueKolonlar.length && (
                      <span className="text-gray-500 font-normal ml-2">
                        (toplam {bucketKolonlar.length} kolon, {bucketKolonlar.length - uniqueKolonlar.length} tekrar)
                      </span>
                    )}
                  </h3>
                  <button
                    onClick={() => setSelectedLiveBucket(null)}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    ✕ Kapat
                  </button>
                </div>
                {uniqueKolonlar.map(({ grade: g, count }, i) => (
                  <div key={`${g.kuponId}-${i}`} className={`rounded-2xl border overflow-hidden ${
                    g.missCount === 0 ? 'border-emerald-500/40' :
                    g.missCount === 1 ? 'border-sky-500/40' :
                    g.missCount <= 3 ? 'border-amber-500/40' :
                    'border-gray-600'
                  }`}>
                    <div className={`px-4 py-2.5 flex items-center justify-between ${
                      g.missCount === 0 ? 'bg-emerald-500/15' :
                      g.missCount === 1 ? 'bg-sky-500/15' :
                      g.missCount <= 3 ? 'bg-amber-500/15' :
                      'bg-gray-700/30'
                    }`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-mono">#{i + 1}</span>
                        <span className={`text-lg font-black ${
                          g.missCount === 0 ? 'text-emerald-300' :
                          g.missCount === 1 ? 'text-sky-300' :
                          g.missCount <= 3 ? 'text-amber-300' :
                          'text-gray-400'
                        }`}>
                          {g.hitCount}✓ {g.missCount}✗ {g.pendingCount}⏳
                        </span>
                        {count > 1 && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            ×{count} adet
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        Maks: {g.maxPossible}/15
                      </span>
                    </div>
                    <div className="divide-y divide-gray-800/50">
                      {g.matchDetails.map((md) => (
                        <div key={md.matchNo} className={`px-4 py-1.5 flex items-center gap-2 text-sm ${
                          md.status === 'hit' ? 'bg-emerald-500/8' :
                          md.status === 'miss' ? 'bg-red-500/10' :
                          'bg-gray-900/30'
                        }`}>
                          <span className="w-5 text-center text-[11px] text-gray-500 font-mono">{md.matchNo}</span>
                          <div className="flex-1 min-w-0 truncate text-gray-300 text-xs">
                            {md.homeTeam} - {md.awayTeam}
                          </div>
                          <span className={`w-10 text-center text-xs font-bold ${
                            md.status === 'hit' ? 'text-emerald-400' :
                            md.status === 'miss' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {md.selection.join('-') || '-'}
                          </span>
                          <span className="text-[11px] text-gray-500 w-10 text-center">
                            {md.score || '-'}
                          </span>
                          <span className={`w-4 text-center text-xs font-bold ${
                            md.status === 'hit' ? 'text-emerald-400' :
                            md.status === 'miss' ? 'text-red-400' :
                            'text-yellow-400/60'
                          }`}>
                            {md.result || '?'}
                          </span>
                          <span className="w-4 text-center text-sm">
                            {md.status === 'hit' ? <span className="text-emerald-400">✓</span> :
                             md.status === 'miss' ? <span className="text-red-400">✗</span> :
                             <span className="text-yellow-400">⏳</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex gap-4 text-sm text-gray-400">
            <span>Toplam: <strong className="text-white">{liveSummary.totalCoupons}</strong></span>
            <span className="text-emerald-400">Devam eden: <strong>{liveSummary.aliveCount}</strong></span>
            <span className="text-gray-500">Elenen: <strong>{liveSummary.eliminatedCount}</strong></span>
          </div>
        </div>
      )}

      {activeTab === 'kayitli' && (
        <div className="bg-gray-800/55 border border-gray-700 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Gecmis Program Dereceleri</h2>
              <p className="text-sm text-gray-400 mt-1">
                Gecmis programlardaki kayitli kuponlarinizin isabet dereceleri.
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {historyLoading
                ? 'Geçmiş program sonuçları yükleniyor...'
                : `${gradedCouponCount} adet kayıtlı kupon için derece bulundu.`}
            </div>
          </div>

          {historyError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              {historyError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {GRADE_BUCKETS.map((grade) => (
              <div
                key={grade}
                onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
                className={`rounded-2xl border px-5 py-4 cursor-pointer transition-all ${
                  selectedGrade === grade
                    ? 'border-white/40 bg-gradient-to-br from-slate-700 to-slate-800 ring-1 ring-white/20'
                    : 'border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-gray-500'
                }`}
              >
                <div className="text-sm font-semibold text-gray-300">{grade}'e Giden Kuponlar</div>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <span className="text-3xl font-black text-white">{savedCouponGradeSummary[grade]}</span>
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    {grade}/15
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setSelectedGrade(selectedGrade === 'kazanilan' ? null : 'kazanilan')}
              className={`rounded-2xl border px-5 py-4 cursor-pointer transition-all ${
                selectedGrade === 'kazanilan'
                  ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-900/30 to-slate-800 ring-1 ring-emerald-400/30'
                  : 'border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-gray-500'
              }`}
            >
              <div className="text-sm font-semibold text-emerald-400">Kazanılan Kuponlar</div>
              <div className="text-xs text-gray-500 mt-0.5">12+ isabet ile dereceye giren kuponlar</div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <span className="text-3xl font-black text-white">{wonCoupons.length}</span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  Tamamlandı
                </span>
              </div>
            </div>
            <div
              onClick={() => setSelectedGrade(selectedGrade === 'devam' ? null : 'devam')}
              className={`rounded-2xl border px-5 py-4 cursor-pointer transition-all ${
                selectedGrade === 'devam'
                  ? 'border-sky-400/50 bg-gradient-to-br from-sky-900/30 to-slate-800 ring-1 ring-sky-400/30'
                  : 'border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-gray-500'
              }`}
            >
              <div className="text-sm font-semibold text-sky-400">Devam Eden Kuponlar</div>
              <div className="text-xs text-gray-500 mt-0.5">Programı henüz tamamlanmamış kuponlar</div>
              <div className="mt-3 flex items-end justify-between gap-4">
                <span className="text-3xl font-black text-white">{ongoingCoupons.length}</span>
                <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                  Aktif
                </span>
              </div>
            </div>
          </div>

          {selectedGrade !== null && (() => {
            // Get all kolonlar matching the selected grade, deduplicated
            const all: { coupon: CouponRow; kolon: KolonGrade }[] = [];
            for (const insight of gradeCoupons) {
              for (const kg of insight.kolonGrades) {
                if (selectedGrade === 'kazanilan' || selectedGrade === 'devam') {
                  if (kg.grade !== null) all.push({ coupon: insight.coupon, kolon: kg });
                } else {
                  if (kg.grade === selectedGrade) all.push({ coupon: insight.coupon, kolon: kg });
                }
              }
            }
            // Deduplicate by selection signature (across all coupons)
            const seen = new Map<string, { coupon: CouponRow; kolon: KolonGrade; count: number }>();
            for (const item of all) {
              const sig = item.kolon.matchDetails
                .map(md => `${md.matchNo}:${[...md.selections].sort().join('')}`)
                .join(',');
              const existing = seen.get(sig);
              if (existing) { existing.count++; } else { seen.set(sig, { ...item, count: 1 }); }
            }
            const matchingKolonlar = Array.from(seen.values())
              .sort((a, b) => b.kolon.hitCount - a.kolon.hitCount);

            return (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">
                    {selectedGrade === 'kazanilan'
                      ? `Kazanılan Kolonlar (${matchingKolonlar.length})`
                      : selectedGrade === 'devam'
                      ? `Devam Eden Kuponlar (${gradeCoupons.length})`
                      : `${selectedGrade}'e Giden Kolonlar (${matchingKolonlar.length})`}
                  </h3>
                  <button
                    onClick={() => setSelectedGrade(null)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    ✕ Kapat
                  </button>
                </div>

                {selectedGrade === 'devam' ? (
                  gradeCoupons.length === 0 ? (
                    <p className="text-gray-500 text-sm">Devam eden kupon bulunamadı.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {gradeCoupons.map((insight) => renderCouponCard(insight))}
                    </div>
                  )
                ) : matchingKolonlar.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    {selectedGrade === 'kazanilan'
                      ? 'Henüz kazanılan kolon bulunamadı.'
                      : 'Bu dereceye ulaşan kolon bulunamadı.'}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {matchingKolonlar.map(({ coupon, kolon, count }) => (
                      <div key={`grade-${coupon.id}-${kolon.kolonId}`} className={`rounded-2xl border overflow-hidden ${
                        kolon.grade === 15 ? 'border-emerald-500/40' :
                        kolon.grade === 14 ? 'border-sky-500/40' :
                        kolon.grade === 13 ? 'border-amber-500/40' :
                        'border-fuchsia-500/40'
                      }`}>
                        <div className={`px-4 py-2.5 flex items-center justify-between ${
                          kolon.grade === 15 ? 'bg-emerald-500/15' :
                          kolon.grade === 14 ? 'bg-sky-500/15' :
                          kolon.grade === 13 ? 'bg-amber-500/15' :
                          'bg-fuchsia-500/15'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`text-lg font-black ${
                              kolon.grade === 15 ? 'text-emerald-300' :
                              kolon.grade === 14 ? 'text-sky-300' :
                              kolon.grade === 13 ? 'text-amber-300' :
                              'text-fuchsia-300'
                            }`}>{kolon.hitCount}/15</span>
                            <span className="text-sm text-white font-medium">{coupon.week}</span>
                            <span className="text-xs text-gray-500">#{coupon.id}</span>
                            {count > 1 && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-bold">
                                x{count} adet
                              </span>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            kolon.grade === 15 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                            kolon.grade === 14 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                            kolon.grade === 13 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                            'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                          }`}>
                            {kolon.grade === 15 ? '🏆 TAM' : `${kolon.grade}'e Giden`}
                          </span>
                        </div>
                        <div className="divide-y divide-gray-800/50">
                          {kolon.matchDetails.map((md) => (
                            <div key={md.matchNo} className={`px-4 py-1.5 flex items-center gap-2 text-sm ${
                              md.isHit ? 'bg-gray-900/40' : 'bg-red-500/8'
                            }`}>
                              <span className="w-5 text-center text-[11px] text-gray-500 font-mono">{md.matchNo}</span>
                              <div className="flex-1 min-w-0 truncate text-gray-300 text-xs">
                                {md.homeTeam} - {md.awayTeam}
                              </div>
                              <span className="text-[11px] text-gray-500 w-10 text-center">{md.score}</span>
                              <span className={`w-10 text-center text-xs font-bold ${md.isHit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {md.selections.join('-')}
                              </span>
                              <span className={`w-4 text-center text-xs font-bold ${md.isHit ? 'text-emerald-400' : 'text-red-400/60'}`}>
                                {md.result}
                              </span>
                              <span className="w-4 text-center text-xs">
                                {md.isHit ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✗</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {!historyLoading && !historyError && gradedCouponCount === 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-sm text-gray-400">
              Geçmiş programlarla eşleşen 12, 13, 14 veya 15 isabetli kayıtlı kupon bulunamadı.
            </div>
          )}
        </div>
      )}

      {/* ─── Kazanan Kuponlar Tab ─── */}
      {activeTab === 'kazanan' && (
        <div className="space-y-4">
          <div className="bg-gray-800/55 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-emerald-400 flex items-center gap-2">
                  🏆 Kazanan Kolonlar
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  12+ isabet ile dereceye giren kolonlarınız, maç detaylarıyla birlikte.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {historyLoading ? 'Geçmiş sonuçlar yükleniyor...' : `${winningKolonlar.length} kazanan kolon`}
              </div>
            </div>

            {winningKolonlar.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {GRADE_BUCKETS.map((grade) => {
                  const count = winningKolonlar.filter(k => k.kolon.grade === grade).length;
                  return (
                    <div key={grade} className={`rounded-xl border px-4 py-3 text-center ${
                      grade === 15 ? 'border-emerald-500/40 bg-emerald-500/10' :
                      grade === 14 ? 'border-sky-500/40 bg-sky-500/10' :
                      grade === 13 ? 'border-amber-500/40 bg-amber-500/10' :
                      'border-fuchsia-500/40 bg-fuchsia-500/10'
                    }`}>
                      <div className="text-xs text-gray-400">{grade}/15 isabet</div>
                      <div className="mt-1 text-2xl font-black text-white">{count}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {historyLoading ? (
            <div className="text-center py-12 text-gray-400">
              <div className="inline-block w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
              <p>Geçmiş sonuçlar yükleniyor...</p>
            </div>
          ) : winningKolonlar.length === 0 ? (
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center text-gray-400">
              Henüz 12+ isabet ile kazanan kolon bulunamadı.
            </div>
          ) : (
            <div className="space-y-4">
              {winningKolonlar.map(({ coupon, kolon, count }) => (
                <div key={`${coupon.id}-${kolon.kolonId}`} className={`rounded-2xl border overflow-hidden ${
                  kolon.grade === 15 ? 'border-emerald-500/40' :
                  kolon.grade === 14 ? 'border-sky-500/40' :
                  kolon.grade === 13 ? 'border-amber-500/40' :
                  'border-fuchsia-500/40'
                }`}>
                  {/* Header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${
                    kolon.grade === 15 ? 'bg-emerald-500/15' :
                    kolon.grade === 14 ? 'bg-sky-500/15' :
                    kolon.grade === 13 ? 'bg-amber-500/15' :
                    'bg-fuchsia-500/15'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xl font-black ${
                        kolon.grade === 15 ? 'text-emerald-300' :
                        kolon.grade === 14 ? 'text-sky-300' :
                        kolon.grade === 13 ? 'text-amber-300' :
                        'text-fuchsia-300'
                      }`}>
                        {kolon.hitCount}/15
                      </span>
                      <div>
                        <span className="text-sm font-semibold text-white">{coupon.week}</span>
                        <span className="text-xs text-gray-400 ml-2">Kupon #{coupon.id}</span>
                      </div>
                      {count > 1 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 font-bold">
                          x{count} adet
                        </span>
                      )}
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                      kolon.grade === 15 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      kolon.grade === 14 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30' :
                      kolon.grade === 13 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                    }`}>
                      {kolon.grade === 15 ? '🏆 TAM İSABET' : `${kolon.grade}'e Giden`}
                    </span>
                  </div>

                  {/* Match details table */}
                  <div className="divide-y divide-gray-800">
                    {kolon.matchDetails.map((md) => (
                      <div
                        key={md.matchNo}
                        className={`px-4 py-2 flex items-center gap-3 text-sm ${
                          md.isHit ? 'bg-gray-900/40' : 'bg-red-500/5'
                        }`}
                      >
                        <span className="w-6 text-center text-xs text-gray-500 font-mono">{md.matchNo}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-200 truncate">{md.homeTeam}</span>
                          <span className="text-gray-500 mx-1">-</span>
                          <span className="text-gray-200 truncate">{md.awayTeam}</span>
                        </div>
                        <span className="text-xs text-gray-400 w-12 text-center">{md.score}</span>
                        <span className="text-xs text-gray-500 w-8 text-center font-bold">
                          {md.selections.join('-')}
                        </span>
                        <span className={`w-6 text-center text-xs font-bold ${
                          md.isHit ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {md.result}
                        </span>
                        <span className="w-5 text-center">
                          {md.isHit
                            ? <span className="text-emerald-400">✓</span>
                            : <span className="text-red-400">✗</span>
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Devam Eden Kuponlar Tab ─── */}
      {activeTab === 'devam' && (
        <div className="space-y-4">
          <div className="bg-gray-800/55 border border-sky-500/30 rounded-2xl p-5">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-sky-400 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  Devam Eden Kuponlar
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Programı henüz tamamlanmamış, sonuçları beklenen kuponlarınız.
                </p>
              </div>
              <div className="text-sm text-gray-500">
                {historyLoading ? 'Yükleniyor...' : `${ongoingCoupons.length} aktif kupon`}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'arkadaslar' && (loading ? (
        <div className="text-center py-20 text-gray-400">Kuponlar yükleniyor...</div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center text-gray-400">
          Bu kategoride henüz bir kuponunuz bulunmuyor.
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === 'kayitli' && bulkSelectableCouponIds.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-800/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-gray-200">
                <input
                  type="checkbox"
                  checked={allBulkCouponsSelected}
                  onChange={toggleAllBulkSelection}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
                />
                Tümünü Seç
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">
                  {selectedBulkCouponIds.length} / {bulkSelectableCouponIds.length} kupon seçili
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCouponIds(new Set())}
                  disabled={selectedBulkCouponIds.length === 0 || bulkDeleting}
                  className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-bold text-gray-200 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  Seçimi Temizle
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedBulkCouponIds.length === 0 || bulkDeleting}
                  className="rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {bulkDeleting ? 'Siliniyor...' : 'Seçilenleri Sil'}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCoupons.map((insight) => renderCouponCard(insight))}
          </div>
        </div>
      ))}

      {selectedCoupon && (
        <div className="mt-8">
          <h2 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4">
            Kupon #{selectedCoupon.id} Detayı
          </h2>
          {selectedCoupon.canShare && (
            <div className="mb-5 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-emerald-400">Site İçinde Paylaş</h3>
                <p className="mt-1 text-xs text-gray-400">
                  Arkadaş listenden seç veya kullanıcı arayıp arkadaşlık isteği gönder.
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Arkadaşlarım</div>
                  {friends.length === 0 ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                      Henüz arkadaşın yok. Sağdaki aramadan kullanıcı bulup istek gönderebilirsin.
                    </div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900/60 p-2">
                      {friends.map((friend) => {
                        const selected = shareRecipient === friend.username;
                        return (
                          <button
                            key={friend.id}
                            type="button"
                            onClick={() => setShareRecipient(friend.username)}
                            className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors last:mb-0 ${
                              selected
                                ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
                                : 'bg-gray-800/70 text-gray-200 hover:bg-gray-700'
                            }`}
                          >
                            <span className="font-semibold">{friend.username}</span>
                            {selected && <span className="text-xs font-bold text-emerald-300">Seçildi</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Kullanıcı Ara</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareFriendSearch}
                      onChange={(event) => setShareFriendSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void handleShareFriendSearch();
                        }
                      }}
                      placeholder="Kullanıcı adı veya e-posta"
                      className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleShareFriendSearch}
                      disabled={shareFriendSearching}
                      className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-bold text-gray-100 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:text-gray-500"
                    >
                      {shareFriendSearching ? '...' : 'Ara'}
                    </button>
                  </div>
                  {shareFriendResults.length > 0 && (
                    <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-gray-700 bg-gray-900/60">
                      {shareFriendResults.map((result) => (
                        <div key={result.id} className="flex items-center justify-between gap-3 border-b border-gray-800 px-3 py-2 last:border-b-0">
                          <div>
                            <div className="text-sm font-semibold text-gray-100">{result.username}</div>
                            <div className="text-xs text-gray-500">
                              {result.relationship === 'friend'
                                ? 'Arkadaşın'
                                : result.relationship === 'outgoing'
                                  ? 'İstek gönderildi'
                                  : result.relationship === 'incoming'
                                    ? 'Bu kullanıcıdan gelen istek var'
                                    : result.relationship === 'self'
                                      ? 'Bu sensin'
                                      : 'Arkadaş eklenebilir'}
                            </div>
                          </div>
                          {result.relationship === 'friend' ? (
                            <button
                              type="button"
                              onClick={() => setShareRecipient(result.username)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
                            >
                              Seç
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleShareFriendRequest(result.username)}
                              disabled={result.relationship !== 'none'}
                              className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-100 transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:text-gray-500"
                            >
                              İstek Gönder
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-gray-700 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-300">
                  Seçili arkadaş:{' '}
                  <span className={shareRecipient ? 'font-bold text-emerald-300' : 'text-gray-500'}>
                    {shareRecipient || 'Yok'}
                  </span>
                </div>
                <button
                  onClick={handleShareSelectedCoupon}
                  disabled={shareLoading || !shareRecipient}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                >
                  {shareLoading ? 'Paylaşılıyor...' : 'Arkadaşıma Gönder'}
                </button>
              </div>
              {shareMessage && (
                <div className="mt-3 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300">
                  {shareMessage}
                </div>
              )}
            </div>
          )}
          {selectedCoupon.snapshotUrl && (
            <div className="mb-5 rounded-xl border border-gray-700 bg-gray-800/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-emerald-400">Maç Snapshotı</h3>
                <button
                  type="button"
                  onClick={() => setShowSnapshot((current) => !current)}
                  aria-label={showSnapshot ? 'Snapshotı kapat' : 'Snapshotı aç'}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-600 bg-gray-900 text-lg font-black text-gray-200 transition-colors hover:border-emerald-500 hover:text-emerald-300"
                >
                  <span className={`inline-block transition-transform ${showSnapshot ? '-rotate-90' : ''}`}>
                    {'<'}
                  </span>
                </button>
              </div>
              {showSnapshot && (
                <div className="mt-3 overflow-x-auto rounded-lg border border-gray-700 bg-gray-950">
                  <img
                    src={selectedCoupon.snapshotUrl}
                    alt="Kupon kaydedilirken oluşturulan maç snapshotı"
                    className="block min-w-[760px] max-w-none"
                  />
                </div>
              )}
            </div>
          )}
          <KolonOutput
            kolonlar={selectedCouponKolonlar}
            matches={selectedCouponMatches}
            weekLabel={selectedCoupon.week}
            rowStatuses={selectedCouponRowStatuses}
            showSequenceFilter={false}
            activeSequenceMatch={detailActiveSequenceMatch}
            activeSequenceOutcomes={detailActiveSequenceOutcomes}
            sequenceFilters={detailSequenceFilters}
            onActiveSequenceMatchChange={setDetailActiveSequenceMatch}
            onSequenceOutcomesChange={handleDetailSequenceOutcomesChange}
            onActiveSequenceFilterReset={handleDetailActiveSequenceFilterReset}
            onSequenceFilterRemove={handleDetailSequenceFilterRemove}
          />
        </div>
      )}

      {activeTab === 'arkadaslar' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gray-700 bg-gray-800/55 p-5">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-emerald-400">Arkadaş Ekle</h2>
              <p className="mt-1 text-sm text-gray-400">
                Kullanıcı adı veya e-posta ile kullanıcı arayın, arkadaşlık isteği gönderin.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void handleFriendSearch();
                  }
                }}
                placeholder="Kullanıcı adı veya e-posta"
                className="min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={handleFriendSearch}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-500"
              >
                Ara
              </button>
            </div>
            {friendMessage && (
              <div className="mt-3 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs text-gray-300">
                {friendMessage}
              </div>
            )}
            {friendSearchResults.length > 0 && (
              <div className="mt-4 divide-y divide-gray-700 rounded-xl border border-gray-700 bg-gray-900/50">
                {friendSearchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="font-semibold text-gray-100">{result.username}</div>
                      <div className="text-xs text-gray-500">
                        {result.relationship === 'friend'
                          ? 'Zaten arkadaşınız'
                          : result.relationship === 'outgoing'
                            ? 'İstek gönderildi'
                            : result.relationship === 'incoming'
                              ? 'Bu kullanıcıdan gelen istek var'
                              : result.relationship === 'self'
                                ? 'Bu sizsiniz'
                                : 'Arkadaş eklenebilir'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendFriendRequest(result.username)}
                      disabled={result.relationship !== 'none'}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
                    >
                      İstek Gönder
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-700 bg-gray-800/55 p-5">
              <h3 className="mb-3 text-base font-bold text-white">Gelen İstekler</h3>
              {incomingRequests.length === 0 ? (
                <p className="text-sm text-gray-500">Gelen arkadaşlık isteği yok.</p>
              ) : (
                <div className="space-y-2">
                  {incomingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
                      <div>
                        <div className="font-semibold text-gray-100">{request.requester_username}</div>
                        <div className="text-xs text-gray-500">{new Date(request.created_at).toLocaleDateString('tr-TR')}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRespondFriendRequest(request.id, 'accept')}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500"
                        >
                          Kabul
                        </button>
                        <button
                          onClick={() => handleRespondFriendRequest(request.id, 'decline')}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-600"
                        >
                          Reddet
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800/55 p-5">
              <h3 className="mb-3 text-base font-bold text-white">Giden İstekler</h3>
              {outgoingRequests.length === 0 ? (
                <p className="text-sm text-gray-500">Bekleyen giden istek yok.</p>
              ) : (
                <div className="space-y-2">
                  {outgoingRequests.map((request) => (
                    <div key={request.id} className="rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
                      <div className="font-semibold text-gray-100">{request.recipient_username}</div>
                      <div className="text-xs text-gray-500">Bekliyor</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-700 bg-gray-800/55 p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-bold text-white">Arkadaşlarım</h3>
              <span className="text-xs text-gray-500">
                {friendsLoading ? 'Yükleniyor...' : `${friends.length} kişi`}
              </span>
            </div>
            {friends.length === 0 ? (
              <p className="text-sm text-gray-500">Henüz arkadaşınız yok.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {friends.map((friend) => (
                  <div key={friend.id} className="rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
                    <div className="font-semibold text-gray-100">{friend.username}</div>
                    <div className="mt-1 text-xs text-gray-500">{friend.email}</div>
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="mt-3 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-gray-600"
                    >
                      Arkadaşı Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Celebration Overlay */}
      <CelebrationOverlay
        isVisible={showCelebration}
        hitCount={celebrationHits}
        onClose={() => setShowCelebration(false)}
      />
    </div>
  );
}
