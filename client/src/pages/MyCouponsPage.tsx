import { useState, useEffect, useMemo } from 'react';
import { useMatches } from '../hooks/useMatches';
import { couponsApi, CouponRow } from '../lib/coupons-api';
import { fetchHistoryAnalysis } from '../lib/history-api';
import { SYSTEM_FORMULAS, calculateFormulaPrice } from '../lib/system-formulas';
import {
  buildCouponInsight,
  CouponGrade,
  CouponInsight,
  parseProgramNoFromWeekLabel,
} from '../lib/coupon-grading';
import { generateSystemCoupons, SystemMatchDistribution, SystemKupon } from '../lib/system-generator';
import { HistoricalProgram } from '../lib/types';
import SystemKuponOutput from '../components/SystemKuponOutput';

type Tab = 'otomatik' | 'kayitli' | 'gelecek' | 'gecmis';
type GradeBucket = 12 | 13 | 14 | 15;

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

  const filteredCoupons = useMemo(() => {
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
  }, [activeTab, couponInsights, currentProgramNo, currentWeek]);

  const gradedCouponCount = useMemo(() => {
    return GRADE_BUCKETS.reduce((total, grade) => total + savedCouponGradeSummary[grade], 0);
  }, [savedCouponGradeSummary]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-emerald-400">Kuponlarım</h1>
          <p className="text-gray-400 text-sm mt-1">Kayıtlı sistem kuponlarınız ve YZ ile otomatik üretilen tahminler.</p>
        </div>
        <button
          onClick={handleGenerateAuto}
          disabled={generating || programLoading}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {generating ? 'Üretiliyor...' : '✨ Otomatik Kupon Üret'}
        </button>
      </div>

      <div className="bg-gray-800/40 rounded-lg p-2 flex overflow-x-auto gap-2 border border-gray-700">
        {[
          { id: 'otomatik', label: 'Otomatik Oynadıklarım' },
          { id: 'kayitli', label: 'Kayıtlı Kuponlarım' },
          { id: 'gelecek', label: 'Gelecek Hafta Kuponlarım' },
          { id: 'gecmis', label: 'Geçmiş Hafta Kuponlarım' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as Tab);
              setSelectedCoupon(null);
            }}
            className={`px-4 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-gray-400 hover:bg-gray-700 hover:text-gray-200 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'kayitli' && (
        <div className="bg-gray-800/55 border border-gray-700 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white">Kayıtlı Kupon Dereceleri</h2>
              <p className="text-sm text-gray-400 mt-1">
                Derecelendirilebilen kayıtlı kuponlarınız 15, 14, 13 ve 12 isabet sırasıyla listelenir.
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
                className="rounded-2xl border border-gray-700 bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-4"
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

          {!historyLoading && !historyError && gradedCouponCount === 0 && (
            <div className="rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3 text-sm text-gray-400">
              Geçmiş programlarla eşleşen 12, 13, 14 veya 15 isabetli kayıtlı kupon bulunamadı.
            </div>
          )}
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
          {filteredCoupons.map((insight) => {
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
          })}
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
    </div>
  );
}
