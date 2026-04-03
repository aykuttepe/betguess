import { useState, useEffect, useMemo, useRef } from 'react';
import { useMatches } from '../hooks/useMatches';
import { couponsApi, CouponRow } from '../lib/coupons-api';
import { fetchHistoryAnalysis } from '../lib/history-api';
import { SYSTEM_FORMULAS, calculateFormulaPrice } from '../lib/system-formulas';
import {
  buildCouponInsight,
  CouponGrade,
  CouponInsight,
  KolonGrade,
  parseProgramNoFromWeekLabel,
} from '../lib/coupon-grading';
import { generateSystemCoupons, SystemMatchDistribution, SystemKupon } from '../lib/system-generator';
import { HistoricalProgram } from '../lib/types';
import SystemKuponOutput from '../components/SystemKuponOutput';
import { useLiveTracking } from '../hooks/useLiveTracking';
import { gradeCouponsLive, summarizeLiveGrades } from '../lib/live-grading';
import LiveTrackingDashboard from '../components/LiveTrackingDashboard';
import LiveCouponCard from '../components/LiveCouponCard';
import CelebrationOverlay from '../components/CelebrationOverlay';
import { useUsageStatus } from '../hooks/useUsageStatus';
import UpgradePrompt from '../components/UpgradePrompt';

type Tab = 'otomatik' | 'kayitli' | 'gelecek' | 'gecmis' | 'canli' | 'kazanan' | 'devam';
type GradeBucket = 12 | 13 | 14 | 15;
type GradeFilter = GradeBucket | 'kazanilan' | 'devam';

const GRADE_BUCKETS: GradeBucket[] = [15, 14, 13, 12];

function getGradeAccent(grade: CouponGrade): string {
  if (grade === 15) return 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  if (grade === 14) return 'bg-sky-500/15 text-sky-300 border border-sky-500/30';
  if (grade === 13) return 'bg-amber-500/15 text-amber-300 border border-amber-500/30';
  return 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30';
}

export default function MyCouponsPage() {
  const { program, loading: programLoading } = useMatches();
  const [activeTab, setActiveTab] = useState<Tab>('kayitli');
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [historyPrograms, setHistoryPrograms] = useState<HistoricalProgram[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // For viewing a specific selected coupon
  const [selectedCoupon, setSelectedCoupon] = useState<{ id: number; data: SystemKupon[] } | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeFilter | null>(null);

  const { data: usage, canUse } = useUsageStatus();
  const [selectedLiveBucket, setSelectedLiveBucket] = useState<string | null>(null);

  // Celebration overlay
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationHits, setCelebrationHits] = useState(0);
  const celebrationShownRef = useRef<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    fetchCouponHistory();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await couponsApi.getCoupons();
      setCoupons(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

      const generated = generateSystemCoupons(
        dists, 
        kapaliCount, 
        cifteCount, 
        targetCouponCount, 
        calculateFormulaPrice(kapaliCount, cifteCount)
      );

      await couponsApi.saveCoupon('otomatik', program.weekLabel, generated);
      await fetchCoupons();
    } catch (err) {
      console.error('Auto generate error:', err);
      alert('Otomatik kupon üretilirken bir hata oluştu.');
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
  }, [activeTab]);

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
  }, [activeTab, couponInsights, currentProgramNo, currentWeek, wonCoupons, ongoingCoupons]);

  const gradedCouponCount = useMemo(() => {
    return GRADE_BUCKETS.reduce((total, grade) => total + savedCouponGradeSummary[grade], 0);
  }, [savedCouponGradeSummary]);

  // ─── Live Tracking ───
  const { liveProgram, loading: liveLoading, error: liveError, refetch: liveRefetch } = useLiveTracking(activeTab === 'canli' || activeTab === 'kayitli');

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
      const key = `celebration-${liveProgram.programNo}`;
      if (celebrationShownRef.current !== key) {
        celebrationShownRef.current = key;
        setCelebrationHits(bestHit);
        setShowCelebration(true);
      }
    }
  }, [liveSummary, liveProgram]);

  const renderCouponCard = (insight: CouponInsight) => {
    const { coupon, parsedData, grade, bestHitCount, hasCompletedProgram } = insight;
    return (
      <div key={coupon.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
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
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-4">
          İçerisinde <strong className="text-gray-200">{parsedData.length}</strong> adet farklı kolon barındırıyor.
        </p>

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
            <button
              onClick={async () => {
                if (confirm('Silmek istediğinize emin misiniz?')) {
                  await couponsApi.deleteCoupon(coupon.id);
                  await fetchCoupons();
                  if (selectedCoupon?.id === coupon.id) setSelectedCoupon(null);
                }
              }}
              className="text-gray-500 hover:text-red-400 transition-colors p-2"
              title="Sil"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
            <button
              onClick={() => setSelectedCoupon({ id: coupon.id, data: parsedData })}
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
                {liveGrades.map((grade, i) => (
                  <LiveCouponCard key={grade.kuponId} grade={grade} index={i} />
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

      {loading ? (
        <div className="text-center py-20 text-gray-400">Kuponlar yükleniyor...</div>
      ) : filteredCoupons.length === 0 ? (
        <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-12 text-center text-gray-400">
          Bu kategoride henüz bir kuponunuz bulunmuyor.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCoupons.map((insight) => renderCouponCard(insight))}
        </div>
      )}

      {selectedCoupon && (
        <div className="mt-8">
          <h2 className="text-xl font-bold border-b border-gray-700 pb-2 mb-4">
            Kupon #{selectedCoupon.id} Detayı
          </h2>
          <SystemKuponOutput 
            kuponlar={selectedCoupon.data} 
            matches={program?.matches || []} 
            weekLabel={program?.weekLabel || ''} 
          />
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
