import { useState, useCallback } from 'react';
import { useMatches } from '../hooks/useMatches';
import { useSelections } from '../hooks/useSelections';
import { generateKolonlar, shuffleKolonlar, applyFilters, applySequenceFilters } from '../lib/kolon-generator';
import { Kolon, Outcome, KolonFilters, DEFAULT_FILTERS, SportTotoMatch, DEFAULT_SEQUENCE_FILTERS, SequenceFilters } from '../lib/types';
import MatchList from '../components/MatchList';
import MatchDetailModal from '../components/MatchDetailModal';
import SelectionSummary from '../components/SelectionSummary';
import KolonOutput from '../components/KolonOutput';
import FilterPanel from '../components/FilterPanel';
import AiPanel from '../components/AiPanel';
import LatestUsers from '../components/LatestUsers';
import { fetchMatchAnalysis, fetchFallbackAnalysis, fetchBulkAnalysis } from '../lib/ai-api';
import { couponsApi } from '../lib/coupons-api';
import { isHttpApiError } from '../lib/http';
import { useSubscription } from '../hooks/useSubscription';
import UpgradePrompt from '../components/UpgradePrompt';

const DEMO_TEAMS = [
    'Galatasaray', 'Fenerbahce', 'Besiktas', 'Trabzonspor',
    'Basaksehir', 'Adana Demirspor', 'Antalyaspor', 'Alanyaspor',
    'Konyaspor', 'Sivasspor', 'Kayserispor', 'Gaziantep FK',
    'Kasimpasa', 'Hatayspor', 'Samsunspor', 'Rizespor',
    'Pendikspor', 'Istanbulspor', 'Ankaraguca', 'Bodrum FK',
    'Eyupspor', 'Goztepe', 'Sakaryaspor', 'Boluspor',
    'Bandirmaspor', 'Umraniyespor', 'Erzurumspor', 'Altay',
    'Manisaspor', 'Bursaspor',
];

function generateDemoMatches(): SportTotoMatch[] {
    const shuffled = [...DEMO_TEAMS].sort(() => Math.random() - 0.5);
    return Array.from({ length: 15 }, (_, i) => {
        const a = Math.random() * 60 + 20;
        const b = Math.random() * (100 - a);
        const home = Math.round(a);
        const away = Math.round(b);
        const draw = 100 - home - away;
        return {
            matchNumber: i + 1,
            homeTeam: shuffled[i * 2],
            awayTeam: shuffled[i * 2 + 1],
            matchDate: '2026-03-07',
            matchTime: `${String(Math.floor(Math.random() * 12) + 12).padStart(2, '0')}:00`,
            preferences: { home, draw: Math.max(0, draw), away },
        };
    });
}

export default function KolonPage() {
    const { program, loading, refreshing, error, refresh } = useMatches();
    const [demoMatches, setDemoMatches] = useState<SportTotoMatch[] | null>(null);
    const isDemo = demoMatches !== null;
    const effectiveMatches = demoMatches || program?.matches || [];
    const matchCount = effectiveMatches.length;
    const {
        selections,
        toggleSelection,
        resetSelections,
        setPopular,
        selectAll,
        kolonInputs,
        allSelected,
        kolonCount,
    } = useSelections(matchCount);

    const [allKolonlar, setAllKolonlar] = useState<Kolon[]>([]);
    const [kolonlar, setKolonlar] = useState<Kolon[]>([]);
    const [filters, setFilters] = useState<KolonFilters>({ ...DEFAULT_FILTERS });
    const [sequenceFilters, setSequenceFilters] = useState<SequenceFilters>({ ...DEFAULT_SEQUENCE_FILTERS });
    const [activeSequenceMatch, setActiveSequenceMatch] = useState<number | null>(null);
    const [genError, setGenError] = useState<string | null>(null);
    const [aiMatchIdx, setAiMatchIdx] = useState<number | null>(null);
    const [showBulkAi, setShowBulkAi] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<SportTotoMatch | null>(null);

    const { tier } = useSubscription();
    // Default limits
    const maxKolonLimit = tier === 'premium' ? 500000 : tier === 'pro' ? 200000 : 50000;
    const isOverKolonLimit = allSelected && kolonCount > maxKolonLimit;

    const activeSequenceOutcomes = activeSequenceMatch === null
        ? []
        : sequenceFilters[activeSequenceMatch] || [];

    const applyCurrentFilters = useCallback((all: Kolon[], f: KolonFilters, sequence: SequenceFilters) => {
        const filtered = applyFilters(all, f);
        setKolonlar(applySequenceFilters(filtered, sequence));
    }, []);

    const handleGenerate = useCallback(() => {
        setGenError(null);
        try {
            const result = generateKolonlar(kolonInputs);
            const shuffled = shuffleKolonlar(result);
            setAllKolonlar(shuffled);
            applyCurrentFilters(shuffled, filters, sequenceFilters);
        } catch (err: any) {
            setGenError(err.message);
            setAllKolonlar([]);
            setKolonlar([]);
        }
    }, [kolonInputs, filters, sequenceFilters, applyCurrentFilters]);

    const handleFiltersChange = useCallback((newFilters: KolonFilters) => {
        setFilters(newFilters);
        if (allKolonlar.length > 0) {
            applyCurrentFilters(allKolonlar, newFilters, sequenceFilters);
        }
    }, [allKolonlar, sequenceFilters, applyCurrentFilters]);

    const handleFiltersReset = useCallback(() => {
        const reset = { ...DEFAULT_FILTERS };
        setFilters(reset);
        if (allKolonlar.length > 0) {
            applyCurrentFilters(allKolonlar, reset, sequenceFilters);
        }
    }, [allKolonlar, sequenceFilters, applyCurrentFilters]);

    const handleActiveSequenceMatchChange = useCallback((matchNumber: number | null) => {
        setActiveSequenceMatch(matchNumber);
    }, []);

    const handleSequenceOutcomesChange = useCallback((outcomes: Outcome[]) => {
        if (activeSequenceMatch === null) {
            return;
        }

        setSequenceFilters((prev) => {
            const next = { ...prev };

            if (outcomes.length === 0) {
                delete next[activeSequenceMatch];
            } else {
                next[activeSequenceMatch] = outcomes;
            }

            if (allKolonlar.length > 0) {
                applyCurrentFilters(allKolonlar, filters, next);
            }

            return next;
        });
    }, [activeSequenceMatch, allKolonlar, filters, applyCurrentFilters]);

    const handleActiveSequenceFilterReset = useCallback(() => {
        if (activeSequenceMatch === null) {
            return;
        }

        setSequenceFilters((prev) => {
            const next = { ...prev };
            delete next[activeSequenceMatch];

            if (allKolonlar.length > 0) {
                applyCurrentFilters(allKolonlar, filters, next);
            }

            return next;
        });
    }, [activeSequenceMatch, allKolonlar, filters, applyCurrentFilters]);

    const handleSequenceFilterRemove = useCallback((matchNumber: number) => {
        setSequenceFilters((prev) => {
            if (!(matchNumber in prev)) {
                return prev;
            }

            const next = { ...prev };
            delete next[matchNumber];

            if (allKolonlar.length > 0) {
                applyCurrentFilters(allKolonlar, filters, next);
            }

            return next;
        });

        setActiveSequenceMatch((current) => (current === matchNumber ? null : current));
    }, [allKolonlar, filters, applyCurrentFilters]);

    const handleReset = useCallback(() => {
        resetSelections();
        setAllKolonlar([]);
        setKolonlar([]);
        setFilters({ ...DEFAULT_FILTERS });
        setSequenceFilters({ ...DEFAULT_SEQUENCE_FILTERS });
        setActiveSequenceMatch(null);
        setGenError(null);
    }, [resetSelections]);

    const handleImport = useCallback((imported: Kolon[]) => {
        setAllKolonlar(imported);
        applyCurrentFilters(imported, filters, sequenceFilters);
        setGenError(null);
    }, [filters, sequenceFilters, applyCurrentFilters]);

    const handlePopular = useCallback(() => {
        if (effectiveMatches.length === 0) return;
        const picks = new Map<number, Outcome>();
        for (const match of effectiveMatches) {
            const { home, draw, away } = match.preferences;
            if (home >= draw && home >= away) picks.set(match.matchNumber, '1');
            else if (draw >= home && draw >= away) picks.set(match.matchNumber, 'X');
            else picks.set(match.matchNumber, '2');
        }
        setPopular(picks);
        setKolonlar([]);
    }, [effectiveMatches, setPopular]);

    const handleDemo = useCallback(() => {
        setDemoMatches(generateDemoMatches());
        resetSelections();
        setAllKolonlar([]);
        setKolonlar([]);
        setFilters({ ...DEFAULT_FILTERS });
        setSequenceFilters({ ...DEFAULT_SEQUENCE_FILTERS });
        setActiveSequenceMatch(null);
        setGenError(null);
    }, [resetSelections]);

    const handleDemoReset = useCallback(() => {
        setDemoMatches(null);
        resetSelections();
        setAllKolonlar([]);
        setKolonlar([]);
        setFilters({ ...DEFAULT_FILTERS });
        setSequenceFilters({ ...DEFAULT_SEQUENCE_FILTERS });
        setActiveSequenceMatch(null);
        setGenError(null);
    }, [resetSelections]);

    const selectedCount = Array.from(selections.values()).filter(v => v.length > 0).length;
    const showFatalError = Boolean(error && !loading && !program && !isDemo);
    const showSoftError = Boolean(error && program);

    return (
        <div className="w-full xl:grid xl:grid-cols-[minmax(290px,1fr)_minmax(auto,1152px)_minmax(290px,1fr)] max-w-full">
            {/* Left Sidebar (Sticky) */}
            <div className="hidden xl:block pl-6">
                <div className="w-[260px] h-max sticky top-24 z-10 mt-11">
                    <LatestUsers />
                </div>
            </div>

            {/* Center Area (Table) - Fully Centered */}
            <div className="w-full px-4 overflow-hidden min-w-0">
            {program && !isDemo && (
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 mt-2">
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-400">{program.weekLabel}</div>
                        {refreshing && (
                            <div className="flex items-center gap-2 text-xs text-emerald-400">
                                <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                <span>Guncelleniyor...</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={refresh}
                        disabled={loading || refreshing}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:text-gray-500"
                    >
                        {refreshing ? 'Guncelleniyor...' : 'Yenile'}
                    </button>
                </div>
            )}

            {isDemo && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-amber-200">Deneme modu - 15 rastgele mac</span>
                    <button
                        onClick={handleDemoReset}
                        className="px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs"
                    >
                        Denemeyi Sifirla
                    </button>
                </div>
            )}

            {loading && !program && !isDemo && (
                <div className="text-center py-20">
                    <div className="inline-block w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <p className="mt-4 text-gray-400">Maclar yukleniyor...</p>
                    <button
                        onClick={handleDemo}
                        className="mt-4 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm"
                    >
                        Deneme Maclari Olustur
                    </button>
                </div>
            )}

            {showFatalError && (
                <div className="space-y-4">
                    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-center">
                        <p className="text-red-400 font-medium">{error}</p>
                        <div className="mt-3 flex gap-2 justify-center">
                            <button
                                onClick={refresh}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
                            >
                                Tekrar Dene
                            </button>
                            <button
                                onClick={handleDemo}
                                className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-sm"
                            >
                                Deneme
                            </button>
                        </div>
                    </div>
                    <AiPanel
                        title="AI Yardimi - Mac Programi"
                        autoLoad
                        fetchFn={() => fetchFallbackAnalysis(
                            'Spor Toto mac programi ve bahis verileri',
                            error as string
                        )}
                    />
                </div>
            )}

            {showSoftError && (
                <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {error}
                </div>
            )}

            {(program || isDemo) && !loading && (
                <>
                    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
                        <MatchList
                            matches={effectiveMatches}
                            selections={selections}
                            onToggle={toggleSelection}
                            onOpenDetails={(match) => setSelectedMatch(match)}
                        />
                        {!isDemo && program && (
                            <div className="px-3 sm:px-4 py-3 border-t border-gray-700 flex flex-wrap gap-1.5 sm:gap-2">
                                <span className="text-xs text-gray-400 flex items-center gap-1 mr-1 sm:mr-2">AI:</span>
                                {program.matches.map(m => (
                                    <button
                                        key={m.matchNumber}
                                        onClick={() => setAiMatchIdx(aiMatchIdx === m.matchNumber ? null : m.matchNumber)}
                                        className={`px-2 py-1 rounded text-xs transition-all ${aiMatchIdx === m.matchNumber
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-gray-700 text-gray-400 hover:bg-purple-600/30 hover:text-purple-300'
                                            }`}
                                    >
                                        {m.matchNumber}
                                    </button>
                                ))}
                                <button
                                    onClick={() => { setAiMatchIdx(null); setShowBulkAi(!showBulkAi); }}
                                    className={`px-2 py-1 rounded text-xs transition-all ml-1 ${showBulkAi
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-purple-700/30 text-purple-300 hover:bg-purple-600/40'
                                        }`}
                                >
                                    Tumu
                                </button>
                            </div>
                        )}
                    </div>

                    {!isDemo && aiMatchIdx !== null && program?.matches.find(m => m.matchNumber === aiMatchIdx) && (
                        <div className="mt-4">
                            <AiPanel
                                key={aiMatchIdx}
                                title={`AI - Mac ${aiMatchIdx}: ${program!.matches.find(m => m.matchNumber === aiMatchIdx)!.homeTeam} vs ${program!.matches.find(m => m.matchNumber === aiMatchIdx)!.awayTeam}`}
                                autoLoad
                                fetchFn={() => {
                                    const match = program!.matches.find(m => m.matchNumber === aiMatchIdx)!;
                                    return fetchMatchAnalysis(match.homeTeam, match.awayTeam, 'Super Lig');
                                }}
                            />
                        </div>
                    )}

                    {!isDemo && showBulkAi && program && (
                        <div className="mt-4">
                            <AiPanel
                                key="bulk"
                                title="AI - Tum Maclar Analizi"
                                autoLoad
                                fetchFn={() => fetchBulkAnalysis(
                                    program.matches.map(m => ({
                                        home: m.homeTeam,
                                        away: m.awayTeam,
                                        matchNo: m.matchNumber,
                                    })),
                                    'Super Lig'
                                )}
                            />
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2 no-print">
                        <button
                            onClick={handleDemo}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs sm:text-sm"
                        >
                            Deneme
                        </button>
                        <button
                            onClick={handlePopular}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-xs sm:text-sm"
                        >
                            Populer Secim
                        </button>
                        <button
                            onClick={selectAll}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-xs sm:text-sm"
                        >
                            Tumunu Sec
                        </button>
                        <button
                            onClick={handleReset}
                            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors text-xs sm:text-sm"
                        >
                            Sifirla
                        </button>
                        <div className="flex-1 min-w-0" />
                        <button
                            onClick={handleGenerate}
                            disabled={!allSelected || isOverKolonLimit}
                            className={`px-4 py-1.5 sm:px-6 sm:py-2 rounded font-medium text-xs sm:text-sm transition-colors ${!allSelected || isOverKolonLimit
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20'
                                }`}
                        >
                            Kolonlari Olustur ({allSelected ? kolonCount.toLocaleString('tr-TR') : '?'})
                        </button>
                    </div>

                    <div className="mt-4 no-print">
                        <SelectionSummary
                            matchCount={matchCount}
                            selectedCount={selectedCount}
                            kolonCount={kolonCount}
                            allSelected={allSelected}
                        />
                        {isOverKolonLimit && (
                            <div className="mt-4">
                                <UpgradePrompt 
                                    feature="kolon_generate"
                                    requiredTier={tier === 'free' ? 'pro' : 'premium'}
                                    message={`Tek seferde en fazla ${maxKolonLimit.toLocaleString('tr-TR')} kolon üretebilirsiniz (Şu an: ${kolonCount.toLocaleString('tr-TR')}). Limitinizi artırmak için aboneliğinizi yükseltin.`}
                                />
                            </div>
                        )}
                    </div>

                    <FilterPanel
                        filters={filters}
                        onChange={handleFiltersChange}
                        onReset={handleFiltersReset}
                        filteredCount={allKolonlar.length > 0 ? kolonlar.length : null}
                        totalCount={allKolonlar.length > 0 ? allKolonlar.length : null}
                    />

                    {genError && (
                        <div className="mt-4 bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
                            {genError}
                        </div>
                    )}

                    <div className="mt-4 flex justify-end px-2">
                        {kolonlar.length > 0 && !isDemo && (
                            <button
                                onClick={async () => {
                                    if (kolonlar.length > 5000) {
                                        if (!confirm(`${kolonlar.length} adet kuponu kaydetmek biraz zaman alabilir ve veritabanına yük bindirebilir. Devam etmek istiyor musunuz?`)) {
                                            return;
                                        }
                                    }
                                    
                                    try {
                                        // Convert Kolon[] to SystemKupon[] compatible format
                                        const systemKuponsForm = kolonlar.map(k => {
                                            const selections: Record<number, string[]> = {};
                                            k.predictions.forEach((o, idx) => {
                                                selections[idx + 1] = [o];
                                            });
                                            return {
                                                id: k.id.toString(),
                                                price: 10, // Single kolon price
                                                selections
                                            };
                                        });

                                        await couponsApi.saveCoupon('kayitli', program?.weekLabel || 'Kolon', systemKuponsForm);
                                        alert('Kolonlar başarıyla Kuponlarım (Kayıtlı) sekmesine eklendi!');
                                    } catch (err) {
                                        if (isHttpApiError(err) && err.status === 401) {
                                            return;
                                        }

                                        alert(err instanceof Error ? err.message : 'Kupon kaydedilirken bir hata oluştu.');
                                    }
                                }}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all hover:scale-105 flex items-center gap-2"
                            >
                                💾 Kuponları Kaydet
                            </button>
                        )}
                    </div>

                    <KolonOutput
                        kolonlar={kolonlar}
                        matches={effectiveMatches}
                        weekLabel={isDemo ? 'Deneme Modu' : program?.weekLabel || ''}
                        onImport={handleImport}
                        activeSequenceMatch={activeSequenceMatch}
                        activeSequenceOutcomes={activeSequenceOutcomes}
                        sequenceFilters={sequenceFilters}
                        onActiveSequenceMatchChange={handleActiveSequenceMatchChange}
                        onSequenceOutcomesChange={handleSequenceOutcomesChange}
                        onActiveSequenceFilterReset={handleActiveSequenceFilterReset}
                        onSequenceFilterRemove={handleSequenceFilterRemove}
                    />
                </>
            )}

            {selectedMatch && (
                <MatchDetailModal
                    match={selectedMatch}
                    onClose={() => setSelectedMatch(null)}
                />
            )}
            </div>

            {/* Dummy Right Sidebar to balance and center the table perfectly */}
            <div className="hidden xl:block" />
        </div>
    );
}
