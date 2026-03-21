import { useState, useEffect, useMemo } from 'react';
import { useMatches } from '../hooks/useMatches';
import {
  SYSTEM_FORMULAS,
  COUPON_COUNTS,
  calculateFormulaPrice,
} from '../lib/system-formulas';
import {
  calculateComprehensiveFormulaCapacity,
  ComprehensiveMatchSelection,
  generateComprehensiveFormulaCoupons,
  generateSystemCoupons,
  getOutcomeType,
  SystemKupon,
  SystemMatchDistribution,
  SystemOutcome,
} from '../lib/system-generator';
import { Outcome } from '../lib/types';
import SystemKuponOutput from '../components/SystemKuponOutput';
import { couponsApi } from '../lib/coupons-api';
import { isHttpApiError } from '../lib/http';

const OUTCOME_OPTIONS: Outcome[] = ['1', 'X', '2'];
const OUTCOME_LABELS: Record<Outcome, string> = {
  '1': '1',
  X: 'X',
  '2': '2',
};

function sortOutcomes(outcomes: Outcome[]): Outcome[] {
  return [...outcomes].sort(
    (left, right) => OUTCOME_OPTIONS.indexOf(left) - OUTCOME_OPTIONS.indexOf(right),
  );
}

function FormulaPicker({
  selectedFormulaId,
  onSelect,
  compact = false,
}: {
  selectedFormulaId: string | null;
  onSelect: (formulaId: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 overflow-y-auto pr-2 custom-scrollbar ${
        compact
          ? 'grid-cols-2 sm:grid-cols-3 max-h-[22rem]'
          : 'grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 max-h-72'
      }`}
    >
      {SYSTEM_FORMULAS.map((formula) => (
        <button
          key={formula.id}
          onClick={() => onSelect(formula.id)}
          className={`rounded-xl border p-3 text-left transition-all ${
            selectedFormulaId === formula.id
              ? 'bg-emerald-600/30 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
              : 'bg-gray-800 border-gray-600 hover:border-gray-500 hover:bg-gray-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Formul</div>
              <div className="mt-1 text-base font-bold text-white leading-none">
                {formula.kapaliCount}/{formula.cifteCount}
              </div>
            </div>
            <div className="shrink-0 rounded-full bg-gray-950/60 px-2 py-1 text-[10px] font-semibold text-emerald-300">
              {15 - formula.kapaliCount - formula.cifteCount} tek
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300">
              {formula.kapaliCount} kapali
            </span>
            <span className="rounded-md bg-sky-500/10 px-2 py-1 font-semibold text-sky-300">
              {formula.cifteCount} cifte
            </span>
          </div>

          <div className="mt-3 rounded-lg bg-black/30 px-2 py-2 text-center text-sm font-bold text-emerald-300">
            {formula.price.toLocaleString('tr-TR')} TL
          </div>
        </button>
      ))}
    </div>
  );
}

function CouponCountPicker({
  couponCount,
  onSelect,
  options = COUPON_COUNTS,
  maxSelectableCount,
}: {
  couponCount: number | null;
  onSelect: (count: number) => void;
  options?: number[];
  maxSelectableCount?: number | null;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((count) => {
        const isDisabled = maxSelectableCount !== null && maxSelectableCount !== undefined && count > maxSelectableCount;

        return (
          <button
            key={count}
            onClick={() => onSelect(count)}
            disabled={isDisabled}
            className={`w-12 h-16 flex items-center justify-center font-bold text-lg rounded-t-full rounded-br-full transform -rotate-45 transition-all ${
              isDisabled
                ? 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed opacity-55'
                : couponCount === count
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-gray-900 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-br from-cyan-600/50 to-blue-600/50 text-gray-200 border border-cyan-500/30 hover:scale-110'
            }`}
          >
            <span className="rotate-45">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function getSelectionType(outcomes: Outcome[]): 'bos' | 'banko' | 'cifte' | 'kapali' {
  if (outcomes.length === 0) return 'bos';
  if (outcomes.length === 1) return 'banko';
  if (outcomes.length === 2) return 'cifte';
  return 'kapali';
}

function SelectionTypeBadge({ outcomes }: { outcomes: Outcome[] }) {
  const selectionType = getSelectionType(outcomes);

  if (selectionType === 'bos') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-800 text-gray-400 border border-gray-700">
        Secim yok
      </span>
    );
  }

  if (selectionType === 'banko') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-200 border border-slate-400/30">
        Banko
      </span>
    );
  }

  if (selectionType === 'cifte') {
    return (
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-300 border border-sky-400/30">
        Cifte
      </span>
    );
  }

  return (
    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-400/30">
      Kapali
    </span>
  );
}

function formatWideSummary(
  kapaliCount: number,
  cifteCount: number,
  bankoCount: number,
  missingCount: number,
): string {
  if (missingCount > 0) {
    return `${missingCount} mac icin secim eksik.`;
  }

  return `Genis kuponunuz: ${kapaliCount} kapali, ${cifteCount} cifte, ${bankoCount} banko.`;
}

function formatCapacity(capacity: bigint): string {
  const asNumber = Number(capacity);
  if (Number.isSafeInteger(asNumber)) {
    return asNumber.toLocaleString('tr-TR');
  }

  return capacity.toString();
}

export default function SystemCouponPage() {
  const { program, loading, error } = useMatches();
  const effectiveMatches = program?.matches || [];

  const [manualFormulaId, setManualFormulaId] = useState<string | null>(null);
  const [manualCouponCount, setManualCouponCount] = useState<number | null>(null);
  const [wideFormulaId, setWideFormulaId] = useState<string | null>(null);
  const [wideCouponCount, setWideCouponCount] = useState<number | null>(null);

  const [dists, setDists] = useState<Record<number, Record<SystemOutcome, number>>>({});
  const [wideSelections, setWideSelections] = useState<Record<number, Outcome[]>>({});

  const [kupons, setKupons] = useState<SystemKupon[]>([]);
  const [genError, setGenError] = useState<string | null>(null);
  const [chanceError, setChanceError] = useState<string | null>(null);

  useEffect(() => {
    if (effectiveMatches.length === 15 && Object.keys(dists).length === 0) {
      const initial: Record<number, Record<SystemOutcome, number>> = {};
      effectiveMatches.forEach((match) => {
        initial[match.matchNumber] = {
          '1': 0,
          X: 0,
          '2': 0,
          '1X': 0,
          '12': 0,
          X2: 0,
          '1X2': 0,
        };
      });
      setDists(initial);
    }
  }, [effectiveMatches, dists]);

  useEffect(() => {
    if (effectiveMatches.length === 15 && Object.keys(wideSelections).length === 0) {
      const initial: Record<number, Outcome[]> = {};
      effectiveMatches.forEach((match) => {
        initial[match.matchNumber] = [];
      });
      setWideSelections(initial);
    }
  }, [effectiveMatches, wideSelections]);

  const manualFormula = useMemo(
    () => SYSTEM_FORMULAS.find((formula) => formula.id === manualFormulaId) ?? null,
    [manualFormulaId],
  );

  const wideFormula = useMemo(
    () => SYSTEM_FORMULAS.find((formula) => formula.id === wideFormulaId) ?? null,
    [wideFormulaId],
  );

  const targetKapali = manualFormula && manualCouponCount ? manualFormula.kapaliCount * manualCouponCount : 0;
  const targetCifte = manualFormula && manualCouponCount ? manualFormula.cifteCount * manualCouponCount : 0;

  const currentSums = useMemo(() => {
    let kapali = 0;
    let cifte = 0;

    Object.values(dists).forEach((matchCounts) => {
      Object.entries(matchCounts).forEach(([outcome, count]) => {
        const type = getOutcomeType(outcome as SystemOutcome);
        if (type === 'kapali') kapali += count;
        if (type === 'cifte') cifte += count;
      });
    });

    return { kapali, cifte };
  }, [dists]);

  const wideSelectionSummary = useMemo(() => {
    let kapaliCount = 0;
    let cifteCount = 0;
    let bankoCount = 0;
    let missingCount = 0;

    effectiveMatches.forEach((match) => {
      const outcomes = wideSelections[match.matchNumber] || [];
      if (outcomes.length === 3) {
        kapaliCount += 1;
      } else if (outcomes.length === 2) {
        cifteCount += 1;
      } else if (outcomes.length === 1) {
        bankoCount += 1;
      } else {
        missingCount += 1;
      }
    });

    return {
      kapaliCount,
      cifteCount,
      bankoCount,
      missingCount,
      allSelected: effectiveMatches.length === 15 && missingCount === 0,
    };
  }, [effectiveMatches, wideSelections]);

  const wideCompatibilityMessage = useMemo(() => {
    if (!wideFormula) {
      return null;
    }

    if (!wideSelectionSummary.allSelected) {
      return 'Once 15 macin tamaminda en az bir secim yapin.';
    }

    if (wideFormula.kapaliCount > wideSelectionSummary.kapaliCount) {
      return `Genis kuponda sadece ${wideSelectionSummary.kapaliCount} kapali var. Bu formulu uretemezsiniz.`;
    }

    if (
      wideFormula.kapaliCount + wideFormula.cifteCount >
      wideSelectionSummary.kapaliCount + wideSelectionSummary.cifteCount
    ) {
      const maxCifte = wideSelectionSummary.kapaliCount + wideSelectionSummary.cifteCount - wideFormula.kapaliCount;
      return `Bu genis kupondan en fazla ${Math.max(0, maxCifte)} cifte cikabilir.`;
    }

    return null;
  }, [wideFormula, wideSelectionSummary]);

  const wideFormulaCapacity = useMemo(() => {
    if (!wideFormula || !wideSelectionSummary.allSelected) {
      return null;
    }

    const wideSelectionArray: ComprehensiveMatchSelection[] = effectiveMatches.map((match) => ({
      matchNumber: match.matchNumber,
      outcomes: wideSelections[match.matchNumber] || [],
    }));

    return calculateComprehensiveFormulaCapacity(
      wideSelectionArray,
      wideFormula.kapaliCount,
      wideFormula.cifteCount,
    );
  }, [effectiveMatches, wideFormula, wideSelectionSummary.allSelected, wideSelections]);

  const wideCouponCountOptions = useMemo(() => {
    const baseOptions = [1, 2, 3, 4, ...COUPON_COUNTS];
    return Array.from(new Set(baseOptions)).sort((left, right) => left - right);
  }, []);

  const maxSelectableWideCount = useMemo(() => {
    if (wideFormulaCapacity === null) {
      return null;
    }

    const numericCapacity = Number(wideFormulaCapacity);
    if (Number.isSafeInteger(numericCapacity)) {
      return numericCapacity;
    }

    return wideCouponCountOptions[wideCouponCountOptions.length - 1] ?? null;
  }, [wideFormulaCapacity, wideCouponCountOptions]);

  useEffect(() => {
    if (
      wideCouponCount !== null &&
      maxSelectableWideCount !== null &&
      wideCouponCount > maxSelectableWideCount
    ) {
      setWideCouponCount(null);
    }
  }, [maxSelectableWideCount, wideCouponCount]);

  const wideCapacityStatus = useMemo(() => {
    if (wideCompatibilityMessage) {
      return {
        tone: 'warning' as const,
        message: wideCompatibilityMessage,
      };
    }

    if (wideFormulaCapacity === null) {
      return {
        tone: 'warning' as const,
        message: 'Once genis kuponu tamamlayin.',
      };
    }

    if (wideFormulaCapacity === 0n) {
      return {
        tone: 'warning' as const,
        message: 'Bu secimle hedef formulu ureten bir kupon bulunamadi.',
      };
    }

    if (wideFormulaCapacity === 1n) {
      return {
        tone: 'neutral' as const,
        message: 'Bu secimle yalnizca 1 farkli kupon uretilebilir.',
      };
    }

    return {
      tone: 'success' as const,
      message: `Bu secimle en fazla ${formatCapacity(wideFormulaCapacity)} farkli kupon uretilebilir.`,
    };
  }, [wideCompatibilityMessage, wideFormulaCapacity]);

  const toggleWideSelection = (matchNumber: number, outcome: Outcome) => {
    setWideSelections((prev) => {
      const current = prev[matchNumber] || [];
      const next = current.includes(outcome)
        ? current.filter((item) => item !== outcome)
        : [...current, outcome];

      return {
        ...prev,
        [matchNumber]: sortOutcomes(next),
      };
    });
  };

  const setWidePreset = (preset: 'popular' | 'all' | 'reset') => {
    const next: Record<number, Outcome[]> = {};

    effectiveMatches.forEach((match) => {
      if (preset === 'all') {
        next[match.matchNumber] = ['1', 'X', '2'];
        return;
      }

      if (preset === 'reset') {
        next[match.matchNumber] = [];
        return;
      }

      const { home, draw, away } = match.preferences;
      if (home >= draw && home >= away) {
        next[match.matchNumber] = ['1'];
      } else if (draw >= home && draw >= away) {
        next[match.matchNumber] = ['X'];
      } else {
        next[match.matchNumber] = ['2'];
      }
    });

    setWideSelections(next);
  };

  const handleCountChange = (matchNumber: number, outcome: SystemOutcome, value: string) => {
    const numericValue = Math.max(0, parseInt(value, 10) || 0);
    setDists((prev) => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        [outcome]: numericValue,
      },
    }));
  };

  const setCountsForMatch = (matchNumber: number, field: SystemOutcome, value: number) => {
    setDists((prev) => ({
      ...prev,
      [matchNumber]: {
        ...prev[matchNumber],
        [field]: value,
      },
    }));
  };

  const handleGenerate = () => {
    setGenError(null);
    setChanceError(null);

    if (!manualFormula || !manualCouponCount) {
      setGenError('Lutfen once formül ve kupon sayisi secin.');
      return;
    }

    const distArray: SystemMatchDistribution[] = effectiveMatches.map((match) => ({
      matchNumber: match.matchNumber,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      counts: dists[match.matchNumber],
    }));

    try {
      const result = generateSystemCoupons(
        distArray,
        manualFormula.kapaliCount,
        manualFormula.cifteCount,
        manualCouponCount,
        calculateFormulaPrice(manualFormula.kapaliCount, manualFormula.cifteCount),
      );
      setKupons(result);
    } catch (err: any) {
      setGenError(err.message);
    }
  };

  const handleChanceGenerate = () => {
    setChanceError(null);
    setGenError(null);

    if (!wideFormula || !wideCouponCount) {
      setChanceError('Lutfen genis kupondan uretilecek formulu ve kupon sayisini secin.');
      return;
    }

    const wideSelectionArray: ComprehensiveMatchSelection[] = effectiveMatches.map((match) => ({
      matchNumber: match.matchNumber,
      outcomes: wideSelections[match.matchNumber] || [],
    }));

    try {
      const result = generateComprehensiveFormulaCoupons(
        wideSelectionArray,
        wideFormula.kapaliCount,
        wideFormula.cifteCount,
        wideCouponCount,
        calculateFormulaPrice(wideFormula.kapaliCount, wideFormula.cifteCount),
      );
      setKupons(result);
    } catch (err: any) {
      setChanceError(err.message);
    }
  };

  const handleSaveCoupons = async () => {
    try {
      await couponsApi.saveCoupon('kayitli', program?.weekLabel || '', kupons);
      alert('Kupon basariyla Kayitli sekmesine eklendi!');
    } catch (error) {
      if (isHttpApiError(error) && error.status === 401) {
        return;
      }

      alert(error instanceof Error ? error.message : 'Hata olustu.');
    }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Yukleniyor...</div>;
  }

  if (error) {
    return <div className="text-center py-20 text-red-400">{error}</div>;
  }

  if (effectiveMatches.length === 0) {
    const providerMessage = program?.weekLabel?.trim();
    const emptyStateMessage =
      providerMessage && providerMessage.length > 0
        ? providerMessage
        : 'Su anda aktif Spor Toto programi bulunmadigi icin sistem kuponu olusturulamiyor.';

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 px-4">
          <h1 className="text-lg font-bold text-gray-100">Sistem Kuponu / Formul Motoru</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Genis kupondan daha dar formullu rastgele kuponlar veya klasik dagitim tabanli sistemler olusturun.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-slate-900 to-slate-800 p-6 shadow-[0_18px_50px_rgba(2,6,23,0.38)]">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>

            <div className="min-w-0 space-y-3">
              <div>
                <h2 className="text-xl font-bold text-white">Aktif program bulunamadi</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">{emptyStateMessage}</p>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-400">
                Mac listesi aktif Spor Toto program verisine baglidir. Yeni program yayinlandiginda bu sayfa otomatik olarak yeniden dolacaktir.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 px-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-100">Sistem Kuponu / Formul Motoru</h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Genis kupondan daha dar formullu rastgele kuponlar veya klasik dagitim tabanli sistemler olusturun.
          </p>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-emerald-400">Kapsamli Formul</h2>
            <p className="text-sm text-gray-400 mt-1">
              Once genis kuponu kurun, sonra ondan daha dar bir formul secip birbirinden farkli kuponlar uretin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setWidePreset('popular')}
              className="px-3 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm hover:bg-gray-600 transition-colors"
            >
              Populeri Yukle
            </button>
            <button
              onClick={() => setWidePreset('all')}
              className="px-3 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm hover:bg-gray-600 transition-colors"
            >
              Tumunu Kapat
            </button>
            <button
              onClick={() => setWidePreset('reset')}
              className="px-3 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm hover:bg-gray-600 transition-colors"
            >
              Sifirla
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.95fr] gap-5">
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">1. Adim: En genis kuponu kur</div>
                <div className="text-xs text-gray-400 mt-1">
                  Her mac icin 1, X ve 2 secimlerini acip kapatarak banko, cifte veya kapali yapabilirsiniz.
                </div>
              </div>
              <div className="text-xs text-gray-500">{formatWideSummary(
                wideSelectionSummary.kapaliCount,
                wideSelectionSummary.cifteCount,
                wideSelectionSummary.bankoCount,
                wideSelectionSummary.missingCount,
              )}</div>
            </div>

            <div className="divide-y divide-gray-800">
              {effectiveMatches.map((match) => {
                const selected = wideSelections[match.matchNumber] || [];

                return (
                  <div
                    key={match.matchNumber}
                    className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-gray-500 mb-1">{match.matchNumber}. Mac</div>
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-100">
                        <span className="truncate">{match.homeTeam}</span>
                        <span className="text-gray-500">-</span>
                        <span className="truncate">{match.awayTeam}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {OUTCOME_OPTIONS.map((outcome) => {
                        const selectedState = selected.includes(outcome);
                        const preference =
                          outcome === '1'
                            ? match.preferences.home
                            : outcome === 'X'
                              ? match.preferences.draw
                              : match.preferences.away;

                        return (
                          <button
                            key={outcome}
                            onClick={() => toggleWideSelection(match.matchNumber, outcome)}
                            className={`w-12 h-11 rounded-lg text-sm font-bold transition-all flex flex-col items-center justify-center ${
                              selectedState
                                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                            }`}
                          >
                            <span>{OUTCOME_LABELS[outcome]}</span>
                            <span className="text-[10px] opacity-75">%{preference}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="lg:min-w-[92px]">
                      <SelectionTypeBadge outcomes={selected} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
              <h3 className="text-sm font-bold text-emerald-400 border-b border-gray-700 pb-2 mb-3">
                2. Adim: Uretilecek formul
              </h3>
              <FormulaPicker compact selectedFormulaId={wideFormulaId} onSelect={setWideFormulaId} />
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
              <h3 className="text-sm font-bold text-emerald-400 border-b border-gray-700 pb-2 mb-3">
                3. Adim: Kolon sayisi
              </h3>
              <CouponCountPicker
                couponCount={wideCouponCount}
                onSelect={setWideCouponCount}
                options={wideCouponCountOptions}
                maxSelectableCount={maxSelectableWideCount}
              />
            </div>

            <div
              className={`rounded-xl border px-4 py-4 ${
                wideCapacityStatus.tone === 'warning'
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : wideCapacityStatus.tone === 'neutral'
                    ? 'border-slate-400/30 bg-slate-500/10 text-slate-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              }`}
            >
              <div className="text-sm font-semibold">Durum</div>
              <div className="text-sm mt-1">{wideCapacityStatus.message}</div>
              {wideFormula && (
                <div className="text-xs mt-2 text-gray-300">
                  Hedef formul: {wideFormula.kapaliCount} kapali, {wideFormula.cifteCount} cifte,{' '}
                  {15 - wideFormula.kapaliCount - wideFormula.cifteCount} tek.
                </div>
              )}
              {wideFormulaCapacity !== null && !wideCompatibilityMessage && (
                <div className="text-xs mt-2 text-gray-300">
                  Maksimum farkli kupon: {formatCapacity(wideFormulaCapacity)}
                </div>
              )}
            </div>

            {chanceError && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 text-sm font-medium">
                {chanceError}
              </div>
            )}

            <button
              onClick={handleChanceGenerate}
              disabled={
                !wideFormula ||
                !wideCouponCount ||
                !wideSelectionSummary.allSelected ||
                Boolean(wideCompatibilityMessage) ||
                (wideFormulaCapacity !== null && wideFormulaCapacity < BigInt(wideCouponCount))
              }
              className="w-full px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.35)] transition-all"
            >
              Sans Gele
            </button>

            <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4 text-xs text-gray-400 leading-6">
              Genis kuponunuz 3 kapali 8 cifte ise geriye 4 mac banko kalir. Buradan 2 kapali 4 cifte secerek,
              genis kupondaki secimlerin alt kumelerinden rastgele farkli kuponlar uretirsiniz.
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-5">
        <h2 className="text-lg font-bold mb-4 text-emerald-400 border-b border-gray-700 pb-2">
          Klasik Dagitim Motoru
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          Eski akista her mac ve secim tipi icin adet vererek tam dagitim kontrollu kupon uretebilirsiniz.
        </p>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold mb-4 text-emerald-400 border-b border-gray-700 pb-2">
              1. Adim: Formul Secimi
            </h3>
            <FormulaPicker selectedFormulaId={manualFormulaId} onSelect={setManualFormulaId} />
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4 text-emerald-400 border-b border-gray-700 pb-2">
              2. Adim: Uretilecek Formul Kuponu Sayisi
            </h3>
            <CouponCountPicker couponCount={manualCouponCount} onSelect={setManualCouponCount} />
          </div>

          {manualFormula && manualCouponCount && (
            <div
              className={`p-4 rounded-lg border font-medium text-center shadow-lg transition-colors ${
                currentSums.kapali === targetKapali && currentSums.cifte === targetCifte
                  ? 'bg-emerald-900/30 border-emerald-500 text-emerald-300'
                  : 'bg-red-900/40 border-red-500 text-red-200'
              }`}
            >
              Hedef: toplam cifte sayisi <strong>{targetCifte}</strong> (girilen: {currentSums.cifte}), toplam kapali
              sayisi <strong>{targetKapali}</strong> (girilen: {currentSums.kapali})
            </div>
          )}

          <div>
            <h3 className="text-lg font-bold mb-4 text-emerald-400 border-b border-gray-700 pb-2">
              3. Adim: Her mactaki dagilim adetlerini secin
            </h3>
            <div className="overflow-auto max-h-[65vh] custom-scrollbar rounded-lg border border-gray-700/50">
              <div className="min-w-[950px]">
                <div className="sticky top-0 z-20 bg-[#1e293b] grid grid-cols-[3fr_2fr_10fr_2fr] gap-4 px-3 py-3 text-xs font-bold text-gray-300 border-b border-emerald-500/30 shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
                  <div className="flex items-center">MAC</div>
                  <div className="text-center flex items-center justify-center">IHTIMAL (%)</div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    <div>1</div>
                    <div>X</div>
                    <div>2</div>
                    <div>1X</div>
                    <div>12</div>
                    <div>X2</div>
                    <div>1X2</div>
                  </div>
                  <div className="text-center flex items-center justify-center">DURUM</div>
                </div>

                <div className="space-y-1 p-2">
                  {effectiveMatches.map((match) => {
                    const counts = dists[match.matchNumber] || {};
                    const rowTotal = Object.values(counts).reduce((sum, value) => sum + value, 0);
                    const totalError = manualCouponCount ? rowTotal !== manualCouponCount : false;

                    return (
                      <div
                        key={match.matchNumber}
                        className="grid grid-cols-[3fr_2fr_10fr_2fr] gap-4 items-center bg-gray-700/30 rounded p-2 border border-gray-700 hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 text-xs text-gray-500">{match.matchNumber}.</span>
                          <div className="flex flex-col text-sm font-medium">
                            <span>{match.homeTeam}</span>
                            <span className="text-gray-400">vs</span>
                            <span>{match.awayTeam}</span>
                          </div>
                        </div>

                        <div className="flex justify-center gap-1.5 text-xs">
                          <div className="w-8 h-8 rounded-full border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold bg-gray-800 shadow-inner">
                            {match.preferences.home}
                          </div>
                          <div className="w-8 h-8 rounded-full border border-yellow-500/50 flex items-center justify-center text-yellow-400 font-bold bg-gray-800 shadow-inner">
                            {match.preferences.draw}
                          </div>
                          <div className="w-8 h-8 rounded-full border border-blue-500/50 flex items-center justify-center text-blue-400 font-bold bg-gray-800 shadow-inner">
                            {match.preferences.away}
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-1 items-center relative">
                          {(['1', 'X', '2', '1X', '12', 'X2', '1X2'] as SystemOutcome[]).map((outcome) => (
                            <div key={outcome} className="flex flex-col items-center w-full">
                              <div className="flex bg-gray-800 rounded overflow-hidden border border-gray-600 w-full h-9 hover:border-emerald-500/50 transition-colors focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                                <button
                                  tabIndex={-1}
                                  onClick={() =>
                                    setCountsForMatch(match.matchNumber, outcome, Math.max(0, (counts[outcome] || 0) - 1))
                                  }
                                  className="w-5 sm:w-6 flex shrink-0 items-center justify-center bg-gray-700/50 hover:bg-gray-600 text-gray-300 transition-colors font-bold select-none border-r border-gray-600 text-lg leading-none"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={counts[outcome] || ''}
                                  placeholder="0"
                                  onFocus={(event) => event.target.select()}
                                  onChange={(event) =>
                                    handleCountChange(match.matchNumber, outcome, event.target.value)
                                  }
                                  className="w-full bg-transparent text-center text-sm font-bold text-gray-100 focus:outline-none hide-spin-button py-1 px-0 placeholder-gray-500 min-w-[15px]"
                                />
                                <button
                                  tabIndex={-1}
                                  onClick={() => setCountsForMatch(match.matchNumber, outcome, (counts[outcome] || 0) + 1)}
                                  className="w-5 sm:w-6 flex shrink-0 items-center justify-center bg-gray-700/50 hover:bg-gray-600 text-gray-300 transition-colors font-bold select-none border-l border-gray-600 text-lg leading-none"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex justify-center items-center">
                          <div
                            className={`px-3 py-1.5 min-w-[70px] justify-center rounded-md text-xs font-bold flex items-center gap-1 transition-all ${
                              manualCouponCount
                                ? totalError
                                  ? 'bg-red-900/40 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                  : 'bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                                : 'bg-gray-800 text-gray-500 border border-gray-700'
                            }`}
                          >
                            {rowTotal} / {manualCouponCount || '-'}
                            {manualCouponCount && !totalError ? ' ✓' : ''}
                            {totalError ? ' !' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {genError && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-400 text-sm font-medium">
              {genError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleGenerate}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all hover:scale-105"
            >
              Kuponlari Uret
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-700 gap-3">
        {kupons.length > 0 && (
          <button
            onClick={handleSaveCoupons}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all hover:scale-105"
          >
            Kuponlari Kaydet
          </button>
        )}
      </div>

      <SystemKuponOutput kuponlar={kupons} matches={effectiveMatches} weekLabel={program?.weekLabel || ''} />
    </div>
  );
}
